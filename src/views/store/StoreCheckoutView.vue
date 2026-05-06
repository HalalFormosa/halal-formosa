<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.checkout')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" slot="fixed" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Checkout is currently disabled during maintenance. We'll be back soon!</p>
        </div>
      </div>

      <div class="checkout-wrapper" style="position: relative; min-height: 100%;">

        <!-- Order Summary -->
        <div class="section-card">
          <h3 class="section-title">{{ $t('store.orderSummary') }}</h3>
          <ion-list lines="none">
            <ion-item v-for="item in cartItems" :key="item.productId" class="order-item">
              <ion-thumbnail slot="start">
                <img :src="item.image || '/favicon-32x32.png'" :alt="item.name" />
              </ion-thumbnail>
              <ion-label>
                <h3>{{ item.name }}</h3>
                <p>{{ $t('store.twd') }}{{ formatPrice(item.price) }} × {{ item.quantity }}</p>
              </ion-label>
              <ion-note slot="end" class="item-total">
                {{ $t('store.twd') }}{{ formatPrice(item.price * item.quantity) }}
              </ion-note>
            </ion-item>
          </ion-list>
          <div class="total-row">
            <span>{{ $t('store.cartTotal') }}</span>
            <span class="total-price">{{ $t('store.twd') }}{{ formatPrice(cartTotal) }}</span>
          </div>
        </div>

        <!-- Buyer Info -->
        <div class="section-card">
          <h3 class="section-title">{{ $t('store.buyerInfo') }}</h3>

          <ion-item class="form-item">
            <ion-input v-model="buyerName" :label="$t('store.buyerName')" label-placement="stacked" :placeholder="$t('store.buyerName')" />
          </ion-item>

          <ion-item class="form-item">
            <ion-input v-model="buyerEmail" :label="$t('store.buyerEmail')" label-placement="stacked" type="email" :placeholder="$t('store.buyerEmail')" />
          </ion-item>

          <ion-item class="form-item">
            <ion-input v-model="buyerPhone" :label="$t('store.buyerPhone')" label-placement="stacked" type="tel" :placeholder="$t('store.buyerPhone')" />
          </ion-item>

          <ion-item class="form-item">
            <ion-textarea v-model="shippingAddress" :label="$t('store.shippingAddress')" label-placement="stacked"
              :placeholder="$t('store.shippingAddress')" :rows="3" />
          </ion-item>

          <ion-item class="form-item">
            <ion-textarea v-model="note" :label="$t('store.note')" label-placement="stacked" :placeholder="$t('store.note')" :rows="2" />
          </ion-item>
        </div>

        <!-- Delivery Method -->
        <div class="section-card">
          <h3 class="section-title">🚚 {{ $t('store.deliveryMethod') || 'Delivery Method' }}</h3>
          <div v-if="loadingDelivery" class="ion-text-center ion-padding">
            <ion-spinner name="dots" />
          </div>
          <div v-else-if="availableDelivery.length === 0" class="ion-padding">
            <p style="color: var(--ion-color-medium); font-size: 0.9rem;">No delivery options available</p>
          </div>
          <ion-radio-group v-else v-model="selectedDelivery">
            <ion-item v-for="method in availableDelivery" :key="method.key" class="delivery-option" lines="none">
              <ion-icon :icon="method.icon" slot="start" color="primary" style="font-size: 20px; margin-right: 10px;" />
              <ion-label>
                <h3 style="font-weight: 600; margin: 0; font-size: 0.95rem;">{{ method.label }}</h3>
                <p style="color: var(--ion-color-medium); margin: 2px 0 0; font-size: 0.8rem;">{{ method.labelZh }}</p>
              </ion-label>
              <ion-radio slot="end" :value="method.key" />
            </ion-item>
          </ion-radio-group>

          <!-- Home Delivery: require phone + address -->
          <div v-if="selectedDelivery === 'home_delivery'" class="conditional-fields">
            <p class="field-hint">⚠️ Phone number and shipping address are required for home delivery</p>
          </div>

          <!-- CVS Pickup: map picker -->
          <div v-if="isCvsDelivery" class="conditional-fields">
            <!-- Selected store display -->
            <div v-if="selectedCvsStore" class="cvs-store-card">
              <div class="cvs-store-header">
                <ion-icon :icon="storefrontOutline" class="cvs-store-icon" />
                <div class="cvs-store-details">
                  <h4>{{ selectedCvsStore.storeName }}</h4>
                  <p v-if="selectedCvsStore.storeId">ID: {{ selectedCvsStore.storeId }}</p>
                  <p v-if="selectedCvsStore.storeAddress">{{ selectedCvsStore.storeAddress }}</p>
                </div>
              </div>
              <ion-button fill="clear" size="small" @click="pickCvsStore" :disabled="logisticsLoading">
                {{ $t('common.change') || 'Change' }}
              </ion-button>
            </div>
            <!-- Pick store button -->
            <ion-button v-else expand="block" fill="outline" color="carrot" class="pick-store-btn" @click="pickCvsStore" :disabled="logisticsLoading">
              <ion-spinner v-if="logisticsLoading" name="dots" slot="start" />
              <ion-icon v-else :icon="mapOutline" slot="start" />
              {{ $t('store.selectCvsStore') || 'Select Pickup Store' }}
            </ion-button>
            <p class="field-hint">{{ $t('store.selectCvsStoreHint') || 'Choose a convenience store branch for pickup' }}</p>
          </div>

          <!-- COD: date + location -->
          <div v-if="selectedDelivery === 'cod_meetup'" class="conditional-fields">
            <ion-item class="form-item">
              <ion-input v-model="codDate" type="datetime-local" label="📅 Meet-up Date & Time / 面交日期時間" label-placement="stacked" />
            </ion-item>
            <ion-item class="form-item">
              <ion-textarea v-model="codLocation" label="📍 Meet-up Location / 面交地點" label-placement="stacked"
                placeholder="Where to meet? / 請輸入面交地點" :rows="2" />
            </ion-item>
            <p class="field-hint">ℹ️ Shipping address not needed for meet-up orders</p>
          </div>
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar class="checkout-footer">
        <ion-button
          expand="block"
          color="carrot"
          class="place-order-btn"
          @click="placeOrder"
          :disabled="submitting || cartItems.length === 0 || isUnderConstruction"
        >
          <ion-spinner v-if="submitting" name="crescent" slot="start" />
          {{ submitting ? $t('store.saving') : $t('store.placeOrder') }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonToolbar, IonButton,
  IonList, IonItem, IonLabel, IonThumbnail, IonNote, IonInput, IonTextarea,
  IonSpinner, IonIcon, toastController, IonRadio, IonRadioGroup
} from '@ionic/vue'
import { constructOutline, mapOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreCart } from '@/composables/useStoreCart'
import { useEcpayPayment } from '@/composables/useEcpayPayment'
import { useEcpayLogistics } from '@/composables/useEcpayLogistics'
import type { CvsStoreSelection } from '@/composables/useEcpayLogistics'
import { ActivityLogService } from '@/services/ActivityLogService'
import { useI18n } from 'vue-i18n'
import {
  homeOutline, storefrontOutline, cartOutline, businessOutline, bagHandleOutline, peopleOutline
} from 'ionicons/icons'

const ALL_DELIVERY_METHODS = [
  { key: 'home_delivery', label: 'Home Delivery (Courier)', labelZh: '宅配到府', icon: homeOutline },
  { key: '7eleven', label: '7-Eleven Pickup', labelZh: '7-ELEVEN 取貨', icon: storefrontOutline },
  { key: 'family_mart', label: 'FamilyMart Pickup', labelZh: '全家取貨', icon: cartOutline },
  { key: 'hi_life', label: 'Hi-Life Pickup', labelZh: '萊爾富取貨', icon: businessOutline },
  { key: 'ok_mart', label: 'OK Mart Pickup', labelZh: 'OK超商取貨', icon: bagHandleOutline },
  { key: 'cod_meetup', label: 'Meet in Person', labelZh: '面交自取', icon: peopleOutline },
]

const { t } = useI18n()
const router = useRouter()
const { items: cartItems, cartTotal, clearCart } = useStoreCart()
const { initiatePayment } = useEcpayPayment()
const { openCvsMapPicker, createLogisticsOrder, logisticsLoading, selectedStore: selectedCvsStore } = useEcpayLogistics()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const buyerName = ref('')
const buyerEmail = ref('')
const buyerPhone = ref('')
const shippingAddress = ref('')
const note = ref('')
const submitting = ref(false)

// Delivery
const selectedDelivery = ref('')
const codLocation = ref('')
const codDate = ref('')
const cvsStoreInfo = ref('')
const availableDelivery = ref<any[]>([])
const loadingDelivery = ref(true)

const CVS_METHODS = ['7eleven', 'family_mart', 'hi_life', 'ok_mart']
const isCvsDelivery = computed(() => CVS_METHODS.includes(selectedDelivery.value))

async function pickCvsStore() {
  try {
    const store = await openCvsMapPicker(selectedDelivery.value)
    if (store) {
      // Also keep legacy field populated for backward compatibility
      cvsStoreInfo.value = `${store.storeName} (${store.storeId})`
    }
  } catch (err: any) {
    const toast = await toastController.create({
      message: `⚠️ ${err.message || 'Failed to open store picker'}`,
      duration: 3000, color: 'warning', position: 'bottom'
    })
    toast.present()
  }
}

function formatPrice(price: number) {
  return Number(price).toLocaleString()
}

// Prefill from session
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    buyerEmail.value = session.user.email || ''
    buyerName.value = session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
    
    // Fetch additional info from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('phone')
      .eq('id', session.user.id)
      .single()
    
    if (profile?.phone) {
      buyerPhone.value = profile.phone
    }
  }
  await fetchDeliveryOptions()
  ActivityLogService.log('store_checkout_page_open')
})

async function fetchDeliveryOptions() {
  loadingDelivery.value = true
  try {
    // Get store IDs from cart items' products
    const productIds = cartItems.value.map(i => i.productId)
    if (productIds.length === 0) { loadingDelivery.value = false; return }

    const { data: products } = await supabase
      .from('store_products')
      .select('store_id')
      .in('id', productIds)

    const storeIds = [...new Set((products || []).map(p => p.store_id).filter(Boolean))]
    if (storeIds.length === 0) { loadingDelivery.value = false; return }

    // Fetch delivery options from merchant store(s)
    const { data: stores } = await supabase
      .from('merchant_stores')
      .select('delivery_options')
      .in('id', storeIds)

    // Intersect delivery options across all merchants in cart
    let commonOptions: string[] | null = null
    for (const s of (stores || [])) {
      const opts: string[] = Array.isArray(s.delivery_options) ? s.delivery_options : ['home_delivery']
      if (commonOptions === null) {
        commonOptions = opts
      } else {
        commonOptions = commonOptions.filter(o => opts.includes(o))
      }
    }

    availableDelivery.value = ALL_DELIVERY_METHODS.filter(m => (commonOptions || []).includes(m.key))
    if (availableDelivery.value.length > 0) {
      selectedDelivery.value = availableDelivery.value[0].key
    }
  } catch (e) {
    console.error('Failed to fetch delivery options:', e)
  }
  loadingDelivery.value = false
}

async function placeOrder() {
  if (!buyerName.value.trim() || !buyerEmail.value.trim()) {
    const toast = await toastController.create({
      message: '⚠️ Name and Email are required',
      duration: 2000, color: 'warning', position: 'bottom'
    })
    toast.present()
    return
  }

  // Delivery-specific validation
  if (selectedDelivery.value === 'home_delivery') {
    if (!buyerPhone.value.trim() || !shippingAddress.value.trim()) {
      const toast = await toastController.create({
        message: '⚠️ Phone number and shipping address are required for home delivery',
        duration: 3000, color: 'warning', position: 'bottom'
      })
      toast.present()
      return
    }
  }

  if (isCvsDelivery.value) {
    if (!buyerPhone.value.trim()) {
      const toast = await toastController.create({
        message: '⚠️ Phone number is required for convenience store pickup',
        duration: 2000, color: 'warning', position: 'bottom'
      })
      toast.present()
      return
    }
    
    if (!selectedCvsStore.value && !cvsStoreInfo.value.trim()) {
      const toast = await toastController.create({
        message: '⚠️ Please select a pickup store',
        duration: 2000, color: 'warning', position: 'bottom'
      })
      toast.present()
      return
    }
  }

  if (selectedDelivery.value === 'cod_meetup') {
    if (!codLocation.value.trim() || !codDate.value.trim()) {
      const toast = await toastController.create({
        message: '⚠️ Meet-up date and location are required',
        duration: 2000, color: 'warning', position: 'bottom'
      })
      toast.present()
      return
    }
  }

  submitting.value = true

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Get store_id from first item (assume single store checkout for simplicity)
    const productIds = cartItems.value.map(i => i.productId)
    const { data: firstProd } = await supabase
      .from('store_products')
      .select('store_id')
      .in('id', productIds)
      .limit(1)
      .single()

    const storeId = firstProd?.store_id || null

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('store_orders')
      .insert({
        user_id: session.user.id,
        store_id: storeId,
        total_amount: cartTotal.value,
        buyer_name: buyerName.value.trim(),
        buyer_email: buyerEmail.value.trim(),
        buyer_phone: buyerPhone.value.trim() || null,
        shipping_address: selectedDelivery.value === 'cod_meetup' ? null : (shippingAddress.value.trim() || null),
        note: note.value.trim() || null,
        status: 'pending',
        delivery_method: selectedDelivery.value || null,
        cod_location: selectedDelivery.value === 'cod_meetup' ? (codLocation.value.trim() || null) : null,
        cod_date: selectedDelivery.value === 'cod_meetup' ? (codDate.value || null) : null,
        cvs_store_info: isCvsDelivery.value ? (cvsStoreInfo.value.trim() || null) : null,
        cvs_store_id: isCvsDelivery.value && selectedCvsStore.value ? selectedCvsStore.value.storeId : null,
        cvs_store_name: isCvsDelivery.value && selectedCvsStore.value ? selectedCvsStore.value.storeName : null,
        cvs_store_address: isCvsDelivery.value && selectedCvsStore.value ? selectedCvsStore.value.storeAddress : null,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      throw new Error(orderErr?.message || 'Order creation failed')
    }

    ActivityLogService.log('store_order_submit', { order_id: order.id, total: cartTotal.value })

    // Create order items
    const orderItems = cartItems.value.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.price
    }))

    const { error: itemsErr } = await supabase
      .from('store_order_items')
      .insert(orderItems)

    if (itemsErr) {
      throw new Error(itemsErr.message)
    }

    // 💰 Initiate ECPay payment via composable
    console.log('💰 Initiating ECPay payment for order:', order.id)

    // Create logistics order for CVS deliveries (will be shipped after payment confirmation)
    if (isCvsDelivery.value) {
      try {
        console.log('📦 Creating logistics order for CVS delivery...')
        await createLogisticsOrder(order.id)
      } catch (logErr: any) {
        console.warn('⚠️ Logistics order creation deferred:', logErr.message)
        // Don't block payment - logistics can be created later from admin
      }
    }

    // Clear cart before redirecting
    clearCart()

    await initiatePayment(order.id)

  } catch (err: any) {
    const toast = await toastController.create({
      message: `❌ ${err.message || 'Something went wrong'}`,
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    })
    toast.present()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.checkout-wrapper {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--ion-text-color);
}

.order-item {
  --padding-start: 0;
  --inner-padding-end: 0;
}

.order-item ion-thumbnail {
  --size: 48px;
  --border-radius: 10px;
}

.item-total {
  font-weight: 600;
  color: var(--ion-text-color);
  font-size: 0.9rem;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 0;
  border-top: 1px solid var(--ion-color-light-shade, #e0e0e0);
  margin-top: 12px;
  font-weight: 600;
  font-size: 1rem;
}

.total-price {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.form-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  --background: transparent;
  margin-bottom: 4px;
}

.checkout-footer {
  --background: var(--ion-background-color);
  --border-width: 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.place-order-btn {
  margin: 8px 16px;
  --border-radius: 14px;
  font-weight: 600;
  font-size: 1rem;
  height: 50px;
}




/* Dark mode */
.ion-palette-dark .section-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.ion-palette-dark .total-row {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.conditional-fields {
  padding: 8px 0 0;
}

.field-hint {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  padding: 6px 16px;
  margin: 0;
}

.delivery-option {
  --background: transparent;
  margin-bottom: 2px;
}

/* CVS Store Picker */
.pick-store-btn {
  margin: 8px 16px;
  --border-radius: 12px;
  font-weight: 600;
  height: 48px;
}

.cvs-store-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 8px 0;
  background: rgba(var(--ion-color-carrot-rgb, 255, 152, 0), 0.08);
  border-radius: 14px;
  border: 1px solid rgba(var(--ion-color-carrot-rgb, 255, 152, 0), 0.2);
}

.cvs-store-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.cvs-store-icon {
  font-size: 28px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.cvs-store-details h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.cvs-store-details p {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}
</style>
