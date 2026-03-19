<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.locationsReview')"
          :icon="listOutline"
          :showBack="true"
          backRoute="/profile"
      />
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
      <ion-list v-else-if="pendingLocations.length">
        <ion-item
            v-for="loc in pendingLocations"
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

            <div style="margin-top:20px;display:flex;gap:12px;">
              <ion-button
                  expand="block"
                  color="success"
                  @click="approveLocation(selectedLocation)"
              >
                {{ $t('admin.approve') }}
              </ion-button>

              <ion-button
                  expand="block"
                  color="danger"
                  @click="rejectLocation(selectedLocation.id)"
              >
                {{ $t('admin.reject') }}
              </ion-button>
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
  IonButton, IonInput, IonTextarea, IonSkeletonText
} from '@ionic/vue'

import { ref, onMounted, reactive } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { listOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'

const pendingLocations = ref<any[]>([])
const loadingLocations = ref(true)
const showModal = ref(false)
const selectedLocation = ref<any | null>(null)

async function loadPendingLocations() {
  loadingLocations.value = true

  const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('approved', false)
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

async function rejectLocation(id: number) {
  await supabase
      .from('locations')
      .delete()
      .eq('id', id)

  await loadPendingLocations()
  closeModal()
}

onMounted(loadPendingLocations)
</script>