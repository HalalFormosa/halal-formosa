<template>
  <div v-if="offers.length" class="offer-list">
    <div v-for="offer in offers" :key="offer.id" class="offer-card" :class="{ revealed: codes[offer.id] }">
      <div class="offer-head">
        <ion-icon :icon="pricetagOutline" class="offer-icon" />
        <div class="offer-text">
          <div class="offer-title-row">
            <strong class="offer-title">{{ offer.title }}</strong>
            <span v-if="offer.discount_label" class="offer-badge">{{ offer.discount_label }}</span>
          </div>
          <p v-if="offer.description" class="offer-desc">{{ offer.description }}</p>
          <span class="offer-pro">
            <ion-icon :icon="sparkles" />
            {{ offer.free_uses > 0 ? $t('offers.freeThenPro', { n: offer.free_uses }) : $t('offers.proPerk') }}
          </span>
          <span v-if="offer.valid_until" class="offer-ends">{{ $t('offers.endsOn', { date: formatDate(offer.valid_until) }) }}</span>
        </div>
      </div>

      <!-- Revealed code -->
      <div v-if="codes[offer.id]" class="offer-code-box">
        <img v-if="qr[offer.id]" :src="qr[offer.id]" alt="QR code" class="offer-qr" />
        <div class="offer-code">{{ codes[offer.id]!.code }}</div>
        <p class="offer-hint">
          {{ $t('offers.showAtCounter') }}
          <br />
          <template v-if="followSteps(offer).length">{{ $t('offers.followStaffNote') }}<br /></template>
          {{ $t('offers.validUntil', { date: formatDate(codes[offer.id]!.expires_at) }) }}
        </p>
      </div>

      <!-- Follow first: one step per social account the store actually has -->
      <div v-if="!codes[offer.id] && showFollow(offer)" class="offer-follow">
        <p class="of-title">{{ $t('offers.followFirst') }}</p>
        <div class="of-row">
          <a
            v-for="step in followSteps(offer)"
            :key="step.platform"
            class="of-btn"
            :class="{ done: step.done }"
            :href="followUrl(step)"
            target="_blank"
            rel="noopener"
            @click="onFollow(offer, step)"
          >
            <ion-icon :icon="step.done ? checkmarkCircle : followIcon(step.platform)" />
            <span>{{ step.done ? $t('offers.followed', { platform: platformName(step.platform) }) : $t('offers.followOn', { platform: platformName(step.platform) }) }}</span>
          </a>
        </div>
      </div>

      <ion-button
        v-if="!codes[offer.id]"
        expand="block"
        color="carrot"
        mode="md"
        :disabled="busy === offer.id || followIncomplete(offer)"
        @click="reveal(offer)"
      >
        <ion-spinner v-if="busy === offer.id" name="crescent" slot="start" />
        <ion-icon v-else :icon="!signedIn ? logInOutline : needsPro(offer) ? lockClosedOutline : ticketOutline" slot="start" />
        {{ !signedIn ? $t('offers.loginToClaim') : needsPro(offer) ? (offer.free_uses > 0 ? $t('offers.unlockMore') : $t('offers.unlock')) : $t('offers.showCode') }}
      </ion-button>

      <p v-if="messages[offer.id]" class="offer-msg">{{ messages[offer.id] }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonButton, IonIcon, IonSpinner, toastController } from '@ionic/vue'
import { pricetagOutline, sparkles, lockClosedOutline, ticketOutline, logInOutline, logoInstagram, logoTiktok, logoFacebook, checkmarkCircle } from 'ionicons/icons'
import QRCode from 'qrcode'
import { supabase } from '@/plugins/supabaseClient'
import router from '@/router'
import { isDonor } from '@/composables/useSubscriptionStatus'
import { presentProPaywall } from '@/utils/proPaywall'
import { OfferService, OfferError, type LocationOffer, type OfferCode, type OfferStatus, type FollowStep } from '@/services/OfferService'

const props = defineProps<{ locationId: number }>()
const { t, locale } = useI18n()

const offers = ref<LocationOffer[]>([])
const codes = ref<Record<string, OfferCode | undefined>>({})
const qr = ref<Record<string, string | undefined>>({})
const messages = ref<Record<string, string | undefined>>({})
const busy = ref<string | null>(null)
const status = ref<Record<string, OfferStatus | undefined>>({})
const signedIn = ref(false)

async function load() {
  codes.value = {}
  qr.value = {}
  messages.value = {}
  status.value = {}
  offers.value = props.locationId ? await OfferService.getOffersForLocation(props.locationId) : []
  await loadStatus()
}

// Per-user state (free redemptions left?) — only known once signed in.
async function loadStatus() {
  const { data: { session } } = await supabase.auth.getSession()
  signedIn.value = !!session
  if (!session) return
  await Promise.all(offers.value.map(async o => {
    status.value[o.id] = (await OfferService.getMyStatus(o.id)) ?? undefined
  }))
}

// The button becomes an upgrade prompt once a free user has used up their free redemption(s).
function needsPro(offer: LocationOffer): boolean {
  if (isDonor.value) return false
  const st = status.value[offer.id]
  if (st) return !st.can_get_code
  return offer.free_uses <= 0
}

// ---- Follow-first steps (only for accounts the store actually has) ----
function followSteps(offer: LocationOffer): FollowStep[] {
  return status.value[offer.id]?.follow ?? []
}
function followIncomplete(offer: LocationOffer): boolean {
  if (!signedIn.value || needsPro(offer)) return false   // the upgrade prompt is never blocked by this
  if (status.value[offer.id]?.has_open_code) return false // an open code is just shown again
  return followSteps(offer).some(s => !s.done)
}
function showFollow(offer: LocationOffer): boolean {
  return signedIn.value && !needsPro(offer) && !status.value[offer.id]?.has_open_code && followSteps(offer).length > 0
}
function platformName(p: FollowStep['platform']) {
  return p === 'instagram' ? 'Instagram' : p === 'tiktok' ? 'TikTok' : 'Facebook'
}
function followIcon(p: FollowStep['platform']) {
  return p === 'instagram' ? logoInstagram : p === 'tiktok' ? logoTiktok : logoFacebook
}
function followUrl(s: FollowStep) {
  return s.platform === 'instagram' ? `https://instagram.com/${s.account}`
    : s.platform === 'tiktok' ? `https://tiktok.com/@${s.account}`
    : s.account
}
// The link itself opens the account; we only record that they went there.
async function onFollow(offer: LocationOffer, step: FollowStep) {
  if (step.done) return
  try {
    await OfferService.recordFollow(offer, step.platform)
    step.done = true
  } catch { /* the code step re-checks on the server; they can tap again */ }
}

watch(() => props.locationId, load, { immediate: true })

// Keep the button label right after logging in/out.
const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
  const was = signedIn.value
  signedIn.value = !!session
  if (was !== signedIn.value) loadStatus()
})
onBeforeUnmount(() => authSub.subscription.unsubscribe())

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function reveal(offer: LocationOffer) {
  messages.value[offer.id] = undefined
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    router.push('/login')
    return
  }

  // A free user who has used their free redemption goes to the paywall first
  // (it only runs in the native app); Pro users and users with uses left skip it.
  if (needsPro(offer)) {
    const ok = await presentProPaywall('offer_code', { meta: { offer_id: offer.id, location_id: offer.location_id } })
    if (!ok) {
      messages.value[offer.id] = offer.free_uses > 0 ? t('offers.limitReached') : t('offers.proRequired')
      return
    }
  }

  busy.value = offer.id
  try {
    const result = await OfferService.getMyCode(offer)
    codes.value[offer.id] = result
    qr.value[offer.id] = await QRCode.toDataURL(result.code, { margin: 1, width: 220 })
  } catch (e) {
    const code = e instanceof OfferError ? e.code : 'unknown'
    messages.value[offer.id] =
      code === 'follow_required' ? t('offers.followRequired')
      : code === 'free_limit_reached' ? t('offers.limitReached')
      : code === 'pro_required' ? t('offers.proRequired')
      : code === 'offer_ended' || code === 'offer_not_found' ? t('offers.ended')
      : t('offers.error')
    if (code === 'follow_required') await loadStatus()
    if (code === 'unknown') {
      const toast = await toastController.create({ message: t('offers.error'), duration: 2500, position: 'bottom' })
      await toast.present()
    }
  } finally {
    busy.value = null
  }
}
</script>

<style scoped>
.offer-list { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
.offer-card {
  border: 1px solid var(--ion-color-carrot, #ff7a00);
  border-radius: 16px;
  padding: 14px;
  background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 8%, transparent);
}
.offer-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.offer-icon { font-size: 24px; color: var(--ion-color-carrot, #ff7a00); flex-shrink: 0; margin-top: 2px; }
.offer-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.offer-title { font-size: 15px; }
.offer-badge {
  background: var(--ion-color-carrot, #ff7a00); color: #fff; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
}
.offer-desc { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.offer-pro { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; margin-top: 6px; opacity: 0.85; }
.offer-follow { margin: 0 0 10px; }
.of-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.of-row { display: flex; flex-wrap: wrap; gap: 8px; }
.of-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600; text-decoration: none; color: var(--ion-color-carrot, #ff7a00); border: 1px solid var(--ion-color-carrot, #ff7a00); }
.of-btn.done { opacity: 0.7; border-style: dashed; }
.of-btn ion-icon { font-size: 18px; }
.offer-ends { display: block; font-size: 12px; margin-top: 4px; opacity: 0.85; }
.offer-code-box { text-align: center; padding: 8px 0 2px; }
.offer-qr { width: 180px; height: 180px; border-radius: 12px; background: #fff; padding: 6px; }
.offer-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24px; font-weight: 800;
  letter-spacing: 2px; margin: 8px 0; user-select: all;
}
.offer-hint { font-size: 12px; opacity: 0.75; margin: 0; }
.offer-msg { font-size: 12px; margin: 8px 0 0; color: var(--ion-color-danger, #d33); }
</style>
