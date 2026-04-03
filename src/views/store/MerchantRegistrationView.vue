<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header 
        :title="$t('merchant.register.title')" 
        show-back 
        back-route="/profile" 
        icon="none"
      />
      <div class="progress-container">
        <div class="progress-bar" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="isSubmitted" class="success-screen fade-in">
        <div class="success-circle">
          <ion-icon :icon="checkmarkCircleOutline" color="carrot" />
        </div>
        <h1 class="success-title">{{ $t('merchant.register.successTitle') }}</h1>
        <p class="success-subtitle">{{ $t('merchant.register.successSubtitle') }}</p>
        
        <div class="success-card ion-padding">
          <p class="success-text">{{ $t('merchant.register.successText') }}</p>
        </div>

        <ion-button 
          expand="block" 
          color="carrot" 
          mode="md"
          class="back-btn" 
          @click="router.replace('/profile')"
        >
          {{ $t('merchant.register.backToProfile') }}
        </ion-button>
      </div>

      <div v-else class="registration-container">
        <!-- Rejection Banner (Sticky at top of all steps if rejected) -->
        <div v-if="merchantApplication?.status === 'rejected' && merchantApplication.rejection_reason" class="rejected-banner fade-in">
          <ion-icon :icon="alertCircleOutline" color="danger" class="banner-alert-icon" />
          <div class="banner-reason-standalone">
            <strong>{{ $t('merchant.register.rejectionReason') }}</strong>
            <p>{{ merchantApplication.rejection_reason }}</p>
          </div>
        </div>

        <!-- Step 1: Store Name -->
        <div v-if="currentStep === 1" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.storeInfo') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.subtitle') }}</p>
          </div>
          
          <div class="innovative-field" :class="{ 'field-is-valid': form.store_name.length > 0 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="storefrontOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">
                {{ $t('merchant.register.placeholders.storeNameEn') }}
                <span class="required-asterisk">*</span>
              </label>
              <ion-input 
                v-model="form.store_name" 
                :placeholder="$t('merchant.register.placeholders.storeNameEn')" 
                class="innovative-input" 
              />
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
          
          <div class="innovative-field" :class="{ 'field-is-valid': form.store_name_zh.length > 0 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="chatbubbleEllipsesOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">{{ $t('merchant.register.placeholders.storeNameZh') }}</label>
              <ion-input 
                v-model="form.store_name_zh" 
                :placeholder="$t('merchant.register.placeholders.storeNameZh')" 
                class="innovative-input" 
              />
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
        </div>

        <!-- Step 2: Store Address -->
        <div v-if="currentStep === 2" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.address') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.hints.address') }}</p>
          </div>
          
          <div class="innovative-field" :class="{ 'field-is-valid': form.store_address.length > 0 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="locationOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">{{ $t('merchant.register.placeholders.address') }}</label>
              <ion-input 
                v-model="form.store_address" 
                :placeholder="$t('merchant.register.placeholders.address')" 
                class="innovative-input" 
              />
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
        </div>

        <!-- Step 3: Store Description -->
        <div v-if="currentStep === 3" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.description') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.hints.description') }}</p>
          </div>
          
          <div class="innovative-field" :class="{ 'field-is-valid': form.store_description.trim().length >= 100 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="informationCircleOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">
                {{ $t('merchant.register.steps.description') }}
                <span class="required-asterisk">*</span>
              </label>
              <ion-textarea 
                v-model="form.store_description" 
                :rows="4" 
                :placeholder="$t('merchant.register.placeholders.description')" 
                class="innovative-input" 
                :minlength="100"
              />
              <p class="char-counter" :class="{ 'valid': form.store_description.trim().length >= 100 }">
                {{ form.store_description.trim().length }} / 100
              </p>
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
        </div>

        <!-- Step 4: Contact Phone -->
        <div v-if="currentStep === 4" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.contact') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.hints.phone') }}</p>
          </div>
          
          <div class="innovative-field" :class="{ 'field-is-valid': form.contact_phone.length >= 8 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="callOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">
                {{ $t('merchant.register.placeholders.phone') }}
                <span class="required-asterisk">*</span>
              </label>
              
              <div class="phone-input-group">
                <ion-select 
                  v-model="selectedCountryCode" 
                  interface="popover" 
                  class="country-select"
                >
                  <ion-select-option v-for="c in countryCodes" :key="c.code" :value="c.code">
                    {{ c.code }} ({{ c.name }})
                  </ion-select-option>
                </ion-select>
                
                <ion-input 
                  v-model="form.contact_phone" 
                  type="tel" 
                  :placeholder="$t('merchant.register.placeholders.phone')" 
                  class="innovative-input"
                />
              </div>
              <p class="field-hint">
                <ion-icon :icon="informationCircleOutline" color="warning" />
                {{ $t('merchant.register.hints.phone_warning') }}
              </p>
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
          
          <div class="verification-note ion-margin-top ion-padding">
            <ion-icon :icon="callOutline" size="large" color="carrot" />
            <h3 class="ion-padding-top">{{ $t('merchant.register.hints.human_verify') }}</h3>
            <p>
              {{ $t('merchant.register.hints.contact_note') }}
            </p>
          </div>
        </div>

        <!-- Step 5: Business UBN -->
        <div v-if="currentStep === 5" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.business') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.hints.ubn') }}</p>
          </div>
          
          <div class="choice-container ion-margin-vertical">
            <ion-button 
              :fill="hasUbn === true ? 'solid' : 'outline'" 
              @click="hasUbn = true" 
              expand="block"
              color="carrot"
              mode="md"
              style="height: 60px; --border-radius: 20px; font-weight: 800;"
            >
              {{ $t('common.yes') }}
            </ion-button>
            <ion-button 
              :fill="hasUbn === false ? 'solid' : 'outline'" 
              @click="hasUbn = false" 
              expand="block" 
              color="medium"
              class="ion-margin-top"
              mode="md"
              style="height: 60px; --border-radius: 20px; font-weight: 800;"
            >
              {{ $t('common.no') }}
            </ion-button>
          </div>

          <div v-if="hasUbn" class="innovative-field fade-in" :class="{ 'field-is-valid': form.unified_business_number.length === 8 }">
            <div class="field-icon-wrapper">
              <ion-icon :icon="businessOutline" />
            </div>
            <div class="field-content">
              <label class="field-label">{{ $t('merchant.register.steps.business') }}</label>
              <ion-input 
                v-model="form.unified_business_number" 
                :placeholder="$t('merchant.register.placeholders.ubn')" 
                class="innovative-input" 
                :maxlength="8"
              />
            </div>
            <ion-icon :icon="checkmarkCircleOutline" class="field-valid-indicator" />
          </div>
        </div>

        <!-- Step 6: Review -->
        <div v-if="currentStep === 6" class="step-content fade-in">
          <div class="step-header">
            <h1 class="step-title">{{ $t('merchant.register.steps.review') }}</h1>
            <p class="step-subtitle">{{ $t('merchant.register.hints.review') }}</p>
          </div>
          
          <ion-card class="review-card ion-no-margin">
            <ion-card-content>
              <div class="review-item">
                <label>{{ $t('merchant.register.steps.storeInfo') }}</label>
                <p>{{ form.store_name }} <span v-if="form.store_name_zh">({{ form.store_name_zh }})</span></p>
              </div>
              <div class="review-item">
                <label>{{ $t('merchant.register.steps.address') }}</label>
                <p>{{ form.store_address || $t('common.no') }}</p>
              </div>
              <div class="review-item">
                <label>{{ $t('merchant.register.steps.contact') }}</label>
                <p>{{ form.contact_phone }}</p>
              </div>
              <div v-if="form.unified_business_number" class="review-item">
                <label>{{ $t('merchant.register.steps.business') }}</label>
                <p>{{ form.unified_business_number }}</p>
              </div>
            </ion-card-content>
          </ion-card>
          
          <p class="final-note ion-margin-top" style="opacity: 0.7; font-size: 0.8rem;">
            {{ $t('merchant.register.hints.review_note') }}
          </p>
        </div>
      </div>
    </ion-content>

    <ion-footer v-if="!isSubmitted" class="ion-no-border ion-padding">
      <div class="footer-buttons">
        <ion-button 
          v-if="currentStep > 1" 
          fill="clear" 
          @click="prevStep" 
          class="prev-btn"
          color="medium"
        >
          {{ $t('common.previous') }}
        </ion-button>
        
        <ion-button 
          v-if="currentStep < totalSteps" 
          expand="block" 
          @click="nextStep" 
          class="next-btn"
          color="carrot"
          :disabled="!isStepValid"
        >
          {{ $t('common.next') }}
        </ion-button>
        
        <ion-button 
          v-else 
          expand="block" 
          @click="submitApplication" 
          class="submit-btn"
          color="carrot"
          :disabled="submitting"
        >
          <ion-spinner v-if="submitting" name="crescent" slot="start" />
          {{ $t('common.submit') }}
        </ion-button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  IonPage, IonHeader, IonButtons, IonBackButton, IonTitle, 
  IonContent, IonList, IonItem, IonLabel, IonInput, IonTextarea, 
  IonButton, IonFooter, IonIcon, IonSpinner, IonCard, IonCardContent,
  IonSelect, IonSelectOption,
  toastController, onIonViewWillEnter
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import { useNotifier } from '@/composables/useNotifier'
import { 
  informationCircleOutline, 
  callOutline,
  storefrontOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircleOutline,
  businessOutline,
  alertCircleOutline,
  checkmarkCircle
} from 'ionicons/icons'
import { MerchantService } from '@/services/MerchantService'
import { ActivityLogService } from '@/services/ActivityLogService'
import router from '@/router'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

onIonViewWillEnter(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    router.replace('/profile')
    return
  }

  // Check if they already have a store
  const { data: store } = await supabase
    .from('merchant_stores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (store) {
    router.replace('/profile')
    return
  }

  // Check for existing pending application
  const app = await MerchantService.getUserApplication()
  if (app) {
    if (app.status === 'pending') {
      router.replace('/profile')
      return
    }
    
    if (app.status === 'rejected') {
      merchantApplication.value = app
      // Pre-fill form
      form.value.store_name = app.store_name || ''
      form.value.store_name_zh = app.store_name_zh || ''
      form.value.store_address = app.store_address || ''
      form.value.store_description = app.store_description || ''
      form.value.unified_business_number = app.unified_business_number || ''
      
      if (app.unified_business_number) {
        hasUbn.value = true
      }

      // Parse phone (e.g. +886912345678)
      if (app.contact_phone) {
        const phoneMatch = app.contact_phone.match(/^(\+\d{1,4})(\d+)$/)
        if (phoneMatch) {
          selectedCountryCode.value = phoneMatch[1]
          form.value.contact_phone = phoneMatch[2]
        } else {
          form.value.contact_phone = app.contact_phone
        }
      }
    }
  }
  ActivityLogService.log('merchant_registration_page_open')
})

const currentStep = ref(1)
const totalSteps = 6
const submitting = ref(false)
const isSubmitted = ref(false)
const hasUbn = ref<boolean | null>(null)
const merchantApplication = ref<any>(null)

const { notifyEvent } = useNotifier()

// Country Selection State (OTP is disabled, but we keep code for formatting)
const selectedCountryCode = ref('+886')
const countryCodes = [
  { name: 'Taiwan', code: '+886' },
  { name: 'Indonesia', code: '+62' },
  { name: 'Malaysia', code: '+60' },
  { name: 'Vietnam', code: '+84' },
  { name: 'Philippines', code: '+63' },
  { name: 'Thailand', code: '+66' },
  { name: 'US', code: '+1' },
]

const form = ref({
  store_name: '',
  store_name_zh: '',
  store_address: '',
  store_description: '',
  contact_phone: '',
  unified_business_number: ''
})

const isStepValid = computed(() => {
  if (currentStep.value === 1) return form.value.store_name.trim().length > 0
  if (currentStep.value === 2) return true // Address is optional but recommended
  if (currentStep.value === 3) return form.value.store_description.trim().length >= 100
  if (currentStep.value === 4) return form.value.contact_phone.trim().length >= 8
  if (currentStep.value === 5) return hasUbn.value !== null
  return true
})

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
    ActivityLogService.log('merchant_registration_step_view', { step: currentStep.value })
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
    ActivityLogService.log('merchant_registration_step_view', { step: currentStep.value })
  }
}

async function submitApplication() {
  submitting.value = true
  try {
    const fullPhone = `${selectedCountryCode.value}${form.value.contact_phone.replace(/^0/, '')}`
    const payload = { 
      ...form.value,
      contact_phone: fullPhone
    }
    
    // Clear UBN if not chosen
    if (!hasUbn.value) {
      payload.unified_business_number = ''
    }

    await MerchantService.submitApplication(payload)
    
    // 🔔 Notify Discord (Admin only)
    const isUpdate = !!merchantApplication.value
    const notifyTitle = isUpdate 
      ? `🔄 Resubmitted Merchant: ${form.value.store_name}`
      : `🆕 New Merchant: ${form.value.store_name}`

    await notifyEvent(
      'new_merchant_application',
      notifyTitle,
      `A merchant has ${isUpdate ? 'resubmitted' : 'applied'} for verification.\n\n` +
      `**Store:** ${form.value.store_name} (${form.value.store_name_zh || 'N/A'})\n` +
      `**Phone:** ${fullPhone}\n` +
      `**Address:** ${form.value.store_address || 'N/A'}\n` +
      `**UBN:** ${form.value.unified_business_number || 'None'}\n\n` +
      `**Description:**\n${form.value.store_description}`,
      undefined,
      { 
        store_name: form.value.store_name,
        contact_phone: fullPhone,
        ubn: form.value.unified_business_number,
        is_update: isUpdate
      },
      ['discord']
    )
    
    const toast = await toastController.create({
      message: t('merchant.register.success'),
      duration: 3000,
      color: 'success',
      position: 'bottom'
    })
    await toast.present()
    
    isSubmitted.value = true
    ActivityLogService.log('merchant_registration_success')
  } catch (error: any) {
    const toast = await toastController.create({
      message: error.message || 'Error submitting application.',
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    })
    await toast.present()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.success-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  min-height: 80%;
}

.success-circle {
  width: 100px;
  height: 100px;
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.success-circle ion-icon {
  font-size: 64px;
}

.success-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
}

.success-subtitle {
  font-size: 18px;
  color: var(--ion-color-medium);
  margin-bottom: 32px;
}

.success-card {
  background: rgba(var(--ion-color-light-rgb), 0.4);
  border-radius: 24px;
  border: 1px solid var(--ion-color-light-shade);
  margin-bottom: 40px;
}

.success-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--ion-color-step-600);
  margin: 0;
}

.back-btn {
  width: 100%;
  max-width: 300px;
  height: 56px;
  --border-radius: 18px;
  font-weight: 700;
  font-size: 1.1rem;
}

.rejected-banner {
  background: rgba(var(--ion-color-danger-rgb), 0.08);
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.2);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.banner-alert-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.banner-reason-standalone strong {
  display: block;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--ion-color-danger);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.banner-reason-standalone p {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.3;
}

.registration-container {
  max-width: 600px;
  margin: 0 auto;
}

.progress-container {
  height: 6px;
  background: var(--ion-color-light);
  width: 100%;
}

.progress-bar {
  height: 100%;
  background: var(--ion-color-carrot);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 3px 3px 0;
}

.step-content {
  padding: 5px 0;
}

.step-header {
  margin-bottom: 32px;
}

.step-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.step-subtitle {
  font-size: 16px;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

/* Iconic Input Cards */
.innovative-field {
  background: rgba(var(--ion-color-carrot-rgb), 0.03);
  border: 1.5px solid var(--ion-color-light-shade);
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.innovative-field:focus-within {
  background: var(--ion-background-color);
  border-color: var(--ion-color-carrot);
  box-shadow: 0 8px 24px rgba(var(--ion-color-carrot-rgb), 0.15);
  transform: translateY(-2px);
}

.field-icon-wrapper {
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.innovative-field:focus-within .field-icon-wrapper {
  background: var(--ion-color-carrot);
}

.field-icon-wrapper ion-icon {
  font-size: 24px;
  color: var(--ion-color-carrot);
  transition: all 0.3s ease;
}

.innovative-field:focus-within .field-icon-wrapper ion-icon {
  color: white;
}

.field-content {
  flex: 1;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  transition: all 0.3s ease;
}

.required-asterisk {
  color: var(--ion-color-danger);
  margin-left: 2px;
}

.innovative-field:focus-within .field-label {
  color: var(--ion-color-carrot);
}

.innovative-input {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin: 0;
  --background: transparent;
}

.char-counter {
  font-size: 12px;
  color: var(--ion-color-medium);
  text-align: right;
  margin-top: 8px;
  font-weight: 700;
}

.char-counter.valid {
  color: var(--ion-color-success);
}

/* Validation Feedback */
.field-valid-indicator {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--ion-color-success);
  font-size: 20px;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.field-is-valid .field-valid-indicator {
  opacity: 1;
  transform: scale(1);
}

.field-is-valid {
  border-color: rgba(var(--ion-color-success-rgb), 0.3);
}

/* Note Boxes */
.verification-note {
  background: rgba(var(--ion-color-carrot-rgb), 0.05);
  border: 1px solid var(--ion-color-carrot);
  border-radius: 20px;
  text-align: center;
  margin-top: 24px;
}

.verification-note h3 {
  font-weight: 800;
  margin: 12px 0 4px;
  color: var(--ion-color-dark);
}

.verification-note p {
  font-size: 14px;
  color: var(--ion-color-medium);
}

/* Footer & Progress */
.footer-buttons {
  display: flex;
  gap: 12px;
}

.next-btn, .submit-btn {
  flex: 2;
  --border-radius: 16px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 56px;
  font-weight: 700;
  font-size: 1.1rem;
}

.prev-btn {
  flex: 1;
  font-weight: 600;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.review-card {
  border-radius: 24px;
  background: rgba(var(--ion-color-light-rgb), 0.3);
  border: 1px solid var(--ion-color-light-shade);
}

.review-item {
  margin-bottom: 20px;
}

.review-item label {
  font-size: 0.75rem;
  color: var(--ion-color-carrot);
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
  display: block;
}

.phone-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.country-select {
  --padding-start: 0;
  --padding-end: 8px;
  border-right: 1px solid var(--ion-color-light-shade);
  font-weight: 700;
  font-size: 1.1rem;
  width: 90px;
}

.otp-actions {
  animation: fadeIn 0.3s ease-out;
}

.otp-verify-group {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(var(--ion-color-carrot-rgb), 0.05);
  padding: 8px;
  border-radius: 12px;
}

.otp-input {
  --padding-start: 12px;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: 2px;
}

.resend-btn {
  font-size: 0.75rem;
  margin-top: 4px;
}
.phone-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.country-select {
  --padding-start: 0;
  --padding-end: 8px;
  border-right: 1px solid var(--ion-color-light-shade);
  font-weight: 700;
  font-size: 1.1rem;
  width: 90px;
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ion-color-medium);
  margin-top: 8px;
  margin-bottom: 0;
}

.field-hint ion-icon {
  font-size: 14px;
}
</style>
