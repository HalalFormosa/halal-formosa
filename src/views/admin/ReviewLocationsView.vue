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
              <ion-label>{{ $t('admin.review') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="archived">
              <ion-label>{{ $t('admin.archive') }}</ion-label>
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

      <!-- ✅ Location Detail Modal -->
      <ion-modal :is-open="showModal" @didDismiss="closeModal" class="review-modal">
        <ion-header>
          <ion-toolbar color="carrot">
            <ion-buttons slot="start">
              <ion-button @click="closeModal">
                <ion-icon :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>{{ $t('admin.reviewLocation') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="approveLocation(selectedLocation)">
                <ion-icon slot="start" :icon="checkmarkOutline" />
                {{ $t('review.approve') }}
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <div v-if="selectedLocation" class="form-container">
            <!-- 👤 Uploader Attribution -->
            <ion-item lines="none" class="uploader-info ion-margin-bottom">
              <ion-avatar slot="start">
                <img :src="selectedLocation.uploader?.avatar_url || 'https://placehold.co/100x100?text=👤'" />
              </ion-avatar>
              <ion-label>
                <p style="font-size: 12px; margin-bottom: 2px;">{{ $t('review.uploadedBy') }}</p>
                <h3 style="font-weight: 600;">{{ selectedLocation.uploader?.display_name || $t('home.anonymous') }}</h3>
              </ion-label>
              <ion-badge slot="end" color="medium">{{ selectedLocation.uploader?.donor_type || $t('profile.donors.Free') }}</ion-badge>
            </ion-item>

            <ion-item-group>
              <!-- Name -->
              <ion-item>
                <ion-input
                    v-model="selectedLocation.name"
                    label-placement="floating"
                    :label="$t('admin.name')"
                ></ion-input>
              </ion-item>

              <!-- Category (Location Type) -->
              <ion-item>
                <ion-select
                    v-model="selectedLocation.location_type_id"
                    interface="popover"
                    :label="$t('explore.categories')"
                    label-placement="floating"
                >
                  <ion-select-option v-for="type in locationTypes" :key="type.id" :value="type.id">
                    {{ type.name }}
                  </ion-select-option>
                </ion-select>
              </ion-item>

              <!-- Address -->
              <ion-item>
                <ion-input
                    v-model="selectedLocation.address"
                    label-placement="floating"
                    :label="$t('admin.address')"
                ></ion-input>
              </ion-item>

              <!-- Pinpoint (Lat/Lng) -->
              <div class="coordinates-row">
                <ion-item style="flex: 1">
                  <ion-input
                      v-model.number="selectedLocation.lat"
                      type="number"
                      label-placement="floating"
                      :label="$t('admin.latitude')"
                  ></ion-input>
                </ion-item>
                <ion-item style="flex: 1">
                  <ion-input
                      v-model.number="selectedLocation.lng"
                      type="number"
                      label-placement="floating"
                      :label="$t('admin.longitude')"
                  ></ion-input>
                </ion-item>
              </div>

              <!-- Map Preview -->
              <div class="map-preview-container ion-margin-vertical">
                <iframe
                    v-if="selectedLocation.lat && selectedLocation.lng"
                    width="100%"
                    height="180"
                    style="border:0; border-radius: 12px;"
                    loading="lazy"
                    allowfullscreen
                    :src="`https://maps.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}&z=16&output=embed`"
                ></iframe>
              </div>

              <!-- Description -->
              <ion-item>
                <ion-textarea
                    v-model="selectedLocation.description"
                    label-placement="floating"
                    :label="$t('admin.description')"
                    auto-grow
                ></ion-textarea>
              </ion-item>

              <!-- Contact Info -->
              <ion-item>
                <ion-icon :icon="callOutline" slot="start" size="small" />
                <ion-input
                    v-model="selectedLocation.phone"
                    label-placement="floating"
                    :label="$t('explore.details.phone')"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-icon :icon="logoInstagram" slot="start" size="small" />
                <ion-input
                    v-model="selectedLocation.instagram"
                    label-placement="floating"
                    :label="$t('addPlace.instagramLabel')"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-icon :icon="chatboxEllipsesOutline" slot="start" size="small" />
                <ion-input
                    v-model="selectedLocation.line_id"
                    label-placement="floating"
                    :label="$t('addPlace.lineIdLabel')"
                ></ion-input>
              </ion-item>

              <!-- Price Range -->
              <ion-item>
                <ion-icon :icon="cashOutline" slot="start" size="small" />
                <ion-select
                    v-model="selectedLocation.price_range"
                    interface="popover"
                    :label="$t('explore.filters.priceRange')"
                    label-placement="floating"
                >
                  <ion-select-option value="$">{{ $t('addPlace.priceLevels.low') }}</ion-select-option>
                  <ion-select-option value="$$">{{ $t('addPlace.priceLevels.medium') }}</ion-select-option>
                  <ion-select-option value="$$$">{{ $t('addPlace.priceLevels.high') }}</ion-select-option>
                </ion-select>
              </ion-item>

              <!-- Image Section -->
              <div class="ion-margin-top ion-padding-horizontal">
                <ion-label><strong>{{ $t('admin.locationImage') }}</strong></ion-label>
                <div class="img-preview-container ion-margin-top">
                  <div class="img-preview-box">
                    <img :src="imagePreviewUrl || 'https://placehold.co/300x200?text=No+Image'" />
                  </div>
                  <div class="img-controls">
                    <ion-button size="small" fill="clear" @click="takePicture">
                      <ion-icon slot="icon-only" :icon="cameraOutline" />
                    </ion-button>
                    <ion-button size="small" fill="clear" @click="uploadFromGallery">
                      <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
                    </ion-button>
                  </div>
                </div>
              </div>

            </ion-item-group>

            <div class="ion-padding-top ion-margin-top" style="border-top: 1px solid var(--ion-color-step-150); display: flex; gap: 8px;">
              <ion-button v-if="viewMode === 'pending'" @click="archiveLocation(selectedLocation.id)" color="warning" style="flex: 1;">
                <ion-icon slot="start" :icon="trashOutline" />
                {{ $t('admin.archive') }}
              </ion-button>
              <ion-button v-else @click="restoreLocation(selectedLocation.id)" color="success" style="flex: 1;">
                <ion-icon slot="start" :icon="swapVerticalOutline" />
                {{ $t('admin.restore') }}
              </ion-button>
              <ion-button @click="rejectLocation(selectedLocation.id)" color="danger" fill="outline" style="flex: 1;">
                <ion-icon slot="start" :icon="trashOutline" />
                {{ $t('admin.reject') }}
              </ion-button>
            </div>
          </div>
        </ion-content>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonList,
  IonItem, IonThumbnail, IonLabel, IonText,
  IonModal, IonToolbar, IonTitle, IonButtons, IonAvatar, IonBadge, IonItemGroup,
  IonButton, IonInput, IonTextarea, IonSkeletonText, IonSelect, IonSelectOption,
  IonSearchbar, IonSegment, IonSegmentButton, IonPopover, IonIcon
} from '@ionic/vue'

import { ref, onMounted, reactive, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import {
  listOutline, timeOutline, checkmarkCircle, swapVerticalOutline,
  closeOutline, checkmarkOutline, cameraOutline, cloudUploadOutline,
  trashOutline, callOutline, logoInstagram, chatboxEllipsesOutline,
  cashOutline, locationOutline, shieldCheckmarkOutline, sparkles
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { useI18n } from 'vue-i18n'
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera'
import { useImageResizer } from "@/composables/useImageResizer"

const { t } = useI18n()

const pendingLocations = ref<any[]>([])
const loadingLocations = ref(true)
const showModal = ref(false)
const selectedLocation = ref<any | null>(null)
const locationTypes = ref<{ id: number, name: string }[]>([])
const isUnmounted = ref(false)
const { resizeImage } = useImageResizer()

// Image states
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)

const searchQuery = ref('')
const viewMode = ref<'pending' | 'archived'>('pending')
const sortBy = ref<'recent' | 'alpha'>('recent')

import { onUnmounted } from 'vue'
onUnmounted(() => {
  isUnmounted.value = true
})

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

async function loadLocationTypes() {
  const { data, error } = await supabase.from('location_types').select('id, name')
  if (!error && data) locationTypes.value = data
}

async function loadPendingLocations() {
  loadingLocations.value = true

  const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('*')
      .or('approved.eq.false,is_archived.eq.true')
      .order('created_at', { ascending: false })

  if (locError) {
    console.error("❌ Error fetching pending locations:", locError)
    loadingLocations.value = false
    return
  }

  if (locations && locations.length > 0) {
    const uploaderIds = [...new Set(locations.map(l => l.created_by).filter(Boolean))]

    if (uploaderIds.length > 0) {
      const { data: profiles, error: profError } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url, donor_type')
          .in('id', uploaderIds)

      if (!profError && profiles) {
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
        pendingLocations.value = locations.map(l => ({
          ...l,
          uploader: profileMap[l.created_by] || null
        }))
      } else {
        pendingLocations.value = locations
      }
    } else {
      pendingLocations.value = locations
    }
  } else {
    pendingLocations.value = []
  }

  loadingLocations.value = false
}

function openLocationModal(loc: any) {
  selectedLocation.value = reactive({ ...loc })
  imageFile.value = null
  imagePreviewUrl.value = loc.image
  showModal.value = true
}

function closeModal() {
  selectedLocation.value = null
  imageFile.value = null
  imagePreviewUrl.value = null
  showModal.value = false
}

async function takePicture() {
  if (isUnmounted.value) return
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear
    })
    imagePreviewUrl.value = image.webPath || null
    imageFile.value = await resizeImage(image.webPath || '')
  } catch (error) {
    console.error('Error taking photo:', error)
  }
}

function uploadFromGallery() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const file = target.files[0]
      const reader = new FileReader()
      reader.onload = async () => {
        imagePreviewUrl.value = reader.result as string
        imageFile.value = await resizeImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

async function approveLocation(loc: any) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return

  let imageUrl = loc.image

  // 1. Upload image if changed
  if (imageFile.value && loc.id) {
    const { error: uploadError } = await supabase.storage
        .from('location-images')
        .upload(`${loc.id}/main.jpg`, imageFile.value, { upsert: true })

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
          .from('location-images')
          .getPublicUrl(`${loc.id}/main.jpg`)
      imageUrl = publicUrl.publicUrl
    }
  }

  // 2. Update location
  const { error } = await supabase
      .from('locations')
      .update({
        name: loc.name,
        address: loc.address,
        description: loc.description,
        lat: loc.lat,
        lng: loc.lng,
        phone: loc.phone,
        instagram: loc.instagram,
        line_id: loc.line_id,
        price_range: loc.price_range,
        location_type_id: loc.location_type_id,
        image: imageUrl,
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', loc.id)

  if (!error) {
    await loadPendingLocations()
    closeModal()
  } else {
    console.error("❌ Error approving location:", error)
  }
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
  if (!confirm(t('admin.confirmDeletePlace'))) return
  
  await supabase
      .from('locations')
      .delete()
      .eq('id', id)

  await loadPendingLocations()
  closeModal()
}

onMounted(() => {
  loadLocationTypes()
  loadPendingLocations()
})
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

/* Review Modal Styles */
.review-modal {
  --width: 100%;
  --height: 100%;
}

.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.uploader-info {
  --background: var(--ion-color-step-50);
  border-radius: 12px;
  margin-bottom: 20px;
}

.coordinates-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.map-preview-container {
  overflow: hidden;
  border: 1px solid var(--ion-color-step-200);
  border-radius: 12px;
}

.img-preview-container {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--ion-background-color-step-100);
  border: 1px solid var(--ion-color-step-200);
}

.img-preview-box {
  width: 100%;
  aspect-ratio: 3 / 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.img-preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.img-controls ion-button {
  --color: var(--ion-color-dark);
}

@media (prefers-color-scheme: dark) {
  .img-controls {
    background: rgba(0, 0, 0, 0.6);
  }
  .img-controls ion-button {
    --color: white;
  }
}
</style>
