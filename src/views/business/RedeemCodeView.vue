<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('offers.redeem.title')" show-back :back-route="'/business'" icon="none" />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="redeem-container">
        <p class="hint">{{ $t('offers.redeem.hint') }}</p>

        <!-- Typed code -->
        <form class="code-form" @submit.prevent="check(codeInput)">
          <input
            v-model="codeInput"
            @input="pending = null"
            class="code-input"
            type="text"
            inputmode="text"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            :placeholder="$t('offers.redeem.placeholder')"
          />
          <ion-button type="submit" color="carrot" mode="md" :disabled="busy || !codeInput.trim()">
            <ion-spinner v-if="busy" name="crescent" />
            <span v-else>{{ $t('offers.redeem.check') }}</span>
          </ion-button>
        </form>

        <!-- Scanner (web camera via html5-qrcode) -->
        <ion-button expand="block" fill="outline" color="carrot" mode="md" class="scan-btn" @click="toggleScan">
          <ion-icon :icon="scanning ? closeOutline : qrCodeOutline" slot="start" />
          {{ scanning ? $t('offers.redeem.stopScan') : $t('offers.redeem.scan') }}
        </ion-button>
        <div v-show="scanning" id="offer-qr-reader" class="qr-reader"></div>

        <!-- Checked, not yet redeemed: always ask before marking a code as used -->
        <div v-if="pending" class="pending" aria-live="polite">
          <strong>{{ pending.offer_title }}<template v-if="pending.discount_label"> · {{ pending.discount_label }}</template></strong>
          <p v-if="pending.location_name">{{ pending.location_name }}</p>
          <p class="pending-code">{{ pending.code }}</p>
          <p v-if="pending.state === 'ok'">{{ $t('offers.redeem.valid') }}</p>
          <p v-else class="pending-problem">{{ stateText(pending) }}</p>
          <div class="pending-actions">
            <ion-button class="pending-cancel" fill="outline" color="medium" mode="md" :disabled="busy" @click="pending = null">
              {{ pending.state === 'ok' ? $t('common.cancel') : $t('common.ok') }}
            </ion-button>
            <ion-button v-if="pending.state === 'ok'" class="pending-confirm" color="carrot" mode="md" :disabled="busy" @click="confirmRedeem">
              <ion-spinner v-if="busy" name="crescent" />
              <span v-else>{{ $t('offers.redeem.confirm') }}</span>
            </ion-button>
          </div>
        </div>

        <!-- Result -->
        <div v-if="result" class="result" :class="result.ok ? 'ok' : 'bad'">
          <ion-icon :icon="result.ok ? checkmarkCircle : alertCircle" />
          <div>
            <strong>{{ result.title }}</strong>
            <p v-if="result.detail">{{ result.detail }}</p>
          </div>
        </div>

        <!-- History -->
        <p class="section-label">{{ $t('offers.redeem.recent') }}</p>
        <p v-if="!history.length" class="empty">{{ $t('offers.redeem.none') }}</p>
        <ul v-else class="history">
          <li v-for="row in history" :key="row.code + row.redeemed_at">
            <span class="h-code">{{ row.code }}<small v-if="row.location_name" class="h-store">{{ row.location_name }}</small></span>
            <span class="h-time">{{ formatTime(row.redeemed_at) }}</span>
            <button v-if="row.can_void" type="button" class="h-undo" :disabled="voiding === row.code" @click="confirmVoid(row)">
              {{ $t('offers.redeem.undo') }}
            </button>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { IonPage, IonHeader, IonContent, IonButton, IonIcon, IonSpinner, toastController, alertController, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import { qrCodeOutline, closeOutline, checkmarkCircle, alertCircle } from 'ionicons/icons'
import { Html5Qrcode } from 'html5-qrcode'
import AppHeader from '@/components/AppHeader.vue'
import { acceptPendingOwnerInvites } from '@/composables/useStoreAccess'
import { OfferService, OfferError, type CodeCheck, type RedemptionRow } from '@/services/OfferService'

const router = useRouter()
const { t, locale } = useI18n()

const codeInput = ref('')
const busy = ref(false)
const scanning = ref(false)
const history = ref<RedemptionRow[]>([])
const result = ref<{ ok: boolean; title: string; detail?: string } | null>(null)
const pending = ref<CodeCheck | null>(null)
let scanner: Html5Qrcode | null = null

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

async function loadHistory() {
  try {
    history.value = await OfferService.listMyRedemptions(20)
  } catch {
    history.value = []
  }
}

const voiding = ref<string | null>(null)

async function confirmVoid(row: RedemptionRow) {
  const alert = await alertController.create({
    header: t('offers.redeem.undoTitle'),
    message: t('offers.redeem.undoBody', { code: row.code }),
    // Each button names its outcome: "Cancel" and "Undo" read almost the same in Chinese.
    buttons: [
      { text: t('offers.redeem.undoKeep'), role: 'cancel' },
      { text: t('offers.redeem.undoConfirm'), role: 'destructive', handler: () => { void doVoid(row) } },
    ],
  })
  await alert.present()
}

async function doVoid(row: RedemptionRow) {
  voiding.value = row.code
  try {
    await OfferService.voidRedemption(row.code)
    result.value = { ok: true, title: t('offers.redeem.undone'), detail: t('offers.redeem.undoneDetail', { code: row.code }) }
    await loadHistory()
  } catch (e) {
    const code = e instanceof OfferError ? e.code : 'unknown'
    result.value = {
      ok: false,
      title: code === 'void_window_passed' ? t('offers.redeem.errWindow')
        : code === 'customer_has_open_code' ? t('offers.redeem.errOpenCode')
        : t('offers.redeem.generic'),
    }
  } finally {
    voiding.value = null
  }
}

function errorTitle(e: unknown, fallback: string) {
  const err = e instanceof OfferError ? e : null
  if (err?.code === 'invalid_code') return t('offers.redeem.invalid_code')
  if (err?.code === 'already_used') return t('offers.redeem.already_used', { when: err.detail ?? '' })
  if (err?.code === 'expired') return t('offers.redeem.expired')
  if (err?.code === 'offer_not_active') return t('offers.redeem.offer_not_active')
  if (err?.code === 'not_allowed') return t('offers.redeem.not_allowed')
  return fallback
}

function stateText(info: CodeCheck) {
  if (info.state === 'already_used') {
    return t('offers.redeem.already_used', { when: info.redeemed_at ? formatTime(info.redeemed_at) : '' })
  }
  return t(`offers.redeem.${info.state}`)
}

/** Looks the code up without using it. */
async function check(raw: string) {
  const code = raw.trim()
  if (!code || busy.value) return
  busy.value = true
  result.value = null
  pending.value = null
  // An answer for a code that is no longer in the box must not be offered for confirmation.
  const stale = () => codeInput.value.trim() !== code
  try {
    const info = await OfferService.checkCode(code)
    if (!stale()) pending.value = info
  } catch (e) {
    if (!stale()) result.value = { ok: false, title: errorTitle(e, t('offers.redeem.checkFailed')) }
  } finally {
    busy.value = false
  }
}

async function confirmRedeem() {
  const current = pending.value
  if (!current || current.state !== 'ok' || busy.value) return
  busy.value = true
  try {
    const res = await OfferService.redeem(current.code)
    pending.value = null
    result.value = {
      ok: true,
      title: t('offers.redeem.success'),
      detail: res.location_name
        ? t('offers.redeem.successDetailStore', { offer: res.offer_title, store: res.location_name })
        : t('offers.redeem.successDetail', { offer: res.offer_title }),
    }
    codeInput.value = ''
    await loadHistory()
  } catch (e) {
    pending.value = null
    result.value = { ok: false, title: errorTitle(e, t('offers.redeem.generic')) }
  } finally {
    busy.value = false
  }
}

async function stopScan() {
  if (scanner) {
    try { if (scanner.isScanning) await scanner.stop() } catch { /* already stopped */ }
    try { scanner.clear() } catch { /* ignore */ }
    scanner = null
  }
  scanning.value = false
}

async function toggleScan() {
  if (scanning.value) return stopScan()
  scanning.value = true
  result.value = null
  pending.value = null
  try {
    scanner = new Html5Qrcode('offer-qr-reader')
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        await stopScan()
        codeInput.value = decoded
        await check(decoded)
      },
      () => { /* per-frame decode misses are normal */ }
    )
  } catch {
    await stopScan()
    result.value = { ok: false, title: t('offers.redeem.cameraDenied') }
  }
}

onIonViewWillEnter(async () => {
  result.value = null
  pending.value = null
  await acceptPendingOwnerInvites() // a newly added owner can open this straight away
  try {
    history.value = await OfferService.listMyRedemptions(20)
  } catch (e) {
    // Not an owner of any store (and not an admin): nothing to redeem here.
    if (e instanceof OfferError && e.code === 'not_allowed') {
      router.replace('/business')
      const toast = await toastController.create({ message: t('offers.redeem.noAccess'), duration: 3000, position: 'bottom' })
      await toast.present()
    }
  }
})
onIonViewWillLeave(stopScan)
onBeforeUnmount(stopScan)
</script>

<style scoped>
.redeem-container { max-width: 520px; margin: 0 auto; }
.hint { margin: 0 0 14px; opacity: 0.75; font-size: 14px; }
.code-form { display: flex; gap: 8px; align-items: stretch; margin-bottom: 10px; }
.code-input {
  flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
  letter-spacing: 1px; text-transform: uppercase; padding: 12px; border-radius: 12px;
  border: 1px solid var(--ion-color-medium, #999); background: transparent; color: inherit;
}
.scan-btn { margin-bottom: 10px; }
.qr-reader { width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.pending { padding: 14px; border-radius: 16px; margin: 12px 0; border: 1px solid var(--ion-color-carrot); }
.pending p { margin: 4px 0 0; font-size: 14px; }
.pending .pending-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; }
.pending .pending-problem { font-weight: 700; }
.pending-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.result { display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-radius: 14px; margin: 12px 0; }
.result ion-icon { font-size: 28px; flex-shrink: 0; }
.result p { margin: 4px 0 0; font-size: 14px; }
.result.ok { background: color-mix(in srgb, var(--ion-color-success, #2dd36f) 15%, transparent); }
.result.ok ion-icon { color: var(--ion-color-success, #2dd36f); }
.result.bad { background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 15%, transparent); }
.result.bad ion-icon { color: var(--ion-color-danger, #eb445a); }
.section-label { margin: 22px 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; opacity: 0.6; }
.empty { opacity: 0.6; font-size: 14px; }
.history { list-style: none; margin: 0; padding: 0; }
.history li { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(128,128,128,0.2); }
.h-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }
.h-undo { margin-left: 8px; background: none; border: 1px solid var(--ion-color-carrot); color: var(--ion-color-carrot); border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
.h-time { font-size: 12px; opacity: 0.7; }
.h-store { display: block; font-family: inherit; font-size: 11px; opacity: 0.65; }
</style>
