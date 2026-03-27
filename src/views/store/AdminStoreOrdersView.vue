<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.adminOrders')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Admin order management is undergoing a scheduled update.</p>
        </div>

        <!-- Skeleton -->
        <div class="orders-list">
          <div v-for="n in 4" :key="n" class="order-card skeleton-card">
            <div class="order-header">
              <ion-skeleton-text animated style="width: 40%; height: 16px;" />
              <ion-skeleton-text animated style="width: 25%; height: 16px;" />
            </div>
            <ion-skeleton-text animated style="width: 60%; height: 14px; margin-top: 8px;" />
          </div>
        </div>
      </div>

      <template v-else>
        <ion-refresher slot="fixed" @ionRefresh="doRefresh($event)">
          <ion-refresher-content />
        </ion-refresher>

      <!-- Status filter chips -->
      <div class="status-chips">
        <ion-chip
          v-for="s in statusFilters"
          :key="s.value"
          :class="['modern-category-chip', { 'selected': selectedStatus === s.value }]"
          @click="selectedStatus = s.value"
        >
          <span class="chip-emoji">{{ s.emoji }}</span>
          {{ s.label }}
          <ion-badge v-if="s.count > 0" :color="s.badgeColor" class="chip-badge">{{ s.count }}</ion-badge>
        </ion-chip>
      </div>

      <!-- Orders list -->
      <div class="orders-list" v-if="!loading && orders.length > 0">
        <div v-for="order in orders" :key="order.id" class="order-card" @click="toggleExpand(order.id)">
          <!-- Order header -->
          <div class="order-header">
            <div class="order-id-col">
              <span class="order-id">#{{ order.id.slice(0, 8).toUpperCase() }}</span>
              <span class="order-date">{{ formatDate(order.created_at) }}</span>
            </div>
            <div class="order-status-col">
              <ion-badge :color="statusColor(order.status)" class="status-badge">
                {{ statusEmoji(order.status) }} {{ order.status }}
              </ion-badge>
              <span class="order-total">{{ $t('store.twd') }}{{ formatPrice(order.total_amount) }}</span>
            </div>
          </div>

          <!-- Buyer info -->
          <div class="buyer-row">
            <ion-icon :icon="personOutline" />
            <span>{{ order.buyer_name }}</span>
            <span class="buyer-email">{{ order.buyer_email }}</span>
          </div>

          <!-- Expanded details -->
          <transition name="slide-down">
            <div v-if="expandedId === order.id" class="order-details">
              <div v-if="order.buyer_phone" class="detail-row">
                <ion-icon :icon="callOutline" />
                <span>{{ order.buyer_phone }}</span>
              </div>
              <div v-if="order.shipping_address" class="detail-row">
                <ion-icon :icon="locationOutline" />
                <span>{{ order.shipping_address }}</span>
              </div>
              <div v-if="order.note" class="detail-row">
                <ion-icon :icon="chatbubbleOutline" />
                <span>{{ order.note }}</span>
              </div>

              <!-- Order items -->
              <div class="items-section">
                <div v-for="item in order.store_order_items" :key="item.id" class="order-item-row">
                  <span class="item-name">{{ localized(item.store_products?.name_zh, item.store_products?.name) || 'Product' }}</span>
                  <span class="item-qty">×{{ item.quantity }}</span>
                  <span class="item-price">{{ $t('store.twd') }}{{ formatPrice(item.unit_price * item.quantity) }}</span>
                </div>
              </div>

              <!-- Status actions -->
              <div class="status-actions">
                <ion-button
                  v-for="action in getActions(order.status)"
                  :key="action.status"
                  :color="action.color"
                  size="small"
                  fill="outline"
                  @click.stop="updateOrderStatus(order.id, action.status)"
                  :disabled="updating"
                >
                  {{ action.emoji }} {{ action.label }}
                </ion-button>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="orders-list">
        <div v-for="n in 4" :key="n" class="order-card skeleton-card">
          <div class="order-header">
            <ion-skeleton-text animated style="width: 40%; height: 16px;" />
            <ion-skeleton-text animated style="width: 25%; height: 16px;" />
          </div>
          <ion-skeleton-text animated style="width: 60%; height: 14px; margin-top: 8px;" />
        </div>
      </div>

      <!-- Empty -->
      <div v-if="!loading && orders.length === 0" class="empty-state">
        <ion-icon :icon="receiptOutline" class="empty-icon" />
        <p>{{ $t('store.noOrders') }}</p>
      </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  IonPage, IonHeader, IonContent, IonChip, IonBadge, IonButton, IonIcon,
  IonRefresher, IonRefresherContent, IonSkeletonText, toastController
} from '@ionic/vue'
import {
  personOutline, callOutline, locationOutline, chatbubbleOutline, receiptOutline, constructOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const loading = ref(true)
const updating = ref(false)
const orders = ref<any[]>([])
const expandedId = ref<string | null>(null)
const selectedStatus = ref('all')
const statusCounts = ref<Record<string, number>>({ pending: 0, paid: 0, shipped: 0, completed: 0, cancelled: 0 })

const statusFilters = computed(() => [
  { value: 'all', label: t('store.allCategories'), emoji: '📋', count: 0, badgeColor: 'medium' },
  { value: 'pending', label: 'Pending', emoji: '⏳', count: statusCounts.value.pending, badgeColor: 'warning' },
  { value: 'paid', label: 'Paid', emoji: '💳', count: statusCounts.value.paid, badgeColor: 'success' },
  { value: 'shipped', label: 'Shipped', emoji: '📦', count: statusCounts.value.shipped, badgeColor: 'tertiary' },
  { value: 'completed', label: 'Done', emoji: '✅', count: statusCounts.value.completed, badgeColor: 'medium' },
  { value: 'cancelled', label: 'Cancel', emoji: '❌', count: statusCounts.value.cancelled, badgeColor: 'danger' }
])

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

function statusEmoji(status: string) {
  const map: Record<string, string> = { pending: '⏳', paid: '💳', shipped: '📦', completed: '✅', cancelled: '❌' }
  return map[status] || '📋'
}

function getActions(status: string) {
  const actions: Record<string, Array<{ status: string; label: string; emoji: string; color: string }>> = {
    pending: [
      { status: 'paid', label: 'Mark Paid', emoji: '💳', color: 'success' },
      { status: 'cancelled', label: 'Cancel', emoji: '❌', color: 'danger' }
    ],
    paid: [
      { status: 'shipped', label: 'Mark Shipped', emoji: '📦', color: 'tertiary' },
      { status: 'cancelled', label: 'Cancel', emoji: '❌', color: 'danger' }
    ],
    shipped: [
      { status: 'completed', label: 'Mark Done', emoji: '✅', color: 'success' }
    ]
  }
  return actions[status] || []
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function fetchCounts() {
  const statuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled']
  for (const s of statuses) {
    const { count } = await supabase
      .from('store_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', s)
    statusCounts.value[s] = count || 0
  }
}

async function fetchOrders() {
  loading.value = true
  let query = supabase
    .from('store_orders')
    .select('*, store_order_items(*, store_products(name, name_zh, images))')
    .order('created_at', { ascending: false })
    .limit(100)

  if (selectedStatus.value !== 'all') {
    query = query.eq('status', selectedStatus.value)
  }

  const { data } = await query
  orders.value = data || []
  loading.value = false
}

async function updateOrderStatus(orderId: string, newStatus: string) {
  updating.value = true
  const { error } = await supabase
    .from('store_orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (!error) {
    // Update locally
    const order = orders.value.find((o: any) => o.id === orderId)
    if (order) order.status = newStatus

    await fetchCounts()

    const toast = await toastController.create({
      message: `✅ Order updated to ${newStatus}`,
      duration: 1500,
      color: 'success'
    })
    toast.present()
  } else {
    const toast = await toastController.create({
      message: `❌ ${error.message}`,
      duration: 2000,
      color: 'danger'
    })
    toast.present()
  }
  updating.value = false
}

async function doRefresh(event: any) {
  await Promise.all([fetchOrders(), fetchCounts()])
  event.target.complete()
}

watch(selectedStatus, () => fetchOrders())

onMounted(async () => {
  await Promise.all([fetchOrders(), fetchCounts()])
})
</script>

<style scoped>
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

.chip-emoji { margin-right: 4px; }

.chip-badge {
  font-size: 10px;
  margin-left: 4px;
  border-radius: 8px;
  padding: 2px 5px;
  min-width: 18px;
}

/* Under Construction */
.under-construction-overlay {
  padding: 8px 16px;
}

.construction-card {
  padding: 24px;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 20px;
  text-align: center;
  border: 1px dashed var(--ion-color-carrot);
  margin-bottom: 24px;
}

.construction-icon {
  font-size: 40px;
  color: var(--ion-color-carrot);
  margin-bottom: 12px;
}

.construction-card h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.construction-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

/* Orders list */
.orders-list {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.15s;
}

.order-card:active { transform: scale(0.98); }

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
}

.order-total {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
}

.buyer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.82rem;
  color: var(--ion-text-color);
}

.buyer-row ion-icon {
  font-size: 14px;
  color: var(--ion-color-medium);
}

.buyer-email {
  color: var(--ion-color-medium);
  font-size: 0.75rem;
}

/* Expanded */
.order-details {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  margin-top: 12px;
  padding-top: 12px;
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

.items-section {
  margin: 12px 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 10px;
}

.order-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  padding: 4px 0;
}

.order-item-row + .order-item-row {
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  padding-top: 6px;
}

.item-name {
  flex: 1;
  font-weight: 500;
  color: var(--ion-text-color);
}

.item-qty {
  margin: 0 8px;
  color: var(--ion-color-medium);
  font-size: 0.78rem;
}

.item-price {
  font-weight: 600;
  color: var(--ion-color-carrot);
}

.status-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.status-actions ion-button {
  --border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: none;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

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

/* Skeleton */
.skeleton-card {
  pointer-events: none;
}

/* Dark mode */
.ion-palette-dark .order-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.ion-palette-dark .order-details {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.ion-palette-dark .items-section {
  background: rgba(255, 255, 255, 0.04);
}
</style>
