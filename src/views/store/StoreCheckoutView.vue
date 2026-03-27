<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.checkout')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Checkout is currently disabled during maintenance. We'll be back soon!</p>
        </div>
      </div>

      <div v-else class="checkout-wrapper">
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
  IonSpinner, IonIcon, toastController
} from '@ionic/vue'
import { constructOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreCart } from '@/composables/useStoreCart'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const { items: cartItems, cartTotal, clearCart } = useStoreCart()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const buyerName = ref('')
const buyerEmail = ref('')
const buyerPhone = ref('')
const shippingAddress = ref('')
const note = ref('')
const submitting = ref(false)

function formatPrice(price: number) {
  return Number(price).toLocaleString()
}

// Prefill from session
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    buyerEmail.value = session.user.email || ''
    buyerName.value = session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
  }
})

async function placeOrder() {
  if (!buyerName.value.trim() || !buyerEmail.value.trim()) {
    const toast = await toastController.create({
      message: '⚠️ Name and Email are required',
      duration: 2000,
      color: 'warning',
      position: 'bottom'
    })
    toast.present()
    return
  }

  submitting.value = true

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('store_orders')
      .insert({
        user_id: session.user.id,
        total_amount: cartTotal.value,
        buyer_name: buyerName.value.trim(),
        buyer_email: buyerEmail.value.trim(),
        buyer_phone: buyerPhone.value.trim() || null,
        shipping_address: shippingAddress.value.trim() || null,
        note: note.value.trim() || null,
        status: 'pending'
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      throw new Error(orderErr?.message || 'Order creation failed')
    }

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

    // 💰 Initiate ECPay payment
    console.log('💰 Initiating ECPay payment for order:', order.id)
    const { data: payData, error: payErr } = await supabase.functions.invoke('ecpay-payment', {
      body: { orderId: order.id }
    })

    if (payErr || !payData) {
      throw new Error(payErr?.message || 'Failed to initiate payment')
    }

    // Clear cart before redirecting
    clearCart()

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

/* Under Construction */
.under-construction-overlay {
  padding: 16px;
}


/* Dark mode */
.ion-palette-dark .section-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.ion-palette-dark .total-row {
  border-top-color: rgba(255, 255, 255, 0.1);
}
</style>
