<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('business.dashboard.title')" show-back back-route="/profile" icon="none" />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="dash-container">
        <div v-if="loading" class="ion-text-center ion-padding">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <!-- Empty (no owned + no pending) -->
          <div v-if="locations.length === 0 && pendingClaims.length === 0" class="empty-state fade-in">
            <ion-icon :icon="storefrontOutline" color="carrot" />
            <h3>{{ $t('business.dashboard.empty') }}</h3>
            <p>{{ $t('business.dashboard.emptyHint') }}</p>
            <ion-button color="carrot" mode="md" @click="router.push('/explore')">
              {{ $t('business.dashboard.explore') }}
            </ion-button>
          </div>

          <template v-else>
            <!-- Pending claims -->
            <div v-if="pendingClaims.length" class="section-block fade-in">
              <p class="section-label">{{ $t('business.dashboard.pendingClaims') }}</p>
              <ion-card
                v-for="claim in pendingClaims" :key="claim.id"
                class="biz-card pending"
                button
                @click="router.push(`/place/${claim.location_id}`)"
              >
                <div class="biz-card-inner">
                  <div class="biz-thumb">
                    <img :src="claim.locations?.image || 'https://placehold.co/120x120?text=%20'" />
                  </div>
                  <div class="biz-info">
                    <div class="biz-title-row">
                      <h2>{{ claim.locations?.name || `#${claim.location_id}` }}</h2>
                      <ion-badge color="warning">{{ $t('business.dashboard.underReview') }}</ion-badge>
                    </div>
                    <p v-if="claim.locations?.address" class="biz-address">{{ claim.locations.address }}</p>
                  </div>
                </div>
              </ion-card>
            </div>

            <!-- Owned businesses -->
            <div v-if="locations.length" class="section-block">
              <p v-if="pendingClaims.length" class="section-label">{{ $t('business.dashboard.yourBusinesses') }}</p>
              <div class="biz-list">
            <ion-card
              v-for="loc in locations" :key="loc.id"
              class="biz-card fade-in"
              button
              @click="router.push(`/business/${loc.id}`)"
            >
              <div class="biz-card-inner">
                <div class="biz-thumb">
                  <img :src="loc.image || 'https://placehold.co/120x120?text=%20'" />
                </div>
                <div class="biz-info">
                  <div class="biz-title-row">
                    <h2>{{ loc.name }}</h2>
                    <span class="tier-pill" :class="loc.tier">{{ loc.tier }}</span>
                  </div>
                  <p v-if="loc.address" class="biz-address">{{ loc.address }}</p>
                  <p class="biz-role">{{ loc.role }}</p>
                </div>
                <ion-icon :icon="chevronForward" class="biz-chevron" />
              </div>
            </ion-card>
              </div>
            </div>
          </template>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  IonPage, IonHeader, IonContent, IonSpinner, IonCard, IonButton, IonIcon,
  IonBadge, onIonViewWillEnter
} from '@ionic/vue'
import { storefrontOutline, chevronForward } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import router from '@/router'
import { useBusinessListings, type OwnedLocation } from '@/composables/useBusinessListings'
import { ClaimService } from '@/services/ClaimService'
import { ActivityLogService } from '@/services/ActivityLogService'
import type { LocationClaim } from '@/types/Business'

const { getMyLocations } = useBusinessListings()
const loading = ref(true)
const locations = ref<OwnedLocation[]>([])
const pendingClaims = ref<LocationClaim[]>([])

onIonViewWillEnter(async () => {
  loading.value = true
  const [owned, pending] = await Promise.all([getMyLocations(), ClaimService.getMyPendingClaims()])
  locations.value = owned
  pendingClaims.value = pending
  loading.value = false
  ActivityLogService.log('business_dashboard_open', { count: locations.value.length, pending: pending.length })
})
</script>

<style scoped>
.dash-container { max-width: 720px; margin: 0 auto; }

.empty-state { text-align: center; padding: 60px 20px; }
.empty-state ion-icon { font-size: 64px; }
.empty-state h3 { color: var(--ion-color-dark); font-weight: 800; margin: 16px 0 8px; }
.empty-state p { color: var(--ion-color-medium); margin: 0 0 24px; }

.section-block { margin-bottom: 8px; }
.section-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .5px; font-weight: 800; color: var(--ion-color-medium); margin: 6px 4px 10px; }

.biz-card {
  border-radius: 18px; margin: 0 0 14px; box-shadow: 0 4px 16px rgba(0,0,0,.06);
}
.biz-card.pending { opacity: .92; }
.biz-card-inner { display: flex; align-items: center; gap: 14px; padding: 12px; }
.biz-thumb { width: 64px; height: 64px; border-radius: 14px; overflow: hidden; flex-shrink: 0; }
.biz-thumb img { width: 100%; height: 100%; object-fit: cover; }
.biz-info { flex: 1; min-width: 0; }
.biz-title-row { display: flex; align-items: center; gap: 8px; }
.biz-title-row h2 { font-size: 1.05rem; font-weight: 800; margin: 0; color: var(--ion-color-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.biz-address { font-size: .82rem; color: var(--ion-color-medium); margin: 2px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.biz-role { font-size: .72rem; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; color: var(--ion-color-carrot); margin: 4px 0 0; }
.biz-chevron { color: var(--ion-color-medium); font-size: 20px; }

.tier-pill { font-size: .62rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; padding: 2px 8px; border-radius: 999px; background: var(--ion-color-light); color: var(--ion-color-medium); }
.tier-pill.bronze { background: rgba(205,127,50,.15); color: #b06a2c; }
.tier-pill.silver { background: rgba(148,163,184,.2); color: #64748b; }
.tier-pill.gold   { background: rgba(202,138,4,.15); color: #ca8a04; }

.fade-in { animation: fadeIn .4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
