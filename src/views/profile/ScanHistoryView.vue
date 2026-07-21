<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.scanHistory')" show-back back-route="/profile" :icon="timeOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Paywall state for non-Pro/Free users -->
      <div v-if="!isDonor" class="paywall-container animate__animated animate__fadeIn">
        <div class="lock-icon-wrapper">
          <ion-icon :icon="lockClosedOutline" class="lock-icon" />
        </div>
        <h2 class="paywall-title">{{ $t('profile.scanHistory') }}</h2>
        <p class="paywall-description">
          Scan History is a premium feature available on Halal Formosa Pro. Keep track of all your scanned items and ingredients instantly.
        </p>
        <ion-button expand="block" color="carrot" @click="presentRcPaywall">
          Upgrade to Pro
        </ion-button>
      </div>

      <!-- Main content for Pro/Donor users -->
      <template v-else>
        <div v-if="loading" class="ion-text-center ion-margin-top">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <div v-if="combinedScans.length === 0" class="empty-state">
            <ion-icon :icon="documentTextOutline" class="empty-icon" />
            <h3>No scans yet</h3>
            <p>Products and ingredients you scan will appear here.</p>
          </div>

          <ion-list v-else lines="none">
            <ion-item
              v-for="item in combinedScans"
              :key="item.type + '-' + item.id"
              button
              @click="openScan(item)"
              class="history-item"
            >
              <ion-thumbnail v-if="item.photo" slot="start" class="product-thumbnail">
                <img :src="item.photo" alt="Product Image" />
              </ion-thumbnail>
              <div v-else slot="start" class="scan-type-icon" :class="item.type">
                <ion-icon :icon="item.type === 'barcode' ? barcodeOutline : documentTextOutline" />
              </div>

              <ion-label>
                <h3 class="product-name">{{ item.name }}</h3>
                <p v-if="item.subtitle" class="ingredients-summary">{{ item.subtitle }}</p>
                <p class="scan-time">
                  {{ item.type === 'barcode' ? 'Barcode' : 'Ingredients' }} · {{ fromNowToTaipei(item.created_at) }}
                </p>
              </ion-label>

              <span slot="end" :class="['status-badge', statusClass(item.status)]">
                {{ statusLabel(item.status) }}
              </span>
            </ion-item>
          </ion-list>
        </template>
      </template>

      <!-- Modal to show ingredient scan details -->
      <ion-modal :is-open="isDetailModalOpen" @didDismiss="isDetailModalOpen = false" class="ingredient-detail-modal">
        <ion-header>
          <ion-toolbar color="carrot">
            <ion-title>Ingredient Scan Detail</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="isDetailModalOpen = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div v-if="selectedScan" class="detail-modal-content">
            <h2 class="detail-title">{{ selectedScan.product_name || 'Ingredient Scan' }}</h2>
            <p class="detail-time"><strong>Scanned:</strong> {{ formatFullTime(selectedScan.created_at) }}</p>
            
            <div class="status-summary-box" :class="statusClass(selectedScan.auto_status)">
              <h3>Status: {{ statusLabel(selectedScan.auto_status) }}</h3>
            </div>

            <h3 class="section-title">Ingredients (Chinese)</h3>
            <div class="ingredients-box">{{ selectedScan.ingredients_text_zh || 'No Chinese text extracted' }}</div>

            <h3 class="section-title">Ingredients (English Translation)</h3>
            <div class="ingredients-box">{{ selectedScan.ingredients_text_en || 'No English translation available' }}</div>
          </div>
        </ion-content>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { ActivityLogService } from '@/services/ActivityLogService'
import { useNotifier } from '@/composables/useNotifier'
import {
  IonPage,
  IonHeader,
  IonContent,
  IonButton,
  IonIcon,
  IonLabel,
  IonSpinner,
  IonList,
  IonItem,
  IonThumbnail,
  IonModal,
  IonToolbar,
  IonTitle,
  IonButtons
} from '@ionic/vue'
import {
  timeOutline,
  lockClosedOutline,
  barcodeOutline,
  documentTextOutline
} from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import AppHeader from '@/components/AppHeader.vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const router = useRouter()
const { t } = useI18n()
const { notifyEvent } = useNotifier()

const loading = ref(false)
const combinedScans = ref<any[]>([])

// Modal details
const isDetailModalOpen = ref(false)
const selectedScan = ref<any>(null)

async function loadScanHistory() {
  if (!isDonor.value) return
  
  loading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Barcode scans — keep only those that matched a real catalog product
    //    (unlisted / unknown barcodes carry no info, so we drop them).
    const barcodeItems: any[] = []
    const { data: logData, error: logError } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_type', 'barcode_scan_success')
      .order('created_at', { ascending: false })
      .limit(100)

    if (logError) throw logError

    if (logData && logData.length > 0) {
      const barcodes = logData.map(log => log.activity_detail?.barcode).filter(Boolean)
      if (barcodes.length > 0) {
        const { data: productData } = await supabase
          .from('products')
          .select('id, name, barcode, photo_front_url, status, brand')
          .in('barcode', barcodes)
          .eq('is_archived', false)

        const productMap = new Map((productData || []).map(p => [p.barcode, p]))
        for (const log of logData) {
          const product = productMap.get(log.activity_detail?.barcode)
          if (!product) continue // skip unlisted / unknown
          barcodeItems.push({
            id: log.id,
            type: 'barcode',
            created_at: log.created_at,
            name: product.name,
            subtitle: product.brand || '',
            photo: product.photo_front_url || null,
            status: product.status || '',
            product
          })
        }
      }
    }

    // 2. Ingredient (OCR) scans
    const { data: ocrData, error: ocrError } = await supabase
      .from('ingredient_scan_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('success', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (ocrError) throw ocrError

    const ingredientItems = (ocrData || []).map((scan: any) => ({
      id: scan.id,
      type: 'ingredient',
      created_at: scan.created_at,
      name: scan.product_name || 'Ingredient Scan',
      subtitle: scan.ingredients_text_zh || scan.ingredients_text_en || 'OCR Text',
      photo: null,
      status: scan.auto_status || '',
      raw: scan
    }))

    // 3. Merge into a single chronological history
    combinedScans.value = [...barcodeItems, ...ingredientItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  } catch (err) {
    console.error('Error loading scan history:', err)
  } finally {
    loading.value = false
  }
}

function openScan(item: any) {
  if (item.type === 'barcode') {
    openProductDetails(item.product)
  } else {
    viewIngredientScanDetail(item.raw)
  }
}

function openProductDetails(product: any) {
  if (product?.id) {
    router.push(`/search/item/${product.id}`)
  }
}

function viewIngredientScanDetail(scan: any) {
  selectedScan.value = scan
  isDetailModalOpen.value = true
}

// Normalize DB status values ("Muslim-friendly", "Syubhah") to the CSS badge classes.
function statusClass(status?: string) {
  return (status || '').toLowerCase().replace(/[\s-]+/g, '_')
}

// Translate a scan status. The canonical values live under `scanIngredients.status.*`
// (keyed by the exact DB value). Anything else (empty, "No ingredients detected") → Unknown.
const KNOWN_STATUSES = ['Halal', 'Muslim-friendly', 'Syubhah', 'Haram']
function statusLabel(status?: string) {
  return status && KNOWN_STATUSES.includes(status)
    ? t(`scanIngredients.status.${status}`)
    : t('scanIngredients.status.Unknown')
}

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

function formatFullTime(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm')
}

async function presentRcPaywall() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[RC] Paywall can only run on native apps.')
    return false
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall()

    if (result === PAYWALL_RESULT.PURCHASED) {
      await refreshSubscriptionStatus({ syncToServer: true })
      await ActivityLogService.log('pro_purchase_success', {
        source: 'scan_history_view'
      })

      const { data: { user } } = await supabase.auth.getUser()
      await notifyEvent(
        'pro_purchase_success',
        '💎 New Pro Member!',
        `User ${user?.email ?? 'unknown'} has just subscribed to Halal Formosa Pro!`,
        undefined,
        {
          source: 'scan_history_view',
          email: user?.email,
          user_id: user?.id
        },
        ['discord']
      ).catch(console.error)

      await loadScanHistory()
      return true
    } else if (result === PAYWALL_RESULT.RESTORED) {
      await refreshSubscriptionStatus({ syncToServer: true })
      await ActivityLogService.log('pro_restore_success', {
        source: 'scan_history_view'
      })
      await loadScanHistory()
      return true
    }
  } catch (err) {
    console.error('Paywall failed:', err)
  }
  return false
}

// Watch isDonor status change to dynamically reload logs
watch(isDonor, (newValue) => {
  if (newValue) {
    loadScanHistory()
  }
})

onMounted(() => {
  loadScanHistory()
})
</script>

<style scoped>
.paywall-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  text-align: center;
  padding: 24px;
}

.lock-icon-wrapper {
  background: var(--ion-color-light);
  border-radius: 50%;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.lock-icon {
  font-size: 48px;
  color: var(--ion-color-carrot);
}

.paywall-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.paywall-description {
  font-size: 1rem;
  color: var(--ion-color-medium);
  margin-bottom: 32px;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  height: 50vh;
}

.empty-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.history-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  border-bottom: 1px solid var(--ion-color-light);
  margin-bottom: 8px;
}

.product-thumbnail {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--ion-color-light);
  background: #fff;
}

/* Placeholder icon shown when a scan has no product photo (e.g. ingredient scans) */
.scan-type-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-color-light-shade, var(--ion-color-light));
}

.scan-type-icon ion-icon {
  font-size: 26px;
  color: var(--ion-color-medium);
}

.scan-type-icon.ingredient ion-icon {
  color: var(--ion-color-carrot, var(--ion-color-primary));
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-text-color, #000);
}

.product-brand {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.scan-time {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.ingredients-summary {
  font-size: 13px;
  color: var(--ion-color-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  text-align: center;
  min-width: 80px;
}

.status-badge.halal, .status-badge.muslim_friendly {
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success);
}

.status-badge.haram {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
}

.status-badge.syubhah {
  background: rgba(var(--ion-color-warning-rgb), 0.1);
  color: var(--ion-color-warning);
}

.detail-modal-content {
  padding-bottom: 32px;
}

.detail-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 12px;
  margin-bottom: 4px;
}

.detail-time {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.status-summary-box {
  padding: 14px;
  border-radius: 12px;
  margin: 16px 0;
  text-align: center;
}

.status-summary-box h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.status-summary-box.halal, .status-summary-box.muslim_friendly {
  background: rgba(var(--ion-color-success-rgb), 0.12);
  color: var(--ion-color-success);
}

.status-summary-box.haram {
  background: rgba(var(--ion-color-danger-rgb), 0.12);
  color: var(--ion-color-danger);
}

.status-summary-box.syubhah {
  background: rgba(var(--ion-color-warning-rgb), 0.12);
  color: var(--ion-color-warning);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 8px;
}

.ingredients-box {
  background: var(--ion-color-light);
  padding: 14px;
  border-radius: 10px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ion-color-dark);
  white-space: pre-wrap;
}
</style>
