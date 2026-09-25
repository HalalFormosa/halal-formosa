<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="pageTitle" icon="none" :showBack="true" backRoute="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card v-if="summary?.my_code" class="fade-in code-card">
        <ion-card-content class="ion-text-center">
          <p class="code-label">{{ $t('referral.yourCode') || 'Your referral code' }}</p>
          <h1 class="code-value">{{ summary.my_code }}</h1>
          <ion-button expand="block" color="carrot" shape="round" @click="shareCode">
            <ion-icon :icon="shareSocialOutline" slot="start" />
            {{ $t('referral.share') || 'Share' }}
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="summary?.referred_by" class="fade-in">
        <ion-card-content>
          <p class="section-label">{{ $t('referral.referredBy') || 'You were referred by' }}</p>
          <p class="referred-by-name">{{ summary.referred_by.display_name || $t('referral.someone') || 'Someone' }}</p>
        </ion-card-content>
      </ion-card>

      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">
            {{ isFreeDaysMode ? ($t('referral.yourRewardsPro') || 'Your Pro days earned') : ($t('referral.yourRewardsCash') || 'Your earnings') }}
          </p>

          <template v-if="isFreeDaysMode">
            <h2 class="reward-total">{{ summary?.rewards?.total_days_granted ?? 0 }} {{ $t('referral.days') || 'days' }}</h2>
          </template>
          <template v-else>
            <h2 class="reward-total">NT$ {{ summary?.rewards?.total_ntd ?? 0 }}</h2>
            <div class="reward-breakdown">
              <span>{{ $t('referral.pending') || 'Pending' }}: NT$ {{ summary?.rewards?.pending_ntd ?? 0 }}</span>
              <span>{{ $t('referral.paid') || 'Paid' }}: NT$ {{ summary?.rewards?.paid_ntd ?? 0 }}</span>
            </div>
          </template>
        </ion-card-content>
      </ion-card>

      <ion-card class="fade-in">
        <ion-card-content>
          <p class="section-label">{{ $t('referral.peopleYouReferred') || "People you've referred" }}</p>

          <div v-if="loading" class="ion-text-center ion-padding">
            <ion-spinner name="crescent" color="carrot" />
          </div>
          <div v-else-if="!summary?.referrals?.length" class="empty-state">
            {{ $t('referral.noReferralsYet') || "You haven't referred anyone yet." }}
          </div>
          <ion-list v-else lines="inset">
            <ion-item v-for="r in summary.referrals" :key="r.referred_user_id">
              <ion-label>
                <h3>{{ r.display_name || $t('referral.someone') || 'Someone' }}</h3>
                <p>{{ formatDate(r.redeemed_at) }}</p>
              </ion-label>
              <ion-badge :color="statusColor(r.status)" slot="end">{{ statusLabel(r.status) }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonCard, IonCardContent, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonBadge, IonSpinner
} from '@ionic/vue';
import AppHeader from '@/components/AppHeader.vue';
import { shareSocialOutline } from 'ionicons/icons';
import { Share } from '@capacitor/share';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useReferrals } from '@/composables/useReferrals';

const { t } = useI18n();
const { summary, config, loading, loadReferralConfig, loadMyReferralSummary } = useReferrals();

const isFreeDaysMode = computed(() => config.value?.mode === 'free_days');
const pageTitle = computed(() => isFreeDaysMode.value ? (t('referral.titlePro') || 'Invite & Earn Pro') : (t('referral.titleCash') || 'Invite & Earn NT$'));

onMounted(async () => {
  await Promise.all([loadReferralConfig(), loadMyReferralSummary()]);
});

async function shareCode() {
  const code = summary.value?.my_code;
  if (!code) return;
  try {
    await Share.share({
      title: 'Halal Formosa',
      text: t('referral.shareText', { code }) as string || `Use my referral code ${code} on Halal Formosa!`,
      url: `https://app.halalformosa.com/signup?ref=${code}`,
      dialogTitle: t('referral.share') as string || 'Share',
    });
  } catch {
    /* user cancelled share sheet — nothing to do */
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function statusLabel(status: string) {
  if (status === 'converted') return t('referral.statusConverted') || 'Converted';
  if (status === 'canceled') return t('referral.statusCanceled') || 'Canceled';
  return t('referral.statusSignedUp') || 'Signed up';
}

function statusColor(status: string) {
  if (status === 'converted') return 'success';
  if (status === 'canceled') return 'medium';
  return 'warning';
}
</script>

<style scoped>
.code-card {
  background: linear-gradient(135deg, var(--ion-color-carrot, #ff8c42), var(--ion-color-carrot-shade, #e67a30));
}
.code-label {
  margin: 0;
  opacity: 0.85;
  color: white;
}
.code-value {
  margin: 4px 0 16px;
  letter-spacing: 2px;
  color: white;
}
.section-label {
  margin: 0 0 8px;
  font-weight: 600;
  opacity: 0.7;
  font-size: 0.85rem;
  text-transform: uppercase;
}
.referred-by-name {
  margin: 0;
  font-size: 1.1rem;
}
.reward-total {
  margin: 0 0 8px;
}
.reward-breakdown {
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
  opacity: 0.8;
}
.empty-state {
  opacity: 0.6;
  text-align: center;
  padding: 16px 0;
}
</style>
