<template>
  <!-- Account-level business plan paywall. The tier applies to ALL of the owner's
       businesses, so this is shown from the Business overview, not per-listing. -->
  <ion-modal :is-open="open" @didDismiss="$emit('update:open', false)" :initial-breakpoint="0.8" :breakpoints="[0, 0.8, 1]">
    <ion-content class="ion-padding">
      <h2 class="up-title">{{ $t('business.plan.upgradeTitle') }}</h2>
      <p class="up-sub">{{ $t('business.plan.upgradeSub') }}</p>

      <div v-if="preview" class="up-preview-note">{{ $t('business.plan.previewNote') }}</div>

      <div v-if="upgradeLoading" class="ion-text-center ion-padding"><ion-spinner name="crescent" color="carrot" /></div>

      <!-- Tier comparison table (admin preview or live store packages) -->
      <template v-else-if="preview || businessPackages.length">
        <div class="cmp-wrap">
          <table class="cmp-table">
            <thead>
              <tr>
                <th class="cmp-corner"></th>
                <th
                  v-for="c in displayPlans" :key="c.tier"
                  class="cmp-h" :class="['tier-' + c.tier, { recommended: c.recommended, current: c.tier === currentTier }]"
                >
                  <span v-if="c.recommended" class="up-tag up-tag-rec">{{ $t('business.plan.popular') }}</span>
                  <span v-else-if="c.tier === currentTier" class="up-tag up-tag-current">{{ $t('business.plan.currentTag') }}</span>
                  <div class="cmp-h-name">{{ c.name }}</div>
                  <div class="cmp-h-price">{{ c.price }}<span class="up-per">{{ $t('business.plan.perMonth') }}</span></div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in CMP_ROWS" :key="row.label">
                <td class="cmp-feat">{{ row.label }}</td>
                <td
                  v-for="c in displayPlans" :key="c.tier"
                  class="cmp-cell" :class="{ recommended: c.recommended }"
                >
                  <ion-icon v-if="row.values[c.tier] === true" :icon="checkmarkCircle" class="cmp-yes" />
                  <span v-else-if="row.values[c.tier] === false" class="cmp-no">–</span>
                  <span v-else class="cmp-val">{{ row.values[c.tier] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Purchase actions -->
        <div class="cmp-actions">
          <template v-for="c in displayPlans" :key="c.tier">
            <ion-button
              v-if="!preview && c.pkg && c.tier !== currentTier"
              expand="block" class="cmp-action-btn" color="carrot"
              :fill="c.recommended ? 'solid' : 'outline'"
              :disabled="!!purchasingId" @click="buyPackage(c.pkg)"
            >
              <ion-spinner v-if="purchasingId === c.pkg.identifier" name="crescent" />
              <template v-else>{{ $t('business.plan.choose', { name: c.name }) }} · {{ c.price }}</template>
            </ion-button>
            <div v-else-if="c.tier === currentTier" class="cmp-current-chip">{{ c.name }} — {{ $t('business.plan.yourPlan') }}</div>
          </template>
        </div>

        <ion-button v-if="!preview" fill="clear" size="small" color="medium" expand="block" class="ion-margin-top" @click="restorePurchases">
          {{ $t('business.plan.restore') }}
        </ion-button>
      </template>

      <div v-else class="up-empty">
        <ion-icon :icon="lockClosedOutline" />
        <p>{{ $t('business.plan.upgradeUnavailable') }}</p>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { IonModal, IonContent, IonButton, IonIcon, IonSpinner, toastController } from '@ionic/vue'
import { lockClosedOutline, checkmarkCircle } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useBusinessSubscription } from '@/composables/useBusinessSubscription'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import type { PlanTier } from '@/types/Business'

const props = defineProps<{ open: boolean; currentTier: PlanTier; preview?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'purchased'): void }>()

const { t } = useI18n()
const bizSub = useBusinessSubscription()
const upgradeLoading = ref(false)
const businessPackages = ref<PurchasesPackage[]>([])
const purchasingId = ref<string | null>(null)

type PlanCardTier = Exclude<PlanTier, 'free'>
const PLAN_CARDS: { tier: PlanCardTier; name: string; recommended?: boolean }[] = [
  { tier: 'bronze', name: 'Bronze' },
  { tier: 'silver', name: 'Silver', recommended: true },
  { tier: 'gold', name: 'Gold' },
]

// Feature comparison matrix. `true`/`false` render as check / dash; strings render
// as-is. Kept in sync with app_config `business_plan_features`.
const CMP_ROWS: { label: string; values: Record<PlanCardTier, string | boolean> }[] = [
  { label: 'Photos',                values: { bronze: '5', silver: '10', gold: '∞' } },
  { label: 'Menu showcase',         values: { bronze: false, silver: true, gold: true } },
  { label: 'Promotions',            values: { bronze: '1', silver: '3', gold: '∞' } },
  { label: 'Standard analytics',    values: { bronze: true, silver: true, gold: true } },
  { label: 'Audience & peak times', values: { bronze: false, silver: true, gold: true } },
  { label: 'Funnel & benchmarking', values: { bronze: false, silver: false, gold: true } },
  { label: 'Top search terms',      values: { bronze: false, silver: false, gold: true } },
  { label: 'Weekly email + CSV',    values: { bronze: false, silver: false, gold: true } },
]

// Placeholder prices for the admin "Preview paywall" (live prices come from the store).
const PREVIEW_PRICES: Record<PlanCardTier, string> = { bronze: 'NT$330', silver: 'NT$690', gold: 'NT$990' }

function tierFromProductId(id: string): PlanTier {
  const s = (id || '').toLowerCase()
  if (s.includes('gold')) return 'gold'
  if (s.includes('silver')) return 'silver'
  if (s.includes('bronze')) return 'bronze'
  return 'free'
}

const displayPlans = computed(() =>
  PLAN_CARDS.map(card => {
    const pkg = businessPackages.value.find(p => tierFromProductId(p.product.identifier) === card.tier) ?? null
    return { ...card, pkg, price: pkg?.product.priceString ?? PREVIEW_PRICES[card.tier] }
  })
)

// Load live packages when opened for a real purchase; preview uses placeholder prices.
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  if (props.preview) { businessPackages.value = []; return }
  upgradeLoading.value = true
  try {
    businessPackages.value = await bizSub.getBusinessPackages()
  } finally {
    upgradeLoading.value = false
  }
})

async function buyPackage(pkg: PurchasesPackage) {
  const pkgTier = tierFromProductId(pkg.product.identifier)
  if (pkgTier === 'free') return

  purchasingId.value = pkg.identifier
  try {
    const { result } = await bizSub.presentPaywallForTier(pkgTier as PlanCardTier)

    if (result === 'ERROR') {
      // Fallback to direct purchase if the RevenueCat Paywall UI is unavailable.
      await bizSub.purchasePackage(pkg)
      await new Promise(r => setTimeout(r, 2000))
      emit('purchased')
      emit('update:open', false)
      await toast(t('business.plan.upgradeSuccess'), 'success')
      return
    }

    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      // Authoritative tier is written by the revenuecat-webhook; give it a moment.
      await new Promise(r => setTimeout(r, 2000))
      emit('purchased')
      emit('update:open', false)
      await toast(t('business.plan.upgradeSuccess'), 'success')
    }
  } catch (e: any) {
    if (!/cancel/i.test(e?.message || '')) await toast(e?.message || t('common.error'), 'danger')
  } finally {
    purchasingId.value = null
  }
}

async function restorePurchases() {
  try {
    await bizSub.restore()
    emit('purchased')
    await toast(t('business.plan.restored'), 'success')
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  }
}

async function toast(message: string, color: string) {
  const el = await toastController.create({ message, duration: 2500, color, position: 'bottom' })
  await el.present()
}
</script>

<style scoped>
.up-title { font-size: 1.4rem; font-weight: 900; margin: 4px 0 4px; color: var(--ion-color-dark); }
.up-sub { color: var(--ion-color-medium); margin: 0 0 20px; font-size: .9rem; }
.up-empty { text-align: center; padding: 40px 20px; color: var(--ion-color-medium); }
.up-empty ion-icon { font-size: 44px; }
.up-preview-note { background: rgba(var(--ion-color-warning-rgb), .14); border-radius: 10px; padding: 8px 12px; font-size: .78rem; font-weight: 600; color: var(--ion-color-dark); margin-bottom: 14px; }

.up-tag { display: inline-block; font-size: .58rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; margin-bottom: 4px; }
.up-tag-rec { background: var(--ion-color-carrot); color: #fff; }
.up-tag-current { background: var(--ion-color-medium); color: #fff; }
.up-per { font-size: .68rem; font-weight: 600; color: var(--ion-color-medium); margin-left: 2px; }

.cmp-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 16px; }
.cmp-table { width: 100%; min-width: 320px; border-collapse: collapse; }
.cmp-table th, .cmp-table td { text-align: center; padding: 9px 6px; }
.cmp-corner { width: 34%; }
.cmp-h { vertical-align: bottom; border-bottom: 2px solid var(--ion-color-light-shade); }
.cmp-h.recommended { background: rgba(var(--ion-color-carrot-rgb), .07); border-bottom-color: var(--ion-color-carrot); border-top-left-radius: 12px; border-top-right-radius: 12px; }
.cmp-h-name { font-size: 1rem; font-weight: 900; color: var(--ion-color-dark); }
.cmp-h-price { font-size: .8rem; font-weight: 800; color: var(--ion-color-carrot); white-space: nowrap; }
.cmp-feat { text-align: left; font-size: .82rem; font-weight: 600; color: var(--ion-color-dark); border-bottom: 1px solid var(--ion-color-light); }
.cmp-cell { font-size: .85rem; font-weight: 700; color: var(--ion-color-dark); border-bottom: 1px solid var(--ion-color-light); }
.cmp-cell.recommended { background: rgba(var(--ion-color-carrot-rgb), .05); }
.cmp-yes { color: var(--ion-color-success); font-size: 1.15rem; vertical-align: middle; }
.cmp-no { color: var(--ion-color-medium); }
.cmp-val { color: var(--ion-color-dark); }

.cmp-actions { display: flex; flex-direction: column; gap: 10px; }
.cmp-action-btn { --border-radius: 12px; font-weight: 800; margin: 0; }
.cmp-current-chip { text-align: center; font-size: .8rem; font-weight: 700; color: var(--ion-color-medium); background: var(--ion-color-light); border-radius: 12px; padding: 10px; }
</style>
