<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('admin.auditLog.title')"
          :icon="shieldCheckmarkOutline"
          :showBack="true"
          :contrast="true"
      />
    </ion-header>

    <ion-content class="ion-padding content-background">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Filters -->
      <div class="filters">
        <ion-segment :value="kind" @ionChange="kind = ($event.detail.value as any)" scrollable>
          <ion-segment-button value="all">
            <ion-label>{{ $t('admin.auditLog.kinds.all') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="admin">
            <ion-label>{{ $t('admin.auditLog.kinds.admin') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="merchant">
            <ion-label>{{ $t('admin.auditLog.kinds.merchant') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="business_owner">
            <ion-label>{{ $t('admin.auditLog.kinds.business_owner') }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        <ion-select
            class="table-select"
            interface="popover"
            :value="tableFilter"
            :aria-label="$t('admin.auditLog.table')"
            @ionChange="tableFilter = $event.detail.value"
        >
          <ion-select-option :value="ALL_TABLES">{{ $t('admin.auditLog.allTables') }}</ion-select-option>
          <ion-select-option v-for="t in tableOptions" :key="t" :value="t">{{ prettyTable(t) }}</ion-select-option>
        </ion-select>

        <div v-if="actorFilter || targetFilter" class="active-filters">
          <ion-chip v-if="actorFilter" color="primary" @click="actorFilter = null">
            <ion-label>{{ $t('admin.auditLog.actorFilter', { name: actorFilter.name }) }}</ion-label>
            <ion-icon :icon="closeCircle" />
          </ion-chip>
          <ion-chip v-if="targetFilter" color="tertiary" @click="targetFilter = null">
            <ion-label>{{ $t('admin.auditLog.userFilter', { id: shortId(targetFilter.id) }) }}</ion-label>
            <ion-icon :icon="closeCircle" />
          </ion-chip>
        </div>
      </div>

      <!-- States -->
      <div v-if="loading && entries.length === 0" class="state-box">
        <ion-spinner name="crescent" />
      </div>
      <div v-else-if="failed && entries.length === 0" class="state-box">
        <p>{{ $t('admin.auditLog.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load(true)">{{ $t('admin.auditLog.retry') }}</ion-button>
      </div>
      <div v-else-if="entries.length === 0" class="state-box">
        <ion-icon :icon="shieldCheckmarkOutline" class="state-icon" />
        <p>{{ hasFilters ? $t('admin.auditLog.emptyFiltered') : $t('admin.auditLog.empty') }}</p>
        <ion-button v-if="hasFilters" size="small" fill="outline" @click="clearFilters">
          {{ $t('admin.auditLog.clearFilters') }}
        </ion-button>
      </div>

      <!-- Entries -->
      <div v-for="entry in entries" :key="entry.id" class="audit-card">
        <div class="card-top">
          <ion-badge :color="actionColor(entry.action)" class="action-badge">
            {{ actionLabel(entry.action) }}
          </ion-badge>
          <span class="table-name">{{ prettyTable(entry.table_name) }}</span>
          <span v-if="entry.row_key" class="row-key">#{{ shortKey(entry.row_key) }}</span>
          <span class="time" :title="absoluteTime(entry.created_at)">{{ fromNow(entry.created_at) }}</span>
        </div>

        <div class="card-meta">
          <ion-chip class="meta-chip" :color="kindColor(entry.actor_kind)" @click="filterByActor(entry)">
            <ion-icon :icon="personOutline" />
            <ion-label>
              {{ entry.actor_name || shortId(entry.actor_id) }} · {{ $t('admin.auditLog.kinds.' + entry.actor_kind) }}
            </ion-label>
          </ion-chip>
          <ion-chip v-if="entry.location_id" class="meta-chip" outline @click="openPlace(entry.location_id)">
            <ion-icon :icon="locationOutline" />
            <ion-label>{{ $t('admin.auditLog.place', { id: entry.location_id }) }}</ion-label>
          </ion-chip>
          <ion-chip
              v-if="entry.target_user_id && entry.target_user_id !== entry.actor_id"
              class="meta-chip"
              outline
              @click="openUser(entry.target_user_id)"
          >
            <ion-icon :icon="peopleOutline" />
            <ion-label>{{ $t('admin.auditLog.user', { id: shortId(entry.target_user_id) }) }}</ion-label>
          </ion-chip>
        </div>

        <button type="button" class="toggle" @click="toggle(entry.id)">
          <span>{{ $t('admin.auditLog.changes', { count: changeRows(entry).length }) }}</span>
          <ion-icon :icon="isOpen(entry.id) ? chevronUpOutline : chevronDownOutline" />
        </button>

        <div v-if="isOpen(entry.id)" class="changes">
          <p v-if="changeRows(entry).length === 0" class="no-changes">{{ $t('admin.auditLog.noChanges') }}</p>
          <div v-for="row in changeRows(entry)" :key="row.column" class="change-row">
            <div class="col-name">{{ row.column }}</div>
            <div v-if="row.redacted" class="val hidden-val">
              <ion-icon :icon="lockClosedOutline" /> {{ $t('admin.auditLog.hidden') }}
            </div>
            <div v-else-if="row.isDiff" class="val">
              <span class="old">{{ row.before }}</span>
              <ion-icon :icon="arrowForwardOutline" class="arrow" />
              <span class="new">{{ row.after }}</span>
            </div>
            <div v-else class="val">{{ row.after }}</div>
          </div>
          <p v-if="entry.user_agent" class="ua">{{ entry.user_agent }}</p>
        </div>
      </div>

      <ion-infinite-scroll threshold="120px" :disabled="noMore || entries.length === 0" @ionInfinite="onInfinite">
        <ion-infinite-scroll-content loading-spinner="bubbles" :loading-text="$t('admin.loadingMoreLogs')" />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonLabel,
  IonSelect, IonSelectOption, IonChip, IonIcon, IonBadge, IonButton, IonSpinner, IonInfiniteScroll,
  IonInfiniteScrollContent, onIonViewWillEnter, toastController,
} from '@ionic/vue'
import {
  shieldCheckmarkOutline, personOutline, locationOutline, peopleOutline, chevronDownOutline, chevronUpOutline,
  closeCircle, lockClosedOutline, arrowForwardOutline,
} from 'ionicons/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import {
  AUDITED_TABLES, actionColor, prettyTable, toChangeRows,
  type AuditEntry, type AuditKind, type ChangeRow,
} from '@/utils/auditLog'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const { t, te } = useI18n()
const router = useRouter()

const PAGE_SIZE = 30
const ALL_TABLES = '__all__'

const entries = ref<AuditEntry[]>([])
const loading = ref(false)
const failed = ref(false)
const noMore = ref(false)

const kind = ref<'all' | AuditKind>('all')
const tableFilter = ref<string>(ALL_TABLES)
const actorFilter = ref<{ id: string; name: string } | null>(null)
const targetFilter = ref<{ id: string } | null>(null)
const expanded = ref<Set<number>>(new Set())

const hasFilters = computed(
  () => kind.value !== 'all' || tableFilter.value !== ALL_TABLES || !!actorFilter.value || !!targetFilter.value
)

// The known audited tables plus anything the data shows, so a table added later still appears.
const tableOptions = computed(() => {
  const set = new Set<string>(AUDITED_TABLES)
  entries.value.forEach(e => set.add(e.table_name))
  if (tableFilter.value !== ALL_TABLES) set.add(tableFilter.value)
  return [...set].sort()
})

// Only the latest request may write results, so quick filter changes never show stale rows.
let requestSeq = 0

async function load(reset: boolean) {
  if (!reset && (loading.value || noMore.value)) return
  const seq = ++requestSeq
  loading.value = true
  if (reset) {
    noMore.value = false
    expanded.value = new Set()
  }

  const beforeId = reset ? null : entries.value[entries.value.length - 1]?.id ?? null
  const { data, error } = await supabase.rpc('admin_get_audit_log', {
    p_limit: PAGE_SIZE,
    p_before_id: beforeId,
    p_table: tableFilter.value === ALL_TABLES ? null : tableFilter.value,
    p_actor: actorFilter.value?.id ?? null,
    p_target_user: targetFilter.value?.id ?? null,
    p_location: null,
    p_kind: kind.value === 'all' ? null : kind.value,
  })

  if (seq !== requestSeq) return  // a newer request has taken over
  loading.value = false

  if (error) {
    console.error('[AuditLog] load failed:', error)
    failed.value = true
    const toast = await toastController.create({
      message: t('admin.auditLog.loadFailed'), duration: 3000, color: 'danger', position: 'bottom',
    })
    await toast.present()
    return
  }

  failed.value = false
  const rows = (data ?? []) as AuditEntry[]
  entries.value = reset ? rows : [...entries.value, ...rows]
  if (rows.length < PAGE_SIZE) noMore.value = true
}

watch([kind, tableFilter, actorFilter, targetFilter], () => load(true))
onIonViewWillEnter(() => load(true))

async function handleRefresh(event: CustomEvent) {
  await load(true)
  ;(event.target as HTMLIonRefresherElement).complete()
}

async function onInfinite(event: CustomEvent) {
  await load(false)
  ;(event.target as HTMLIonInfiniteScrollElement).complete()
}

function clearFilters() {
  kind.value = 'all'
  tableFilter.value = ALL_TABLES
  actorFilter.value = null
  targetFilter.value = null
}

function filterByActor(entry: AuditEntry) {
  actorFilter.value = { id: entry.actor_id, name: entry.actor_name || shortId(entry.actor_id) }
}

const openPlace = (id: number) => router.push(`/place/${id}`)
const openUser = (id: string) => router.push(`/admin/users/${id}`)

const isOpen = (id: number) => expanded.value.has(id)
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// Cached per entry object so re-renders do not rebuild every diff.
const rowCache = new WeakMap<AuditEntry, ChangeRow[]>()
function changeRows(entry: AuditEntry): ChangeRow[] {
  let rows = rowCache.get(entry)
  if (!rows) {
    rows = toChangeRows(entry)
    rowCache.set(entry, rows)
  }
  return rows
}

function actionLabel(action: string) {
  const key = `admin.auditLog.actions.${action}`
  return te(key) ? t(key) : prettyTable(action)
}

const kindColor = (k: AuditKind) => (k === 'admin' ? 'primary' : k === 'merchant' ? 'tertiary' : 'secondary')
const shortId = (id: string) => id.slice(0, 8)
const shortKey = (key: string) => (key.length > 13 ? key.slice(0, 8) + '…' : key)
const fromNow = (iso: string) => dayjs.utc(iso).tz('Asia/Taipei').fromNow()
const absoluteTime = (iso: string) => dayjs.utc(iso).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss') + ' (Taipei)'
</script>

<style scoped>
.filters { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.table-select {
  border: 1px solid var(--ion-color-step-150, rgba(127, 127, 127, 0.25));
  border-radius: 10px;
  padding: 0 12px;
  min-height: 42px;
  text-transform: capitalize;
}
.active-filters { display: flex; flex-wrap: wrap; gap: 4px; }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 16px; text-align: center; color: var(--ion-color-medium); }
.state-icon { font-size: 40px; opacity: 0.5; }

.audit-card {
  background: var(--ion-card-background, #fff);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.card-top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.action-badge { text-transform: capitalize; }
.table-name { font-weight: 600; text-transform: capitalize; }
.row-key { color: var(--ion-color-medium); font-size: 0.8rem; font-family: ui-monospace, monospace; }
.time { margin-left: auto; color: var(--ion-color-medium); font-size: 0.78rem; white-space: nowrap; }

.card-meta { display: flex; flex-wrap: wrap; gap: 0; margin: 6px 0 2px -4px; }
.meta-chip { font-size: 0.78rem; height: 28px; cursor: pointer; }

.toggle {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  background: none; border: none; padding: 6px 0 2px; color: var(--ion-color-primary);
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
}

.changes { margin-top: 6px; border-top: 1px solid rgba(127, 127, 127, 0.2); padding-top: 8px; }
.change-row { display: flex; gap: 10px; padding: 4px 0; font-size: 0.82rem; align-items: baseline; }
.col-name { flex: 0 0 34%; max-width: 34%; color: var(--ion-color-medium); font-family: ui-monospace, monospace; word-break: break-word; }
.val { flex: 1; min-width: 0; word-break: break-word; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; }
.old { color: var(--ion-color-danger); text-decoration: line-through; opacity: 0.85; }
.new { color: var(--ion-color-success); font-weight: 600; }
.arrow { font-size: 0.9rem; align-self: center; color: var(--ion-color-medium); }
.hidden-val { color: var(--ion-color-medium); font-style: italic; align-items: center; }
.no-changes { color: var(--ion-color-medium); font-size: 0.82rem; margin: 0; }
.ua { margin: 8px 0 0; font-size: 0.7rem; color: var(--ion-color-medium); opacity: 0.8; word-break: break-all; }
</style>
