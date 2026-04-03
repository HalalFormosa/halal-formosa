<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header 
        :title="$t('admin.merchant.title')" 
        show-back 
        back-route="/profile" 
      />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="admin-container">
        <div v-if="loading" class="ion-text-center ion-padding">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <div v-if="applications.length === 0" class="empty-state fade-in">
            <ion-icon :icon="checkmarkCircleOutline" size="large" color="success" />
            <h3>{{ $t('admin.merchant.noPending') }}</h3>
          </div>

          <div v-else class="applications-list">
            <ion-card 
              v-for="app in applications" 
              :key="app.id" 
              class="application-card fade-in"
            >
              <ion-card-header>
                <div class="card-title-row">
                  <ion-card-title>{{ app.store_name }}</ion-card-title>
                  <ion-badge color="warning">{{ $t('admin.merchant.status.pending') }}</ion-badge>
                </div>
                <ion-card-subtitle v-if="app.store_name_zh">{{ app.store_name_zh }}</ion-card-subtitle>
              </ion-card-header>

              <ion-card-content>
                <div class="info-grid">
                  <div class="info-item">
                    <label>Contact Phone</label>
                    <p>{{ app.contact_phone }}</p>
                  </div>
                  <div class="info-item" v-if="app.unified_business_number">
                    <label>UBN</label>
                    <p>{{ app.unified_business_number }}</p>
                  </div>
                  <div class="info-item full-width">
                    <label>Address</label>
                    <p>{{ app.store_address || 'Not provided' }}</p>
                  </div>
                  <div class="info-item full-width">
                    <label>Description</label>
                    <p class="description">{{ app.store_description }}</p>
                  </div>
                </div>

                <div class="action-buttons ion-margin-top">
                  <ion-button 
                    fill="outline" 
                    color="danger" 
                    @click="handleReject(app)"
                    class="action-btn"
                  >
                    {{ $t('admin.merchant.reject') }}
                  </ion-button>
                  <ion-button 
                    color="success" 
                    @click="handleApprove(app)"
                    class="action-btn"
                  >
                    {{ $t('admin.merchant.approve') }}
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  IonPage, IonHeader, IonContent, IonSpinner, 
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonBadge, IonButton, IonIcon, alertController, toastController
} from '@ionic/vue'
import { checkmarkCircleOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { MerchantService, type MerchantApplication } from '@/services/MerchantService'
import { ActivityLogService } from '@/services/ActivityLogService'

const loading = ref(true)
const applications = ref<MerchantApplication[]>([])

async function fetchApplications() {
  loading.value = true
  try {
    applications.value = await MerchantService.getPendingApplications()
  } catch (error) {
    showToast('Error loading applications', 'danger')
  } finally {
    loading.value = false
  }
}

async function handleApprove(app: MerchantApplication) {
  const alert = await alertController.create({
    header: 'Confirm Approval',
    message: `Are you sure you want to approve "${app.store_name}"? This will create their store automatically.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { 
        text: 'Approve', 
        handler: async () => {
          try {
            await MerchantService.updateApplicationStatus(app.id!, 'approved')
            showToast('Application approved! Store created.', 'success')
            fetchApplications()
          } catch (error) {
            showToast('Approval failed', 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function handleReject(app: MerchantApplication) {
  const alert = await alertController.create({
    header: 'Reject Application',
    message: 'Please provide a reason for rejection.',
    inputs: [
      {
        name: 'reason',
        type: 'textarea',
        placeholder: 'e.g. Invalid UBN or Phone number'
      }
    ],
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { 
        text: 'Reject', 
        handler: async (data) => {
          if (!data.reason) {
            showToast('Reason is required for rejection', 'warning')
            return false
          }
          try {
            await MerchantService.updateApplicationStatus(app.id!, 'rejected', data.reason)
            showToast('Application rejected', 'medium')
            fetchApplications()
          } catch (error) {
            showToast('Rejection failed', 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color,
    position: 'bottom'
  })
  await toast.present()
}

onMounted(() => {
  fetchApplications()
  ActivityLogService.log('merchant_admin_view_applications')
})
</script>

<style scoped>
.admin-container {
  max-width: 800px;
  margin: 0 auto;
}

.application-card {
  border-radius: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 8px;
}

.info-item label {
  display: block;
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 4px;
}

.info-item p {
  margin: 0;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.full-width {
  grid-column: span 2;
}

.description {
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  --border-radius: 12px;
  font-weight: 700;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state h3 {
  color: var(--ion-color-medium);
  font-weight: 600;
  margin-top: 16px;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
