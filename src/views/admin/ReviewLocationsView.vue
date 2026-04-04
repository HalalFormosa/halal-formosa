<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.locationsReview')"
          :icon="listOutline"
          :showBack="true"
          backRoute="/profile"
      />
      <ion-toolbar class="actions-toolbar">
        <div class="header-main-actions">
          <ion-button fill="clear" class="classic-action-btn sort-btn-wrapper" id="sort-trigger">
            <ion-icon :icon="sortIcon" />
            <span class="btn-label">{{ sortLabel }}</span>
          </ion-button>

          <ion-popover trigger="sort-trigger" trigger-action="click" :dismiss-on-select="true" class="width-190">
            <ion-list lines="none">
              <ion-item button @click="sortBy = 'recent'">
                <ion-icon :icon="timeOutline" slot="start" />
                <ion-label>{{ $t('admin.sortRecent') }}</ion-label>
                <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
              
              <ion-item button @click="sortBy = 'alpha'">
                <ion-icon :icon="listOutline" slot="start" />
                <ion-label>{{ $t('admin.sortAlpha') }}</ion-label>
                <ion-icon v-if="sortBy === 'alpha'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
            </ion-list>
          </ion-popover>

          <ion-segment v-model="viewMode" mode="ios" style="width: 140px;">
            <ion-segment-button value="pending">
              <ion-label>Review</ion-label>
            </ion-segment-button>
            <ion-segment-button value="archived">
              <ion-label>Archive</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </ion-toolbar>

      <ion-toolbar class="search-row-toolbar">
        <div class="search-container">
          <ion-searchbar
              v-model="searchQuery"
              :placeholder="$t('explore.placeholder')"
              :debounce="500"
              class="compact-searchbar"
              :animated="true"
          />
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Skeleton -->
      <div v-if="loadingLocations">
        <ion-list>
          <ion-item v-for="n in 5" :key="n">
            <ion-thumbnail slot="start">
              <ion-skeleton-text animated style="width:64px;height:64px;border-radius:8px;" />
            </ion-thumbnail>
            <ion-label>
              <h2>
                <ion-skeleton-text animated style="width:60%;height:16px;" />
              </h2>
              <p>
                <ion-skeleton-text animated style="width:40%;height:14px;" />
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Pending Locations -->
      <ion-list v-else-if="filteredLocations.length">
        <ion-item
            v-for="loc in filteredLocations"
            :key="loc.id"
            button
            detail
            @click="openLocationModal(loc)"
        >
          <ion-thumbnail slot="start">
            <img :src="loc.image" :alt="$t('admin.locationImage')" />
          </ion-thumbnail>

          <ion-label>
            <h2>{{ loc.name }}</h2>
            <p>{{ loc.address }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- Empty -->
      <ion-text v-else color="medium">
        {{ $t('admin.noPendingLocations') }}
      </ion-text>

      <!-- Modal -->
      <ion-modal :is-open="showModal" @didDismiss="closeModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('admin.reviewLocation') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeModal">{{ $t('admin.close') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <ion-list v-if="selectedLocation">

            <ion-item>
              <ion-label position="stacked">{{ $t('admin.name') }}</ion-label>
              <ion-input v-model="selectedLocation.name" />
            </ion-item>

            <ion-item>
              <ion-label position="stacked">{{ $t('admin.address') }}</ion-label>
              <ion-input v-model="selectedLocation.address" />
            </ion-item>

            <ion-item>
              <ion-label position="stacked">{{ $t('admin.description') }}</ion-label>
              <ion-textarea v-model="selectedLocation.description" auto-grow />
            </ion-item>

            <div class="ion-margin-top">
              <img
                  :src="selectedLocation.image"
                  style="width:100%;border-radius:12px"
              />
            </div>

            <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;">
              <ion-button
                  expand="block"
                  color="success"
                  @click="approveLocation(selectedLocation)"
              >
                {{ $t('admin.approve') }}
              </ion-button>

              <div style="display:flex;gap:12px;">
                <ion-button
                    v-if="viewMode === 'pending'"
                    style="flex:1"
                    color="medium"
                    @click="archiveLocation(selectedLocation.id)"
                >
                  {{ $t('admin.archive') }}
                </ion-button>
                <ion-button
                    v-else
                    style="flex:1"
                    color="primary"
                    @click="restoreLocation(selectedLocation.id)"
                >
                  {{ $t('admin.restore') || 'Restore' }}
                </ion-button>

                <ion-button
                    style="flex:1"
                    color="danger"
                    @click="rejectLocation(selectedLocation.id)"
                >
                  {{ $t('admin.reject') }}
                </ion-button>
              </div>
            </div>

          </ion-list>
        </ion-content>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonList,
  IonItem, IonThumbnail, IonLabel, IonText,
  IonModal, IonToolbar, IonTitle, IonButtons,
  IonButton, IonInput, IonTextarea, IonSkeletonText,
  IonSearchbar, IonSegment, IonSegmentButton, IonPopover, IonIcon
} from '@ionic/vue'

import { ref, onMounted, reactive, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { listOutline, funnelOutline, timeOutline, checkmarkCircle, swapVerticalOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const pendingLocations = ref<any[]>([])
const loadingLocations = ref(true)
const showModal = ref(false)
const selectedLocation = ref<any | null>(null)

const searchQuery = ref('')
const viewMode = ref<'pending' | 'archived'>('pending')
const sortBy = ref<'recent' | 'alpha'>('recent')

const sortIcon = computed(() => {
  return sortBy.value === 'recent' ? timeOutline : listOutline
})

const sortLabel = computed(() => {
  return sortBy.value === 'recent' ? t('admin.sortRecent') : t('admin.sortAlpha')
})

const filteredLocations = computed(() => {
  let result = [...pendingLocations.value]

  // View Mode Filter
  if (viewMode.value === 'pending') {
    result = result.filter(loc => !loc.approved && !loc.is_archived)
  } else {
    result = result.filter(loc => loc.is_archived)
  }

  // Search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(loc => 
      loc.name?.toLowerCase().includes(q) || 
      loc.address?.toLowerCase().includes(q)
    )
  }

  // Sort
  if (sortBy.value === 'alpha') {
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else {
    // recent - pendingLocations is already sorted by created_at DESC from supabase
    // but we resort here if search/filter made it messy or to be safe
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return result
})

async function loadPendingLocations() {
  loadingLocations.value = true

  const { data } = await supabase
      .from('locations')
      .select('*')
      .or('approved.eq.false,is_archived.eq.true')
      .order('created_at', { ascending: false })

  pendingLocations.value = data || []
  loadingLocations.value = false
}

function openLocationModal(loc: any) {
  selectedLocation.value = reactive({ ...loc })
  showModal.value = true
}

function closeModal() {
  selectedLocation.value = null
  showModal.value = false
}

async function approveLocation(loc: any) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return

  await supabase
      .from('locations')
      .update({
        name: loc.name,
        address: loc.address,
        description: loc.description,
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', loc.id)

  await loadPendingLocations()
  closeModal()
}

async function archiveLocation(id: number) {
  if (!confirm(t('admin.confirmArchive'))) return

  await supabase
      .from('locations')
      .update({ is_archived: true })
      .eq('id', id)

  await loadPendingLocations()
  closeModal()
}

async function restoreLocation(id: number) {
  if (!confirm(t('admin.confirmRestore'))) return

  await supabase
      .from('locations')
      .update({ is_archived: false })
      .eq('id', id)

  await loadPendingLocations()
  closeModal()
}

async function rejectLocation(id: number) {
  if (!confirm("Are you sure you want to delete/reject this location permanently?")) return
  
  await supabase
      .from('locations')
      .delete()
      .eq('id', id)

  await loadPendingLocations()
  closeModal()
}

onMounted(loadPendingLocations)
</script>
<style scoped>
/* Consolidated Search Header Styles from SearchView.vue */
.header-main-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  width: 100%;
}

.classic-action-btn {
  height: 50px;
  margin: 0;
  --color: var(--ion-color-dark);
  position: relative;
  font-weight: 700;
  text-transform: none;
}

.classic-action-btn ion-icon {
  font-size: 22px;
}

.sort-btn-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-label {
  margin-left: 4px;
  font-size: 13px;
}

.search-container {
  padding: 0 16px 12px;
}



.search-row-toolbar {
  --min-height: auto;
}

.actions-toolbar,
.search-row-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
}

.width-190 {
  --width: 190px;
}

ion-header {
  border-bottom: none !important;
  box-shadow: none !important;
}

/* Force neutral text color in toolbar controls */
.actions-toolbar ion-button,
.actions-toolbar ion-icon {
  color: var(--ion-color-dark);
}
</style>
