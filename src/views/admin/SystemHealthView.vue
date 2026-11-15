<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.health.title')" :icon="pulseOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-segment class="ap-segment" :value="tab" @ionChange="onTab($event.detail.value as any)" data-testid="health-tabs">
        <ion-segment-button value="checks"><ion-label>{{ $t('adminPages.health.tabChecks') }}</ion-label></ion-segment-button>
        <ion-segment-button value="events"><ion-label>{{ $t('adminPages.health.tabEvents') }}</ion-label></ion-segment-button>
        <ion-segment-button value="security"><ion-label>{{ $t('adminPages.health.tabSecurity') }}</ion-label></ion-segment-button>
      </ion-segment>

      <div v-if="loading" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <!-- ===== checks (the daily health report, on screen) ===== -->
      <template v-else-if="tab === 'checks' && health">
        <div class="ap-filters">
          <ion-select class="ap-select" interface="popover" :value="hours" :aria-label="$t('adminPages.common.period')"
                      @ionChange="hours = $event.detail.value; load()">
            <ion-select-option :value="24">{{ $t('adminPages.health.hours', { n: 24 }) }}</ion-select-option>
            <ion-select-option :value="72">{{ $t('adminPages.health.hours', { n: 72 }) }}</ion-select-option>
            <ion-select-option :value="168">{{ $t('adminPages.health.hours', { n: 168 }) }}</ion-select-option>
          </ion-select>
        </div>

        <div class="ap-card banner" :class="health.flagged ? 'flagged' : 'clear'" data-testid="health-banner">
          <h3>{{ health.flagged ? $t('adminPages.health.flagged', { n: health.flags.length }) : $t('adminPages.health.allClear') }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.health.generated', { d: fmtDateTime(health.generated_at, locale) }) }}</p>
          <div v-if="health.flags.length" class="ap-wrap">
            <span v-for="f in health.flags" :key="f" class="ap-pill bad">{{ flagLabel(f) }}</span>
          </div>
        </div>

        <AdminStatTiles :tiles="tiles" />

        <div class="ap-card">
          <h3>{{ $t('adminPages.health.scanLog') }}</h3>
          <p>{{ $t('adminPages.health.scanLogLine', { events: health.checks.scan_log.success_events, rows: health.checks.scan_log.logged_rows, missing: health.checks.scan_log.missing }) }}</p>
        </div>

        <div class="ap-card" v-if="health.checks.purchases_not_synced.length">
          <h3>{{ $t('adminPages.health.purchases') }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.health.purchasesHelp') }}</p>
          <div v-for="p in health.checks.purchases_not_synced" :key="p.user_id" class="ap-row">
            <button type="button" class="ap-link ap-mono" @click="openUser(p.user_id)">{{ shortId(p.user_id) }}</button>
            <span class="ap-small ap-muted">{{ fmtDateTime(p.last_purchase_event, locale) }} · {{ p.server_state }}</span>
          </div>
        </div>

        <div class="ap-card">
          <h3>{{ $t('adminPages.health.logins') }}</h3>
          <p>{{ $t('adminPages.health.loginsLine', { n: health.checks.login_failures.last_window, expected: health.checks.login_failures.expected }) }}</p>
        </div>

        <div class="ap-card">
          <h3>{{ $t('adminPages.health.webhook') }}</h3>
          <p>{{ $t('adminPages.health.webhookLine', { purchases: health.checks.webhook.purchases_in_window, processed: health.checks.webhook.events_processed_in_window }) }}</p>
        </div>

        <div class="ap-card" v-if="health.checks.server_job_errors.count > 0">
          <h3>{{ $t('adminPages.health.jobErrors', { n: health.checks.server_job_errors.count }) }}</h3>
          <div v-for="(e, i) in health.checks.server_job_errors.latest" :key="i" class="ap-small">
            <strong>{{ e.source }} · {{ e.event }}</strong> <span class="ap-muted">{{ fmtDateTime(e.at, locale) }}</span>
          </div>
        </div>

        <div class="ap-card" v-if="health.checks.cron_failures.length">
          <h3>{{ $t('adminPages.health.cron') }}</h3>
          <div v-for="(c, i) in health.checks.cron_failures" :key="i" class="ap-small">
            <strong>{{ c.job }}</strong> · {{ c.status }} <span class="ap-muted">{{ fmtDateTime(c.at, locale) }}</span>
            <div class="ap-muted">{{ c.message }}</div>
          </div>
        </div>

        <div class="ap-card" v-if="health.checks.sensitive_changes.by_non_admin_users.length">
          <h3>{{ $t('adminPages.health.sensitive') }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.health.sensitiveHelp') }}</p>
          <div v-for="(s, i) in health.checks.sensitive_changes.by_non_admin_users" :key="i" class="ap-small">
            {{ fmtDateTime(s.at, locale) }} · {{ s.table }} · {{ s.op }} · <button type="button" class="ap-link ap-mono" @click="openUser(s.actor)">{{ shortId(s.actor) }}</button>
          </div>
        </div>
      </template>

      <!-- ===== server events ===== -->
      <template v-else-if="tab === 'events'">
        <div class="ap-filters">
          <ion-select class="ap-select" interface="popover" :value="level" :aria-label="$t('adminPages.health.level')"
                      @ionChange="level = $event.detail.value; load()">
            <ion-select-option value="all">{{ $t('adminPages.common.all') }}</ion-select-option>
            <ion-select-option value="error">error</ion-select-option>
            <ion-select-option value="warn">warn</ion-select-option>
            <ion-select-option value="info">info</ion-select-option>
          </ion-select>
        </div>
        <p v-if="!events.length" class="ap-state" data-testid="health-events-empty">{{ $t('adminPages.health.noEvents') }}</p>
        <div v-for="e in events" :key="e.id" class="ap-card">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill" :class="levelTone(e.level)">{{ e.level }}</span>
              <strong>{{ e.source }}</strong> · {{ e.event }}
            </div>
            <span class="ap-small ap-muted">{{ fmtDateTime(e.created_at, locale) }}</span>
          </div>
          <button v-if="hasDetail(e.detail)" type="button" class="ap-link ap-small" @click="toggle('e' + e.id)">
            {{ open.has('e' + e.id) ? $t('adminPages.common.hideDetails') : $t('adminPages.common.showDetails') }}
          </button>
          <pre v-if="open.has('e' + e.id)" class="ap-pre">{{ prettyJson(e.detail) }}</pre>
        </div>
      </template>

      <!-- ===== security changes ===== -->
      <template v-else-if="tab === 'security'">
        <div class="ap-note">{{ $t('adminPages.health.securityNote') }}</div>
        <p v-if="!audit.length" class="ap-state">{{ $t('adminPages.health.noSecurity') }}</p>
        <div v-for="a in audit" :key="a.id" class="ap-card">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill info">{{ a.op }}</span>
              <strong>{{ a.table_name }}</strong>
              <span v-if="a.actor_role" class="ap-pill neutral">{{ a.actor_role }}</span>
            </div>
            <span class="ap-small ap-muted">{{ fmtDateTime(a.created_at, locale) }}</span>
          </div>
          <p class="ap-small ap-muted">
            <span v-if="a.actor">{{ $t('adminPages.health.by') }} <button type="button" class="ap-link ap-mono" @click="openUser(a.actor)">{{ shortId(a.actor) }}</button></span>
            <span v-if="a.via"> · {{ a.via }}</span>
            <span v-if="a.row_key"> · #{{ a.row_key }}</span>
          </p>
          <button v-if="hasDetail(a.changes)" type="button" class="ap-link ap-small" @click="toggle('a' + a.id)">
            {{ open.has('a' + a.id) ? $t('adminPages.common.hideDetails') : $t('adminPages.common.showDetails') }}
          </button>
          <pre v-if="open.has('a' + a.id)" class="ap-pre">{{ prettyJson(a.changes) }}</pre>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonSegment,
  IonSegmentButton, IonLabel, IonSpinner, IonButton, onIonViewWillEnter,
} from '@ionic/vue'
import { pulseOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type OpsEvent, type OpsHealth, type SecurityAuditRow } from '@/services/AdminService'
import { fmtDateTime, prettyJson, shortId } from '@/utils/adminFormat'

const { t, te, locale } = useI18n()
const router = useRouter()

const tab = ref<'checks' | 'events' | 'security'>('checks')
const hours = ref(24)
const level = ref('all')
const loading = ref(false)
const failed = ref(false)
const health = ref<OpsHealth | null>(null)
const events = ref<OpsEvent[]>([])
const audit = ref<SecurityAuditRow[]>([])
const open = ref<Set<string>>(new Set())

async function load() {
  loading.value = true
  failed.value = false
  try {
    if (tab.value === 'checks') health.value = await AdminService.opsHealth(hours.value)
    else if (tab.value === 'events') events.value = await AdminService.opsEvents(level.value === 'all' ? null : level.value)
    else audit.value = await AdminService.securityAudit()
  } catch (err) {
    console.warn('[SystemHealthView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
function onTab(v: 'checks' | 'events' | 'security') { tab.value = v; open.value = new Set(); load() }
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

function toggle(key: string) {
  const next = new Set(open.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  open.value = next
}
const hasDetail = (v: unknown) => v !== null && v !== undefined && !(typeof v === 'object' && Object.keys(v as object).length === 0)
const flagLabel = (f: string) => (te(`adminPages.health.flag.${f}`) ? t(`adminPages.health.flag.${f}`) : f)
const levelTone = (l: string) => (l === 'error' ? 'bad' : l === 'warn' ? 'warn' : 'neutral')
const openUser = (id: string) => router.push(`/admin/users/${id}`)

const tiles = computed<StatTile[]>(() => {
  const c = health.value?.checks
  if (!c) return []
  return [
    { label: t('adminPages.health.tileScanGap'), value: c.scan_log.missing, tone: c.scan_log.missing >= 3 ? 'bad' : 'good' },
    { label: t('adminPages.health.tileProMismatch'), value: c.pro_flag_mismatches, tone: c.pro_flag_mismatches > 0 ? 'bad' : 'good' },
    { label: t('adminPages.health.tileJobErrors'), value: c.server_job_errors.count, tone: c.server_job_errors.count > 0 ? 'bad' : 'good' },
    { label: t('adminPages.health.tileChanges'), value: c.sensitive_changes.total_audited_changes_in_window },
  ]
})
</script>

<style scoped>
.banner.clear { border-left: 5px solid var(--ion-color-success); }
.banner.flagged { border-left: 5px solid var(--ion-color-danger); }
</style>
