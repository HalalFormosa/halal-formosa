<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.errors.title')" :icon="bugOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="ap-filters">
        <ion-select class="ap-select" interface="popover" :value="days" :aria-label="$t('adminPages.common.period')"
                    @ionChange="days = $event.detail.value; load()">
          <ion-select-option v-for="d in [1, 7, 30]" :key="d" :value="d">{{ $t('adminPages.common.lastDays', { n: d }) }}</ion-select-option>
        </ion-select>
      </div>

      <div v-if="loading && !data" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <template v-else-if="data">
        <AdminStatTiles :tiles="tiles" />
        <div class="ap-note" data-testid="errors-note">{{ $t('adminPages.errors.note') }}</div>

        <p v-if="!data.groups.length" class="ap-state" data-testid="errors-empty">{{ $t('adminPages.errors.empty') }}</p>
        <div v-for="g in data.groups" :key="g.signature" class="ap-card" data-testid="error-group">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill bad">{{ $t('adminPages.errors.times', { n: g.occurrences }) }}</span>
              <span v-if="g.source" class="ap-pill neutral">{{ g.source }}</span>
              <span v-if="g.screen" class="ap-pill info">{{ g.screen }}</span>
            </div>
            <span class="ap-small ap-muted">{{ fmtDateTime(g.last_seen, locale) }}</span>
          </div>
          <p class="msg"><strong v-if="g.name">{{ g.name }}: </strong>{{ g.message || '–' }}</p>
          <p class="ap-small ap-muted">
            {{ $t('adminPages.errors.users', { n: g.users }) }} · {{ $t('adminPages.errors.first', { d: fmtDateTime(g.first_seen, locale) }) }}
          </p>
          <template v-if="g.stack">
            <button type="button" class="ap-link ap-small" @click="toggle(g.signature)">
              {{ open.has(g.signature) ? $t('adminPages.common.hideDetails') : $t('adminPages.errors.stack') }}
            </button>
            <pre v-if="open.has(g.signature)" class="ap-pre">{{ g.stack }}</pre>
          </template>
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
import { bugOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type ClientErrorGroups } from '@/services/AdminService'
import { fmtDateTime } from '@/utils/adminFormat'

const { t, locale } = useI18n()

const days = ref(7)
const data = ref<ClientErrorGroups | null>(null)
const loading = ref(false)
const failed = ref(false)
const open = ref<Set<string>>(new Set())

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await AdminService.clientErrors(days.value, 50)
  } catch (err) {
    console.warn('[AppErrorsView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

function toggle(key: string) {
  const next = new Set(open.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  open.value = next
}

// Errors per 1,000 screen views: comparable between a quiet day and a busy one.
const rate = computed(() => {
  const d = data.value
  return d && d.screen_views > 0 ? Math.round((d.total / d.screen_views) * 10000) / 10 : null
})

const tiles = computed<StatTile[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: t('adminPages.errors.tileErrors'), value: d.total, tone: d.total > 0 ? 'warn' : 'good' },
    { label: t('adminPages.errors.tileKinds'), value: d.groups.length },
    { label: t('adminPages.errors.tileViews'), value: d.screen_views },
    { label: t('adminPages.errors.tileRate'), value: rate.value === null ? '–' : rate.value },
  ]
})
</script>

<style scoped>
.msg { margin: 8px 0 4px; word-break: break-word; }
</style>
