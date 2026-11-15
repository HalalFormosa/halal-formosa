<template>
  <div v-if="report.length" class="offer-report">
    <div class="or-head">
      <strong>{{ $t('offers.report.title') }}</strong>
      <span class="or-days">{{ $t('offers.report.lastDays', { n: report[0].days }) }}</span>
    </div>

    <div v-for="r in report" :key="r.offer_id" class="or-card">
      <div class="or-title">
        <span class="or-prefix">{{ r.code_prefix }}</span>
        <span>{{ r.title }}</span>
        <span v-if="!r.is_active" class="or-paused">{{ $t('offers.report.paused') }}</span>
      </div>

      <div class="or-grid">
        <div><b>{{ r.issued }}</b><span>{{ $t('offers.report.claimed') }}</span></div>
        <div><b>{{ r.redeemed }}</b><span>{{ $t('offers.report.redeemed') }}</span></div>
        <div><b>{{ rate(r) }}</b><span>{{ $t('offers.report.rate') }}</span></div>
        <div><b>{{ r.open }}</b><span>{{ $t('offers.report.open') }}</span></div>
        <div><b>{{ r.expired }}</b><span>{{ $t('offers.report.expired') }}</span></div>
        <div><b>{{ r.people }}</b><span>{{ $t('offers.report.people') }}</span></div>
      </div>

      <p v-if="followLine(r)" class="or-follow">{{ followLine(r) }}</p>
      <p v-if="r.voided" class="or-void">{{ $t('offers.report.voided', { n: r.voided }) }}</p>

      <!-- Tiny 30-day trend: claimed (light) vs redeemed (solid) -->
      <div v-if="hasSeries(r)" class="or-bars" aria-hidden="true">
        <div v-for="d in r.series" :key="d.date" class="or-bar">
          <i class="b-issued" :style="{ height: barH(d.issued, r) }"></i>
          <i class="b-redeemed" :style="{ height: barH(d.redeemed, r) }"></i>
        </div>
      </div>

      <!-- Admin only: who claimed / redeemed -->
      <template v-if="isAdmin">
        <button type="button" class="or-people-btn" @click="toggle(r.offer_id)">
          {{ open === r.offer_id ? $t('offers.report.hideCustomers') : $t('offers.report.showCustomers') }}
        </button>
        <ul v-if="open === r.offer_id" class="or-people">
          <li v-if="loadingPeople"><ion-spinner name="dots" /></li>
          <li v-else-if="!people.length" class="or-none">{{ $t('offers.report.noCustomers') }}</li>
          <li v-for="p in people" :key="p.code">
            <span class="p-name">{{ p.display_name || p.user_id.slice(0, 8) }}</span>
            <span class="p-meta">
              {{ p.redeemed_at ? $t('offers.report.statusRedeemed') : new Date(p.expires_at) < new Date() ? $t('offers.report.statusExpired') : $t('offers.report.statusOpen') }}
              · {{ formatDate(p.redeemed_at || p.issued_at) }}
              <template v-if="p.followed.length"> · {{ p.followed.join(', ') }}</template>
            </span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonSpinner } from '@ionic/vue'
import { OfferService, type OfferReportRow, type AdminOfferCode } from '@/services/OfferService'
import { isAdmin } from '@/composables/userProfile'

const props = defineProps<{ locationId: number; refreshKey?: number }>()
const { t, locale } = useI18n()

const report = ref<OfferReportRow[]>([])
const open = ref<string | null>(null)
const people = ref<AdminOfferCode[]>([])
const loadingPeople = ref(false)

async function load() {
  try { report.value = await OfferService.getOfferReport(props.locationId, 30) } catch { report.value = [] }
}
watch(() => [props.locationId, props.refreshKey], load, { immediate: true })

const rate = (r: OfferReportRow) => (r.issued > 0 ? `${Math.round((100 * r.redeemed) / r.issued)}%` : '–')

function followLine(r: OfferReportRow) {
  const parts: string[] = []
  if (r.followed.instagram) parts.push(`Instagram ${r.followed.instagram}`)
  if (r.followed.tiktok) parts.push(`TikTok ${r.followed.tiktok}`)
  if (r.followed.facebook) parts.push(`Facebook ${r.followed.facebook}`)
  return parts.length ? t('offers.report.followed', { list: parts.join(' · ') }) : ''
}

const hasSeries = (r: OfferReportRow) => r.series.some(d => d.issued > 0 || d.redeemed > 0)
function barH(n: number, r: OfferReportRow) {
  const max = Math.max(1, ...r.series.map(d => Math.max(d.issued, d.redeemed)))
  return `${Math.round((n / max) * 100)}%`
}
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })

async function toggle(offerId: string) {
  if (open.value === offerId) { open.value = null; return }
  open.value = offerId
  loadingPeople.value = true
  try { people.value = await OfferService.adminOfferCodes(offerId) } catch { people.value = [] }
  loadingPeople.value = false
}
</script>

<style scoped>
.offer-report { margin-top: 20px; display: flex; flex-direction: column; gap: 12px; }
.or-head { display: flex; align-items: baseline; justify-content: space-between; }
.or-days { font-size: 12px; opacity: 0.7; }
.or-card { border: 1px solid rgba(128,128,128,0.35); border-radius: 16px; padding: 14px; }
.or-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; }
.or-prefix { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 15%, transparent); padding: 2px 8px; border-radius: 999px; }
.or-paused { font-size: 11px; color: var(--ion-color-danger, #d33); }
.or-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
.or-grid div { display: flex; flex-direction: column; }
.or-grid b { font-size: 20px; }
.or-grid span { font-size: 11px; opacity: 0.7; }
.or-follow, .or-void { margin: 10px 0 0; font-size: 12px; opacity: 0.8; }
.or-bars { display: flex; align-items: flex-end; gap: 2px; height: 48px; margin-top: 12px; }
.or-bar { flex: 1; height: 100%; display: flex; align-items: flex-end; gap: 1px; }
.or-bar i { flex: 1; display: block; border-radius: 2px 2px 0 0; min-height: 0; }
.b-issued { background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 35%, transparent); }
.b-redeemed { background: var(--ion-color-carrot, #ff7a00); }
.or-people-btn { margin-top: 12px; background: none; border: 0; padding: 0; color: var(--ion-color-carrot, #ff7a00); font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; }
.or-people { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.or-people li { display: flex; flex-direction: column; font-size: 13px; }
.p-meta { font-size: 11px; opacity: 0.7; }
.or-none { opacity: 0.7; }
</style>
