<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.versions.title')" :icon="phonePortraitOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="ap-filters">
        <ion-select class="ap-select" interface="popover" :value="days" :aria-label="$t('adminPages.common.period')"
                    data-testid="versions-days" @ionChange="onDays($event.detail.value)">
          <ion-select-option v-for="d in DAY_OPTIONS" :key="d" :value="d">{{ $t('adminPages.common.lastDays', { n: d }) }}</ion-select-option>
        </ion-select>
      </div>
      <ion-segment class="ap-segment" :value="platform" @ionChange="platform = ($event.detail.value as any)">
        <ion-segment-button value="all"><ion-label>{{ $t('adminPages.common.all') }}</ion-label></ion-segment-button>
        <ion-segment-button value="android"><ion-label>Android</ion-label></ion-segment-button>
        <ion-segment-button value="ios"><ion-label>iOS</ion-label></ion-segment-button>
      </ion-segment>

      <div v-if="loading && !rows.length" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <template v-else>
        <AdminStatTiles :tiles="tiles" />

        <div class="ap-note" data-testid="versions-note">
          {{ $t('adminPages.versions.note', { live: liveUsers, total: totalUsers }) }}
        </div>

        <p v-if="!visibleRows.length" class="ap-state" data-testid="versions-empty">{{ $t('adminPages.versions.empty') }}</p>

        <div v-for="group in groups" :key="group.platform" class="ap-card" :data-testid="`versions-${group.platform}`">
          <div class="ap-row">
            <h3>{{ group.platform === 'ios' ? 'iOS' : 'Android' }}</h3>
            <span class="ap-pill neutral">{{ $t('adminPages.versions.minimum', { v: group.minimum || '–' }) }}</span>
          </div>
          <div v-for="r in group.rows" :key="r.app_version" class="ap-bar-row">
            <span class="ap-mono">{{ r.app_version }}</span>
            <div class="ap-bar-track"><div class="ap-bar-fill" :class="{ bad: r.below }" :style="{ width: r.pct + '%' }"></div></div>
            <span class="ap-bar-count">{{ r.users }}</span>
            <span class="ap-small ap-muted" style="grid-column: 1 / -1; margin-top: -4px;">
              <span v-if="r.below" class="ap-pill bad">{{ $t('adminPages.versions.belowMinimum') }}</span>
              <span v-if="r.live_users > 0" class="ap-pill good">{{ $t('adminPages.versions.liveCount', { n: r.live_users }) }}</span>
              {{ $t('adminPages.versions.lastSeen', { d: fmtDateTime(r.last_seen, locale) }) }}
            </span>
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
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonSegment,
  IonSegmentButton, IonLabel, IonSpinner, IonButton, onIonViewWillEnter,
} from '@ionic/vue'
import { phonePortraitOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type VersionRow } from '@/services/AdminService'
import { isBelowMinimum, latestVersion } from '@/utils/versionCompare'
import { fmtDateTime, pct } from '@/utils/adminFormat'

const DAY_OPTIONS = [7, 14, 30, 90]
const { t, locale } = useI18n()

const days = ref(14)
const platform = ref<'all' | 'android' | 'ios'>('all')
const rows = ref<VersionRow[]>([])
const minimums = ref<{ android: string | null; ios: string | null }>({ android: null, ios: null })
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [versionRows, config] = await Promise.all([AdminService.versionBreakdown(days.value), AdminService.appConfig()])
    rows.value = versionRows
    const value = (k: string) => config.find((c) => c.key === k)?.value ?? null
    minimums.value = { android: value('min_android_version'), ios: value('min_ios_version') }
  } catch (err) {
    console.warn('[AppVersionsView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
function onDays(v: number) { days.value = v; load() }
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

const minimumFor = (p: 'android' | 'ios') => minimums.value[p]
const visibleRows = computed(() => rows.value.filter((r) => platform.value === 'all' || r.platform === platform.value))
const totalUsers = computed(() => visibleRows.value.reduce((s, r) => s + Number(r.users), 0))
const liveUsers = computed(() => visibleRows.value.reduce((s, r) => s + Number(r.live_users), 0))
const belowUsers = computed(() =>
  visibleRows.value.filter((r) => isBelowMinimum(r.app_version, minimumFor(r.platform))).reduce((s, r) => s + Number(r.users), 0)
)

// "On the newest" = the newest version seen per platform, so it stays meaningful before and after a release.
const onNewest = computed(() => {
  let n = 0
  for (const p of ['android', 'ios'] as const) {
    const list = visibleRows.value.filter((r) => r.platform === p)
    const newest = latestVersion(list.map((r) => r.app_version))
    n += list.filter((r) => r.app_version === newest).reduce((s, r) => s + Number(r.users), 0)
  }
  return n
})

const tiles = computed<StatTile[]>(() => [
  { label: t('adminPages.versions.tileUsers'), value: totalUsers.value },
  { label: t('adminPages.versions.tileLive'), value: liveUsers.value },
  { label: t('adminPages.versions.tileNewest'), value: `${pct(onNewest.value, totalUsers.value)}%` },
  { label: t('adminPages.versions.tileBelow'), value: belowUsers.value, tone: belowUsers.value > 0 ? 'warn' : 'good' },
])

const groups = computed(() =>
  (['android', 'ios'] as const)
    .filter((p) => platform.value === 'all' || platform.value === p)
    .map((p) => {
      const list = visibleRows.value.filter((r) => r.platform === p)
      const total = list.reduce((s, r) => s + Number(r.users), 0)
      return {
        platform: p,
        minimum: minimumFor(p),
        rows: list.map((r) => ({
          ...r,
          users: Number(r.users),
          live_users: Number(r.live_users),
          pct: pct(Number(r.users), total),
          below: isBelowMinimum(r.app_version, minimumFor(p)),
        })),
      }
    })
    .filter((g) => g.rows.length > 0)
)
</script>
