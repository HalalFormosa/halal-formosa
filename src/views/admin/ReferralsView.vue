<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header title="Referrals" icon="none" :showBack="true" backRoute="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Mode switch + reward parameters -->
      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">Reward mode</p>
          <ion-segment :value="config?.mode" @ionChange="onModeChange($event)">
            <ion-segment-button value="commission">
              <ion-label>Commission</ion-label>
            </ion-segment-button>
            <ion-segment-button value="free_days">
              <ion-label>Free Pro Days</ion-label>
            </ion-segment-button>
          </ion-segment>

          <div v-if="config?.mode === 'commission'" class="config-fields">
            <ion-item lines="none">
              <ion-input
                  type="number"
                  label="Commission per conversion (NT$)"
                  label-placement="stacked"
                  :value="config?.commission_amount_ntd"
                  @ionChange="pendingCommission = Number(($event.target as any).value)"
              ></ion-input>
            </ion-item>
            <ion-button size="small" fill="outline" color="carrot" @click="saveCommission">Save</ion-button>
          </div>

          <div v-else class="config-fields">
            <ion-item lines="none">
              <ion-input
                  type="number"
                  label="Free days for referrer"
                  label-placement="stacked"
                  :value="config?.discount_days_referrer"
                  @ionChange="pendingDaysReferrer = Number(($event.target as any).value)"
              ></ion-input>
            </ion-item>
            <ion-item lines="none">
              <ion-input
                  type="number"
                  label="Free days for referred user"
                  label-placement="stacked"
                  :value="config?.discount_days_referred"
                  @ionChange="pendingDaysReferred = Number(($event.target as any).value)"
              ></ion-input>
            </ion-item>
            <ion-button size="small" fill="outline" color="carrot" @click="saveFreeDays">Save</ion-button>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Funnel -->
      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">Funnel</p>
          <div class="funnel-row">
            <div class="funnel-step">
              <h2>{{ funnel?.codes_generated ?? 0 }}</h2>
              <p>Codes generated</p>
            </div>
            <div class="funnel-step">
              <h2>{{ funnel?.redeemed ?? 0 }}</h2>
              <p>Redeemed</p>
            </div>
            <div class="funnel-step">
              <h2>{{ funnel?.converted ?? 0 }}</h2>
              <p>Converted</p>
            </div>
            <div class="funnel-step highlight">
              <h2>{{ funnel?.conversion_rate ?? 0 }}%</h2>
              <p>Conversion rate</p>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Referral pairs + rewards -->
      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">Referral pairs</p>
          <div v-if="loading" class="ion-text-center ion-padding">
            <ion-spinner name="crescent" color="carrot" />
          </div>
          <ion-list v-else lines="inset">
            <ion-item v-for="row in rows" :key="row.redemption_id">
              <ion-label>
                <h3>{{ row.referrer_name || '—' }} → {{ row.referred_name || '—' }}</h3>
                <p>{{ row.code || 'no code' }} · {{ formatDate(row.redeemed_at) }}</p>
                <p v-if="row.reward_type === 'commission_ntd'">NT$ {{ row.reward_amount_ntd }} — {{ row.reward_status }}</p>
                <p v-else-if="row.reward_type === 'free_days'">{{ row.reward_days }} days — {{ row.reward_status }}</p>
              </ion-label>
              <ion-badge :color="statusColor(row.status)" slot="end">{{ row.status }}</ion-badge>
              <ion-button
                  v-if="row.reward_type === 'commission_ntd' && (row.reward_status === 'pending' || row.reward_status === 'approved')"
                  slot="end" size="small" fill="clear" color="carrot"
                  @click="markPaid(row)"
              >
                Mark paid
              </ion-button>
            </ion-item>
          </ion-list>
          <p v-if="!loading && !rows.length" class="empty-state">No referrals yet.</p>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonCard, IonCardContent, IonSegment, IonSegmentButton,
  IonLabel, IonItem, IonInput, IonButton, IonList, IonBadge, IonSpinner, toastController
} from '@ionic/vue';
import AppHeader from '@/components/AppHeader.vue';
import { ref, onMounted } from 'vue';
import { useAdminReferrals, type ReferralListRow } from '@/composables/useAdminReferrals';

const { funnel, rows, config, loading, loadFunnel, loadReferralList, loadConfig, updateConfig, markCommissionPaid } = useAdminReferrals();

const pendingCommission = ref<number | null>(null);
const pendingDaysReferrer = ref<number | null>(null);
const pendingDaysReferred = ref<number | null>(null);

onMounted(async () => {
  await Promise.all([loadFunnel(), loadReferralList(), loadConfig()]);
});

async function onModeChange(ev: CustomEvent) {
  const mode = (ev.detail as any).value as 'commission' | 'free_days';
  if (!mode || mode === config.value?.mode) return;
  await updateConfig({ mode });
}

async function saveCommission() {
  if (pendingCommission.value === null) return;
  const error = await updateConfig({ commission_amount_ntd: pendingCommission.value });
  await notify(error ? 'Failed to save.' : 'Saved.');
}

async function saveFreeDays() {
  const patch: { discount_days_referrer?: number; discount_days_referred?: number } = {};
  if (pendingDaysReferrer.value !== null) patch.discount_days_referrer = pendingDaysReferrer.value;
  if (pendingDaysReferred.value !== null) patch.discount_days_referred = pendingDaysReferred.value;
  const error = await updateConfig(patch);
  await notify(error ? 'Failed to save.' : 'Saved.');
}

async function markPaid(row: ReferralListRow) {
  if (!row.reward_id) return;
  const error = await markCommissionPaid(row.reward_id);
  await notify(error ? 'Failed to mark paid.' : 'Marked as paid.');
}

async function notify(message: string) {
  const toast = await toastController.create({ message, duration: 2000, position: 'bottom' });
  await toast.present();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function statusColor(status: string) {
  if (status === 'converted') return 'success';
  if (status === 'canceled') return 'medium';
  if (status === 'no_code') return 'light';
  return 'warning';
}
</script>

<style scoped>
.section-label {
  margin: 0 0 12px;
  font-weight: 600;
  opacity: 0.7;
  font-size: 0.85rem;
  text-transform: uppercase;
}
.config-fields {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.funnel-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.funnel-step {
  text-align: center;
  flex: 1;
}
.funnel-step h2 {
  margin: 0;
}
.funnel-step p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  opacity: 0.7;
}
.funnel-step.highlight h2 {
  color: var(--ion-color-carrot, #ff8c42);
}
.empty-state {
  opacity: 0.6;
  text-align: center;
  padding: 16px 0;
}
</style>
