<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('admin.claims.title')" show-back back-route="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="admin-container">
        <div v-if="loading" class="ion-text-center ion-padding">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <div v-if="claims.length === 0" class="empty-state fade-in">
            <ion-icon :icon="checkmarkCircleOutline" size="large" color="success" />
            <h3>{{ $t('admin.claims.noPending') }}</h3>
          </div>

          <div v-else class="applications-list">
            <ion-card v-for="claim in claims" :key="claim.id" class="application-card fade-in">
              <ion-card-header>
                <div class="card-title-row">
                  <ion-card-title>{{ claim.locations?.name || `#${claim.location_id}` }}</ion-card-title>
                  <ion-badge color="warning">{{ $t('admin.claims.pending') }}</ion-badge>
                </div>
                <ion-card-subtitle v-if="claim.locations?.address">{{ claim.locations.address }}</ion-card-subtitle>
              </ion-card-header>

              <ion-card-content>
                <div class="info-grid">
                  <div class="info-item">
                    <label>{{ $t('business.claim.steps.role') }}</label>
                    <p class="capitalize">{{ claim.claimant_role }}</p>
                  </div>
                  <div class="info-item">
                    <label>{{ $t('business.claim.fields.phone') }}</label>
                    <p>{{ claim.contact_phone }}</p>
                  </div>
                  <div class="info-item" v-if="claim.contact_name">
                    <label>{{ $t('business.claim.fields.name') }}</label>
                    <p>{{ claim.contact_name }}</p>
                  </div>
                  <div class="info-item" v-if="claim.unified_business_number">
                    <label>{{ $t('business.claim.fields.ubn') }}</label>
                    <p>{{ claim.unified_business_number }}</p>
                  </div>
                  <div class="info-item full-width" v-if="claim.note">
                    <label>{{ $t('business.claim.fields.note') }}</label>
                    <p class="description">{{ claim.note }}</p>
                  </div>
                </div>

                <div v-if="claim.signedProofs?.length" class="proof-row">
                  <img
                    v-for="(url, i) in claim.signedProofs" :key="i"
                    :src="url" class="proof-img"
                    @click="openImage(url)"
                  />
                </div>

                <div class="action-buttons ion-margin-top">
                  <ion-button fill="outline" color="danger" class="action-btn" @click="handleReject(claim)">
                    {{ $t('admin.claims.reject') }}
                  </ion-button>
                  <ion-button color="success" class="action-btn" @click="handleApprove(claim)">
                    {{ $t('admin.claims.approve') }}
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </template>
      </div>
    </ion-content>

    <!-- Fullscreen zoomable proof image -->
    <ion-modal :is-open="!!zoomImage" @didDismiss="zoomImage = null">
      <ion-content fullscreen>
        <ion-button fill="solid" color="carrot" class="image-modal-close-btn" @click="zoomImage = null">✕</ion-button>
        <Swiper :modules="[Zoom]" :zoom="true" :slides-per-view="1" class="fullscreen-swiper">
          <SwiperSlide>
            <div class="swiper-zoom-container">
              <img :src="zoomImage || ''" alt="Proof image" />
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonContent, IonSpinner, IonCard, IonCardHeader,
  IonCardTitle, IonCardSubtitle, IonCardContent, IonBadge, IonButton, IonIcon,
  IonModal, alertController, toastController
} from '@ionic/vue'
import { checkmarkCircleOutline } from 'ionicons/icons'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/zoom'
import AppHeader from '@/components/AppHeader.vue'
import { ClaimService } from '@/services/ClaimService'
import { supabase } from '@/plugins/supabaseClient'
import type { LocationClaim } from '@/types/Business'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const loading = ref(true)
const claims = ref<LocationClaim[]>([])
const zoomImage = ref<string | null>(null)

function openImage(url: string) { zoomImage.value = url }

async function fetchClaims() {
  loading.value = true
  try {
    const rows = await ClaimService.getPendingClaims()
    // Resolve signed URLs for the private proof objects (paths). Legacy claims
    // may hold full public URLs (old bucket) — pass those through untouched.
    for (const c of rows) {
      c.signedProofs = await resolveProofs(c.proof_urls ?? [])
    }
    claims.value = rows
  } catch {
    showToast(t('common.error'), 'danger')
  } finally {
    loading.value = false
  }
}

async function resolveProofs(refs: string[]): Promise<string[]> {
  const out: string[] = []
  for (const ref of refs) {
    if (/^https?:\/\//.test(ref)) { out.push(ref); continue } // legacy public URL
    const { data } = await supabase.storage.from('claim-proofs').createSignedUrl(ref, 3600)
    if (data?.signedUrl) out.push(data.signedUrl)
  }
  return out
}

async function handleApprove(claim: LocationClaim) {
  const alert = await alertController.create({
    header: t('admin.claims.confirmApprove'),
    message: t('admin.claims.confirmApproveMsg', { name: claim.locations?.name || '' }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('admin.claims.approve'),
        handler: async () => {
          try {
            await ClaimService.approveClaim(claim.id!)
            showToast(t('admin.claims.approveSuccess'), 'success')
            fetchClaims()
          } catch {
            showToast(t('common.error'), 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function handleReject(claim: LocationClaim) {
  const alert = await alertController.create({
    header: t('admin.claims.confirmReject'),
    message: t('admin.claims.confirmRejectMsg'),
    inputs: [{ name: 'reason', type: 'textarea', placeholder: t('admin.claims.reasonPlaceholder') }],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('admin.claims.reject'),
        handler: async (data) => {
          if (!data.reason) { showToast(t('admin.claims.reasonRequired'), 'warning'); return false }
          try {
            await ClaimService.rejectClaim(claim.id!, data.reason)
            showToast(t('admin.claims.rejectSuccess'), 'medium')
            fetchClaims()
          } catch {
            showToast(t('common.error'), 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({ message, duration: 2000, color, position: 'bottom' })
  await toast.present()
}

onMounted(fetchClaims)
</script>

<style scoped>
.admin-container { max-width: 800px; margin: 0 auto; }
.application-card { border-radius: 20px; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.card-title-row { display: flex; justify-content: space-between; align-items: flex-start; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }
.info-item label { display: block; font-size: .7rem; color: var(--ion-color-medium); text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
.info-item p { margin: 0; font-weight: 600; color: var(--ion-color-dark); }
.full-width { grid-column: span 2; }
.description { font-size: .9rem; line-height: 1.4; white-space: pre-wrap; }
.capitalize { text-transform: capitalize; }
.proof-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.proof-img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; border: 1px solid var(--ion-color-light-shade); cursor: pointer; }

.image-modal-close-btn { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px; z-index: 9999; }
.fullscreen-swiper { width: 100%; height: 100%; }
.fullscreen-swiper .swiper-zoom-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.fullscreen-swiper img { max-width: 100%; max-height: 100%; object-fit: contain; }
.action-buttons { display: flex; gap: 12px; }
.action-btn { flex: 1; --border-radius: 12px; font-weight: 700; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-state h3 { color: var(--ion-color-medium); font-weight: 600; margin-top: 16px; }
.fade-in { animation: fadeIn .4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
