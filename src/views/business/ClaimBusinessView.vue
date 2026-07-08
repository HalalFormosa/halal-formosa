<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header
        :title="$t('business.claim.title')"
        show-back
        :back-route="`/place/${locationId}`"
        icon="none"
      />
      <div class="progress-container">
        <div class="progress-bar" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Success -->
      <div v-if="isSubmitted" class="success-screen fade-in">
        <div class="success-circle">
          <ion-icon :icon="checkmarkCircleOutline" color="carrot" />
        </div>
        <h1 class="success-title">{{ $t('business.claim.successTitle') }}</h1>
        <p class="success-subtitle">{{ $t('business.claim.successSubtitle') }}</p>
        <div class="success-card ion-padding">
          <p class="success-text">{{ $t('business.claim.successText') }}</p>
        </div>
        <ion-button expand="block" color="carrot" mode="md" class="back-btn" @click="goBackToListing">
          {{ $t('business.claim.backToListing') }}
        </ion-button>
      </div>

      <div v-else class="registration-container">
        <!-- Context: which business is being claimed -->
        <div class="claim-target fade-in">
          <ion-icon :icon="storefrontOutline" color="carrot" />
          <div>
            <p class="claim-target-label">{{ $t('business.claim.claiming') }}</p>
            <p class="claim-target-name">{{ locationName || '…' }}</p>
            <p v-if="locationAddress" class="claim-target-address">{{ locationAddress }}</p>
          </div>
        </div>

        <!-- Already pending -->
        <div v-if="existingPending" class="verification-note ion-margin-top ion-padding">
          <ion-icon :icon="hourglassOutline" size="large" color="carrot" />
          <h3 class="ion-padding-top">{{ $t('business.claim.pendingTitle') }}</h3>
          <p>{{ $t('business.claim.pendingText') }}</p>
        </div>

        <template v-else>
          <!-- Step 1: Your role -->
          <div v-if="currentStep === 1" class="step-content fade-in">
            <div class="step-header">
              <h1 class="step-title">{{ $t('business.claim.steps.role') }}</h1>
              <p class="step-subtitle">{{ $t('business.claim.hints.role') }}</p>
            </div>
            <div class="choice-container">
              <ion-button
                v-for="r in roleOptions" :key="r.value"
                :fill="form.claimant_role === r.value ? 'solid' : 'outline'"
                @click="form.claimant_role = r.value"
                expand="block" color="carrot" mode="md" class="role-btn"
              >
                {{ $t(r.label) }}
              </ion-button>
            </div>

            <div class="innovative-field ion-margin-top" :class="{ 'field-is-valid': form.contact_name.length > 0 }">
              <div class="field-icon-wrapper"><ion-icon :icon="personOutline" /></div>
              <div class="field-content">
                <label class="field-label">{{ $t('business.claim.fields.name') }}</label>
                <ion-input v-model="form.contact_name" :placeholder="$t('business.claim.fields.name')" class="innovative-input" />
              </div>
            </div>
          </div>

          <!-- Step 2: Contact -->
          <div v-if="currentStep === 2" class="step-content fade-in">
            <div class="step-header">
              <h1 class="step-title">{{ $t('business.claim.steps.contact') }}</h1>
              <p class="step-subtitle">{{ $t('business.claim.hints.contact') }}</p>
            </div>

            <div class="innovative-field" :class="{ 'field-is-valid': form.contact_phone.length >= 8 }">
              <div class="field-icon-wrapper"><ion-icon :icon="callOutline" /></div>
              <div class="field-content">
                <label class="field-label">{{ $t('business.claim.fields.phone') }}<span class="required-asterisk">*</span></label>
                <div class="phone-input-group">
                  <ion-select v-model="selectedCountryCode" interface="popover" class="country-select">
                    <ion-select-option v-for="c in countryCodes" :key="c.code" :value="c.code">{{ c.code }}</ion-select-option>
                  </ion-select>
                  <ion-input v-model="form.contact_phone" type="tel" :placeholder="$t('business.claim.fields.phone')" class="innovative-input" />
                </div>
              </div>
            </div>

            <div class="innovative-field" :class="{ 'field-is-valid': form.contact_email.length > 0 }">
              <div class="field-icon-wrapper"><ion-icon :icon="mailOutline" /></div>
              <div class="field-content">
                <label class="field-label">{{ $t('business.claim.fields.email') }}</label>
                <ion-input v-model="form.contact_email" type="email" :placeholder="$t('business.claim.fields.email')" class="innovative-input" />
              </div>
            </div>
          </div>

          <!-- Step 3: UBN -->
          <div v-if="currentStep === 3" class="step-content fade-in">
            <div class="step-header">
              <h1 class="step-title">{{ $t('business.claim.steps.business') }}</h1>
              <p class="step-subtitle">{{ $t('business.claim.hints.ubn') }}</p>
            </div>
            <div class="innovative-field" :class="{ 'field-is-valid': form.unified_business_number.length === 8 }">
              <div class="field-icon-wrapper"><ion-icon :icon="businessOutline" /></div>
              <div class="field-content">
                <label class="field-label">{{ $t('business.claim.fields.ubn') }}</label>
                <ion-input v-model="form.unified_business_number" :placeholder="$t('business.claim.fields.ubn')" class="innovative-input" :maxlength="8" />
              </div>
            </div>
          </div>

          <!-- Step 4: Proof -->
          <div v-if="currentStep === 4" class="step-content fade-in">
            <div class="step-header">
              <h1 class="step-title">{{ $t('business.claim.steps.proof') }}</h1>
              <p class="step-subtitle">{{ $t('business.claim.hints.proof') }}</p>
            </div>

            <div class="proof-grid">
              <div v-for="(p, i) in proofPreviews" :key="i" class="proof-thumb">
                <img :src="p" />
                <ion-icon :icon="closeCircle" class="proof-remove" @click="removeProof(i)" />
              </div>
              <label class="proof-add">
                <ion-icon :icon="cameraOutline" />
                <span>{{ $t('business.claim.addProof') }}</span>
                <input type="file" accept="image/*" multiple hidden @change="onProofSelected" />
              </label>
            </div>

            <div class="innovative-field ion-margin-top">
              <div class="field-icon-wrapper"><ion-icon :icon="documentTextOutline" /></div>
              <div class="field-content">
                <label class="field-label">{{ $t('business.claim.fields.note') }}</label>
                <ion-textarea v-model="form.note" :rows="3" :placeholder="$t('business.claim.hints.note')" class="innovative-input" />
              </div>
            </div>
          </div>

          <!-- Step 5: Review -->
          <div v-if="currentStep === 5" class="step-content fade-in">
            <div class="step-header">
              <h1 class="step-title">{{ $t('business.claim.steps.review') }}</h1>
              <p class="step-subtitle">{{ $t('business.claim.hints.review') }}</p>
            </div>
            <ion-card class="review-card ion-no-margin">
              <ion-card-content>
                <div class="review-item">
                  <label>{{ $t('business.claim.steps.role') }}</label>
                  <p>{{ $t(roleOptions.find(r => r.value === form.claimant_role)?.label || '') }}<span v-if="form.contact_name"> — {{ form.contact_name }}</span></p>
                </div>
                <div class="review-item">
                  <label>{{ $t('business.claim.fields.phone') }}</label>
                  <p>{{ selectedCountryCode }}{{ form.contact_phone }}</p>
                </div>
                <div v-if="form.contact_email" class="review-item">
                  <label>{{ $t('business.claim.fields.email') }}</label>
                  <p>{{ form.contact_email }}</p>
                </div>
                <div v-if="form.unified_business_number" class="review-item">
                  <label>{{ $t('business.claim.fields.ubn') }}</label>
                  <p>{{ form.unified_business_number }}</p>
                </div>
                <div class="review-item">
                  <label>{{ $t('business.claim.steps.proof') }}</label>
                  <p>{{ proofFiles.length }} {{ $t('business.claim.filesAttached') }}</p>
                </div>
              </ion-card-content>
            </ion-card>
            <p class="final-note ion-margin-top" style="opacity: 0.7; font-size: 0.8rem;">
              {{ $t('business.claim.hints.reviewNote') }}
            </p>
          </div>
        </template>
      </div>
    </ion-content>

    <ion-footer v-if="!isSubmitted && !existingPending" class="ion-no-border ion-padding">
      <div class="footer-buttons">
        <ion-button v-if="currentStep > 1" fill="clear" color="medium" class="prev-btn" @click="prevStep">
          {{ $t('common.previous') }}
        </ion-button>
        <ion-button v-if="currentStep < totalSteps" expand="block" color="carrot" class="next-btn" :disabled="!isStepValid" @click="nextStep">
          {{ $t('common.next') }}
        </ion-button>
        <ion-button v-else expand="block" color="carrot" class="submit-btn" :disabled="submitting" @click="submitClaim">
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
  IonPage, IonHeader, IonContent, IonFooter, IonButton, IonIcon, IonInput,
  IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonCard, IonCardContent,
  toastController, onIonViewWillEnter, useIonRouter
} from '@ionic/vue'
import {
  checkmarkCircleOutline, storefrontOutline, personOutline, callOutline, mailOutline,
  businessOutline, documentTextOutline, cameraOutline, closeCircle, hourglassOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import router from '@/router'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import { ClaimService } from '@/services/ClaimService'
import { useNotifier } from '@/composables/useNotifier'
import type { ClaimantRole } from '@/types/Business'

const { t } = useI18n()
const route = useRoute()
const ionRouter = useIonRouter()
const { notifyEvent } = useNotifier()

const locationId = Number(route.params.id)

function goBackToListing() {
  // Explicit "back" navigation so Ionic pops the claim page and returns to the
  // place detail with a proper transition (plain router.replace doesn't animate/pop here).
  ionRouter.navigate(`/place/${locationId}`, 'back', 'replace')
}
const locationName = ref('')
const locationAddress = ref('')
const existingPending = ref(false)

const currentStep = ref(1)
const totalSteps = 5
const submitting = ref(false)
const isSubmitted = ref(false)

const selectedCountryCode = ref('+886')
const countryCodes = [
  { code: '+886' }, { code: '+62' }, { code: '+60' }, { code: '+84' },
  { code: '+63' }, { code: '+66' }, { code: '+1' },
]

const roleOptions: { value: ClaimantRole; label: string }[] = [
  { value: 'owner', label: 'business.claim.roles.owner' },
  { value: 'manager', label: 'business.claim.roles.manager' },
  { value: 'staff', label: 'business.claim.roles.staff' },
]

const form = ref({
  claimant_role: 'owner' as ClaimantRole,
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  unified_business_number: '',
  note: '',
})

const proofFiles = ref<File[]>([])
const proofPreviews = ref<string[]>([])

onIonViewWillEnter(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.replace(`/place/${locationId}`); return }

  // Pre-fill contact details from the current user's account/profile
  form.value.contact_email = user.email ?? ''
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    if (profile.display_name) form.value.contact_name = profile.display_name
    if (profile.phone) {
      // Split a stored "+886912345678" into country code + local number
      const m = String(profile.phone).match(/^(\+\d{1,4})(\d+)$/)
      if (m && countryCodes.some(c => c.code === m[1])) {
        selectedCountryCode.value = m[1]
        form.value.contact_phone = m[2]
      } else {
        form.value.contact_phone = String(profile.phone).replace(/^0/, '')
      }
    }
  }

  const { data: loc } = await supabase
    .from('locations')
    .select('name, address, is_claimed')
    .eq('id', locationId)
    .maybeSingle()

  if (loc) {
    locationName.value = loc.name
    locationAddress.value = loc.address || ''
  }

  // If the current user already has a pending claim, show a waiting note.
  const existing = await ClaimService.getUserClaimForLocation(locationId)
  existingPending.value = existing?.status === 'pending'
})

const isStepValid = computed(() => {
  if (currentStep.value === 1) return !!form.value.claimant_role
  if (currentStep.value === 2) return form.value.contact_phone.trim().length >= 8
  return true
})

function nextStep() { if (currentStep.value < totalSteps) currentStep.value++ }
function prevStep() { if (currentStep.value > 1) currentStep.value-- }

function onProofSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (const file of Array.from(input.files)) {
    proofFiles.value.push(file)
    proofPreviews.value.push(URL.createObjectURL(file))
  }
  input.value = ''
}

function removeProof(i: number) {
  proofFiles.value.splice(i, 1)
  proofPreviews.value.splice(i, 1)
}

async function uploadProofs(): Promise<string[]> {
  // Proof docs are sensitive → private `claim-proofs` bucket. We store the object
  // PATH (not a public URL); admins fetch signed URLs when reviewing.
  // Path must start with the user's id so storage RLS authorizes the write.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const paths: string[] = []
  for (const file of proofFiles.value) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('claim-proofs').upload(path, file, { upsert: false })
    if (error) { console.error('[ClaimBusiness] proof upload error', error); continue }
    paths.push(path)
  }
  return paths
}

async function submitClaim() {
  submitting.value = true
  try {
    const proofUrls = await uploadProofs()
    const fullPhone = `${selectedCountryCode.value}${form.value.contact_phone.replace(/^0/, '')}`

    await ClaimService.submitClaim({
      location_id: locationId,
      claimant_role: form.value.claimant_role,
      contact_name: form.value.contact_name || null,
      contact_phone: fullPhone,
      contact_email: form.value.contact_email || null,
      unified_business_number: form.value.unified_business_number || null,
      proof_urls: proofUrls,
      note: form.value.note || null,
    })

    await notifyEvent(
      'new_location_claim',
      `🏷️ Business claim: ${locationName.value}`,
      `A user submitted a claim for **${locationName.value}** (#${locationId}).\n` +
      `**Role:** ${form.value.claimant_role}\n` +
      `**Contact:** ${form.value.contact_name || 'N/A'} — ${fullPhone}\n` +
      `**UBN:** ${form.value.unified_business_number || 'None'}\n` +
      `**Proof files:** ${proofUrls.length}`,
      undefined,
      { location_id: locationId, role: form.value.claimant_role },
      ['discord']
    )

    isSubmitted.value = true
  } catch (error: any) {
    const toast = await toastController.create({
      message: error?.message || t('common.error'),
      duration: 3000, color: 'danger', position: 'bottom'
    })
    await toast.present()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.progress-container { height: 6px; background: var(--ion-color-light); width: 100%; }
.progress-bar { height: 100%; background: var(--ion-color-carrot); transition: width .5s cubic-bezier(.4,0,.2,1); border-radius: 0 3px 3px 0; }
.registration-container { max-width: 600px; margin: 0 auto; }

.claim-target {
  display: flex; align-items: center; gap: 14px;
  background: rgba(var(--ion-color-carrot-rgb), 0.06);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.2);
  border-radius: 18px; padding: 14px 16px; margin-bottom: 20px;
}
.claim-target ion-icon { font-size: 30px; flex-shrink: 0; }
.claim-target-label { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--ion-color-medium); margin: 0; }
.claim-target-name { font-size: 1.1rem; font-weight: 800; color: var(--ion-color-dark); margin: 2px 0 0; }
.claim-target-address { font-size: .85rem; color: var(--ion-color-medium); margin: 2px 0 0; }

.step-content { padding: 5px 0; }
.step-header { margin-bottom: 24px; }
.step-title { font-size: 26px; font-weight: 800; color: var(--ion-color-dark); margin-bottom: 8px; letter-spacing: -.5px; }
.step-subtitle { font-size: 16px; color: var(--ion-color-medium); line-height: 1.4; }

.choice-container { display: flex; flex-direction: column; gap: 12px; }
.role-btn { height: 56px; --border-radius: 18px; font-weight: 800; margin: 0; }

.innovative-field {
  background: rgba(var(--ion-color-carrot-rgb), 0.03);
  border: 1.5px solid var(--ion-color-light-shade);
  border-radius: 20px; padding: 16px; margin-bottom: 20px;
  display: flex; align-items: flex-start; gap: 16px; position: relative;
  transition: all .3s cubic-bezier(.4,0,.2,1);
}
.innovative-field:focus-within { background: var(--ion-background-color); border-color: var(--ion-color-carrot); box-shadow: 0 8px 24px rgba(var(--ion-color-carrot-rgb), .15); transform: translateY(-2px); }
.field-icon-wrapper { background: rgba(var(--ion-color-carrot-rgb), .1); width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.field-icon-wrapper ion-icon { font-size: 24px; color: var(--ion-color-carrot); }
.field-content { flex: 1; }
.field-label { display: block; font-size: .75rem; font-weight: 700; color: var(--ion-color-medium); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.required-asterisk { color: var(--ion-color-danger); margin-left: 2px; }
.innovative-input { --padding-start: 0; --padding-end: 0; --padding-top: 0; --padding-bottom: 0; font-size: 1.1rem; font-weight: 600; color: var(--ion-color-dark); margin: 0; --background: transparent; }
.field-is-valid { border-color: rgba(var(--ion-color-success-rgb), .3); }

.phone-input-group { display: flex; align-items: center; gap: 12px; }
.country-select { --padding-start: 0; --padding-end: 8px; border-right: 1px solid var(--ion-color-light-shade); font-weight: 700; font-size: 1.1rem; width: 80px; }

.proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.proof-thumb { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; }
.proof-thumb img { width: 100%; height: 100%; object-fit: cover; }
.proof-remove { position: absolute; top: 4px; right: 4px; font-size: 22px; color: #fff; background: rgba(0,0,0,.5); border-radius: 50%; }
.proof-add {
  aspect-ratio: 1; border: 2px dashed var(--ion-color-medium); border-radius: 14px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; color: var(--ion-color-medium); cursor: pointer; font-size: .75rem; font-weight: 700;
}
.proof-add ion-icon { font-size: 28px; color: var(--ion-color-carrot); }

.review-card { border-radius: 24px; background: rgba(var(--ion-color-light-rgb), .3); border: 1px solid var(--ion-color-light-shade); }
.review-item { margin-bottom: 20px; }
.review-item label { font-size: .75rem; color: var(--ion-color-carrot); font-weight: 800; text-transform: uppercase; margin-bottom: 4px; display: block; }
.review-item p { margin: 0; font-weight: 600; color: var(--ion-color-dark); }

.verification-note { background: rgba(var(--ion-color-carrot-rgb), .05); border: 1px solid var(--ion-color-carrot); border-radius: 20px; text-align: center; }
.verification-note h3 { font-weight: 800; margin: 12px 0 4px; color: var(--ion-color-dark); }
.verification-note p { font-size: 14px; color: var(--ion-color-medium); }

.footer-buttons { display: flex; gap: 12px; }
.next-btn, .submit-btn { flex: 2; --border-radius: 16px; height: 56px; font-weight: 700; font-size: 1.1rem; }
.prev-btn { flex: 1; font-weight: 600; }

.success-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; min-height: 80%; }
.success-circle { width: 100px; height: 100px; background: rgba(var(--ion-color-carrot-rgb), .1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; }
.success-circle ion-icon { font-size: 64px; }
.success-title { font-size: 28px; font-weight: 800; color: var(--ion-color-dark); margin-bottom: 8px; }
.success-subtitle { font-size: 18px; color: var(--ion-color-medium); margin-bottom: 32px; }
.success-card { background: rgba(var(--ion-color-light-rgb), .4); border-radius: 24px; border: 1px solid var(--ion-color-light-shade); margin-bottom: 40px; }
.success-text { font-size: 15px; line-height: 1.6; color: var(--ion-color-step-600); margin: 0; }
.back-btn { width: 100%; max-width: 300px; height: 56px; --border-radius: 18px; font-weight: 700; font-size: 1.1rem; }

.fade-in { animation: fadeIn .4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
