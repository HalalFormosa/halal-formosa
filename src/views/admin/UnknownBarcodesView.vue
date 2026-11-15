<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.barcodes.title')" :icon="barcodeOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="ap-filters">
        <ion-select class="ap-select" interface="popover" :value="days" :aria-label="$t('adminPages.common.period')"
                    @ionChange="days = $event.detail.value; load()">
          <ion-select-option v-for="d in [7, 30, 90, 365]" :key="d" :value="d">{{ $t('adminPages.common.lastDays', { n: d }) }}</ion-select-option>
        </ion-select>
      </div>

      <div v-if="loading && !data" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <template v-else-if="data">
        <AdminStatTiles :tiles="tiles" />
        <div class="ap-note" data-testid="barcodes-note">{{ $t('adminPages.barcodes.note', { added: data.summary.already_added }) }}</div>

        <p v-if="!data.rows.length" class="ap-state" data-testid="barcodes-empty">{{ $t('adminPages.barcodes.empty') }}</p>
        <div v-for="r in data.rows" :key="r.barcode" class="ap-card" data-testid="barcode-row">
          <div class="ap-row">
            <span class="ap-mono code">{{ r.barcode }}</span>
            <span class="ap-pill" :class="r.scans >= 3 ? 'warn' : 'neutral'">{{ $t('adminPages.barcodes.scans', { n: r.scans }) }}</span>
          </div>
          <p class="ap-small ap-muted">
            {{ $t('adminPages.barcodes.people', { n: r.users }) }} · {{ $t('adminPages.barcodes.last', { d: fmtDateTime(r.last_seen, locale) }) }}
          </p>
          <div class="ap-wrap">
            <ion-button size="small" fill="outline" @click="copy(r.barcode)">
              <ion-icon slot="start" :icon="copyOutline" />{{ $t('adminPages.common.copy') }}
            </ion-button>
            <ion-button size="small" fill="clear" @click="lookup(r.barcode)">
              <ion-icon slot="start" :icon="openOutline" />{{ $t('adminPages.barcodes.lookup') }}
            </ion-button>
          </div>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonSpinner,
  IonButton, IonIcon, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { barcodeOutline, copyOutline, openOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type UnknownBarcodes } from '@/services/AdminService'
import { fmtDateTime } from '@/utils/adminFormat'

const { t, locale } = useI18n()

const days = ref(30)
const data = ref<UnknownBarcodes | null>(null)
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await AdminService.unknownBarcodes(days.value, 100)
  } catch (err) {
    console.warn('[UnknownBarcodesView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

async function copy(barcode: string) {
  let ok = true
  try { await navigator.clipboard.writeText(barcode) } catch { ok = false }
  const el = await toastController.create({
    message: ok ? t('adminPages.common.copied', { v: barcode }) : t('adminPages.common.copyFailed'), duration: 1800, color: ok ? 'success' : 'danger',
  })
  await el.present()
}

// Open Food Facts is a public product database: a quick way to see what an unknown barcode is.
const lookup = (barcode: string) =>
  window.open(`https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`, '_blank', 'noopener')

const tiles = computed<StatTile[]>(() => {
  const s = data.value?.summary
  if (!s) return []
  return [
    { label: t('adminPages.barcodes.tileMissing'), value: s.still_missing, tone: s.still_missing > 0 ? 'warn' : 'good' },
    { label: t('adminPages.barcodes.tileScans'), value: s.scans },
    { label: t('adminPages.barcodes.tileRepeated'), value: s.repeated_3plus },
    { label: t('adminPages.barcodes.tileAdded'), value: s.already_added, tone: 'good' },
  ]
})
</script>

<style scoped>
.code { font-size: 1rem; font-weight: 700; }
</style>
