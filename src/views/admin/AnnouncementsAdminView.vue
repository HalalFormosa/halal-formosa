<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.announcements.title')" :icon="megaphoneOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-segment class="ap-segment" :value="tab" data-testid="ann-tabs" @ionChange="onTab($event.detail.value as any)">
        <ion-segment-button value="announcements"><ion-label>{{ $t('adminPages.announcements.tabAnnouncements') }}</ion-label></ion-segment-button>
        <ion-segment-button value="notifications"><ion-label>{{ $t('adminPages.announcements.tabNotifications') }}</ion-label></ion-segment-button>
        <ion-segment-button value="emails"><ion-label>{{ $t('adminPages.announcements.tabEmails') }}</ion-label></ion-segment-button>
      </ion-segment>

      <div v-if="loading" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="load">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>

      <!-- ===== announcements ===== -->
      <template v-else-if="tab === 'announcements'">
        <div class="ap-note">{{ $t('adminPages.announcements.note') }}</div>
        <ion-button expand="block" size="small" data-testid="ann-new" @click="openForm(null)">
          <ion-icon slot="start" :icon="addOutline" />{{ $t('adminPages.announcements.new') }}
        </ion-button>

        <p v-if="!announcements.length" class="ap-state">{{ $t('adminPages.announcements.empty') }}</p>
        <div v-for="a in announcements" :key="a.id" class="ap-card" data-testid="ann-row">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill" :class="a.type === 'warning' ? 'warn' : 'info'">{{ a.type }}</span>
              <span class="ap-pill" :class="a.is_active ? 'good' : 'neutral'">{{ a.is_active ? $t('adminPages.announcements.live') : $t('adminPages.announcements.off') }}</span>
            </div>
            <ion-toggle :checked="a.is_active" :disabled="busyId === a.id" :aria-label="a.title" @ionChange="setActive(a, $event.detail.checked)" />
          </div>
          <h3 style="margin-top: 8px;">{{ a.title }}</h3>
          <p class="ap-small clamp">{{ a.content }}</p>
          <p v-if="a.link_url" class="ap-small ap-muted ap-mono">{{ a.link_url }}</p>
          <div class="ap-row">
            <span class="ap-small ap-muted">{{ fmtDay(a.created_at, locale) }}</span>
            <ion-button size="small" fill="clear" @click="openForm(a)">{{ $t('adminPages.common.edit') }}</ion-button>
          </div>
        </div>
      </template>

      <!-- ===== notifications log ===== -->
      <template v-else-if="tab === 'notifications'">
        <p v-if="!notifications.length" class="ap-state">{{ $t('adminPages.announcements.noNotifications') }}</p>
        <div v-for="n in notifications" :key="String(n.id)" class="ap-card" data-testid="notif-row">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill info">{{ n.type || '–' }}</span>
              <span v-for="c in channelList(n.channels)" :key="c" class="ap-pill neutral">{{ c }}</span>
            </div>
            <span class="ap-small ap-muted">{{ fmtDateTime(n.created_at, locale) }}</span>
          </div>
          <p class="ap-small clamp">{{ n.message }}</p>
        </div>
      </template>

      <!-- ===== update emails ===== -->
      <template v-else>
        <AdminStatTiles :tiles="emailTiles" />
        <div class="ap-note">{{ $t('adminPages.announcements.emailNote') }}</div>
        <p v-if="!emails.length" class="ap-state">{{ $t('adminPages.announcements.noEmails') }}</p>
        <div v-for="e in emails.slice(0, 30)" :key="e.id" class="ap-card">
          <div class="ap-row">
            <div class="ap-wrap">
              <span class="ap-pill" :class="statusTone(e.status)">{{ e.status }}</span>
              <span class="ap-small">{{ e.platform }} {{ e.app_version }}</span>
            </div>
            <span class="ap-small ap-muted">{{ fmtDateTime(e.sent_at || e.created_at, locale) }}</span>
          </div>
          <p v-if="e.error" class="ap-small ap-error">{{ e.error }}</p>
        </div>
      </template>

      <!-- ===== add / edit ===== -->
      <ion-modal :is-open="formOpen" @didDismiss="formOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ form.id ? $t('adminPages.announcements.editTitle') : $t('adminPages.announcements.newTitle') }}</ion-title>
            <ion-buttons slot="end"><ion-button @click="formOpen = false">{{ $t('adminPages.common.cancel') }}</ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-input v-model="form.title" class="gap" fill="outline" :label="$t('adminPages.announcements.fieldTitle')" label-placement="stacked" :maxlength="120" data-testid="ann-title" />
          <ion-textarea v-model="form.content" class="gap" fill="outline" :label="$t('adminPages.announcements.fieldContent')" label-placement="stacked" :rows="5" :maxlength="2000" data-testid="ann-content" />
          <ion-select v-model="form.type" class="gap" fill="outline" interface="popover" :label="$t('adminPages.announcements.fieldType')" label-placement="stacked">
            <ion-select-option value="info">info</ion-select-option>
            <ion-select-option value="warning">warning</ion-select-option>
          </ion-select>
          <ion-input v-model="form.image_url" class="gap" fill="outline" type="url" :label="$t('adminPages.announcements.fieldImage')" label-placement="stacked" placeholder="https://" />
          <ion-input v-model="form.link_url" class="gap" fill="outline" type="url" :label="$t('adminPages.announcements.fieldLink')" label-placement="stacked" placeholder="https:// or myapp://" />
          <div class="ap-row gap">
            <span>{{ $t('adminPages.announcements.fieldActive') }}</span>
            <ion-toggle :checked="form.is_active" aria-label="active" @ionChange="form.is_active = $event.detail.checked" />
          </div>
          <p v-if="formError" class="ap-error ap-small">{{ formError }}</p>
          <ion-button expand="block" :disabled="saving" data-testid="ann-save" @click="saveForm">
            <ion-spinner v-if="saving" name="dots" /><template v-else>{{ $t('adminPages.common.save') }}</template>
          </ion-button>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonRefresher, IonRefresherContent, IonSegment,
  IonSegmentButton, IonLabel, IonSpinner, IonButton, IonIcon, IonToggle, IonModal, IonInput, IonTextarea, IonSelect,
  IonSelectOption, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { megaphoneOutline, addOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import AdminStatTiles, { type StatTile } from '@/components/admin/AdminStatTiles.vue'
import '@/views/admin/adminPage.css'
import {
  AdminService, type AnnouncementRow, type EmailQueueRow, type NotificationLogRow,
} from '@/services/AdminService'
import { fmtDateTime, fmtDay } from '@/utils/adminFormat'

const { t, locale } = useI18n()

const tab = ref<'announcements' | 'notifications' | 'emails'>('announcements')
const loading = ref(false)
const failed = ref(false)
const announcements = ref<AnnouncementRow[]>([])
const notifications = ref<NotificationLogRow[]>([])
const emails = ref<EmailQueueRow[]>([])
const busyId = ref<string | null>(null)

const formOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ id: null as string | null, title: '', content: '', type: 'info' as 'info' | 'warning', is_active: false, image_url: '', link_url: '' })

async function load() {
  loading.value = true
  failed.value = false
  try {
    if (tab.value === 'announcements') announcements.value = await AdminService.announcements()
    else if (tab.value === 'notifications') notifications.value = await AdminService.notificationsLog()
    else emails.value = await AdminService.emailQueue()
  } catch (err) {
    console.warn('[AnnouncementsAdminView] load failed:', err)
    failed.value = true
  } finally {
    loading.value = false
  }
}
function onTab(v: 'announcements' | 'notifications' | 'emails') { tab.value = v; load() }
async function handleRefresh(ev: CustomEvent) { await load(); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(load)

async function toast(message: string, color: 'success' | 'danger' = 'success') {
  const el = await toastController.create({ message, duration: 3000, color })
  await el.present()
}

async function setActive(a: AnnouncementRow, active: boolean) {
  if (active === a.is_active) return
  busyId.value = a.id
  try {
    await AdminService.setAnnouncementActive(a.id, active)
    a.is_active = active
    await toast(active ? t('adminPages.announcements.nowLive') : t('adminPages.announcements.nowOff'))
  } catch (err: any) {
    await toast(err?.message || t('adminPages.common.saveFailed'), 'danger')
    await load()
  } finally {
    busyId.value = null
  }
}

function openForm(a: AnnouncementRow | null) {
  formError.value = ''
  Object.assign(form, a
    ? { id: a.id, title: a.title, content: a.content, type: a.type, is_active: a.is_active, image_url: a.image_url ?? '', link_url: a.link_url ?? '' }
    : { id: null, title: '', content: '', type: 'info', is_active: false, image_url: '', link_url: '' })
  formOpen.value = true
}

async function saveForm() {
  formError.value = ''
  if (!form.title.trim()) { formError.value = t('adminPages.announcements.titleRequired'); return }
  if (form.image_url.trim() && !/^https:\/\//.test(form.image_url.trim())) { formError.value = t('adminPages.announcements.imageHttps'); return }
  if (form.link_url.trim() && !/^(https:\/\/|myapp:\/\/)/.test(form.link_url.trim())) { formError.value = t('adminPages.announcements.linkScheme'); return }
  saving.value = true
  try {
    await AdminService.saveAnnouncement({
      id: form.id, title: form.title, content: form.content, type: form.type, is_active: form.is_active,
      image_url: form.image_url.trim() || null, link_url: form.link_url.trim() || null,
    })
    formOpen.value = false
    await toast(t('adminPages.common.saved'))
    await load()
  } catch (err: any) {
    formError.value = err?.message || t('adminPages.common.saveFailed')
  } finally {
    saving.value = false
  }
}

const channelList = (c: unknown): string[] => (Array.isArray(c) ? c.map(String) : typeof c === 'string' && c ? [c] : [])
const statusTone = (s: string) => (s === 'sent' ? 'good' : s === 'failed' || s === 'error' ? 'bad' : 'neutral')

const emailTiles = computed<StatTile[]>(() => {
  const by = (s: string) => emails.value.filter((e) => e.status === s).length
  return [
    { label: t('adminPages.announcements.emailSent'), value: by('sent'), tone: 'good' },
    { label: t('adminPages.announcements.emailPending'), value: by('pending') },
    { label: t('adminPages.announcements.emailFailed'), value: by('failed'), tone: by('failed') > 0 ? 'bad' : undefined },
    { label: t('adminPages.announcements.emailTotal'), value: emails.value.length },
  ]
})
</script>

<style scoped>
.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.gap { margin-bottom: 14px; }
</style>
