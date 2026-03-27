<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.orderSuccess')" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Order processing is currently undergoing maintenance. Check back later!</p>
        </div>
      </div>

      <div v-else class="success-wrapper">
        <div class="success-icon-ring">
          <ion-icon :icon="checkmarkCircle" class="success-icon" />
        </div>

        <h1 class="success-title">{{ $t('store.orderSuccess') }}</h1>
        <p class="success-desc">{{ $t('store.orderSuccessDesc') }}</p>

        <div class="info-card" v-if="orderId">
          <div class="info-row">
            <span class="info-label">{{ $t('store.orderId') }}</span>
            <span class="info-value">{{ orderId.slice(0, 8).toUpperCase() }}</span>
          </div>
          <div class="info-row" v-if="invoiceNo">
            <span class="info-label">{{ $t('store.invoiceNo') }}</span>
            <span class="info-value">{{ invoiceNo }}</span>
          </div>
        </div>

        <ion-button expand="block" color="carrot" class="back-btn" @click="$router.replace('/store')">
          {{ $t('store.backToStore') }}
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage, IonHeader, IonContent, IonButton, IonIcon } from '@ionic/vue'
import { checkmarkCircle, constructOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const orderId = ref('')
const invoiceNo = ref('')

onMounted(() => {
  orderId.value = (route.query.orderId as string) || ''
  invoiceNo.value = (route.query.invoiceNo as string) || ''
})
</script>

<style scoped>
.success-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  min-height: 60vh;
}

.success-icon-ring {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--ion-color-success-rgb), 0.15), rgba(var(--ion-color-success-rgb), 0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.success-icon {
  font-size: 56px;
  color: var(--ion-color-success);
}

.success-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 8px;
  color: var(--ion-text-color);
}

.success-desc {
  font-size: 0.95rem;
  color: var(--ion-color-medium);
  margin: 0 0 32px;
  max-width: 300px;
}

.info-card {
  background: var(--ion-color-step-50, #f9f9f9);
  border-radius: 16px;
  padding: 16px 20px;
  width: 100%;
  max-width: 340px;
  margin-bottom: 32px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.info-row + .info-row {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.info-label {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.info-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-text-color);
  font-family: monospace;
}

.back-btn {
  --border-radius: 14px;
  font-weight: 600;
  width: 100%;
  max-width: 340px;
  height: 50px;
}

/* Under Construction */
.under-construction-overlay {
  padding: 16px;
}

.construction-card {
  padding: 24px;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 20px;
  text-align: center;
  border: 1px dashed var(--ion-color-carrot);
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

/* Dark mode */
.ion-palette-dark .info-card {
  background: var(--ion-color-step-100, #1e1e1e);
}

.ion-palette-dark .info-row + .info-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
