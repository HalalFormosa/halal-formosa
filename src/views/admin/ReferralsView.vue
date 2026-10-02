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

            <ion-item lines="none">
              <div class="deadline-field">
                <label class="deadline-label">Deadline (users can only earn NT$ before this)</label>
                <input
                    type="datetime-local"
                    class="deadline-input"
                    :value="deadlineInputValue"
                    @change="pendingDeadline = ($event.target as HTMLInputElement).value"
                />
              </div>
            </ion-item>
            <p class="deadline-status">
              <template v-if="!config?.commission_deadline">No deadline set — commission stays open indefinitely.</template>
              <template v-else-if="isDeadlinePast(config.commission_deadline)">⚠️ Deadline passed on {{ formatDateTime(config.commission_deadline) }} — new conversions no longer earn commission.</template>
              <template v-else>Open until {{ formatDateTime(config.commission_deadline) }}.</template>
            </p>

            <div class="button-row">
              <ion-button size="small" fill="outline" color="carrot" @click="saveCommission">Save</ion-button>
              <ion-button v-if="config?.commission_deadline" size="small" fill="clear" color="medium" @click="clearDeadline">Clear deadline</ion-button>
            </div>
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

      <!-- Milestone campaigns -->
      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">Milestone campaigns</p>
          <p class="campaign-note">
            While a campaign is running, conversions inside its window pay a one-time tier bonus at the end instead of the always-on {{ config?.mode === 'free_days' ? 'free-days' : 'commission' }} reward above.
          </p>

          <ion-list v-if="campaigns.length" lines="inset">
            <ion-item v-for="c in campaigns" :key="c.id" button @click="viewCampaignProgress(c.id)">
              <ion-label>
                <h3>{{ formatDate(c.starts_at) }} → {{ formatDate(c.ends_at) }}</h3>
                <p>{{ campaignStatusLabel(c) }} · {{ c.participants }} rewarded</p>
                <p v-if="c.total_ntd > 0">NT$ {{ c.total_ntd }} total</p>
                <p v-if="c.total_days > 0">{{ c.total_days }} Pro-days total</p>
              </ion-label>
              <ion-button
                  v-if="!c.cancelled_at && !c.finalized_at"
                  slot="end" size="small" fill="clear" color="danger"
                  @click.stop="cancelCampaignClick(c.id)"
              >
                Cancel
              </ion-button>
            </ion-item>
          </ion-list>
          <p v-else class="empty-state">No campaigns yet.</p>

          <div v-if="selectedCampaignId" class="campaign-progress">
            <p class="section-label">Progress — {{ formatDate(selectedCampaignId && campaigns.find(c => c.id === selectedCampaignId)?.starts_at || '') }}</p>
            <ion-list lines="inset">
              <ion-item v-for="p in campaignProgress" :key="p.referrer_user_id">
                <ion-label>
                  <h3>{{ p.referrer_name || '—' }}</h3>
                  <p>{{ p.valid_conversions }} valid conversions{{ p.tier_reached ? ` · tier ${p.tier_reached} reached` : '' }}</p>
                </ion-label>
                <ion-badge v-if="p.reward_status" :color="p.reward_status === 'granted' || p.reward_status === 'paid' ? 'success' : 'warning'" slot="end">
                  {{ p.reward_status }}
                </ion-badge>
              </ion-item>
            </ion-list>
            <p v-if="!campaignProgress.length" class="empty-state">No conversions in this campaign yet.</p>
          </div>

          <ion-button expand="block" fill="outline" color="carrot" @click="showCreateForm = !showCreateForm">
            {{ showCreateForm ? 'Close' : 'New campaign' }}
          </ion-button>

          <div v-if="showCreateForm" class="campaign-form">
            <ion-item lines="none">
              <div class="deadline-field">
                <label class="deadline-label">Starts at</label>
                <input type="datetime-local" class="deadline-input" v-model="newCampaignStart" />
              </div>
            </ion-item>
            <ion-item lines="none">
              <div class="deadline-field">
                <label class="deadline-label">Ends at</label>
                <input type="datetime-local" class="deadline-input" v-model="newCampaignEnd" />
              </div>
            </ion-item>

            <p class="deadline-label" style="padding: 8px 16px 0;">Tiers (new paying members → reward)</p>
            <div v-for="(tier, i) in newCampaignTiers" :key="i" class="tier-row">
              <input type="number" placeholder="Members" v-model.number="tier.threshold" class="tier-input" />
              <input type="number" placeholder="NT$" v-model.number="tier.amount_ntd" class="tier-input" />
              <input type="number" placeholder="Days" v-model.number="tier.days_granted" class="tier-input" />
              <ion-button size="small" fill="clear" color="danger" @click="newCampaignTiers.splice(i, 1)">✕</ion-button>
            </div>
            <ion-button size="small" fill="clear" color="carrot" @click="newCampaignTiers.push({ threshold: 0, amount_ntd: 0, days_granted: 0 })">
              + Add tier
            </ion-button>

            <ion-button expand="block" color="carrot" shape="round" @click="submitCampaign">Create campaign</ion-button>
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
import { ref, computed, onMounted } from 'vue';
import { useAdminReferrals, type ReferralListRow, type CampaignSummary, type CampaignTierInput } from '@/composables/useAdminReferrals';

const {
  funnel, rows, config, loading, campaigns, campaignProgress,
  loadFunnel, loadReferralList, loadConfig, updateConfig, markCommissionPaid,
  loadCampaigns, createCampaign, cancelCampaign, loadCampaignProgress,
} = useAdminReferrals();

const pendingCommission = ref<number | null>(null);
const pendingDaysReferrer = ref<number | null>(null);
const pendingDaysReferred = ref<number | null>(null);
const pendingDeadline = ref<string | null>(null); // datetime-local string, local time

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in LOCAL time, not the ISO
// string's UTC representation — convert on the way in and back to a real
// ISO/UTC instant on the way out.
const deadlineInputValue = computed(() => {
  if (pendingDeadline.value !== null) return pendingDeadline.value;
  if (!config.value?.commission_deadline) return '';
  const d = new Date(config.value.commission_deadline);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

onMounted(async () => {
  await Promise.all([loadFunnel(), loadReferralList(), loadConfig(), loadCampaigns()]);
});

const showCreateForm = ref(false);
const newCampaignStart = ref('');
const newCampaignEnd = ref('');
const newCampaignTiers = ref<CampaignTierInput[]>([
  { threshold: 5, amount_ntd: 30, days_granted: 7 },
  { threshold: 10, amount_ntd: 100, days_granted: 21 },
  { threshold: 20, amount_ntd: 250, days_granted: 56 },
]);
const selectedCampaignId = ref<string | null>(null);

async function submitCampaign() {
  if (!newCampaignStart.value || !newCampaignEnd.value || !newCampaignTiers.value.length) {
    await notify('Fill in start, end, and at least one tier.');
    return;
  }
  const error = await createCampaign(
    new Date(newCampaignStart.value).toISOString(),
    new Date(newCampaignEnd.value).toISOString(),
    newCampaignTiers.value.filter(t => t.threshold > 0),
  );
  await notify(error ? 'Failed to create campaign.' : 'Campaign created.');
  if (!error) {
    showCreateForm.value = false;
    newCampaignStart.value = '';
    newCampaignEnd.value = '';
  }
}

async function cancelCampaignClick(campaignId: string) {
  const error = await cancelCampaign(campaignId);
  await notify(error ? 'Failed to cancel campaign.' : 'Campaign cancelled — no payouts will be made.');
}

async function viewCampaignProgress(campaignId: string) {
  selectedCampaignId.value = selectedCampaignId.value === campaignId ? null : campaignId;
  if (selectedCampaignId.value) await loadCampaignProgress(campaignId);
}

function campaignStatusLabel(c: CampaignSummary) {
  if (c.cancelled_at) return 'Cancelled';
  if (c.finalized_at) return 'Finalized';
  if (new Date(c.starts_at).getTime() > Date.now()) return 'Upcoming';
  if (new Date(c.ends_at).getTime() < Date.now()) return 'Ended (pending finalization)';
  return 'Active';
}

async function onModeChange(ev: CustomEvent) {
  const mode = (ev.detail as any).value as 'commission' | 'free_days';
  if (!mode || mode === config.value?.mode) return;
  await updateConfig({ mode });
}

async function saveCommission() {
  const patch: { commission_amount_ntd?: number; commission_deadline?: string } = {};
  if (pendingCommission.value !== null) patch.commission_amount_ntd = pendingCommission.value;
  if (pendingDeadline.value) patch.commission_deadline = new Date(pendingDeadline.value).toISOString();
  if (Object.keys(patch).length === 0) return;
  const error = await updateConfig(patch);
  if (!error) pendingDeadline.value = null;
  await notify(error ? 'Failed to save.' : 'Saved.');
}

async function clearDeadline() {
  const error = await updateConfig({}, { clearDeadline: true });
  if (!error) pendingDeadline.value = null;
  await notify(error ? 'Failed to clear deadline.' : 'Deadline cleared.');
}

function isDeadlinePast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
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
.deadline-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 8px 0;
}
.deadline-label {
  font-size: 0.75rem;
  opacity: 0.7;
}
.deadline-input {
  border: 1px solid var(--ion-color-medium, #92949c);
  border-radius: 8px;
  padding: 8px;
  font-size: 0.95rem;
  background: transparent;
  color: inherit;
}
.deadline-status {
  margin: 4px 0 0;
  font-size: 0.85rem;
  opacity: 0.8;
}
.button-row {
  display: flex;
  gap: 8px;
  align-items: center;
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
.campaign-note {
  margin: 0 0 12px;
  font-size: 0.85rem;
  opacity: 0.7;
}
.campaign-progress {
  margin: 12px 0;
  border-top: 1px solid var(--ion-color-step-150, #d9d9d9);
  padding-top: 12px;
}
.campaign-form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tier-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 16px;
}
.tier-input {
  border: 1px solid var(--ion-color-medium, #92949c);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.9rem;
  background: transparent;
  color: inherit;
  width: 0;
  flex: 1;
}
</style>
