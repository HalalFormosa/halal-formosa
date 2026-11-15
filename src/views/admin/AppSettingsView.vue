<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.settings.title')" :icon="settingsOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div v-if="loading && !config.length" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <template v-else>
        <div class="ap-note">{{ $t('adminPages.settings.note') }}</div>

        <!-- minimum versions -->
        <p class="ap-section">{{ $t('adminPages.settings.minVersions') }}</p>
        <div v-for="p in PLATFORMS" :key="p.key" class="ap-card" :data-testid="`setting-${p.key}`">
          <h3>{{ p.label }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.settings.minVersionHelp') }}</p>
          <div class="ap-row">
            <ion-input
              class="field" fill="outline" inputmode="decimal" :value="drafts[p.key]" :aria-label="p.label"
              :data-testid="`input-${p.key}`" @ionInput="drafts[p.key] = String($event.detail.value ?? '')"
            />
            <ion-button :disabled="!canSave(p.key) || saving === p.key" :data-testid="`save-${p.key}`" @click="saveVersion(p)">
              {{ $t('adminPages.common.save') }}
            </ion-button>
          </div>
          <p v-if="!versionValid(drafts[p.key])" class="ap-small ap-error">{{ $t('adminPages.settings.versionInvalid') }}</p>
          <p v-else-if="isChanged(p.key) && impact(p.platform, drafts[p.key]).total > 0" class="ap-small" :class="{ 'ap-error': impact(p.platform, drafts[p.key]).below > 0 }">
            {{ $t('adminPages.settings.impact', { below: impact(p.platform, drafts[p.key]).below, total: impact(p.platform, drafts[p.key]).total, v: drafts[p.key] }) }}
          </p>
          <p v-else-if="!isChanged(p.key) && impact(p.platform, saved(p.key)).below > 0" class="ap-small ap-muted" data-testid="impact-current">
            {{ $t('adminPages.settings.impactCurrent', { below: impact(p.platform, saved(p.key)).below, total: impact(p.platform, saved(p.key)).total, v: saved(p.key) }) }}
          </p>
          <p class="ap-small ap-muted">{{ updatedText(p.key) }}</p>
        </div>

        <!-- OCR sign-in requirement -->
        <p class="ap-section">{{ $t('adminPages.settings.security') }}</p>
        <div class="ap-card" data-testid="setting-enforce_ocr_auth">
          <div class="ap-row">
            <div>
              <h3>{{ $t('adminPages.settings.ocrTitle') }}</h3>
              <p class="ap-small ap-muted">{{ $t('adminPages.settings.ocrHelp') }}</p>
            </div>
            <ion-toggle :key="toggleKey" :checked="ocrOn" :disabled="saving === 'enforce_ocr_auth'" aria-label="OCR"
                        data-testid="toggle-ocr" @ionChange="onOcr($event.detail.checked)" />
          </div>
          <p class="ap-small ap-muted">{{ updatedText('enforce_ocr_auth') }}</p>
        </div>

        <!-- store links -->
        <p class="ap-section">{{ $t('adminPages.settings.storeLinks') }}</p>
        <div v-for="s in STORES" :key="s.key" class="ap-card" :data-testid="`setting-${s.key}`">
          <h3>{{ s.label }}</h3>
          <div class="ap-row">
            <ion-input class="field" fill="outline" type="url" :value="drafts[s.key]" :aria-label="s.label"
                       @ionInput="drafts[s.key] = String($event.detail.value ?? '')" />
            <ion-button :disabled="!canSave(s.key) || saving === s.key" @click="saveSimple(s.key, s.label)">
              {{ $t('adminPages.common.save') }}
            </ion-button>
          </div>
          <p class="ap-small ap-muted">{{ updatedText(s.key) }}</p>
        </div>

        <!-- read-only -->
        <p class="ap-section">{{ $t('adminPages.settings.readOnly') }}</p>
        <div v-for="r in readOnlyRows" :key="r.key" class="ap-card">
          <h3>{{ r.key }}</h3>
          <p class="ap-small ap-muted">{{ $t('adminPages.settings.readOnlyHelp') }}</p>
          <pre class="ap-pre">{{ prettyJson(parse(r.value), 3000) }}</pre>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSpinner, IonButton, IonInput, IonToggle,
  alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { settingsOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type AppConfigRow, type Platform, type VersionRow } from '@/services/AdminService'
import { compareVersions } from '@/utils/versionCompare'
import { fmtDateTime, prettyJson } from '@/utils/adminFormat'

const { t, locale } = useI18n()

const PLATFORMS: { key: string; label: string; platform: Platform }[] = [
  { key: 'min_android_version', label: 'Android', platform: 'android' },
  { key: 'min_ios_version', label: 'iOS', platform: 'ios' },
]
const STORES = [
  { key: 'android_store_url', label: 'Google Play' },
  { key: 'ios_store_url', label: 'App Store' },
]
const EDITABLE = new Set([...PLATFORMS.map((p) => p.key), ...STORES.map((s) => s.key), 'enforce_ocr_auth'])
const VERSION_RE = /^[0-9]+(\.[0-9]+){1,3}$/

const config = ref<AppConfigRow[]>([])
const versionRows = ref<VersionRow[]>([])
const drafts = reactive<Record<string, string>>({})
const loading = ref(false)
const failed = ref(false)
const saving = ref<string | null>(null)
const toggleKey = ref(0)

const row = (key: string) => config.value.find((c) => c.key === key)
const saved = (key: string) => row(key)?.value ?? ''
const ocrOn = computed(() => saved('enforce_ocr_auth') === 'true')
const readOnlyRows = computed(() => config.value.filter((c) => !EDITABLE.has(c.key)))

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [cfg, versions] = await Promise.all([AdminService.appConfig(), AdminService.versionBreakdown(14)])
    config.value = cfg
    versionRows.value = versions
    for (const c of cfg) drafts[c.key] = c.value
  } catch (err) {
    console.warn('[AppSettingsView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

const versionValid = (v: string | undefined) => VERSION_RE.test((v ?? '').trim())
const updatedText = (key: string) => t('adminPages.settings.updated', { d: fmtDateTime(row(key)?.updated_at, locale.value) })

const isChanged = (key: string) => (drafts[key] ?? '').trim() !== saved(key)

function canSave(key: string) {
  const d = (drafts[key] ?? '').trim()
  if (d === '' || d === saved(key)) return false
  return key.startsWith('min_') ? versionValid(d) : true
}

// How many of the people seen in the last 14 days would be asked to update with this minimum.
function impact(platform: Platform, candidate: string | undefined) {
  const list = versionRows.value.filter((r) => r.platform === platform)
  const total = list.reduce((s, r) => s + Number(r.users), 0)
  if (!versionValid(candidate)) return { below: 0, total }
  const below = list.filter((r) => compareVersions(r.app_version, (candidate ?? '').trim()) < 0).reduce((s, r) => s + Number(r.users), 0)
  return { below, total }
}

async function confirm(header: string, message: string, danger = false): Promise<boolean> {
  const alert = await alertController.create({
    header,
    message,
    buttons: [
      { text: t('adminPages.common.cancel'), role: 'cancel' },
      { text: t('adminPages.common.confirm'), role: 'confirm', cssClass: danger ? 'alert-danger' : undefined },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'confirm'
}

async function toast(message: string, color: 'success' | 'danger' = 'success') {
  const el = await toastController.create({ message, duration: 3500, color })
  await el.present()
}

async function apply(key: string, value: string) {
  saving.value = key
  try {
    const r = await AdminService.setAppConfig(key, value)
    await toast(t('adminPages.settings.savedFrom', { key, old: r.old, new: r.new }))
    await load()
  } catch (err: any) {
    await toast(err?.message || t('adminPages.common.saveFailed'), 'danger')
  } finally {
    saving.value = null
  }
}

async function saveVersion(p: { key: string; label: string; platform: Platform }) {
  const value = (drafts[p.key] ?? '').trim()
  const { below, total } = impact(p.platform, value)
  const message = t('adminPages.settings.confirmVersion', { platform: p.label, v: value, below, total })
  if (await confirm(t('adminPages.settings.confirmTitle'), message, below > 0)) await apply(p.key, value)
}

async function saveSimple(key: string, label: string) {
  const value = (drafts[key] ?? '').trim()
  if (await confirm(t('adminPages.settings.confirmTitle'), t('adminPages.settings.confirmLink', { label, value }))) await apply(key, value)
}

async function onOcr(checked: boolean) {
  if (checked === ocrOn.value) return
  const ok = await confirm(
    t('adminPages.settings.confirmTitle'),
    checked ? t('adminPages.settings.ocrOn') : t('adminPages.settings.ocrOff'),
    !checked
  )
  if (ok) await apply('enforce_ocr_auth', checked ? 'true' : 'false')
  else toggleKey.value += 1 // put the switch back where the saved value says it is
}

function parse(v: string): unknown {
  try { return JSON.parse(v) } catch { return v }
}
</script>

<style scoped>
.field { flex: 1; min-width: 0; --padding-start: 10px; }
</style>
