<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('offers.redeem.title')" show-back :back-route="'/business'" icon="none" />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="redeem-container">
        <p v-if="storeName" class="store-name">{{ $t('offers.redeem.store') }}: <strong>{{ storeName }}</strong></p>
        <p class="hint">{{ $t('offers.redeem.hint') }}</p>

        <!-- Typed code -->
        <form class="code-form" @submit.prevent="redeem(codeInput)">
          <input
            v-model="codeInput"
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
            <span v-else>{{ $t('offers.redeem.button') }}</span>
          </ion-button>
        </form>

        <!-- Scanner (web camera via html5-qrcode) -->
        <ion-button expand="block" fill="outline" color="carrot" mode="md" class="scan-btn" @click="toggleScan">
          <ion-icon :icon="scanning ? closeOutline : qrCodeOutline" slot="start" />
          {{ scanning ? $t('offers.redeem.stopScan') : $t('offers.redeem.scan') }}
        </ion-button>
        <div v-show="scanning" id="offer-qr-reader" class="qr-reader"></div>

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
            <span class="h-code">{{ row.code }}</span>
            <span class="h-time">{{ formatTime(row.redeemed_at) }}</span>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { IonPage, IonHeader, IonContent, IonButton, IonIcon, IonSpinner, toastController, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import { qrCodeOutline, closeOutline, checkmarkCircle, alertCircle } from 'ionicons/icons'
import { Html5Qrcode } from 'html5-qrcode'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { canManageLocation } from '@/composables/useStoreAccess'
import { OfferService, OfferError, type RedemptionRow } from '@/services/OfferService'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const locationId = computed(() => Number(route.params.locationId))
const storeName = ref('')
const codeInput = ref('')
const busy = ref(false)
const scanning = ref(false)
const history = ref<RedemptionRow[]>([])
const result = ref<{ ok: boolean; title: string; detail?: string } | null>(null)
let scanner: Html5Qrcode | null = null

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

async function loadHistory() {
  try {
    history.value = await OfferService.listRedemptions(locationId.value, 20)
  } catch {
    history.value = []
  }
}

async function loadStore() {
  const { data } = await supabase.from('locations').select('name').eq('id', locationId.value).maybeSingle()
  storeName.value = data?.name ?? ''
}

async function redeem(raw: string) {
  const code = raw.trim()
  if (!code || busy.value) return
  busy.value = true
  result.value = null
  try {
    const res = await OfferService.redeem(code, locationId.value)
    result.value = {
      ok: true,
      title: t('offers.redeem.success'),
      detail: t('offers.redeem.successDetail', { offer: res.offer_title }),
    }
    codeInput.value = ''
    await loadHistory()
  } catch (e) {
    const err = e instanceof OfferError ? e : null
    let title = t('offers.redeem.generic')
    if (err?.code === 'invalid_code') title = t('offers.redeem.invalid_code')
    else if (err?.code === 'already_used') title = t('offers.redeem.already_used', { when: err.detail ?? '' })
    else if (err?.code === 'expired') title = t('offers.redeem.expired')
    else if (err?.code === 'offer_not_active') title = t('offers.redeem.offer_not_active')
    else if (err?.code === 'not_allowed') title = t('offers.redeem.not_allowed')
    result.value = { ok: false, title }
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
  try {
    scanner = new Html5Qrcode('offer-qr-reader')
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decoded) => {
        await stopScan()
        codeInput.value = decoded
        await redeem(decoded)
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
  if (!(await canManageLocation(locationId.value))) {
    router.replace(`/place/${locationId.value}`)
    const toast = await toastController.create({ message: t('offers.redeem.noAccess'), duration: 3000, position: 'bottom' })
    await toast.present()
    return
  }
  loadStore()
  loadHistory()
})
onIonViewWillLeave(stopScan)
onBeforeUnmount(stopScan)
</script>

<style scoped>
.redeem-container { max-width: 520px; margin: 0 auto; }
.store-name { margin: 0 0 4px; }
.hint { margin: 0 0 14px; opacity: 0.75; font-size: 14px; }
.code-form { display: flex; gap: 8px; align-items: stretch; margin-bottom: 10px; }
.code-input {
  flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 18px;
  letter-spacing: 1px; text-transform: uppercase; padding: 12px; border-radius: 12px;
  border: 1px solid var(--ion-color-medium, #999); background: transparent; color: inherit;
}
.scan-btn { margin-bottom: 10px; }
.qr-reader { width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
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
.h-time { font-size: 12px; opacity: 0.7; }
</style>
