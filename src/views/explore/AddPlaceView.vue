<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="isEditing ? $t('addPlace.editTitle') : $t('addPlace.title')"
          :icon="locationOutline"
          show-back
          :useRouterBack="false"
          @back="handleBack"
      />

      <!-- 🟢 Step Indicator -->
      <div v-if="!isEditing" id="step-indicator">
        <div class="step-item" :class="{ active: currentStep >= 0 }">
          <div class="step-dot">
            <ion-icon :icon="locationOutline" v-if="currentStep <= 0" />
            <ion-icon :icon="checkmarkCircle" v-else />
          </div>
          <span class="step-label">Location</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 1 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 1 }">
          <div class="step-dot">
            <ion-icon :icon="cameraOutline" v-if="currentStep <= 1" />
            <ion-icon :icon="checkmarkCircle" v-else />
          </div>
          <span class="step-label">Photos</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 2 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 2 }">
          <div class="step-dot">
            <ion-icon :icon="sparklesOutline" v-if="currentStep <= 2" />
            <ion-icon :icon="checkmarkCircle" v-else />
          </div>
          <span class="step-label">Details</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 3 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 3 }">
          <div class="step-dot">
            <ion-icon :icon="checkmarkCircle" />
          </div>
          <span class="step-label">Done</span>
        </div>
      </div>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Limit Reached Block Card -->
      <div v-if="limitReached && !isEditing" class="limit-reached-container animate__animated animate__fadeIn" style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 350px;">
        <ion-card style="margin: 0; box-shadow: none; border: 1px solid var(--ion-color-light); border-radius: 12px; text-align: center; max-width: 400px; width: 100%;" class="ion-padding">
          <div class="lock-icon-wrapper" style="margin: 16px auto;">
            <ion-icon :icon="lockClosedOutline" style="font-size: 56px; color: var(--ion-color-carrot);" />
          </div>
          <h2 style="font-weight: 700; font-size: 1.35rem; margin-top: 0; margin-bottom: 12px;">Daily Limit Reached</h2>
          <p style="color: var(--ion-color-medium); line-height: 1.5; font-size: 0.95rem; margin-bottom: 24px; padding: 0 8px;">
            You have reached your daily limit of 3 contributed locations.
          </p>

          <div v-if="pendingApplicationExists">
            <div style="background: var(--ion-color-light); border-radius: 8px; padding: 12px; margin-bottom: 24px; text-align: left;">
              <span style="font-size: 13px; color: var(--ion-color-dark); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                ⏳ Application Pending Review
              </span>
              <p style="font-size: 12px; color: var(--ion-color-medium); margin-top: 4px; margin-bottom: 0; line-height: 1.4;">
                We are currently reviewing your application to become a Dedicated Contributor. We will notify you once approved!
              </p>
            </div>
            <ion-button expand="block" color="carrot" @click="router.back()">
              Go Back
            </ion-button>
          </div>

          <div v-else-if="!applicationSubmitted">
            <div v-if="!applying">
              <p style="color: var(--ion-color-medium); line-height: 1.4; font-size: 0.85rem; margin-bottom: 20px; padding: 0 8px; font-style: italic;">
                Want to contribute more locations to help the community? Apply to become a Dedicated Contributor!
              </p>
              
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <ion-button expand="block" color="carrot" @click="applying = true">
                  Apply to be a Dedicated Contributor
                </ion-button>
                <ion-button expand="block" fill="clear" color="medium" @click="router.back()">
                  Go Back
                </ion-button>
              </div>
            </div>
            
            <div v-else class="ion-text-start ion-padding-top">
              <ion-item lines="none" style="--background: transparent; margin-bottom: 12px;">
                <ion-textarea
                  v-model="applicationReason"
                  label="Why do you want to contribute more locations?"
                  label-placement="stacked"
                  placeholder="Tell us why you want to help the community (e.g. 'I want to add Halal places in my city' or 'I travel a lot around Taiwan and find many mosques/restaurants')."
                  rows="4"
                  required
                  style="border: 1px solid var(--ion-color-light); border-radius: 8px; padding: 8px; font-size: 14px;"
                />
              </ion-item>
              
              <div style="display: flex; gap: 8px; padding: 0 8px;">
                <ion-button style="flex: 1;" color="carrot" :disabled="applicationLoading || !applicationReason.trim()" @click="submitApplication">
                  <ion-spinner v-if="applicationLoading" name="crescent" style="zoom: 0.6; margin-right: 8px;" />
                  Submit
                </ion-button>
                <ion-button style="flex: 1;" fill="outline" color="medium" @click="applying = false">
                  Cancel
                </ion-button>
              </div>
            </div>
          </div>
          
          <div v-else>
            <p style="color: var(--ion-color-success); font-weight: 600; font-size: 1rem; margin-bottom: 12px;">
              ✅ Application Submitted!
            </p>
            <p style="color: var(--ion-color-medium); line-height: 1.5; font-size: 0.90rem; margin-bottom: 24px; padding: 0 8px;">
              Thank you! We will review your application to become a Dedicated Contributor and update your status soon.
            </p>
            <ion-button expand="block" color="carrot" @click="router.back()">
              Go Back
            </ion-button>
          </div>
        </ion-card>
      </div>

      <div v-else>
        <!-- Not logged in -->
      <ion-card v-if="checkedRole && !myRole">
        <ion-card-content>
          {{ $t('addPlace.loginToSubmit') }}
        </ion-card-content>
      </ion-card>

      <!-- Logged in -->
      <form v-else @submit.prevent="submitPlace" class="form">
        <div class="form-container">

          <!-- 🏷️ STEP 1: IDENTITY & MAP -->
          <div v-show="currentStep === STEP_IDENTITY">
            <div class="form-section">
              <ion-list-header>
                <ion-label>{{ $t('addPlace.nameLabel') }} & {{ $t('addPlace.typeLabel') }}</ion-label>
              </ion-list-header>

              <ion-card class="input-card" style="overflow: visible;">
                <ion-item lines="full">
                  <ion-input
                      v-model="form.name"
                      label-placement="stacked"
                      required
                      :placeholder="$t('addPlace.namePlaceholder')"
                  >
                    <div slot="label">
                      {{ $t('addPlace.nameLabel') }}
                      <ion-text color="danger">*</ion-text>
                    </div>
                  </ion-input>
                </ion-item>

                <ion-item lines="none">
                  <ion-input
                      :value="selectedTypeName"
                      label-placement="stacked"
                      readonly
                      required
                      :placeholder="$t('addPlace.typePlaceholder')"
                      @click="showTypeModal = true"
                      style="cursor: pointer;"
                  >
                    <div slot="label">
                      {{ $t('addPlace.typeLabel') }}
                      <ion-text color="danger">*</ion-text>
                    </div>
                    <ion-icon :icon="chevronForwardOutline" slot="end" color="medium" style="margin-top: 10px; margin-right: 0;" />
                  </ion-input>
                </ion-item>
              </ion-card>
            </div>

            <div class="form-section">
              <ion-list-header>
                <ion-label>{{ $t('addPlace.addressLabel') }}</ion-label>
              </ion-list-header>

              <ion-card class="input-card">
                <ion-item lines="none">
                  <ion-textarea
                      v-model="form.address"
                      label-placement="stacked"
                      :placeholder="$t('addPlace.addressPlaceholder')"
                      required
                      :rows="4"
                      @ionBlur="onAddressConfirm"
                  >
                    <div slot="label">
                      {{ $t('addPlace.addressLabel') }}
                      <ion-text color="danger">*</ion-text>
                    </div>
                  </ion-textarea>
                </ion-item>
              </ion-card>

              <div class="map-wrap ion-padding-horizontal">
                <div class="hint">{{ $t('addPlace.mapHint') }}</div>
                <div class="map-holder">
                  <div id="add-map" :class="{'fade-in': mapReady}"></div>
                  <ion-skeleton-text v-if="mapLoading" animated class="map-skeleton" />
                </div>
              </div>
            </div>

            <ion-button 
              expand="block" 
              color="carrot" 
              style="height: 52px; font-weight: 700; --border-radius: 12px;" 
              @click="currentStep = STEP_PHOTOS"
              :disabled="!form.name || !form.type_id || !form.address"
            >
              Continue to Photos
              <ion-icon slot="end" :icon="chevronForwardOutline" />
            </ion-button>
          </div>

          <!-- 📸 STEP 2: PHOTOS -->
          <div v-show="currentStep === STEP_PHOTOS">
             <div class="form-section">
              <ion-list-header>
                <ion-label>{{ $t('addPlace.imageLabel') }}</ion-label>
              </ion-list-header>

              <div class="ion-text-center ion-padding-vertical">
                <p style="color: var(--ion-color-medium); font-size: 14px;">
                  Provide a clear photo of the place's storefront or interior.
                </p>
              </div>

              <ion-card class="input-card">
                <div class="photo-selection-grid ion-padding">
                  <ion-button @click="takePicture" fill="outline" color="carrot" class="photo-btn" :disabled="uploading">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                      <ion-icon :icon="cameraOutline" style="font-size: 32px;" />
                      <span>{{ $t('addProduct.camera') }}</span>
                    </div>
                  </ion-button>
                  <ion-button @click="uploadFromGallery" fill="outline" color="carrot" class="photo-btn" :disabled="uploading">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                      <ion-icon :icon="cloudUploadOutline" style="font-size: 32px;" />
                      <span>{{ $t('addProduct.gallery') }}</span>
                    </div>
                  </ion-button>
                </div>

                <!-- Preview -->
                <div v-if="imagePreview" class="img-preview-wrap ion-padding-bottom">
                  <img :src="imagePreview" alt="Preview" class="img-preview rounded-xl shadow-md"/>
                </div>
              </ion-card>
            </div>

            <ion-button 
              expand="block" 
              color="carrot" 
              style="height: 52px; font-weight: 700; --border-radius: 12px;" 
              @click="currentStep = STEP_DETAILS"
              :disabled="!imagePreview && !form.image"
            >
              Final Details
              <ion-icon slot="end" :icon="chevronForwardOutline" />
            </ion-button>
          </div>

          <!-- ✨ STEP 3: OPTIONAL DETAILS -->
          <div v-show="currentStep === STEP_DETAILS">
            <div class="ion-text-center ion-padding-vertical">
               <p style="color: var(--ion-color-medium); font-size: 14px;">
                 Almost done! Add any extra information like contact details or opening hours.
               </p>
            </div>

            <!-- ⚠️ Duplicate Warning Card -->
            <ion-card
                v-if="warningLevel"
                :color="warningLevel === 'high' ? 'danger' : 'warning'"
                class="input-card ion-margin-bottom duplicate-warning"
            >
              <ion-card-content style="padding: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                  <div
                    style="flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"
                    :style="{ background: warningLevel === 'high' ? 'var(--ion-color-danger-tint)' : 'var(--ion-color-warning-tint)' }"
                  >
                    <ion-icon
                      :icon="warningLevel === 'high' ? alertCircleOutline : warningOutline"
                      style="font-size: 24px;"
                      :style="{ color: warningLevel === 'high' ? 'var(--ion-color-danger)' : 'var(--ion-color-warning-shade)' }"
                    />
                  </div>
                  <div style="flex: 1;">
                    <div
                      style="font-weight: 700; font-size: 16px; margin-bottom: 6px;"
                      :style="{ color: warningLevel === 'high' ? 'var(--ion-color-danger)' : 'var(--ion-color-warning-contrast)' }"
                    >
                      {{ warningLevel === 'high' ? 'Potential Duplicate Found!' : 'Similar Place Nearby' }}
                    </div>
                    <p
                      style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;"
                      :style="{ color: warningLevel === 'high' ? 'var(--ion-color-danger-contrast)' : 'var(--ion-color-warning-contrast)' }"
                    >
                      {{ warningLevel === 'high'
                        ? 'This location appears to already exist in our database. Please check if it\'s the same place before adding.'
                        : 'There may be a similar place nearby. Please verify before adding.'
                      }}
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      <div
                        v-for="m in nearbyMatches.slice(0, 3)"
                        :key="m.id"
                        style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; font-size: 14px;"
                        :style="{ background: warningLevel === 'high' ? 'rgba(var(--ion-color-danger-rgb), 0.15)' : 'rgba(var(--ion-color-warning-rgb), 0.15)' }"
                      >
                        <ion-icon :icon="locationOutline" size="small" />
                        <span style="flex: 1; font-weight: 600;">{{ m.name }}</span>
                        <span
                          style="font-size: 12px; padding: 2px 8px; border-radius: 12px;"
                          :style="{ background: warningLevel === 'high' ? 'var(--ion-color-danger)' : 'var(--ion-color-warning-shade)', color: 'white' }"
                        >
                          {{ m.distance_meters < 1000 ? m.distance_meters + 'm' : (m.distance_meters / 1000).toFixed(1) + 'km' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- 📝 Section: Description -->
            <div class="form-section">
              <ion-list-header><ion-label>{{ $t('admin.description') }}</ion-label></ion-list-header>
              <ion-card class="input-card">
                <ion-item lines="none">
                  <ion-textarea
                      v-model="form.description"
                      :label="$t('admin.description')"
                      label-placement="stacked"
                      :placeholder="$t('addPlace.descriptionPlaceholder')"
                      auto-grow
                      :maxlength="1000"
                      counter
                  />
                </ion-item>
              </ion-card>
            </div>

            <!-- 📞 Section: Contact Info -->
            <div class="form-section">
              <ion-list-header><ion-label>{{ $t('addPlace.contactInfo') }}</ion-label></ion-list-header>
              <ion-card class="input-card">
                <ion-item lines="full">
                  <ion-input v-model="form.phone" :label="$t('addPlace.phoneLabel')" label-placement="stacked" :placeholder="$t('addPlace.phonePlaceholder')" />
                </ion-item>
                <ion-item lines="full">
                  <ion-input v-model="form.instagram" :label="$t('addPlace.instagramLabel')" label-placement="stacked" placeholder="@username" />
                </ion-item>
                <ion-item lines="none">
                  <ion-input v-model="form.line_id" :label="$t('addPlace.lineIdLabel')" label-placement="stacked" placeholder="yourlineid" />
                </ion-item>
              </ion-card>
            </div>

            <!-- 💰 Section: Tags -->
            <div class="form-section">
              <ion-list-header><ion-label>{{ $t('addPlace.tagsAndCategories') }}</ion-label></ion-list-header>
              <ion-card class="input-card">
                <ion-item lines="none">
                  <ion-input
                      v-model="tagInput"
                      :label="$t('addPlace.addTagLabel')"
                      label-placement="stacked"
                      :placeholder="$t('addPlace.tagPlaceholder')"
                      @ionInput="handleTagInput"
                      @keyup.enter="addTag"
                  />
                  <ion-button slot="end" fill="clear" @click="addTag" style="margin-top: 14px;">
                    {{ $t('common.add') }}
                  </ion-button>
                </ion-item>
                <div v-if="form.tags.length > 0" class="tag-chips">
                  <ion-chip v-for="tag in form.tags" :key="tag" color="primary" outline class="tag-chip">
                    <ion-label>{{ tag }}</ion-label>
                    <ion-icon :icon="closeCircle" @click="removeTag(tag)" />
                  </ion-chip>
                </div>
              </ion-card>
            </div>

            <!-- ⏰ Section: Opening Hours -->
            <div class="form-section">
              <ion-list-header><ion-label>{{ $t('addPlace.openingHours') }}</ion-label></ion-list-header>
              <ion-card class="input-card">
                <ion-list class="opening-hours-list" lines="none">
                  <template v-for="(label, key) in dayLabels" :key="key">
                    <ion-item class="opening-hours-item" lines="full">
                      <ion-checkbox v-model="form.opening_hours[key].active" slot="start" @ionChange="openingHoursTouched = true" />
                      <ion-label class="day-label">{{ $t('addPlace.days.' + key) }}</ion-label>
                      <span v-if="!form.opening_hours[key].active" class="closed-label">{{ $t('addPlace.closed') }}</span>
                      <div v-else class="time-inputs">
                        <ion-input v-model="form.opening_hours[key].open" type="time" class="time-field" />
                        <span style="margin: 0 4px;">-</span>
                        <ion-input v-model="form.opening_hours[key].close" type="time" class="time-field" />
                      </div>
                    </ion-item>
                  </template>
                </ion-list>
              </ion-card>
            </div>

            <!-- 🛠️ Section: Admin Controls -->
            <div v-if="myRole === 'admin'" class="form-section">
              <ion-list-header><ion-label>{{ $t('admin.controls') }}</ion-label></ion-list-header>
              <ion-card class="input-card">
                <ion-item lines="none">
                  <ion-icon :icon="checkmarkCircleOutline" slot="start" color="success" />
                  <ion-label>{{ $t('admin.master.published') }}</ion-label>
                  <ion-toggle
                      slot="end"
                      :checked="form.approved"
                      @ionChange="form.approved = $event.detail.checked"
                  />
                </ion-item>
              </ion-card>
            </div>

            <div class="ion-padding-top">
              <ion-button 
                expand="block" 
                color="carrot" 
                style="height: 56px; font-weight: 700; --border-radius: 12px;" 
                @click="submitPlace"
                :disabled="submitting || uploading || !isValid"
              >
                <ion-spinner v-if="submitting" name="crescent" slot="start" />
                <span v-else>{{ isEditing ? $t('addPlace.updateBtn') : $t('addPlace.saveBtn') }}</span>
              </ion-button>
            </div>
          </div>
        </div>
      </form>

      <!-- 🏷️ Category Selection Modal -->
      <ion-modal :is-open="showTypeModal" @didDismiss="showTypeModal = false" style="--height: 70%; --border-radius: 16px;">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('addPlace.typeLabel') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showTypeModal = false">{{ $t('common.close') || 'Close' }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar
              v-model="modalSearchQuery"
              :placeholder="$t('addPlace.typePlaceholder')"
              animated
            />
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-list lines="full">
            <ion-item
              v-for="lt in filteredModalLocationTypes"
              :key="lt.id"
              button
              @click="selectModalLocationType(lt)"
            >
              <ion-label>{{ lt.name }}</ion-label>
              <ion-icon
                v-if="form.type_id === lt.id"
                :icon="checkmarkCircle"
                slot="end"
                color="success"
              />
            </ion-item>
            <ion-item v-if="filteredModalLocationTypes.length === 0" lines="none">
              <ion-label class="ion-text-center" color="medium">No types found</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>

      <!-- Review Notice for non-privileged users -->
      <div v-if="checkedRole && myRole && !isPrivileged(myRole) && currentStep === STEP_DETAILS" class="ion-padding-horizontal">
        <ion-card
            color="light"
            class="ion-margin-bottom"
            style="border-radius: 12px; margin-top: 0;"
        >
          <ion-card-content style="font-size:13px; color: var(--ion-color-medium);">
            🕵️ {{ $t('addPlace.reviewNotice') }}
          </ion-card-content>
        </ion-card>
      </div>

      <ion-toast
          :is-open="toast.open"
          :message="toast.message"
          :color="toast.color"
          :duration="2200"
          @didDismiss="toast.open = false"
      />

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonToast,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonLabel,
  IonIcon,
  IonSkeletonText,
  IonCheckbox,
  IonList,
  IonText,
    IonTextarea,
    IonChip,
    IonToggle,
    IonListHeader,
    IonModal,
    IonSearchbar,
    onIonViewWillEnter
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import {ref, onMounted, onBeforeUnmount, computed} from 'vue'
import {useRouter} from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import mapsLoader from '@/plugins/googleMapsLoader'
import {Camera, CameraResultType, CameraSource} from '@capacitor/camera'
import {
    cameraOutline,
    cloudUploadOutline,
    closeCircle,
    checkmarkCircleOutline,
    arrowDownOutline,
    arrowUpOutline,
    locationOutline,
    chevronForwardOutline,
    chevronBackOutline,
    sparklesOutline,
    shieldCheckmarkOutline,
    checkmarkCircle,
    barcodeOutline,
    addCircleOutline,
    alertCircleOutline,
    warningOutline,
    lockClosedOutline
} from 'ionicons/icons'
import {Capacitor} from '@capacitor/core'
import {Geolocation} from '@capacitor/geolocation'
import {usePoints} from "@/composables/usePoints";
import {useNotifier} from "@/composables/useNotifier"
import {watch} from 'vue'
import {useRoute} from 'vue-router'
import {ActivityLogService} from "@/services/ActivityLogService";
import { awardScanBonus, isContributionLimitReached } from '@/composables/useScanQuotaReward';

const route = useRoute()
const isEditing = computed(() => !!route.params.id)
const coordUpdateSource = ref<'address' | 'map' | 'manual' | 'init' | null>('init')

const limitReached = ref(false)
const applying = ref(false)
const applicationReason = ref('')
const applicationSubmitted = ref(false)
const applicationLoading = ref(false)
const pendingApplicationExists = ref(false)

async function checkPendingApplication() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data, error } = await supabase
    .from('contributor_applications')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .limit(1)
  if (!error && data && data.length > 0) {
    pendingApplicationExists.value = true
  }
}

async function submitApplication() {
  if (!applicationReason.value.trim()) return
  applicationLoading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase
      .from('contributor_applications')
      .insert({
        user_id: user.id,
        reason: applicationReason.value,
        status: 'pending'
      })
      
    if (error) throw error
    
    applicationSubmitted.value = true

    // Fetch profile for user metadata
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const userName = profile?.display_name || user.email || 'Anonymous'
    const userEmail = profile?.email || user.email || 'N/A'

    await notifyEvent(
      'contributor_application_needs_review',
      '🔍 Contributor Application Needs Review',
      `User ${userName} (${userEmail}) has applied to become a Dedicated Contributor.\nReason: ${applicationReason.value}`,
      undefined,
      {
        user_id: user.id,
        target_role: 'admin',
        isNative: true
      },
      ['discord', 'onesignal']
    )
  } catch (err) {
    console.error('Failed to submit contributor application:', err)
  } finally {
    applicationLoading.value = false
  }
}

onIonViewWillEnter(async () => {
  limitReached.value = await isContributionLimitReached()
  if (limitReached.value) {
    await checkPendingApplication()
  }
})

/* -------------------- Multi-Step Logic -------------------- */
const STEP_IDENTITY = 0
const STEP_PHOTOS = 1
const STEP_DETAILS = 2
const currentStep = ref(STEP_IDENTITY)

/* -------------------- Constants -------------------- */
const MAP_ID = 'a40f1ec0ad0afbbb12694f19'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const DEFAULT_CENTER = {lat: 25.0343, lng: 121.5645}
let clickMarker: google.maps.marker.AdvancedMarkerElement | null = null
let pinEl: any | null = null
const mapLoading = ref(true)  // show skeleton
const mapReady = ref(false)   // reveal map once real map is ready
const {awardAndCelebrate} = usePoints();
const {notifyEvent} = useNotifier();
const dayLabels = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const showMoreOptions = ref(false)
const openingHoursTouched = ref(true)


/* -------------------- Router -------------------- */
const router = useRouter()

/* -------------------- Role Gate -------------------- */
const checkedRole = ref(false)
const locationTypes = ref<{ id: number; name: string }[]>([])
const isPrivileged = (r: Role | null) => r === 'admin'

type Role = 'admin' | 'contributor' | 'user'
const myRole = ref<Role | null>(null)

const loadRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    myRole.value = null
    checkedRole.value = true
    return
  }

  const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

  myRole.value = !error ? ((data?.role ?? 'user') as Role) : 'user'
  checkedRole.value = true

  // ✅ Default to approved if admin adding new place
  if (myRole.value === 'admin' && !isEditing.value) {
    form.value.approved = true
  }
}

// Fetch from Supabase
const fetchLocationTypes = async () => {
  const {data, error} = await supabase
      .from('location_types')
      .select('id, name')
      .order('name', {ascending: true}) // alphabetic sort
  if (!error && data) locationTypes.value = data
}

const showTypeModal = ref(false)
const modalSearchQuery = ref('')

const selectedTypeName = computed(() => {
  const matched = locationTypes.value.find(t => t.id === form.value.type_id)
  return matched ? matched.name : ''
})

const filteredModalLocationTypes = computed(() => {
  const q = modalSearchQuery.value.toLowerCase().trim()
  if (!q) return locationTypes.value
  return locationTypes.value.filter(lt => lt.name.toLowerCase().includes(q))
})

function selectModalLocationType(lt: { id: number; name: string }) {
  form.value.type_id = lt.id
  showTypeModal.value = false
  modalSearchQuery.value = ''
}

/* -------------------- Form State -------------------- */
const form = ref<{
  name: string
  type_id: number | null
  lat: number
  lng: number
  image: string | null
  address: string | null,
  description: string | null,
  phone: string | null,
  instagram: string | null,
  line_id: string | null,
  price_range: string | null,
  opening_hours: any,
  tags: string[],
  approved: boolean,
}>({
  name: '',
  type_id: null,
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
  address: null,
  image: null,
  description: '',
  phone: '',
  instagram: '',
  line_id: '',
  price_range: '',
  tags: [],
  approved: false,

  opening_hours: {
    mon: {active: true, open: "09:00", close: "18:00"},
    tue: {active: true, open: "09:00", close: "18:00"},
    wed: {active: true, open: "09:00", close: "18:00"},
    thu: {active: true, open: "09:00", close: "18:00"},
    fri: {active: true, open: "09:00", close: "18:00"},
    sat: {active: true, open: "09:00", close: "18:00"},
    sun: {active: true, open: "09:00", close: "18:00"},
  },
})

const tagInput = ref('')
const isTagsManuallyEdited = ref(false)

function extractTagsFromName(name: string): string[] {
  if (!name) return []
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'among', 'within',
    'taiwan', 'taipei', 'taichung', 'kaohsiung', 'taitung', 'hualien',
    'yilan', 'hsinchu', 'miaoli', 'changhua', 'nantou', 'yunlin',
    'chiayi', 'pingtung', 'keelung', 'new', 'city', 'road', 'street',
    'avenue', 'lane', 'district', 'no', 'number', 'floor', 'building'
  ])
  const cleaned = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ')
  const meaningfulWords = words.filter(word =>
    word.length >= 2 &&
    !stopWords.has(word) &&
    !/^\d+$/.test(word)
  )
  const uniqueWords: string[] = []
  const seen = new Set<string>()
  for (const word of meaningfulWords) {
    if (!seen.has(word)) {
      seen.add(word)
      uniqueWords.push(word)
    }
  }
  return uniqueWords
}

watch(
  () => [form.value.name, form.value.type_id],
  () => {
    if (isEditing.value) return // Don't overwrite existing place tags
    if (isTagsManuallyEdited.value) return

    const nameTags = extractTagsFromName(form.value.name)
    const typeTags = selectedTypeName.value
      ? selectedTypeName.value.toLowerCase().split(/[/\s-_]+/).filter(t => t.length >= 2)
      : []

    // Merge uniquely
    const merged = Array.from(new Set([...nameTags, ...typeTags]))
    form.value.tags = merged
  },
  { deep: true }
)

const handleTagInput = (e: any) => {
  const val = e.target.value
  if (val.endsWith(',')) {
    const tag = val.slice(0, -1).trim()
    if (tag && !form.value.tags.includes(tag)) {
      isTagsManuallyEdited.value = true
      form.value.tags.push(tag)
    }
    tagInput.value = ''
  }
}

const addTag = (e?: any) => {
  if (e) e.preventDefault()
  const val = tagInput.value.trim().replace(/,/g, '')
  if (val && !form.value.tags.includes(val)) {
    isTagsManuallyEdited.value = true
    form.value.tags.push(val)
  }
  tagInput.value = ''
}
const removeTag = (tag: string) => {
  isTagsManuallyEdited.value = true
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

function handleBack() {
  if (currentStep.value > STEP_IDENTITY && !isEditing.value) {
    currentStep.value--
  } else {
    router.back()
  }
}



const submitting = ref(false)
const toast = ref<{ open: boolean; message: string; color: string }>({
  open: false,
  message: '',
  color: 'primary'
})

const isValid = computed(() =>
    !!form.value.name &&
    !!form.value.type_id &&
    form.value.lat !== null &&
    form.value.lng !== null &&
    (!!form.value.image || !!pendingFile.value) // allow deferred file
)

/* -------------------- Image Upload -------------------- */
async function resizeImageFromWebPath(
    webPath: string,
    filename: string,
    maxSize = 1200,     // longest side in px
    quality = 0.8       // JPEG quality 0..1
): Promise<File> {
  const res = await fetch(webPath)
  const blob = await res.blob()

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const tempImg = new Image()
    const url = URL.createObjectURL(blob)
    tempImg.onload = () => resolve(tempImg)
    tempImg.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image element'))
    }
    tempImg.src = url
  })

  const objectUrl = img.src

  // Resize keeping aspect ratio by the longest edge
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const outW = Math.round(w * scale)
  const outH = Math.round(h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, outW, outH)

  const outBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', quality)
  )

  URL.revokeObjectURL(objectUrl)

  return new File([outBlob], filename, {type: 'image/jpeg'})
}

type NearbyMatch = {
  id: string | number // Can be Google place_id or database id
  name: string
  address?: string
  lat?: number
  lng?: number
  distance_meters: number
  name_similarity: number
  place_id?: string // Google place_id
}

const nearbyMatches = ref<NearbyMatch[]>([])
const checkingNearby = ref(false)

let nearbyDebounceTimer: number | undefined
let addressDebounceTimer: number | undefined

watch(
    () => ({
      name: form.value.name,
      lat: form.value.lat,
      lng: form.value.lng
    }),
    (v) => {
      clearTimeout(nearbyDebounceTimer)

      nearbyDebounceTimer = window.setTimeout(async () => {
        const { name, lat, lng } = v

        if (!name || !lat || !lng || name.trim().length < 4) {
          nearbyMatches.value = []
          return
        }

        checkingNearby.value = true

        const { data, error } = await supabase.rpc(
            'find_nearby_similar_locations',
            {
              p_lat: lat,
              p_lng: lng,
              p_name: name.trim(),
              p_exclude_id: isEditing.value
                  ? Number(route.params.id)
                  : null
            }
        )

        nearbyMatches.value = !error && Array.isArray(data) ? data : []
        checkingNearby.value = false
      }, 600)
    },
    { deep: false }
)

watch(
  () => form.value.address,
  () => {
    if (coordUpdateSource.value) return

    clearTimeout(addressDebounceTimer)
    addressDebounceTimer = window.setTimeout(async () => {
      await onAddressConfirm()
    }, 1200)
  }
)


const warningLevel = computed(() => {
  if (!nearbyMatches.value.length) return null

  const strongest = nearbyMatches.value[0]

  if (strongest.distance_meters <= 20 && strongest.name_similarity >= 0.75) {
    return 'high'
  }

  if (strongest.distance_meters <= 50 && strongest.name_similarity >= 0.6) {
    return 'medium'
  }

  return 'low'
})

// Make safe base file name
const makeSafeBase = () => {
  const base = form.value.name?.trim()
      .replace(/\s+/g, '-')            // spaces → dash
      .replace(/[^a-zA-Z0-9-_]/g, '')  // strip weird chars
      .toLowerCase()
  return base && base.length ? base : 'place'
}

const imagePreview = ref<string | null>(null)   // preview URL
const pendingFile = ref<File | null>(null)      // hold the chosen file until submit
const uploading = ref(false)

const setPreview = (file: File) => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = URL.createObjectURL(file)
  pendingFile.value = file
}

const takePicture = async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 85,
      allowEditing: false
    })
    if (!photo.webPath) return
    const safeBase = makeSafeBase()

    try {
      const file = await resizeImageFromWebPath(photo.webPath, `image-${safeBase}.jpg`, 1200, 0.8)
      if (file.size > MAX_BYTES) {
        toast.value = {open: true, message: 'Image still too large after compression.', color: 'danger'}
        return
      }
      setPreview(file)
    } catch (e: any) {
      toast.value = {open: true, message: e?.message || 'Could not process image.', color: 'danger'}
    }
  } catch { /* empty */
  }
}

const uploadFromGallery = async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 85,
      allowEditing: false
    })
    if (!photo.webPath) return
    const safeBase = makeSafeBase()

    // compress to JPEG here
    const file = await resizeImageFromWebPath(photo.webPath, `image-${safeBase}.jpg`, 1200, 0.8)

    if (file.size > MAX_BYTES) {
      toast.value = {open: true, message: 'Image still too large after compression.', color: 'danger'}
      return
    }
    setPreview(file)
  } catch { /* empty */
  }
}

/* -------------------- Map Picker -------------------- */
let map: google.maps.Map | null = null
let advancedMarkerLib: any = null
let mapClickListener: google.maps.MapsEventListener | null = null

const initMap = async () => {
  mapLoading.value = true

  const [{Map}, markerLib] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])

  // after markerLib is set
  if (!markerLib?.PinElement || !markerLib?.AdvancedMarkerElement) {
    console.error('Advanced markers not available. Check Maps JS API version/libraries.')
  }

  advancedMarkerLib = markerLib

  map = new Map(document.getElementById('add-map') as HTMLElement, {
    center: {lat: form.value.lat, lng: form.value.lng},
    zoom: 14,
    disableDefaultUI: true,
    mapId: MAP_ID,
    gestureHandling: 'greedy'   // 👈 add
  })

  // Build a colored pin (much more visible than a small dot)
  pinEl = new advancedMarkerLib.PinElement({
    background: getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-color-carrot')
        .trim() || '#d8620d',
    borderColor: '#ffffff',
    glyphColor: '#ffffff',
    scale: 1.2,
  })

  // Create marker at initial coords
  clickMarker = new advancedMarkerLib.AdvancedMarkerElement({
    map,
    position: {lat: form.value.lat, lng: form.value.lng},
    content: pinEl.element,
    zIndex: 10,
  })

  // Prefer 'idle' (fires once map finishes first render)
  const onReady = () => {
    mapReady.value = true
    // tiny next tick to avoid flicker
    requestAnimationFrame(() => {
      mapLoading.value = false
    })
  }

  google.maps.event.addListenerOnce(map, 'idle', onReady);
  google.maps.event.addListenerOnce(map, 'tilesloaded', onReady);

  // Absolute last resort: time out after 3s
  setTimeout(() => {
    if (!mapReady.value) {
      onReady()
      console.warn('Map ready fallback timeout used')
    }
  }, 3000)

  // On click: move pin + animate + update form
  let firstTapDone = false
  mapClickListener = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return

    coordUpdateSource.value = 'map'

    const lat = e.latLng.lat()
    const lng = e.latLng.lng()

    form.value.lat = lat
    form.value.lng = lng

    if (clickMarker) {
      clickMarker.position = {lat, lng}
    } else {
      // safety: if null for any reason
      clickMarker = new advancedMarkerLib.AdvancedMarkerElement({
        map,
        position: {lat, lng},
        content: pinEl?.element ?? undefined,
        zIndex: 10,
      })
    }

    // optional: pan slightly so user sees the pin move
    map!.panTo({lat, lng})

    // add a quick "pop" animation for feedback
    if (pinEl?.element) {
      pinEl.element.classList.add('marker-pop')
      setTimeout(() => pinEl.element.classList.remove('marker-pop'), 220)
    }

    if (!firstTapDone) {
      map!.setZoom(16);
      firstTapDone = true
    }

    // 🧠 Auto-fetch address
    const addr = await reverseGeocode(lat, lng)
    if (addr) form.value.address = addr

    coordUpdateSource.value = null
  })
}

/* ------------- Responsive Pin Color --------------- */
let themeObserver: MutationObserver | null = null   // <-- add this
const updatePinColor = () => {
  const carrot = getComputedStyle(document.documentElement)
      .getPropertyValue('--ion-color-carrot').trim() || '#d8620d'
  if (pinEl && advancedMarkerLib?.PinElement) {
    pinEl = new advancedMarkerLib.PinElement({
      background: carrot, borderColor: '#ffffff', glyphColor: '#ffffff', scale: 1.2
    })
    if (clickMarker) clickMarker.content = pinEl.element
  }
}

/* ---------------- Geocoding --------------------- */

const geocoder = ref<google.maps.Geocoder | null>(null)

const onAddressConfirm = async () => {
  if (coordUpdateSource.value) return
  const addr = form.value.address?.trim()
  if (!addr || addr.length < 8) return

  coordUpdateSource.value = 'address'
  try {
    const result = await geocodeAddress(addr)
    if (!result) return

    const { lat, lng } = result

    form.value.lat = lat
    form.value.lng = lng

    map?.panTo({ lat, lng })
    map?.setZoom(16)

    if (clickMarker) {
      clickMarker.position = { lat, lng }
    }
  } catch (err) {
    console.error('Failed to geocode address:', err)
  } finally {
    coordUpdateSource.value = null
  }
}




async function reverseGeocode(lat: number, lng: number) {
  if (!mapReady.value) return null // ✅ safety guard

  // ✅ Initialize geocoder only after loader is ready
  if (!geocoder.value) {
    geocoder.value = new google.maps.Geocoder()
  }

  return new Promise<string | null>((resolve) => {
    geocoder.value!.geocode({location: {lat, lng}}, (results, status) => {
      if (status === 'OK' && results?.[0]) resolve(results[0].formatted_address)
      else {
        console.warn('Geocode failed:', status)
        resolve(null)
      }
    })
  })
}

async function geocodeAddress(address: string) {
  if (!mapReady.value || !address) return null

  if (!geocoder.value) {
    geocoder.value = new google.maps.Geocoder()
  }

  return new Promise<{ lat: number; lng: number } | null>((resolve) => {
    geocoder.value!.geocode({
      address,
      region: 'TW',
      componentRestrictions: { country: 'TW' },
    }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        resolve({
          lat: loc.lat(),
          lng: loc.lng()
        })
      } else {
        console.warn('Address geocode failed:', status)
        resolve(null)
      }
    })
  })
}

function updateMapMarker() {
  if (!map || !clickMarker) return
  const pos = { lat: form.value.lat, lng: form.value.lng }
  clickMarker.position = pos
  map.setCenter(pos)
  map.setZoom(17)
}

function formatOpeningHours(googleHours: any) {
  const hours = { ...form.value.opening_hours }
  const daysMap: Record<number, string> = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 0: 'sun' }

  if (googleHours?.periods) {
    googleHours.periods.forEach((period: any) => {
      const dayKey = daysMap[period.open.day]
      if (dayKey && hours[dayKey]) {
        hours[dayKey].active = true
        const openH = String(period.open.hour).padStart(2, '0')
        const openM = String(period.open.minute).padStart(2, '0')
        hours[dayKey].open = `${openH}:${openM}`

        if (period.close) {
          const closeH = String(period.close.hour).padStart(2, '0')
          const closeM = String(period.close.minute).padStart(2, '0')
          hours[dayKey].close = `${closeH}:${closeM}`
        }
      }
    })
  }
  return hours
}

// Convert opening hours from DB (Google Places or custom format) to form format
function convertOpeningHoursForEdit(dbHours: any) {
  // Default hours structure
  const defaultHours = {
    mon: { active: false, open: "09:00", close: "18:00" },
    tue: { active: false, open: "09:00", close: "18:00" },
    wed: { active: false, open: "09:00", close: "18:00" },
    thu: { active: false, open: "09:00", close: "18:00" },
    fri: { active: false, open: "09:00", close: "18:00" },
    sat: { active: false, open: "09:00", close: "18:00" },
    sun: { active: false, open: "09:00", close: "18:00" },
  }

  if (!dbHours) return defaultHours

  // Check if it's Google Places format (has periods array)
  if (dbHours.periods && Array.isArray(dbHours.periods)) {
    const hours = { ...defaultHours }
    const daysMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

    dbHours.periods.forEach((period: any) => {
      if (!period?.open?.day && period?.open?.day !== 0) return

      const dayKey = daysMap[period.open.day]
      if (!dayKey || !hours[dayKey as keyof typeof hours]) return

      const dayData = hours[dayKey as keyof typeof hours]
      dayData.active = true

      // Format time from HHMM to HH:MM
      const formatTime = (timeStr: string) => {
        if (!timeStr) return "09:00"
        // Remove any existing colons
        const cleanTime = timeStr.replace(/:/g, '')
        if (cleanTime.length === 4) {
          return `${cleanTime.substring(0, 2)}:${cleanTime.substring(2, 4)}`
        }
        return timeStr
      }

      dayData.open = formatTime(period.open.time)

      if (period.close?.time) {
        dayData.close = formatTime(period.close.time)
      }
    })

    return hours
  }

  // Check if it's already in custom format (has day keys like mon, tue, etc.)
  if (dbHours.mon || dbHours.tue || dbHours.wed || dbHours.thu || dbHours.fri || dbHours.sat || dbHours.sun) {
    // Merge with defaults to ensure all days exist
    return {
      mon: dbHours.mon || defaultHours.mon,
      tue: dbHours.tue || defaultHours.tue,
      wed: dbHours.wed || defaultHours.wed,
      thu: dbHours.thu || defaultHours.thu,
      fri: dbHours.fri || defaultHours.fri,
      sat: dbHours.sat || defaultHours.sat,
      sun: dbHours.sun || defaultHours.sun,
    }
  }

  // Unknown format, return defaults
  return defaultHours
}

/* -------------------- Submit -------------------- */
const uploadToSupabase = async (file: File): Promise<string> => {
  uploading.value = true
  try {
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) throw new Error('You must be logged in.')
    const safeBase = makeSafeBase()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${user.id}/${safeBase}/${Date.now()}_${rand}.jpg`   // folder per place
    const {error: upErr} = await supabase.storage.from('location-image')
        .upload(path, file, {cacheControl: '3600', upsert: false, contentType: 'image/jpeg'})
    if (upErr) throw upErr
    const {data: pub} = supabase.storage.from('location-image').getPublicUrl(path)
    if (!pub?.publicUrl) throw new Error('Could not get public URL.')
    return pub.publicUrl
  } finally {
    uploading.value = false
  }
}

const normalizeOpeningHours = () => {
  if (!openingHoursTouched.value) return null

  const hours = form.value.opening_hours

  const hasAnyActive = Object.values(hours).some(
      (d: any) => d.active && d.open && d.close
  )

  if (!hasAnyActive) return null

  return hours
}


const submitPlace = async () => {
  if (submitting.value) return

  // ✅ Auto-add any pending tag in input box before saving
  if (tagInput.value.trim()) {
    addTag()
  }

  if (!form.value.image && !pendingFile.value) {
    toast.value = { open: true, message: 'Please select an image.', color: 'warning' }
    return
  }

  submitting.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be logged in.')

    // ✅ Decide auto-approval (for new places)
    const autoApprove = isPrivileged(myRole.value)

    // delete old image if editing + new image selected
    if (isEditing.value && pendingFile.value && form.value.image) {
      const oldPath = form.value.image.split('/storage/v1/object/public/location-image/')[1]
      if (oldPath) await supabase.storage.from('location-image').remove([oldPath])
    }

    // upload new image if selected
    if (pendingFile.value) {
      form.value.image = await uploadToSupabase(pendingFile.value)
    }

    const payload: Record<string, any> = {
      name: form.value.name.trim(),
      lat: form.value.lat,
      lng: form.value.lng,
      type_id: form.value.type_id,
      image: String(form.value.image || '').trim(),
      address: form.value.address?.trim() || null,
      description: form.value.description?.trim() || null,
      phone: form.value.phone || null,
      instagram: form.value.instagram || null,
      line_id: form.value.line_id || null,
      price_range: form.value.price_range || null,
      opening_hours: normalizeOpeningHours(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      tags: form.value.tags,
    }

    // ✅ Approval Logic
    if (myRole.value === 'admin') {
      // Admins manually control the toggle
      payload.approved = form.value.approved
      if (form.value.approved) {
        payload.approved_by = user.id
        payload.approved_at = new Date().toISOString()
      } else {
        payload.approved_by = null
        payload.approved_at = null
      }
    } else {
      // For non-admins, new places use auto-approve logic, edits are always unapproved
      if (!isEditing.value) {
        payload.approved = autoApprove
        payload.approved_by = autoApprove ? user.id : null
        payload.approved_at = autoApprove ? new Date().toISOString() : null
        payload.created_by = user.id
      } else {
        // Non-admin edits require new review
        payload.approved = false
        payload.approved_by = null
        payload.approved_at = null
      }
    }

    if (isEditing.value) {
      const { error } = await supabase
          .from('locations')
          .update(payload)
          .eq('id', route.params.id)

      if (error) throw error

      toast.value = { open: true, message: 'Place updated!', color: 'success' }
      
      await ActivityLogService.log("edit_place_success", {
        id: route.params.id,
        name: form.value.name,
        approved: payload.approved
      })

      setTimeout(() => router.replace(`/place/${route.params.id}`), 500)
    } else {
      // CREATE
      payload.created_by = user.id
      const { data: newPlace, error } = await supabase
          .from('locations')
          .insert([payload])
          .select('id')
          .single()

      if (error) throw error

      // 🎁 Award scan bonus quota for contributing a place
      await awardScanBonus(1)

      toast.value = {
        open: true,
        message: payload.approved ? '✅ Place published!' : '✅ Place submitted and awaiting approval.',
        color: 'success',
      }

      // ✅ Notification if approved
      const userEmail = user?.email || 'Unknown'
      const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Unknown'

      if (payload.approved) {
        const selectedType = locationTypes.value.find(t => t.id === form.value.type_id)
        const placeTypeName = selectedType?.name || 'Halal Place'

        await notifyEvent(
            'new_place',
            `🕌 New ${placeTypeName} Added!`,
            `${form.value.name} (${placeTypeName})\nLat: ${form.value.lat}, Lng: ${form.value.lng}\nAdded by: ${userName} (${userEmail})`,
            form.value.image ?? undefined,
            { id: newPlace.id, lat: form.value.lat, lng: form.value.lng, isNative: true, added_by: userEmail, user_id: user?.id }
        )
      } else {
        // 🔴 Non-admin → notify Discord and push to Admin accounts
        const selectedType = locationTypes.value.find(t => t.id === form.value.type_id)
        const placeTypeName = selectedType?.name || 'Halal Place'

        await notifyEvent(
            'location_needs_review',
            `🔍 Location Needs Review`,
            `${form.value.name} (${placeTypeName})\nAddress: ${form.value.address || 'N/A'}\nSubmitted by: ${userName} (${userEmail})\nAwaiting approval.`,
            form.value.image ?? undefined,
            { id: newPlace.id, lat: form.value.lat, lng: form.value.lng, isNative: true, added_by: userEmail, user_id: user?.id, target_role: 'admin' },
            ['discord', 'onesignal']
        )
      }

      await awardAndCelebrate('add_place', 10000)

      await ActivityLogService.log("add_place_success", {
        name: form.value.name,
        address: form.value.address,
        lat: form.value.lat,
        lng: form.value.lng
      })

      setTimeout(() => {
        router.replace(payload.approved ? `/explore?focus=${newPlace.id}` : `/explore`)
      }, 500)
    }

    // cleanup
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
    pendingFile.value = null
  } catch (err: any) {
    toast.value = { open: true, message: err.message || 'Failed to save.', color: 'danger' }
  } finally {
    submitting.value = false
  }
}

/* -------------------- Lifecycle -------------------- */
// Reusable geolocation function that returns coordinates
const getLocation = async (): Promise<{lat: number; lng: number} | null> => {
  // Native (Android/iOS): use Capacitor plugin
  if (Capacitor.getPlatform() !== 'web') {
    try {
      // Permissions
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions()
      }

      // Get position
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      const {latitude, longitude} = pos.coords
      return {lat: latitude, lng: longitude}
    } catch (err) {
      console.warn('Native geolocation failed, falling back to default', err)
      return null
    }
  }

  // Web fallback: use the browser API
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
          const {latitude, longitude} = pos.coords
          resolve({lat: latitude, lng: longitude})
        },
        (err) => {
          console.warn('Web geolocation failed or denied', err)
          resolve(null)
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        }
    )
  })
}

const centerOnUserOnce = async () => {
  const coords = await getLocation()
  if (coords) {
    form.value.lat = coords.lat
    form.value.lng = coords.lng
    const addr = await reverseGeocode(coords.lat, coords.lng)
    if (addr) form.value.address = addr
  }
}

onMounted(async () => {
  await loadRole()
  await fetchLocationTypes()

  // 1️⃣ If editing, load existing location data first
  if (isEditing.value) {
    const {data, error} = await supabase
        .from('locations')
        .select(`
    id,
    name,
    lat,
    lng,
    address,
    description,
    image,
    type_id,
    phone,
    instagram,
    line_id,
    price_range,
    opening_hours,
    tags,
    approved
  `)
        .eq('id', route.params.id)
        .maybeSingle()

    if (!error && data) {
      form.value = {
        name: data.name,
        type_id: data.type_id,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        image: data.image,
        description: data.description || '',
        phone: data.phone || '',
        instagram: data.instagram || '',
        line_id: data.line_id || '',
        price_range: data.price_range || '',

        opening_hours: convertOpeningHoursForEdit(data.opening_hours),
        tags: data.tags || [],
        approved: data.approved || false,
      }

      imagePreview.value = data.image || null
    }

    if (isEditing.value && data?.opening_hours) {
      openingHoursTouched.value = true
    }

  }

  // 3️⃣ Only center on user if adding a NEW place
  if (!isEditing.value && checkedRole.value && myRole.value) {
    await centerOnUserOnce()
  }

  // 4️⃣ Initialize map in all cases
  await initMap()
  updatePinColor()

  // 5️⃣ Wait until map is fully ready before fetching address
  const waitForMapReady = () =>
      new Promise<void>((resolve) => {
        const stop = watch(mapReady, (ready) => {
          if (ready) {
            stop()
            resolve()
          }
        })
      })
  await waitForMapReady()

  // 6️⃣ Auto-fill address if missing
  if (!form.value.address && form.value.lat && form.value.lng) {
    const addr = await reverseGeocode(form.value.lat, form.value.lng)
    if (addr) form.value.address = addr
  }


  // 7️⃣ Theme listener for dark/light map pin color
  themeObserver = new MutationObserver(updatePinColor)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // 8️⃣ Clear initialization flag after mount finishes
  setTimeout(() => {
    if (coordUpdateSource.value === 'init') {
      coordUpdateSource.value = null
    }
  }, 400)
})


onBeforeUnmount(() => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  if (mapClickListener) {
    mapClickListener.remove();
    mapClickListener = null
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null
  }
  clearTimeout(nearbyDebounceTimer)
  clearTimeout(addressDebounceTimer)
  clickMarker = null
  pinEl = null
  map = null
})

</script>

<style scoped>
.form :deep(.ion-invalid) {
  --highlight-color-invalid: var(--ion-color-danger);
}

/* Grid for lat/lng inputs */
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

/* Map */
.map-wrap {
  margin: 12px 0 16px;
}

.hint {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 4px 0 8px;
}

.map-holder {
  position: relative;
  height: 32vh;
  border-radius: 12px;
  overflow: hidden;
}

#add-map {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

#add-map.fade-in {
  opacity: 1;
}

.map-skeleton {
  position: absolute;
  inset: 0; /* cover the map fully */
  border-radius: 12px;
}

/* Image preview */
.img-preview-wrap {
  padding: 0 16px 16px;
}

.img-preview {
  max-width: 100%;
  display: block;
  border-radius: 8px;
}

/* Misc */
.mr-2 {
  margin-right: 8px;
}

/* subtle feedback when the pin moves */
@keyframes pop {
  0% {
    transform: translateZ(0) scale(0.85);
  }
  70% {
    transform: translateZ(0) scale(1.08);
  }
  100% {
    transform: translateZ(0) scale(1);
  }
}

.marker-pop {
  animation: pop 220ms ease-out;
}

/* optional: show crosshair cursor on map to hint interactivity */
#add-map {
  cursor: crosshair;
}

.opening-hours-list {
  margin-top: 4px;
}

.opening-hours-item {
  display: flex;
  align-items: center;
}

.day-label {
  min-width: 50px;
  font-weight: 600;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.time-field {
  max-width: 110px;
}

.closed-label {
  margin-left: auto;
  color: var(--ion-color-medium);
  font-size: 14px;
}

/* Tags */
.tag-chips {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  margin: 0;
  height: 32px;
  --color: var(--ion-color-primary);
}

.tag-chip ion-icon {
  font-size: 18px;
  cursor: pointer;
  margin-inline-start: 4px;
}

.tag-chip ion-icon:hover {
  color: var(--ion-color-danger);
}
/* Premium Form Styles (Synced with AddProductView) */
.form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--ion-background-color);
  padding-bottom: 32px;
}

.form-section {
  margin-bottom: 8px;
}

.form-section ion-list-header {
  padding-inline-start: 16px;
  min-height: 32px;
  margin-bottom: 4px;
}

.form-section ion-list-header ion-label {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-step-600);
}

.input-card {
  margin: 0 12px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  background: var(--ion-card-background, white);
  border: 1px solid var(--ion-color-light-shade);
}

.input-card ion-item {
  --background-active: transparent;
  --ripple-color: transparent;
}

.full-width-select {
  width: 100%;
  --padding-start: 0;
}

.day-label {
  min-width: 80px;
}

/* Autocomplete wrapper */
.autocomplete-wrapper {
  padding: 12px 16px;
}

.autocomplete-wrapper .autocomplete-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 12px;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.autocomplete-wrapper .autocomplete-input:focus {
  border-color: var(--ion-color-carrot);
  box-shadow: 0 0 0 2px rgba(216, 98, 13, 0.15);
}

/* 🟢 Step Indicator */
ion-header {
  overflow: visible;
}

#step-indicator {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12px 16px 16px;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-light);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-item.active .step-label {
  color: var(--ion-color-carrot);
  font-weight: 600;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--ion-color-medium);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-item.active .step-dot {
  background: var(--ion-color-carrot);
  color: white;
  box-shadow: 0 4px 12px rgba(216, 98, 13, 0.3);
  transform: scale(1.1);
}

.step-label {
  font-size: 11px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.step-line {
  height: 2px;
  width: 20px;
  background: var(--ion-color-light);
  margin: 16px 2px 0;
  transition: background 0.3s ease;
}

.step-line.active {
  background: var(--ion-color-carrot);
}

.photo-selection-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.photo-btn {
  height: 90px;
  --border-radius: 16px;
  font-weight: 700;
  margin: 0;
  font-size: 13px;
  text-transform: none;
}

.photo-btn ion-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.rounded-xl {
  border-radius: 16px;
}

.shadow-md {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

</style>
