<template>
  <div class="owner-offers">
    <p class="oo-note">{{ $t('offers.owner.note') }}</p>

    <div v-for="d in drafts" :key="d.id" class="oo-card">
      <div class="oo-head">
        <span class="oo-prefix">{{ d.code_prefix }}</span>
        <span class="oo-stats">{{ $t('offers.owner.stats', { issued: d.issued_count, redeemed: d.redeemed_count }) }}</span>
        <ion-toggle :checked="d.is_active" @ionChange="d.is_active = $event.detail.checked" />
      </div>

      <label class="oo-label">{{ $t('offers.owner.title') }}</label>
      <ion-input v-model="d.title" :maxlength="80" class="oo-input" />

      <label class="oo-label">{{ $t('offers.owner.badge') }}</label>
      <ion-input v-model="d.discount_label" :maxlength="24" class="oo-input" :placeholder="$t('offers.owner.badgeHint')" />

      <label class="oo-label">{{ $t('offers.owner.description') }}</label>
      <ion-textarea v-model="d.description" :maxlength="300" :rows="3" class="oo-input" />

      <label class="oo-label">{{ $t('offers.owner.image') }}</label>
      <div class="oo-image">
        <img v-if="d.image_url" :src="d.image_url" :alt="d.title" class="oo-image-thumb" />
        <div class="oo-image-actions">
          <ion-button size="small" fill="outline" color="carrot" :disabled="uploading === d.id" @click="pickImage(d)">
            <ion-spinner v-if="uploading === d.id" name="crescent" slot="start" />
            <ion-icon v-else :icon="imageOutline" slot="start" />
            {{ d.image_url ? $t('offers.owner.imageChange') : $t('offers.owner.imageAdd') }}
          </ion-button>
          <ion-button v-if="d.image_url" size="small" fill="clear" color="danger" :disabled="uploading === d.id" @click="d.image_url = null">
            {{ $t('offers.owner.imageRemove') }}
          </ion-button>
        </div>
        <p class="oo-image-hint">{{ $t('offers.owner.imageHint') }}</p>
      </div>

      <p class="oo-fixed">
        <ion-icon :icon="lockClosedOutline" />
        {{ d.free_uses > 0 ? $t('offers.freeThenPro', { n: d.free_uses }) : $t('offers.proPerk') }}
        · {{ $t('offers.owner.fixed') }}
      </p>

      <!-- How this code is set up (read-only for owners, editable by admins) -->
      <div class="oo-settings">
        <div class="oo-settings-head" @click="toggleSettings(d.id)">
          <strong>{{ $t('offers.owner.settings') }}</strong>
          <span class="oo-summary">{{ settingsSummary(d) }}</span>
          <ion-icon :icon="openSettings === d.id ? chevronUp : chevronDown" />
        </div>
        <template v-if="openSettings === d.id">
          <template v-if="isAdmin && sd[d.id]">
            <label class="oo-label">{{ $t('offers.create.validFrom') }}</label>
            <input v-model="sd[d.id].validFrom" type="datetime-local" class="oo-native" />
            <label class="oo-label">{{ $t('offers.create.validUntil') }}</label>
            <input v-model="sd[d.id].validUntil" type="datetime-local" class="oo-native" />
            <label class="oo-label">{{ $t('offers.create.ttl') }}</label>
            <ion-input v-model="sd[d.id].ttl" type="number" inputmode="numeric" class="oo-input" />
            <label class="oo-label">{{ $t('offers.create.maxCodes') }}</label>
            <ion-input v-model="sd[d.id].maxCodes" type="number" inputmode="numeric" class="oo-input" :placeholder="$t('offers.create.maxCodesHint')" />
            <div class="oo-toggle-row">
              <span>{{ $t('offers.create.requireFollow') }}</span>
              <ion-toggle :checked="sd[d.id].requireFollow" @ionChange="sd[d.id].requireFollow = $event.detail.checked" />
            </div>
            <label class="oo-label">{{ $t('offers.create.followInstagram') }}</label>
            <ion-input v-model="sd[d.id].ig" class="oo-input" />
            <label class="oo-label">{{ $t('offers.create.followTiktok') }}</label>
            <ion-input v-model="sd[d.id].tt" class="oo-input" />
            <label class="oo-label">{{ $t('offers.create.followFacebook') }}</label>
            <ion-input v-model="sd[d.id].fb" class="oo-input" />
            <ion-button size="small" fill="outline" color="carrot" :disabled="busy === d.id" @click="saveSettings(d)">
              {{ $t('offers.owner.saveSettings') }}
            </ion-button>
          </template>
          <p v-else class="oo-ro">{{ $t('offers.owner.settingsReadonly') }}</p>
        </template>
      </div>

      <!-- Live preview, same card customers see -->
      <p class="oo-label">{{ $t('offers.owner.preview') }}</p>
      <div class="oo-preview" :class="{ paused: !d.is_active }">
        <img v-if="d.image_url" :src="d.image_url" :alt="d.title" class="pv-image" />
        <div class="pv-row">
          <ion-icon :icon="pricetagOutline" class="pv-icon" />
          <div>
            <div class="pv-title">
              <strong>{{ d.title || '…' }}</strong>
              <span v-if="d.discount_label" class="pv-badge">{{ d.discount_label }}</span>
            </div>
            <p v-if="d.description" class="pv-desc">{{ d.description }}</p>
          </div>
        </div>
        <p v-if="!d.is_active" class="pv-paused">{{ $t('offers.owner.paused') }}</p>
      </div>

      <ion-button color="carrot" expand="block" :disabled="busy === d.id || !d.title.trim() || !isDirty(d)" @click="save(d)">
        <ion-spinner v-if="busy === d.id" name="crescent" />
        <template v-else>{{ $t('common.save') }}</template>
      </ion-button>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="oo-file" @change="onImageSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonButton, IonIcon, IonInput, IonSpinner, IonTextarea, IonToggle, toastController } from '@ionic/vue'
import { lockClosedOutline, pricetagOutline, chevronDown, chevronUp, imageOutline } from 'ionicons/icons'
import { isAdmin } from '@/composables/userProfile'
import { supabase } from '@/plugins/supabaseClient'
import { useImageResizer } from '@/composables/useImageResizer'
import { OfferService, OfferError, type OwnerOffer } from '@/services/OfferService'

type Draft = OwnerOffer & { description: string; discount_label: string }

const props = defineProps<{ offers: OwnerOffer[] }>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const { t } = useI18n()

const drafts = ref<Draft[]>([])
const { resizeImage } = useImageResizer()

// Picture upload: pick a file, shrink it, store it, and keep the public URL on
// the draft. It only goes live when the owner taps Save.
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref<string | null>(null)
let pickingFor: Draft | null = null
function pickImage(d: Draft) {
  pickingFor = d
  fileInput.value?.click()
}
async function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const d = pickingFor
  pickingFor = null
  if (!file || !d) return
  uploading.value = d.id
  try {
    const resized = await resizeImage(file, 1200, 0.8)
    const path = `offers/${d.location_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const { error } = await supabase.storage.from('location-image').upload(path, resized, { upsert: false, contentType: 'image/jpeg' })
    if (error) throw error
    d.image_url = supabase.storage.from('location-image').getPublicUrl(path).data.publicUrl
  } catch (err) {
    console.error('[offer image]', err)
    await toast(t('offers.owner.imageError'))
  } finally {
    uploading.value = null
  }
}

// Admin-editable settings per offer (dates, code validity, stock, follow).
type SettingsDraft = { validFrom: string; validUntil: string; ttl: string | number; maxCodes: string | number; requireFollow: boolean; ig: string; tt: string; fb: string }
const sd = ref<Record<string, SettingsDraft>>({})
const openSettings = ref<string | null>(null)
// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function settingsSummary(d: OwnerOffer) {
  const bits = [t('offers.owner.validDays', { n: d.code_ttl_days })]
  bits.push(d.max_codes ? t('offers.owner.stock', { n: d.max_codes }) : t('offers.owner.noStockLimit'))
  if (d.valid_until) bits.push(t('offers.endsOn', { date: new Date(d.valid_until).toLocaleDateString() }))
  return bits.join(' · ')
}
function toggleSettings(id: string) { openSettings.value = openSettings.value === id ? null : id }
const busy = ref<string | null>(null)

watch(() => props.offers, list => {
  drafts.value = list.map(o => ({ ...o, description: o.description ?? '', discount_label: o.discount_label ?? '' }))
  sd.value = Object.fromEntries(list.map(o => [o.id, {
    validFrom: toLocalInput(o.valid_from), validUntil: toLocalInput(o.valid_until),
    ttl: o.code_ttl_days, maxCodes: o.max_codes ?? '', requireFollow: o.require_follow,
    ig: o.follow_instagram ?? '', tt: o.follow_tiktok ?? '', fb: o.follow_facebook ?? '',
  }]))
}, { immediate: true })

function isDirty(d: Draft) {
  const o = props.offers.find(x => x.id === d.id)
  if (!o) return false
  return o.title !== d.title.trim()
    || (o.description ?? '') !== d.description.trim()
    || (o.discount_label ?? '') !== d.discount_label.trim()
    || o.is_active !== d.is_active
    || (o.image_url ?? null) !== (d.image_url ?? null)
}

async function toast(message: string) {
  const el = await toastController.create({ message, duration: 2500, position: 'bottom' })
  await el.present()
}

async function saveSettings(d: Draft) {
  const v = sd.value[d.id]
  if (!v) return
  busy.value = d.id
  try {
    await OfferService.adminUpdateSettings(d.id, {
      validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
      validUntil: v.validUntil ? new Date(v.validUntil).toISOString() : null,
      codeTtlDays: Number(v.ttl) > 0 ? Math.round(Number(v.ttl)) : 30,
      maxCodes: Number(v.maxCodes) > 0 ? Math.round(Number(v.maxCodes)) : null,
      requireFollow: v.requireFollow,
      followInstagram: v.ig, followTiktok: v.tt, followFacebook: v.fb,
    }, d.location_id)
    await toast(t('offers.owner.settingsSaved'))
    emit('saved')
  } catch (e) {
    const code = e instanceof OfferError ? e.code : 'unknown'
    await toast(
      code === 'invalid_dates' ? t('offers.create.errDates')
      : code === 'invalid_ttl' || code === 'invalid_max_codes' ? t('offers.create.errNumbers')
      : code === 'invalid_follow' ? t('offers.create.errFollow')
      : t('offers.owner.errGeneric')
    )
  } finally {
    busy.value = null
  }
}

async function save(d: Draft) {
  busy.value = d.id
  try {
    await OfferService.updateMyOffer(d.id, {
      title: d.title, description: d.description, discount_label: d.discount_label, is_active: d.is_active,
      image_url: d.image_url ?? null,
    }, d.location_id)
    await toast(t('offers.owner.saved'))
    emit('saved')
  } catch (e) {
    const code = e instanceof OfferError ? e.code : 'unknown'
    await toast(
      code === 'invalid_title' ? t('offers.owner.errTitle')
      : code === 'not_allowed' ? t('offers.owner.errNotAllowed')
      : t('offers.owner.errGeneric')
    )
  } finally {
    busy.value = null
  }
}
</script>

<style scoped>
.owner-offers { display: flex; flex-direction: column; gap: 16px; }
.oo-note { margin: 0; font-size: 13px; opacity: 0.75; }
.oo-card { border: 1px solid var(--ion-color-carrot, #ff7a00); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.oo-head { display: flex; align-items: center; gap: 10px; }
.oo-prefix { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; letter-spacing: 1px; }
.oo-stats { flex: 1; font-size: 12px; opacity: 0.7; }
.oo-label { font-size: 12px; font-weight: 600; margin: 8px 0 0; opacity: 0.8; }
.oo-input { --padding-start: 10px; --padding-end: 10px; border: 1px solid var(--ion-color-medium, #999); border-radius: 10px; }
.oo-settings { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,0.3); display: flex; flex-direction: column; gap: 6px; }
.oo-settings-head { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.oo-summary { flex: 1; font-size: 11px; opacity: 0.7; }
.oo-native { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 10px; border: 1px solid var(--ion-color-medium, #999); background: transparent; color: inherit; font-family: inherit; font-size: 14px; }
.oo-toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; font-size: 14px; }
.oo-ro { margin: 0; font-size: 12px; opacity: 0.7; }
.oo-fixed { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.7; margin: 8px 0 0; }
.oo-preview { border: 1px solid var(--ion-color-carrot, #ff7a00); border-radius: 14px; padding: 12px; background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 8%, transparent); }
.oo-preview.paused { opacity: 0.55; }
.oo-file { display: none; }
.oo-image { display: flex; flex-direction: column; gap: 6px; }
.oo-image-thumb { width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(128,128,128,0.3); }
.oo-image-actions { display: flex; align-items: center; gap: 4px; }
.oo-image-hint { margin: 0; font-size: 11px; opacity: 0.65; }
.pv-image { display: block; width: calc(100% + 24px); margin: -12px -12px 10px; max-height: 160px; object-fit: cover; border-radius: 13px 13px 0 0; }
.pv-row { display: flex; gap: 10px; align-items: flex-start; }
.pv-icon { font-size: 22px; color: var(--ion-color-carrot, #ff7a00); flex-shrink: 0; margin-top: 2px; }
.pv-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-badge { background: var(--ion-color-carrot, #ff7a00); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.pv-desc { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.pv-paused { margin: 8px 0 0; font-size: 12px; color: var(--ion-color-danger, #d33); }
</style>
