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

          <div v-if="qrDataUrl" class="qr-wrapper">
            <img :src="qrDataUrl" class="qr-image" alt="Referral QR code" />
            <p class="qr-hint">{{ $t('referral.qrHint') || 'Scan to sign up with your code' }}</p>
          </div>

          <ion-button expand="block" color="carrot" shape="round" @click="shareCode">
            <ion-icon :icon="shareSocialOutline" slot="start" />
            {{ $t('referral.share') || 'Share' }}
          </ion-button>
          <ion-button v-if="qrDataUrl" expand="block" fill="outline" color="light" @click="shareQrCode">
            <ion-icon :icon="qrCodeOutline" slot="start" />
            {{ $t('referral.shareQr') || 'Share QR code' }}
          </ion-button>

          <!-- One-tap links for specific platforms, in case a device's own
               share sheet doesn't list them (common on desktop browsers). -->
          <div class="quick-share-row">
            <button class="quick-share-btn" aria-label="Share on WhatsApp" @click="shareVia('whatsapp')">
              <ion-icon :icon="logoWhatsapp" />
            </button>
            <button class="quick-share-btn" aria-label="Share on LINE" @click="shareVia('line')">
              <ion-icon :icon="chatbubbleEllipsesOutline" />
            </button>
            <button class="quick-share-btn" aria-label="Share on Facebook" @click="shareVia('facebook')">
              <ion-icon :icon="logoFacebook" />
            </button>
            <button class="quick-share-btn" aria-label="Share on X" @click="shareVia('x')">
              <ion-icon :icon="logoX" />
            </button>
            <button class="quick-share-btn" aria-label="Copy link" @click="copyLink">
              <ion-icon :icon="copyOutline" />
            </button>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Milestone campaign: replaces the always-on reward while it runs, so
           the plain deadline banner below is hidden in favor of this. -->
      <ion-card v-if="summary?.active_campaign" class="fade-in campaign-card">
        <ion-card-content>
          <p class="section-label">{{ $t('referral.campaignActive') || 'Promotion running now' }}</p>
          <p class="campaign-ends">{{ $t('referral.campaignEnds', { date: formatDeadline(summary.active_campaign.ends_at) }) || `Ends ${formatDeadline(summary.active_campaign.ends_at)}` }}</p>
          <p class="campaign-count">{{ summary.active_campaign.my_valid_conversions }} {{ $t('referral.campaignValidReferrals') || 'valid referrals so far' }}</p>

          <div class="tier-progress">
            <div
                v-for="tier in summary.active_campaign.tiers"
                :key="tier.threshold"
                class="tier-row"
                :class="{ 'tier-reached': summary.active_campaign.my_valid_conversions >= tier.threshold }"
            >
              <ion-icon :icon="summary.active_campaign.my_valid_conversions >= tier.threshold ? checkmarkCircle : ellipseOutline" />
              <span class="tier-threshold">{{ tier.threshold }} {{ $t('referral.people') || 'people' }}</span>
              <span class="tier-reward">
                {{ isFreeDaysMode ? `${tier.days_granted} ${$t('referral.days') || 'days'}` : `NT$ ${tier.amount_ntd}` }}
              </span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-card v-else-if="!isFreeDaysMode && config?.commission_deadline" class="fade-in deadline-card" :class="{ 'deadline-expired': deadlineHasPassed }">
        <ion-card-content class="ion-text-center">
          <ion-icon :icon="timeOutline" class="deadline-icon" />
          <p v-if="deadlineHasPassed" class="deadline-text">
            {{ $t('referral.deadlinePassed') || 'The NT$ earning period has ended.' }}
          </p>
          <template v-else>
            <p class="deadline-text">{{ $t('referral.deadlinePrompt') || 'Earn NT$ for referrals made before:' }}</p>
            <p class="deadline-date">{{ formatDeadline(config.commission_deadline) }}</p>
          </template>
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
import {
  shareSocialOutline, qrCodeOutline, copyOutline, chatbubbleEllipsesOutline,
  logoWhatsapp, logoFacebook, logoX, timeOutline, checkmarkCircle, ellipseOutline
} from 'ionicons/icons';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import QRCode from 'qrcode';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toastController } from '@ionic/vue';
import { useReferrals } from '@/composables/useReferrals';

const { t } = useI18n();
const { summary, config, loading, loadReferralConfig, loadMyReferralSummary } = useReferrals();

const isFreeDaysMode = computed(() => config.value?.mode === 'free_days');
const pageTitle = computed(() => isFreeDaysMode.value ? (t('referral.titlePro') || 'Invite & Earn Pro') : (t('referral.titleCash') || 'Invite & Earn NT$'));

const deadlineHasPassed = computed(() => {
  const deadline = config.value?.commission_deadline;
  return !!deadline && new Date(deadline).getTime() < Date.now();
});

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Same universal-link domain handleDeepLink() in main.ts already parses ?ref= from.
const referralLink = computed(() => {
  const code = summary.value?.my_code;
  return code ? `https://app.halalformosa.com/signup?ref=${code}` : null;
});

const qrDataUrl = ref<string | null>(null);
watch(referralLink, async (link) => {
  qrDataUrl.value = link ? await QRCode.toDataURL(link, { width: 480, margin: 1 }) : null;
}, { immediate: true });

onMounted(async () => {
  await Promise.all([loadReferralConfig(), loadMyReferralSummary()]);
});

function shareTextFor(code: string) {
  return t('referral.shareText', { code }) as string || `Use my referral code ${code} on Halal Formosa!`;
}

async function shareCode() {
  const code = summary.value?.my_code;
  if (!code || !referralLink.value) return;
  try {
    await Share.share({
      title: 'Halal Formosa',
      text: shareTextFor(code),
      url: referralLink.value,
      dialogTitle: t('referral.share') as string || 'Share',
    });
  } catch (err: any) {
    // On desktop web there's often no native/Web Share API at all — Capacitor's
    // Share plugin throws rather than silently no-oping, so fall back to a
    // copy-to-clipboard the user can paste into any app themselves. A real
    // "user cancelled the sheet" case also lands here but a harmless extra
    // clipboard copy is a fine trade-off for never leaving desktop users stuck.
    if (String(err?.message ?? err).toLowerCase().includes('cancel')) return;
    await copyLink();
  }
}

// One-tap deep links into specific platforms' own share/compose flows, for
// devices/browsers whose native share sheet doesn't already list them.
async function shareVia(platform: 'whatsapp' | 'line' | 'facebook' | 'x') {
  const code = summary.value?.my_code;
  if (!code || !referralLink.value) return;
  const text = shareTextFor(code);
  const link = referralLink.value;

  const urls: Record<typeof platform, string> = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
  };

  try {
    await Browser.open({ url: urls[platform] });
  } catch {
    window.open(urls[platform], '_blank');
  }
}

async function copyLink() {
  const code = summary.value?.my_code;
  if (!code || !referralLink.value) return;
  try {
    await Clipboard.write({ string: `${shareTextFor(code)} ${referralLink.value}` });
  } catch {
    /* clipboard unavailable — nothing more we can do */
  }
  const toast = await toastController.create({
    message: t('referral.linkCopied') as string || 'Link copied — paste it anywhere!',
    duration: 2000,
    position: 'bottom',
  });
  await toast.present();
}

async function shareQrCode() {
  const code = summary.value?.my_code;
  if (!code || !qrDataUrl.value) return;
  const text = t('referral.shareText', { code }) as string || `Use my referral code ${code} on Halal Formosa!`;

  if (!Capacitor.isNativePlatform()) {
    // Web/desktop: no filesystem to hand the share sheet a file, fall back to the link share.
    await shareCode();
    return;
  }

  try {
    const base64 = qrDataUrl.value.replace(/^data:image\/\w+;base64,/, '');
    const path = `share/referral-qr-${Date.now()}.png`;
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({
      title: 'Halal Formosa',
      text,
      files: [uri],
      dialogTitle: t('referral.shareQr') as string || 'Share QR code',
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
.qr-wrapper {
  margin: 0 0 16px;
}
.qr-image {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: white;
  padding: 8px;
}
.qr-hint {
  margin: 8px 0 0;
  color: white;
  opacity: 0.85;
  font-size: 0.85rem;
}
.quick-share-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}
.quick-share-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.quick-share-btn:active {
  background: rgba(255, 255, 255, 0.4);
}
.deadline-card {
  --background: var(--ion-color-warning-tint, #ffe08a);
}
.deadline-card.deadline-expired {
  --background: var(--ion-color-medium-tint, #d7d8da);
}
.deadline-icon {
  font-size: 1.6rem;
  margin-bottom: 4px;
}
.deadline-text {
  margin: 0;
  font-size: 0.9rem;
}
.deadline-date {
  margin: 4px 0 0;
  font-weight: 700;
  font-size: 1.1rem;
}
.campaign-card {
  --background: var(--ion-color-carrot-tint, #ffd9b3);
}
.campaign-ends {
  margin: 0 0 4px;
  font-size: 0.85rem;
  opacity: 0.8;
}
.campaign-count {
  margin: 0 0 12px;
  font-weight: 700;
  font-size: 1.1rem;
}
.tier-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.6;
}
.tier-row.tier-reached {
  opacity: 1;
  font-weight: 600;
}
.tier-threshold {
  flex: 1;
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
