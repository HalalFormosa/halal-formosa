<template>
  <ion-page>
    <ion-header>
      <app-header :title="pageTitle" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div class="result-wrapper">

        <!-- Loading / Checking -->
        <div v-if="checking" class="state-container">
          <div class="icon-ring checking-ring">
            <ion-spinner name="crescent" class="checking-spinner" />
          </div>
          <h1 class="result-title">{{ $t('store.verifyingPayment') || 'Verifying Payment...' }}</h1>
          <p class="result-desc">{{ $t('store.verifyingPaymentDesc') || 'Please wait while we confirm your payment with ECPay' }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
          </div>
        </div>

        <!-- ✅ Payment Success -->
        <div v-else-if="paymentStatus === 'paid'" class="state-container">
          <div class="icon-ring success-ring">
            <ion-icon :icon="checkmarkCircle" class="result-icon success-icon" />
          </div>
          <h1 class="result-title success-text">{{ $t('store.paymentSuccess') || 'Payment Successful!' }}</h1>
          <p class="result-desc">{{ $t('store.paymentSuccessDesc') || 'Your payment has been confirmed. Thank you for your purchase!' }}</p>

          <div class="info-card" v-if="orderId">
            <div class="info-row">
              <span class="info-label">{{ $t('store.orderId') || 'Order ID' }}</span>
              <span class="info-value">#{{ orderId.slice(0, 8).toUpperCase() }}</span>
            </div>
            <div class="info-row" v-if="orderAmount">
              <span class="info-label">{{ $t('store.cartTotal') || 'Total' }}</span>
              <span class="info-value amount-value">NT${{ orderAmount }}</span>
            </div>
          </div>

          <div class="confetti-container">
            <span v-for="n in 20" :key="n" class="confetti-piece" :style="confettiStyle(n)" />
          </div>

          <ion-button expand="block" color="carrot" class="action-btn primary-btn" @click="goToOrders">
            <ion-icon :icon="receiptOutline" slot="start" />
            {{ $t('store.myOrders') || 'My Orders' }}
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" class="action-btn" @click="goToStore">
            <ion-icon :icon="storefrontOutline" slot="start" />
            {{ $t('store.backToStore') || 'Back to Store' }}
          </ion-button>
        </div>

        <!-- ❌ Payment Failed / Timeout -->
        <div v-else class="state-container">
          <div class="icon-ring failed-ring">
            <ion-icon :icon="closeCircle" class="result-icon failed-icon" />
          </div>
          <h1 class="result-title failed-text">{{ $t('store.paymentFailed') || 'Payment Not Confirmed' }}</h1>
          <p class="result-desc">{{ $t('store.paymentFailedDesc') || 'We could not confirm your payment. It may still be processing, or the payment was cancelled.' }}</p>

          <div class="info-card" v-if="orderId">
            <div class="info-row">
              <span class="info-label">{{ $t('store.orderId') || 'Order ID' }}</span>
              <span class="info-value">#{{ orderId.slice(0, 8).toUpperCase() }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t('store.status') || 'Status' }}</span>
              <span class="info-value status-pending">{{ $t('store.orderPending') || 'Pending' }}</span>
            </div>
          </div>

          <ion-button expand="block" color="carrot" class="action-btn primary-btn" @click="tryAgain" :disabled="retrying">
            <ion-spinner v-if="retrying" name="crescent" slot="start" />
            <ion-icon v-else :icon="refreshOutline" slot="start" />
            {{ $t('store.tryAgain') || 'Try Again' }}
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" class="action-btn" @click="goToOrders">
            <ion-icon :icon="receiptOutline" slot="start" />
            {{ $t('store.myOrders') || 'My Orders' }}
          </ion-button>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonButton, IonIcon, IonSpinner
} from '@ionic/vue'
import {
  checkmarkCircle, closeCircle, receiptOutline, storefrontOutline, refreshOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useEcpayPayment } from '@/composables/useEcpayPayment'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { initiatePayment } = useEcpayPayment()

const orderId = ref('')
const paymentStatus = ref<'checking' | 'paid' | 'failed'>('checking')
const checking = ref(true)
const retrying = ref(false)
const orderAmount = ref('')
const pollAttempts = ref(0)
const maxPollAttempts = 20 // 40 seconds total

const progressPercent = computed(() => Math.min((pollAttempts.value / maxPollAttempts) * 100, 100))

const pageTitle = computed(() => {
  if (checking.value) return t('store.verifyingPayment') || 'Verifying...'
  if (paymentStatus.value === 'paid') return t('store.paymentSuccess') || 'Payment Success'
  return t('store.paymentFailed') || 'Payment Failed'
})

let stopPoll: (() => void) | null = null

function confettiStyle(n: number) {
  const colors = ['#FF6B35', '#FFD700', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0']
  return {
    '--delay': `${Math.random() * 3}s`,
    '--x': `${(Math.random() - 0.5) * 200}px`,
    '--color': colors[n % colors.length],
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 2}s`,
  }
}

async function checkPaymentStatus() {
  checking.value = true
  pollAttempts.value = 0

  const check = async (): Promise<boolean> => {
    pollAttempts.value++
    try {
      const { data } = await supabase
        .from('store_orders')
        .select('status, total_amount')
        .eq('id', orderId.value)
        .single()

      if (data) {
        orderAmount.value = Number(data.total_amount).toLocaleString()
        if (data.status === 'paid') {
          paymentStatus.value = 'paid'
          checking.value = false
          return true
        }
      }
    } catch {
      // continue polling
    }
    return false
  }

  // Initial check
  const paid = await check()
  if (paid) return

  // Poll every 2 seconds
  const interval = setInterval(async () => {
    if (pollAttempts.value >= maxPollAttempts) {
      clearInterval(interval)
      paymentStatus.value = 'failed'
      checking.value = false
      return
    }
    const isPaid = await check()
    if (isPaid) {
      clearInterval(interval)
    }
  }, 2000)

  stopPoll = () => clearInterval(interval)
}

async function tryAgain() {
  if (!orderId.value) return
  retrying.value = true
  try {
    await initiatePayment(orderId.value)
  } catch (e: any) {
    console.error('Retry payment failed:', e)
    retrying.value = false
  }
}

function goToOrders() {
  router.replace('/store/my-orders')
}

function goToStore() {
  router.replace('/store')
}

onMounted(() => {
  orderId.value = (route.params.orderId as string) || (route.query.order_id as string) || (route.query.orderId as string) || ''
  if (orderId.value) {
    checkPaymentStatus()
  } else {
    paymentStatus.value = 'failed'
    checking.value = false
  }
})

onUnmounted(() => {
  stopPoll?.()
})
</script>

<style scoped>
.result-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 20px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 380px;
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Icon Rings */
.icon-ring {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  animation: scaleIn 0.4s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.success-ring {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.18), rgba(76, 175, 80, 0.06));
  box-shadow: 0 8px 32px rgba(76, 175, 80, 0.15);
}

.failed-ring {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.18), rgba(244, 67, 54, 0.06));
  box-shadow: 0 8px 32px rgba(244, 67, 54, 0.15);
}

.checking-ring {
  background: linear-gradient(135deg, rgba(var(--ion-color-primary-rgb), 0.18), rgba(var(--ion-color-primary-rgb), 0.06));
  box-shadow: 0 8px 32px rgba(var(--ion-color-primary-rgb), 0.15);
}

.result-icon {
  font-size: 60px;
}

.success-icon { color: #4CAF50; }
.failed-icon { color: #F44336; }

.checking-spinner {
  width: 50px;
  height: 50px;
  color: var(--ion-color-primary);
}

/* Title & Description */
.result-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 8px;
}

.success-text { color: #4CAF50; }
.failed-text { color: #F44336; }

.result-desc {
  font-size: 0.92rem;
  color: var(--ion-color-medium);
  margin: 0 0 28px;
  line-height: 1.5;
  max-width: 320px;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  max-width: 260px;
  height: 4px;
  background: var(--ion-color-step-100, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-primary), var(--ion-color-carrot, #FF6B35));
  border-radius: 4px;
  transition: width 0.5s ease;
}

/* Info Card */
.info-card {
  background: var(--ion-color-step-50, #f9f9f9);
  border-radius: 16px;
  padding: 16px 20px;
  width: 100%;
  margin-bottom: 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.info-row + .info-row {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.info-label {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.info-value {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ion-text-color);
  font-family: monospace;
}

.amount-value {
  color: var(--ion-color-carrot, #FF6B35);
  font-size: 1rem;
}

.status-pending {
  color: #FF9800;
  font-family: inherit;
}

/* Buttons */
.action-btn {
  width: 100%;
  --border-radius: 14px;
  font-weight: 600;
  font-size: 0.95rem;
  height: 50px;
  margin-bottom: 10px;
}

.primary-btn {
  --box-shadow: 0 6px 20px rgba(255, 107, 53, 0.3);
}

/* Confetti */
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 999;
}

.confetti-piece {
  position: absolute;
  top: -10px;
  width: 8px;
  height: 8px;
  background: var(--color);
  border-radius: 2px;
  animation: confettiFall 3s ease-in forwards;
  animation-delay: var(--delay);
  opacity: 0;
}

@keyframes confettiFall {
  0% {
    opacity: 1;
    transform: translateY(-20px) translateX(0) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translateY(100vh) translateX(var(--x)) rotate(720deg);
  }
}

/* Dark Mode */
.ion-palette-dark .info-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.ion-palette-dark .info-row + .info-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
