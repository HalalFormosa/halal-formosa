<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.reviews.title')" :icon="starOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="ap-filters">
        <ion-select class="ap-select" interface="popover" :value="maxRating" :aria-label="$t('adminPages.reviews.rating')"
                    data-testid="reviews-rating" @ionChange="maxRating = $event.detail.value; reload()">
          <ion-select-option :value="0">{{ $t('adminPages.reviews.anyRating') }}</ion-select-option>
          <ion-select-option :value="1">{{ $t('adminPages.reviews.upTo', { n: 1 }) }}</ion-select-option>
          <ion-select-option :value="2">{{ $t('adminPages.reviews.upTo', { n: 2 }) }}</ion-select-option>
          <ion-select-option :value="3">{{ $t('adminPages.reviews.upTo', { n: 3 }) }}</ion-select-option>
        </ion-select>
      </div>
      <ion-searchbar v-model="search" :debounce="400" :placeholder="$t('adminPages.reviews.search')" data-testid="reviews-search" @ionInput="reload" />

      <div class="ap-note">{{ $t('adminPages.reviews.note') }}</div>

      <div v-if="loading && !list.length" class="ap-state"><ion-spinner name="crescent" /></div>
      <div v-else-if="failed" class="ap-state">
        <p>{{ $t('adminPages.common.loadFailed') }}</p>
        <ion-button size="small" fill="outline" @click="reload">{{ $t('adminPages.common.retry') }}</ion-button>
      </div>
      <p v-else-if="!list.length" class="ap-state" data-testid="reviews-empty">{{ $t('adminPages.reviews.empty') }}</p>

      <div v-for="r in list" :key="r.id" class="ap-card" data-testid="review-row">
        <div class="ap-row">
          <button type="button" class="ap-link" @click="openPlace(r.location_id)">{{ r.location_name || `#${r.location_id}` }}</button>
          <span class="stars" :aria-label="`${r.rating}/5`">{{ '★'.repeat(r.rating) }}<span class="dim">{{ '★'.repeat(5 - r.rating) }}</span></span>
        </div>
        <p v-if="r.comment" class="comment">{{ r.comment }}</p>
        <p v-else class="ap-small ap-muted">{{ $t('adminPages.reviews.noComment') }}</p>
        <div v-if="r.owner_response" class="reply">
          <span class="ap-small ap-muted">{{ $t('adminPages.reviews.ownerReply') }}</span>
          <p class="ap-small">{{ r.owner_response }}</p>
        </div>
        <div class="ap-row">
          <span class="ap-small ap-muted">
            <button type="button" class="ap-link ap-small" @click="openUser(r.user_id)">{{ r.user_name || shortId(r.user_id) }}</button>
            · {{ fmtDay(r.created_at, locale) }}
          </span>
          <ion-button size="small" fill="outline" color="danger" :disabled="busyId === r.id" data-testid="review-remove" @click="remove(r)">
            <ion-icon slot="start" :icon="trashOutline" />{{ $t('adminPages.reviews.remove') }}
          </ion-button>
        </div>
      </div>

      <div v-if="hasMore && list.length" class="more">
        <ion-button fill="outline" size="small" :disabled="loading" @click="loadMore">{{ $t('adminPages.common.loadMore') }}</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonSearchbar,
  IonSpinner, IonButton, IonIcon, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { starOutline, trashOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import '@/views/admin/adminPage.css'
import { AdminService, type ReviewRow } from '@/services/AdminService'
import { fmtDay, shortId } from '@/utils/adminFormat'

const PAGE = 30
const { t, locale } = useI18n()
const router = useRouter()

const maxRating = ref(0)
const search = ref('')
const list = ref<ReviewRow[]>([])
const loading = ref(false)
const failed = ref(false)
const hasMore = ref(false)
const busyId = ref<string | null>(null)

let seq = 0
async function fetchPage(reset: boolean) {
  const mine = ++seq
  loading.value = true
  failed.value = false
  try {
    const before = reset ? null : list.value[list.value.length - 1]?.created_at ?? null
    const rows = await AdminService.reviews(PAGE, before, maxRating.value || null, search.value.trim() || null)
    if (mine !== seq) return
    list.value = reset ? rows : [...list.value, ...rows]
    hasMore.value = rows.length === PAGE
  } catch (err) {
    if (mine !== seq) return
    console.warn('[ReviewModerationView] load failed:', err)
    failed.value = true
  } finally {
    if (mine === seq) loading.value = false
  }
}
const reload = () => fetchPage(true)
const loadMore = () => fetchPage(false)
async function handleRefresh(ev: CustomEvent) { await fetchPage(true); (ev.target as HTMLIonRefresherElement).complete() }
onIonViewWillEnter(reload)

const openPlace = (id: number) => router.push(`/place/${id}`)
const openUser = (id: string) => router.push(`/admin/users/${id}`)

async function toast(message: string, color: 'success' | 'danger' = 'success') {
  const el = await toastController.create({ message, duration: 3000, color })
  await el.present()
}

async function remove(r: ReviewRow) {
  const alert = await alertController.create({
    header: t('adminPages.reviews.removeTitle'),
    message: t('adminPages.reviews.removeMessage', { place: r.location_name || `#${r.location_id}` }),
    inputs: [{ name: 'reason', type: 'textarea', placeholder: t('adminPages.reviews.reasonPlaceholder'), attributes: { maxlength: 300 } }],
    buttons: [
      { text: t('adminPages.common.cancel'), role: 'cancel' },
      {
        text: t('adminPages.reviews.remove'),
        role: 'destructive',
        // a reason is required (it is kept with the audit record); returning false keeps the dialog open
        handler: (data: { reason?: string }) => (data.reason ?? '').trim().length >= 3,
      },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss<{ values?: { reason?: string } }>()
  if (role !== 'destructive') return
  const reason = (data?.values?.reason ?? '').trim()
  if (reason.length < 3) return

  busyId.value = r.id
  try {
    await AdminService.deleteReview(r.id, reason)
    list.value = list.value.filter((x) => x.id !== r.id)
    await toast(t('adminPages.reviews.removed'))
  } catch (err: any) {
    await toast(err?.message || t('adminPages.common.saveFailed'), 'danger')
  } finally {
    busyId.value = null
  }
}
</script>

<style scoped>
.stars { color: var(--ion-color-warning); letter-spacing: 1px; white-space: nowrap; }
.stars .dim { color: rgba(127, 127, 127, 0.35); }
.comment { margin: 8px 0; white-space: pre-wrap; word-break: break-word; }
.reply { border-left: 3px solid rgba(var(--ion-color-carrot-rgb), 0.5); padding: 2px 10px; margin: 6px 0; }
.more { display: flex; justify-content: center; margin: 12px 0 24px; }
</style>
