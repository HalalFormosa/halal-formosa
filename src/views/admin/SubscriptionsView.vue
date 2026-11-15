<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.subs.title')" :icon="cardOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <template v-if="summary">
        <AdminStatTiles :tiles="tiles" />
        <div class="ap-note" data-testid="subs-note">
          {{ $t('adminPages.subs.note', { lapsed: summary.lapsed, granted: summary.granted_active, total: summary.total_rows }) }}
        </div>
      </template>

      <ion-segment class="ap-segment" scrollable :value="filter" data-testid="subs-filter" @ionChange="onFilter($event.detail.value as any)">
        <ion-segment-button v-for="f in FILTERS" :key="f" :value="f"><ion-label>{{ $t(`adminPages.subs.filter.${f}`) }}</ion-label></ion-segment-button>
      </ion-segment>

      <div v-if="loading && !list.length" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="reload">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>
      <p v-else-if="!list.length" class="ap-state" data-testid="subs-empty">{{ $t('adminPages.subs.empty') }}</p>

      <div v-for="s in list" :key="s.user_id" class="ap-card" data-testid="subs-row">
        <div class="ap-row">
          <div class="who">
            <img v-if="s.avatar_url" :src="s.avatar_url" class="avatar" alt="" />
            <span v-else class="avatar initial">{{ (s.display_name || '?').slice(0, 1).toUpperCase() }}</span>
            <button type="button" class="ap-link" @click="openUser(s.user_id)">{{ s.display_name || shortId(s.user_id) }}</button>
          </div>
          <span class="ap-pill" :class="s.entitlement_active ? 'good' : 'neutral'">
            {{ s.entitlement_active ? $t('adminPages.subs.active') : $t('adminPages.subs.lapsed') }}
          </span>
        </div>
        <div class="ap-wrap" style="margin-top: 6px;">
          <span v-if="s.entitlement_active && s.will_renew === false" class="ap-pill warn">{{ $t('adminPages.subs.notRenewing') }}</span>
          <span v-if="s.entitlement_active && s.will_renew" class="ap-pill info">{{ $t('adminPages.subs.renews') }}</span>
          <span v-if="s.grant_active" class="ap-pill info">{{ $t('adminPages.subs.granted') }}</span>
          <span v-if="s.flag_mismatch" class="ap-pill bad">{{ $t('adminPages.subs.mismatch') }}</span>
          <span class="ap-pill neutral">{{ s.donor_type || '–' }}</span>
        </div>
        <p class="ap-small ap-muted">
          {{ $t('adminPages.subs.first', { d: fmtDay(s.first_purchase_at, locale) }) }} ·
          {{ s.entitlement_active ? $t('adminPages.subs.expires', { d: fmtDay(s.latest_expiration_at, locale) }) : $t('adminPages.subs.endedOn', { d: fmtDay(s.latest_expiration_at, locale) }) }}
        </p>
      </div>

      <div v-if="hasMore && list.length" class="more">
        <ion-button fill="outline" size="small" :disabled="loading" data-testid="subs-more" @click="loadMore">{{ $t('adminPages.common.loadMore') }}</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonLabel,
  IonSpinner, IonButton, onIonViewWillEnter,
} from '@ionic/vue'
import { cardOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type SubscriptionFilter, type SubscriptionRow, type SubscriptionSummary } from '@/services/AdminService'
import { fmtDay, shortId } from '@/utils/adminFormat'

const PAGE = 50
const FILTERS: SubscriptionFilter[] = ['all', 'active', 'expiring', 'not_renewing', 'lapsed', 'mismatch']

const { t, locale } = useI18n()
const router = useRouter()

const filter = ref<SubscriptionFilter>('active')
const summary = ref<SubscriptionSummary | null>(null)
const list = ref<SubscriptionRow[]>([])
const loading = ref(false)
const failed = ref(false)
const hasMore = ref(false)

// Only the newest request may write results, so switching filters quickly never shows rows of the wrong filter.
let seq = 0

async function fetchPage(reset: boolean) {
  const mine = ++seq
  loading.value = true
  failed.value = false
  try {
    const offset = reset ? 0 : list.value.length
    const [rows, sum] = await Promise.all([
      AdminService.subscriptions(filter.value, PAGE, offset),
      reset ? AdminService.subscriptionSummary() : Promise.resolve(summary.value),
    ])
    if (mine !== seq) return
    list.value = reset ? rows : [...list.value, ...rows]
    hasMore.value = rows.length === PAGE
    summary.value = sum
  } catch (err) {
    if (mine !== seq) return
    console.warn('[SubscriptionsView] load failed:', err)
    failed.value = true
  } finally {
    if (mine === seq) loading.value = false
  }
}
const reload = () => fetchPage(true)
const loadMore = () => fetchPage(false)
function onFilter(v: SubscriptionFilter) { filter.value = v; list.value = []; fetchPage(true) }
async function handleRefresh(ev: CustomEvent) { await fetchPage(true); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(reload)

const openUser = (id: string) => router.push(`/admin/users/${id}`)

const tiles = computed<StatTile[]>(() => {
  const s = summary.value
  if (!s) return []
  return [
    { label: t('adminPages.subs.tileActive'), value: s.active, tone: 'good' },
    { label: t('adminPages.subs.tileExpiring'), value: s.expiring_14d, tone: s.expiring_14d > 0 ? 'warn' : undefined },
    { label: t('adminPages.subs.tileNotRenewing'), value: s.not_renewing, tone: s.not_renewing > 0 ? 'warn' : undefined },
    { label: t('adminPages.subs.tileMismatch'), value: s.flag_mismatch, tone: s.flag_mismatch > 0 ? 'bad' : 'good' },
  ]
})
</script>

<style scoped>
.who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
.avatar.initial { display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ion-color-carrot-rgb), 0.18); color: var(--ion-color-carrot); font-weight: 800; }
.more { display: flex; justify-content: center; margin: 12px 0 24px; }
</style>
