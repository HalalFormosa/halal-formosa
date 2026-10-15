<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('admin.survey.title')"
          :icon="clipboardOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding content-background">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Filters -->
      <div class="filters">
        <ion-select
            class="filter-select"
            interface="popover"
            :value="cycle"
            :aria-label="$t('admin.survey.cycle')"
            data-testid="survey-cycle-select"
            @ionChange="onCycle($event.detail.value)"
        >
          <ion-select-option :value="ALL">{{ $t('admin.survey.allCycles') }}</ion-select-option>
          <ion-select-option v-for="c in cycles" :key="c" :value="c">{{ $t('admin.survey.cycleN', { n: c }) }}</ion-select-option>
        </ion-select>

        <ion-select
            class="filter-select"
            interface="popover"
            :value="status"
            :aria-label="$t('admin.survey.group')"
            data-testid="survey-group-select"
            @ionChange="onStatus($event.detail.value)"
        >
          <ion-select-option :value="ALL">{{ $t('admin.survey.allGroups') }}</ion-select-option>
          <ion-select-option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ text(o.label) }}</ion-select-option>
        </ion-select>

        <ion-button size="small" fill="outline" color="carrot" :disabled="exporting" data-testid="survey-export" @click="exportCsv">
          <ion-icon slot="start" :icon="downloadOutline" />
          {{ $t('admin.survey.export') }}
        </ion-button>
      </div>

      <div v-if="loading && !results" class="state-box"><ion-spinner name="crescent" /></div>
      <div v-else-if="errorMsg" class="state-box error-text">{{ errorMsg }}</div>

      <template v-else-if="results">
        <!-- Summary -->
        <div class="tiles" data-testid="survey-tiles">
          <div class="tile">
            <div class="tile-value">{{ results.respondents }}</div>
            <div class="tile-label">{{ $t('admin.survey.respondents') }}</div>
          </div>
          <div class="tile">
            <div class="tile-value">{{ results.completed }}</div>
            <div class="tile-label">{{ $t('admin.survey.completed') }}</div>
          </div>
          <div class="tile">
            <div class="tile-value">{{ completionRate }}</div>
            <div class="tile-label">{{ $t('admin.survey.completionRate') }}</div>
          </div>
          <div class="tile">
            <div class="tile-value" :class="npsClass">{{ npsText }}</div>
            <div class="tile-label">{{ $t('admin.survey.nps') }}</div>
          </div>
        </div>

        <p v-if="results.respondents === 0" class="empty" data-testid="survey-empty">{{ $t('admin.survey.empty') }}</p>

        <!-- One card per question -->
        <ion-card v-for="q in results.questions" :key="q.key" class="q-card" :data-testid="`survey-result-${q.key}`">
          <ion-card-header>
            <ion-card-subtitle>{{ $t('admin.survey.answers', { n: q.n }) }}</ion-card-subtitle>
            <ion-card-title class="q-title">{{ text(q.prompt) }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <!-- numeric scales -->
            <template v-if="q.answer_type === 'scale_5' || q.answer_type === 'nps'">
              <div v-if="q.n > 0" class="score-line">
                <span v-if="q.answer_type === 'nps'" class="score-big" :class="scoreClass(q.nps)">NPS {{ formatNps(q.nps) }}</span>
                <span class="score-avg">{{ $t('admin.survey.average', { value: q.average }) }}</span>
              </div>
              <div v-for="row in scaleRows(q)" :key="row.value" class="bar-row">
                <span class="bar-label num">{{ row.value }}</span>
                <div class="bar-track"><div class="bar-fill" :style="{ width: row.pct + '%' }"></div></div>
                <span class="bar-count">{{ row.count }}</span>
              </div>
            </template>

            <!-- option lists -->
            <template v-else-if="q.answer_type === 'single' || q.answer_type === 'multi'">
              <div v-for="row in optionRows(q)" :key="row.value" class="bar-row">
                <span class="bar-label">{{ row.label }}</span>
                <div class="bar-track"><div class="bar-fill" :style="{ width: row.pct + '%' }"></div></div>
                <span class="bar-count">{{ row.count }} <small>({{ row.pct }}%)</small></span>
              </div>
            </template>

            <!-- free text -->
            <template v-else>
              <p v-if="!q.texts || !q.texts.length" class="muted">{{ $t('admin.survey.noText') }}</p>
              <ul v-else class="text-list">
                <li v-for="(t, i) in q.texts" :key="i">
                  <span>{{ t.text }}</span>
                  <small>{{ formatDate(t.at) }}</small>
                </li>
              </ul>
            </template>
          </ion-card-content>
        </ion-card>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonButton, IonIcon,
  IonSpinner, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, toastController,
} from '@ionic/vue'
import { clipboardOutline, downloadOutline } from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import AppHeader from '@/components/AppHeader.vue'
import {
  SurveyService, localizedText,
  type LocalizedText, type SurveyOption, type SurveyResultQuestion, type SurveyResults,
} from '@/services/SurveyService'

const ALL = '__all__'
const { t, locale } = useI18n()

const results = ref<SurveyResults | null>(null)
const statusOptions = ref<SurveyOption[]>([])
const loading = ref(false)
const exporting = ref(false)
const errorMsg = ref('')
const cycle = ref<number | typeof ALL>(ALL)
const status = ref<string>(ALL)

const text = (v: LocalizedText) => localizedText(v, locale.value)
const cycles = computed(() => results.value?.cycles ?? [])

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await SurveyService.adminResults(
      cycle.value === ALL ? null : (cycle.value as number),
      status.value === ALL ? null : status.value
    )
    results.value = data
    // the group filter is built from the "situation_status" question so it follows any wording change
    const sq = data.questions.find((q) => q.key === 'situation_status')
    if (sq?.options) statusOptions.value = sq.options
  } catch (err: any) {
    console.warn('[SurveyResultsView] load failed:', err)
    errorMsg.value = err?.message || t('common.error')
  } finally {
    loading.value = false
  }
}

function onCycle(v: number | typeof ALL) { cycle.value = v; load() }
function onStatus(v: string) { status.value = v; load() }
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onMounted(load)

const completionRate = computed(() => {
  const r = results.value
  return r && r.respondents ? Math.round((r.completed / r.respondents) * 100) + '%' : '–'
})
const nps = computed(() => results.value?.questions.find((q) => q.key === 'nps') ?? null)
const npsText = computed(() => (nps.value && nps.value.n > 0 ? formatNps(nps.value.nps) : '–'))
const npsClass = computed(() => scoreClass(nps.value?.nps ?? null))

function formatNps(v: number | null) { return v === null ? '–' : (v > 0 ? '+' : '') + Math.round(v) }
function scoreClass(v: number | null) { return v === null ? '' : v >= 30 ? 'good' : v >= 0 ? 'ok' : 'bad' }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' }) }

function scaleRows(q: SurveyResultQuestion) {
  const max = q.answer_type === 'nps' ? 10 : 5
  const min = q.answer_type === 'nps' ? 0 : 1
  const dist = q.distribution ?? {}
  const rows = []
  for (let v = min; v <= max; v++) {
    const count = dist[String(v)] ?? 0
    rows.push({ value: v, count, pct: q.n ? Math.round((count / q.n) * 100) : 0 })
  }
  return rows
}

function optionRows(q: SurveyResultQuestion) {
  const dist = q.distribution ?? {}
  return (q.options ?? []).map((o) => {
    const count = dist[o.value] ?? 0
    return { value: o.value, label: text(o.label), count, pct: q.n ? Math.round((count / q.n) * 100) : 0 }
  })
}

// ---- CSV: one row per answer, a short pseudonymous user_ref instead of any name, email or id ----
function csvCell(v: unknown) {
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'string' ? v : String(JSON.stringify(v))
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function exportCsv() {
  exporting.value = true
  try {
    const rows = await SurveyService.adminResponses(cycle.value === ALL ? null : (cycle.value as number))
    const lines = ['user_ref,cycle,question,answer,answered_at']
    for (const r of rows) lines.push([r.user_ref, r.cycle, r.question_key, r.answer, r.answered_at].map(csvCell).join(','))
    const csv = '﻿' + lines.join('\n')
    const filename = `halal-formosa-survey_${new Date().toISOString().slice(0, 10)}.csv`
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: filename, url: res.uri })
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }
  } catch (err: any) {
    const toast = await toastController.create({ message: err?.message || t('common.error'), duration: 3000, color: 'danger' })
    await toast.present()
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.content-background { --background: var(--ion-background-color); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.filter-select { flex: 1 1 160px; min-width: 0; }
.state-box { display: flex; justify-content: center; padding: 40px 0; }
.error-text { color: var(--ion-color-danger); }
.empty, .muted { color: var(--ion-color-medium); text-align: center; }

.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
@media (min-width: 640px) { .tiles { grid-template-columns: repeat(4, 1fr); } }
.tile { background: var(--ion-card-background, #fff); border-radius: 14px; padding: 14px; text-align: center; }
.tile-value { font-size: 1.7rem; font-weight: 800; line-height: 1.1; }
.tile-value.good { color: var(--ion-color-success); }
.tile-value.ok { color: var(--ion-color-warning); }
.tile-value.bad { color: var(--ion-color-danger); }
.tile-label { margin-top: 4px; font-size: 0.72rem; color: var(--ion-color-medium); text-transform: uppercase; letter-spacing: 0.04em; }

.q-card { margin: 10px 0; }
.q-title { font-size: 1.02rem; line-height: 1.35; }
.score-line { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.score-big { font-size: 1.3rem; font-weight: 800; }
.score-big.good { color: var(--ion-color-success); }
.score-big.ok { color: var(--ion-color-warning); }
.score-big.bad { color: var(--ion-color-danger); }
.score-avg { color: var(--ion-color-medium); font-size: 0.85rem; }

.bar-row { display: grid; grid-template-columns: minmax(80px, 38%) 1fr auto; align-items: center; gap: 10px; margin: 6px 0; font-size: 0.85rem; }
.bar-label.num { text-align: center; font-weight: 700; min-width: 0; }
.bar-row:has(.bar-label.num) { grid-template-columns: 28px 1fr auto; }
.bar-track { height: 10px; border-radius: 6px; background: rgba(var(--ion-color-carrot-rgb), 0.12); overflow: hidden; }
.bar-fill { height: 100%; background: var(--ion-color-carrot); border-radius: 6px; min-width: 0; }
.bar-count { font-weight: 700; white-space: nowrap; }
.bar-count small { color: var(--ion-color-medium); font-weight: 400; }

.text-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.text-list li { padding: 10px 12px; border-radius: 10px; background: rgba(var(--ion-color-carrot-rgb), 0.07); display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
.text-list small { color: var(--ion-color-medium); font-size: 0.72rem; }
</style>
