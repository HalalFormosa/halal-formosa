<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.myOrders')" :showBack="true" icon="none">
        <template #end>
          <ion-button @click="toggleDarkPalette(!isDark)" class="theme-toggle-btn">
            <ion-icon :icon="isDark ? sunnyOutline : moonOutline" slot="icon-only" />
          </ion-button>
        </template>
      </app-header>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" slot="fixed" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Order tracking is being finalized. Stay tuned!</p>
        </div>
      </div>

      <div class="user-orders-wrapper" style="position: relative; min-height: 100%; background: var(--ion-background-color);">

        <ion-refresher v-if="!isUnderConstruction" slot="fixed" @ionRefresh="doRefresh($event)">
          <ion-refresher-content />
        </ion-refresher>

      <!-- Status filter -->
      <div class="status-chips">
        <ion-chip
          v-for="s in statusFilters"
          :key="s.value"
          :class="['modern-category-chip', { 'selected': selectedStatus === s.value }]"
          @click="selectedStatus = s.value"
        >
          <ion-icon :icon="s.icon" class="chip-status-icon" />
          {{ s.label }}
        </ion-chip>
      </div>

      <!-- Orders -->
      <div class="orders-list" v-if="!loading && orders.length > 0">
        <div v-for="order in orders" :key="order.id" class="order-card" @click="toggleExpand(order.id)">
          <div class="order-header">
            <div class="order-id-col">
              <span class="order-id">#{{ order.id.slice(0, 8).toUpperCase() }}</span>
              <span class="order-date">{{ formatDate(order.created_at) }}</span>
            </div>
            <div class="order-status-col">
              <ion-badge :color="statusColor(order.status)" class="status-badge">
                <ion-icon :icon="statusIcon(order.status)" class="badge-icon" />
                {{ statusLabel(order.status) }}
              </ion-badge>
              <span class="order-total">{{ $t('store.twd') }}{{ formatPrice(order.total_amount) }}</span>
            </div>
          </div>

          <!-- Status timeline -->
          <div class="status-timeline">
            <div v-for="step in timelineSteps" :key="step.key"
              :class="['timeline-step', { 'active': isStepReached(order.status, step.key), 'current': order.status === step.key }]">
              <div class="timeline-dot" />
              <ion-icon :icon="step.icon" class="timeline-icon" />
              <span class="timeline-text">{{ step.label }}</span>
            </div>
            <div class="timeline-line" />
          </div>

          <!-- Expanded details -->
          <transition name="slide-down">
            <div v-if="expandedId === order.id" class="order-details">
              <!-- Items -->
              <div class="items-section">
                <div v-for="item in order.store_order_items" :key="item.id" class="order-item-row clickable" @click.stop="navigateToProduct(item.product_id)">
                  <div class="item-img-wrap" v-if="item.store_products?.images?.[0]">
                    <img :src="item.store_products.images[0]" :alt="item.store_products?.name" />
                  </div>
                  <div class="item-info">
                    <span class="item-name">{{ localized(item.store_products?.name_zh, item.store_products?.name) || 'Product' }}</span>
                    <span class="item-store" v-if="item.store_products?.merchant_stores">
                      <ion-icon :icon="storefrontOutline" class="store-icon" />
                      {{ localized(item.store_products.merchant_stores.name_zh, item.store_products.merchant_stores.name) }}
                    </span>
                    <span class="item-qty-price">×{{ item.quantity }} · {{ $t('store.twd') }}{{ formatPrice(item.unit_price * item.quantity) }}</span>
                  </div>
                </div>
              </div>

              <!-- Pay Now button for pending orders -->
              <div v-if="order.status === 'pending'" class="pay-now-section">
                <ion-button expand="block" color="carrot" @click.stop="payNow(order.id)" :disabled="submittingId === order.id">
                  <ion-spinner v-if="submittingId === order.id" name="crescent" slot="start" />
                  {{ $t('store.payNow') || 'Pay Now' }}
                </ion-button>
              </div>

              <!-- Shipping address -->
              <div v-if="order.shipping_address" class="detail-row">
                <ion-icon :icon="locationOutline" />
                <span>{{ order.shipping_address }}</span>
              </div>

              <!-- Invoice -->
              <div v-if="order.ecpay_invoice_no" class="detail-row">
                <ion-icon :icon="receiptOutline" />
                <span>{{ $t('store.invoiceNo') }}: {{ order.ecpay_invoice_no }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="orders-list">
        <div v-for="n in 3" :key="n" class="order-card skeleton-card">
          <div class="order-header">
            <ion-skeleton-text animated style="width: 40%; height: 16px;" />
            <ion-skeleton-text animated style="width: 25%; height: 16px;" />
          </div>
          <ion-skeleton-text animated style="width: 100%; height: 8px; margin-top: 12px; border-radius: 4px;" />
        </div>
      </div>

      <!-- Empty -->
      <div v-if="!loading && orders.length === 0" class="empty-state">
        <ion-icon :icon="bagHandleOutline" class="empty-icon" />
        <p>{{ $t('store.noOrders') }}</p>
        <ion-button fill="outline" color="carrot" @click="$router.push('/store')" class="shop-btn">
          {{ $t('store.backToStore') }}
        </ion-button>
      </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  IonPage, IonHeader, IonContent, IonChip, IonBadge, IonButton, IonIcon,
  IonRefresher, IonRefresherContent, IonSkeletonText, IonSpinner
} from '@ionic/vue'
import {
  locationOutline, receiptOutline, bagHandleOutline, constructOutline,
  timeOutline, cardOutline, cubeOutline, checkmarkCircleOutline, closeOutline,
  storefrontOutline, moonOutline, sunnyOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useRouter } from 'vue-router'

const { t, locale } = useI18n()
const router = useRouter()
const { isDark, toggleDarkPalette } = useTheme()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const loading = ref(true)
const orders = ref<any[]>([])
const expandedId = ref<string | null>(null)
const selectedStatus = ref('all')
const submittingId = ref<string | null>(null)

const statusFilters = computed(() => [
  { value: 'all', label: t('store.allCategories'), icon: receiptOutline },
  { value: 'pending', label: t('store.orderPending'), icon: timeOutline },
  { value: 'paid', label: t('store.orderPaid'), icon: cardOutline },
  { value: 'shipped', label: t('store.orderShipped'), icon: cubeOutline },
  { value: 'completed', label: t('store.orderCompleted'), icon: checkmarkCircleOutline }
])

const timelineSteps = [
  { key: 'pending', icon: timeOutline, label: t('store.orderPending') },
  { key: 'paid', icon: cardOutline, label: t('store.orderPaid') },
  { key: 'shipped', icon: cubeOutline, label: t('store.orderShipped') },
  { key: 'completed', icon: checkmarkCircleOutline, label: t('store.orderCompleted') }
]

const statusOrder = ['pending', 'paid', 'shipped', 'completed']

function isStepReached(currentStatus: string, stepKey: string) {
  if (currentStatus === 'cancelled') return false
  return statusOrder.indexOf(stepKey) <= statusOrder.indexOf(currentStatus)
}

function formatPrice(price: number) { return Number(price).toLocaleString() }

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusColor(status: string) {
  const map: Record<string, string> = { pending: 'warning', paid: 'success', shipped: 'tertiary', completed: 'medium', cancelled: 'danger' }
  return map[status] || 'medium'
}

function statusIcon(status: string) {
  const map: Record<string, any> = { pending: timeOutline, paid: cardOutline, shipped: cubeOutline, completed: checkmarkCircleOutline, cancelled: closeOutline }
  return map[status] || receiptOutline
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('store.orderPending'),
    paid: t('store.orderPaid'),
    shipped: t('store.orderShipped'),
    completed: t('store.orderCompleted'),
    cancelled: t('store.orderCancelled')
  }
  return map[status] || status
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function navigateToProduct(id: string) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push(`/store/product/${id}`)
}

async function payNow(orderId: string) {
  submittingId.value = orderId
  try {
    const { data: payData, error: payErr } = await supabase.functions.invoke('ecpay-payment', {
      body: { orderId }
    })

    if (payErr || !payData) {
      throw new Error(payErr?.message || 'Failed to initiate payment')
    }

    // Create a hidden form and submit it to ECPay
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = payData.apiUrl
    form.style.display = 'none'

    Object.entries(payData.params).forEach(([key, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = String(value)
      form.appendChild(input)
    })

    document.body.appendChild(form)
    
    // Small delay to ensure form is ready
    setTimeout(() => {
      form.submit()
      setTimeout(() => document.body.removeChild(form), 1000)
    }, 50)
  } catch (err: any) {
    console.error('❌ Payment failed:', err)
  } finally {
    submittingId.value = null
  }
}

async function fetchOrders() {
  loading.value = true
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { loading.value = false; return }

  let query = supabase
    .from('store_orders')
    .select('*, store_order_items(*, store_products(id, name, name_zh, images, merchant_stores(name, name_zh)))')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (selectedStatus.value !== 'all') {
    query = query.eq('status', selectedStatus.value)
  }

  const { data } = await query
  orders.value = data || []
  loading.value = false
}

async function doRefresh(event: any) {
  await fetchOrders()
  event.target.complete()
}

watch(selectedStatus, () => fetchOrders())
onMounted(fetchOrders)
</script>

<style scoped>

/* List & Wrapper */
.user-orders-wrapper {
  background: var(--ion-background-color);
  -webkit-tap-highlight-color: transparent;
}

.status-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 10px 16px;
  -webkit-overflow-scrolling: touch;
}
.status-chips::-webkit-scrollbar { display: none; }

.modern-category-chip {
  --background: var(--ion-color-step-50, #f4f5f8);
  --color: var(--ion-text-color);
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 20px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}
.modern-category-chip.selected {
  --background: var(--ion-color-carrot);
  --color: #fff;
  font-weight: 600;
}
.chip-status-icon { margin-right: 4px; font-size: 16px; }

.orders-list {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  cursor: pointer;
  transition: transform 0.15s, background-color 0.1s;
}
.order-card:active {
  transform: scale(0.98);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.order-id-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.order-id {
  font-weight: 700;
  font-size: 0.92rem;
  font-family: monospace;
  color: var(--ion-text-color);
}
.order-date {
  font-size: 0.72rem;
  color: var(--ion-color-medium);
}

.order-status-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.status-badge {
  font-size: 0.7rem;
  border-radius: 10px;
  padding: 3px 8px;
  text-transform: capitalize;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.badge-icon { font-size: 14px; }
.timeline-icon { font-size: 18px; margin: 4px 0; }
.order-total {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
}

/* Timeline */
.status-timeline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 4px;
  position: relative;
  padding: 0 4px;
}

.timeline-line {
  position: absolute;
  top: 50%;
  left: 20px;
  right: 20px;
  height: 3px;
  background: var(--ion-color-light-shade, #e0e0e0);
  border-radius: 2px;
  z-index: 0;
  transform: translateY(-50%);
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 1;
}

.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ion-color-light-shade, #e0e0e0);
  transition: all 0.3s ease;
  border: 2px solid var(--ion-background-color);
}

.timeline-step.active .timeline-dot {
  background: var(--ion-color-success);
}

.timeline-step.current .timeline-dot {
  background: var(--ion-color-carrot);
  box-shadow: 0 0 0 4px rgba(var(--ion-color-carrot-rgb), 0.2);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(var(--ion-color-carrot-rgb), 0.2); }
  50% { box-shadow: 0 0 0 8px rgba(var(--ion-color-carrot-rgb), 0.1); }
}

.timeline-emoji {
  font-size: 14px;
  line-height: 1;
}

.timeline-text {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--ion-color-medium);
  transition: color 0.3s;
}

.timeline-step.active .timeline-text {
  color: var(--ion-color-success);
  font-weight: 600;
}

.timeline-step.current .timeline-text {
  color: var(--ion-color-carrot);
  font-weight: 700;
}

/* Expanded */
.order-details {
  border-top: 1px solid var(--card-border);
  margin-top: 12px;
  padding-top: 12px;
}

.pay-now-section {
  margin-bottom: 16px;
}

.pay-now-section ion-button {
  --border-radius: 12px;
  font-weight: 700;
  height: 44px;
  margin: 0;
}

.items-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.order-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-img-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}
.item-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  display: flex;
  flex-direction: column;
}
.item-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
}
.item-qty-price {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}
.detail-row ion-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* Transitions */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; max-height: 0; overflow: hidden; }

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
}
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}
.shop-btn {
  margin-top: 16px;
  --border-radius: 12px;
  font-weight: 600;
}

.item-store {
  font-size: 0.72rem;
  color: var(--ion-color-carrot);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 1px 0;
}

.store-icon {
  font-size: 12px;
}

.order-item-row.clickable:active {
  background: rgba(var(--ion-text-color-rgb), 0.08);
  border-radius: 8px;
}

.theme-toggle-btn {
  --color: var(--ion-color-carrot);
  font-size: 20px;
}

.skeleton-card {
  opacity: 0.6;
}

/* Dark mode overrides handled by variables.css but specific ones here */
.ion-palette-dark .order-card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
