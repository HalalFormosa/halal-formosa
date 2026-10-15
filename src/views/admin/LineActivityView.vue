<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.line.title')" :icon="chatbubblesOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="ap-filters">
        <ion-select class="ap-select" interface="popover" :value="days" :aria-label="$t('adminPages.common.period')"
                    @ionChange="days = $event.detail.value; load()">
          <ion-select-option v-for="d in [7, 30, 90]" :key="d" :value="d">{{ $t('adminPages.common.lastDays', { n: d }) }}</ion-select-option>
        </ion-select>
      </div>

      <div v-if="loading && !data" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <template v-else-if="data">
        <AdminStatTiles :tiles="tiles" />
        <div class="ap-note">{{ $t('adminPages.line.note') }}</div>

        <p v-if="!data.events_total && !data.usage_total" class="ap-state" data-testid="line-empty">{{ $t('adminPages.line.empty') }}</p>

        <div v-if="data.by_day.length" class="ap-card" data-testid="line-days">
          <h3>{{ $t('adminPages.line.perDay') }}</h3>
          <div v-for="d in data.by_day" :key="d.day" class="ap-bar-row">
            <span class="ap-small">{{ shortDay(d.day) }}</span>
            <div class="ap-bar-track"><div class="ap-bar-fill" :style="{ width: pct(d.events + d.usage, maxDay) + '%' }"></div></div>
            <span class="ap-bar-count">{{ d.events }}<span v-if="d.usage" class="ap-muted"> +{{ d.usage }}</span></span>
          </div>
          <p class="ap-small ap-muted">{{ $t('adminPages.line.legend') }}</p>
        </div>

        <div v-if="data.by_type.length" class="ap-card">
          <h3>{{ $t('adminPages.line.byType') }}</h3>
          <div v-for="r in data.by_type" :key="r.event_type" class="ap-bar-row">
            <span class="ap-small">{{ r.event_type }}</span>
            <div class="ap-bar-track"><div class="ap-bar-fill" :style="{ width: pct(r.count, data.events_total) + '%' }"></div></div>
            <span class="ap-bar-count">{{ r.count }}</span>
          </div>
        </div>

        <div v-if="data.top_sources.length" class="ap-card">
          <h3>{{ $t('adminPages.line.topSources') }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.line.masked') }}</p>
          <div v-for="s in data.top_sources" :key="s.source" class="ap-row">
            <span class="ap-mono">{{ s.source }}</span>
            <span class="ap-bar-count">{{ s.events }}</span>
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
  IonButton, onIonViewWillEnter,
} from '@ionic/vue'
import { chatbubblesOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type LineActivity } from '@/services/AdminService'
import { pct } from '@/utils/adminFormat'

const { t } = useI18n()

const days = ref(30)
const data = ref<LineActivity | null>(null)
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await AdminService.lineActivity(days.value)
  } catch (err) {
    console.warn('[LineActivityView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

const maxDay = computed(() => Math.max(1, ...(data.value?.by_day ?? []).map((d) => d.events + d.usage)))
const shortDay = (day: string) => day.slice(5) // "2026-10-16" -> "10-16"

const tiles = computed<StatTile[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: t('adminPages.line.tileEvents'), value: d.events_total },
    { label: t('adminPages.line.tileUsage'), value: d.usage_total },
    { label: t('adminPages.line.tileAccounts'), value: d.sources },
    { label: t('adminPages.line.tileActiveDays'), value: d.by_day.length },
  ]
})
</script>
