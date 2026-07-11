<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="emit('close')" 
    class="facility-review-modal"
  >
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ isUpdate ? $t('facilityReview.editTitle') : $t('facilityReview.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="emit('close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding modal-content">
      <div class="header-desc ion-text-center">
        <h3>{{ locationName }}</h3>
        <p>{{ $t('facilityReview.subtitle') }}</p>
      </div>

      <!-- 🕌 Facility checklist -->
      <div class="facility-section">
        <h4>{{ $t('facilityReview.checklistHeader') }}</h4>
        <ion-list lines="none" class="facility-list">
          <div 
            v-for="fac in MUSLIM_FACILITIES" 
            :key="fac.code" 
            v-show="fac.code !== 'qibla_direction' || isAccommodation"
            class="facility-item"
          >
            <div class="facility-info">
              <span class="facility-icon">{{ fac.icon }}</span>
              <span class="facility-label">{{ $t(fac.i18nKey) }}</span>
            </div>
            
            <div class="tri-state-selector">
              <button 
                type="button"
                class="tri-btn yes-btn"
                :class="{ active: facilitiesState[fac.code] === 'yes' }"
                @click="setFacility(fac.code, 'yes')"
              >
                {{ $t('facilityReview.triState.yes') }}
              </button>
              <button 
                type="button"
                class="tri-btn unsure-btn"
                :class="{ active: facilitiesState[fac.code] === 'unsure' }"
                @click="setFacility(fac.code, 'unsure')"
              >
                {{ $t('facilityReview.triState.unsure') }}
              </button>
              <button 
                type="button"
                class="tri-btn no-btn"
                :class="{ active: facilitiesState[fac.code] === 'no' }"
                @click="setFacility(fac.code, 'no')"
              >
                {{ $t('facilityReview.triState.no') }}
              </button>
            </div>
          </div>
        </ion-list>
      </div>

      <!-- ⭐ Star Rating (Optional) -->
      <div class="rating-section ion-margin-top">
        <h4>{{ $t('facilityReview.ratingHeader') }}</h4>
        <div class="star-container">
          <button
            v-for="star in 5"
            :key="star"
            type="button"
            class="star-btn"
            :class="{ active: star <= selectedRating }"
            @click="toggleRating(star)"
          >
            ★
          </button>
          <ion-button 
            v-if="selectedRating > 0" 
            fill="clear" 
            size="small" 
            color="medium" 
            @click="selectedRating = 0"
            class="clear-rating-btn"
          >
            {{ $t('common.clear') || 'Clear' }}
          </ion-button>
        </div>
      </div>

      <!-- 📝 Comment section -->
      <div class="comment-section ion-margin-top">
        <h4>{{ $t('facilityReview.commentHeader') }}</h4>
        <ion-textarea
          v-model="commentText"
          :placeholder="$t('facilityReview.commentPlaceholder')"
          :rows="3"
          class="custom-textarea"
        />
      </div>

      <!-- Submit button -->
      <ion-button
        expand="block"
        color="carrot"
        class="submit-btn ion-margin-top"
        :disabled="submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '...' : $t('facilityReview.submit') }}
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { 
  IonModal, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonButton, 
  IonIcon, 
  IonContent, 
  IonList,
  IonTextarea, 
  toastController 
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import { MUSLIM_FACILITIES } from '@/constants/muslimFacilities'
import { currentUser } from '@/composables/userProfile'
import type { TriState } from '@/types/LocationReview'
import { ActivityLogService } from '@/services/ActivityLogService'
import { usePoints } from '@/composables/usePoints'

const { awardAndCelebrate } = usePoints()

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    locationId: number
    locationName: string
    isAccommodation?: boolean
  }>(),
  {
    isAccommodation: false
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const { t } = useI18n()
const submitting = ref(false)
const isUpdate = ref(false)
const isOwnerOfLocation = ref(false)

const checkOwnership = async () => {
  if (!currentUser.value?.id || !props.locationId) {
    isOwnerOfLocation.value = false
    return
  }
  try {
    const { data, error } = await supabase
      .from('location_owners')
      .select('role')
      .eq('location_id', props.locationId)
      .eq('user_id', currentUser.value.id)
      .maybeSingle()
    
    isOwnerOfLocation.value = !error && !!data
  } catch (err) {
    console.warn('[FacilityReviewModal] Failed to check ownership', err)
    isOwnerOfLocation.value = false
  }
}

const selectedRating = ref(0)
const commentText = ref('')
const facilitiesState = ref<Record<string, TriState>>({})

// Initialize or reset facilities state
const resetForm = () => {
  selectedRating.value = 0
  commentText.value = ''
  facilitiesState.value = {}
  MUSLIM_FACILITIES.forEach(fac => {
    facilitiesState.value[fac.code] = 'unsure'
  })
}

// Fetch existing review for this user and location if exists
const loadExistingReview = async () => {
  if (!currentUser.value?.id || !props.locationId) {
    isUpdate.value = false
    resetForm()
    return
  }

  await checkOwnership()
  if (isOwnerOfLocation.value) {
    const toast = await toastController.create({
      message: t('business.reviews.ownerCannotReview') || 'Owners are not allowed to review their own business',
      duration: 3000,
      color: 'warning'
    })
    toast.present()
    emit('close')
    return
  }

  try {
    const { data, error } = await supabase
      .from('location_reviews')
      .select('*')
      .eq('location_id', props.locationId)
      .eq('user_id', currentUser.value.id)
      .maybeSingle()

    if (!error && data) {
      isUpdate.value = true
      selectedRating.value = data.rating || 0
      commentText.value = data.comment || ''
      
      const loadedFacilities = data.facilities || {}
      MUSLIM_FACILITIES.forEach(fac => {
        facilitiesState.value[fac.code] = loadedFacilities[fac.code] || 'unsure'
      })
    } else {
      isUpdate.value = false
      resetForm()
    }
  } catch (err) {
    console.warn('[FacilityReviewModal] Failed to load existing review', err)
    isUpdate.value = false
    resetForm()
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      loadExistingReview()
    }
  }
)

const setFacility = (code: string, val: TriState) => {
  facilitiesState.value[code] = val
}

const toggleRating = (star: number) => {
  if (selectedRating.value === star) {
    selectedRating.value = 0
  } else {
    selectedRating.value = star
  }
}

const handleSubmit = async () => {
  if (!currentUser.value?.id) {
    const toast = await toastController.create({
      message: t('common.loginRequired') || 'Please log in to submit a review',
      duration: 2000,
      color: 'warning'
    })
    toast.present()
    return
  }

  submitting.value = true
  
  const payload = {
    location_id: props.locationId,
    user_id: currentUser.value.id,
    rating: selectedRating.value > 0 ? selectedRating.value : null,
    comment: commentText.value.trim() || null,
    facilities: facilitiesState.value,
    updated_at: new Date().toISOString()
  }

  try {
    const { error } = await supabase
      .from('location_reviews')
      .upsert(payload, { onConflict: 'location_id,user_id' })

    if (error) throw error

    // Success! Update matching visit to reviewed = true
    try {
      await supabase
        .from('location_visits')
        .update({ reviewed: true })
        .eq('user_id', currentUser.value.id)
        .eq('location_id', props.locationId)
    } catch (visitErr) {
      console.warn('[FacilityReviewModal] Failed to update visit status', visitErr)
    }

    try {
      await ActivityLogService.log(isUpdate.value ? 'location_review_edit' : 'location_review_success', { id: props.locationId })
      if (!isUpdate.value) {
        await awardAndCelebrate('location_review')
      }
    } catch (logErr) {
      console.warn('[FacilityReviewModal] Failed to log activity/points', logErr)
    }

    const toast = await toastController.create({
      message: isUpdate.value ? `✅ ${t('store.reviewUpdated')}` : `✅ ${t('store.reviewSubmitted')}`,
      duration: 2000,
      color: 'success'
    })
    toast.present()

    emit('success')
    emit('close')
  } catch (err: any) {
    console.error('[FacilityReviewModal] Submit failed', err)
    const toast = await toastController.create({
      message: `❌ Error: ${err.message || 'Failed to submit review'}`,
      duration: 3000,
      color: 'danger'
    })
    toast.present()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.modal-content {
  background: var(--ion-background-color);
}

.header-desc h3 {
  margin-top: 0;
  margin-bottom: 6px;
  font-weight: 700;
  color: var(--ion-color-carrot);
}

.header-desc p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.facility-section h4,
.rating-section h4,
.comment-section h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-text-color);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.facility-list {
  background: transparent;
  padding: 0;
}

.facility-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--ion-text-color-rgb), 0.08);
}

.facility-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.facility-icon {
  font-size: 1.3rem;
}

.facility-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.tri-state-selector {
  display: flex;
  background: rgba(var(--ion-text-color-rgb), 0.05);
  border-radius: 8px;
  padding: 2px;
}

.tri-btn {
  background: transparent;
  border: none;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tri-btn.active {
  color: #ffffff;
}

.yes-btn.active {
  background: var(--ion-color-success, #2dd36f);
}

.no-btn.active {
  background: var(--ion-color-danger, #eb445a);
}

.unsure-btn.active {
  background: var(--ion-color-medium, #92949c);
}

.star-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.star-btn {
  background: transparent;
  border: none;
  font-size: 1.8rem;
  color: rgba(var(--ion-text-color-rgb), 0.15);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s ease;
}

.star-btn:active {
  transform: scale(1.2);
}

.star-btn.active {
  color: #ffc409;
}

.clear-rating-btn {
  font-size: 0.8rem;
  --padding-start: 8px;
  --padding-end: 8px;
}

.custom-textarea {
  --background: rgba(var(--ion-text-color-rgb), 0.05);
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
}

.submit-btn {
  --border-radius: 12px;
  height: 48px;
  font-weight: 600;
  font-size: 1rem;
}
</style>
