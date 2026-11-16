<template>
  <div class="offer-create">
    <button v-if="!open" type="button" class="oc-open" @click="open = true">
      <ion-icon :icon="addCircleOutline" />
      {{ $t('offers.create.open') }}
    </button>

    <div v-else class="oc-card">
      <div class="oc-head">
        <strong>{{ $t('offers.create.title') }}</strong>
        <ion-icon :icon="closeOutline" class="oc-close" @click="open = false" />
      </div>
      <p class="oc-note">{{ $t('offers.create.adminOnly') }}</p>

      <!-- Fixed Halal Formosa rule: not a per-code setting -->
      <div class="oc-rule">
        <ion-icon :icon="informationCircleOutline" />
        <div>
          <strong>{{ $t('offers.create.ruleTitle') }}</strong>
          <p>{{ $t('offers.create.ruleBody') }}</p>
        </div>
      </div>

      <label class="oc-label">{{ $t('offers.create.prefix') }}</label>
      <ion-input v-model="f.prefix" :maxlength="12" class="oc-input oc-upper" :placeholder="$t('offers.create.prefixHint')" />

      <label class="oc-label">{{ $t('offers.create.kind') }}</label>
      <ion-select v-model="f.kind" interface="popover" class="oc-input">
        <ion-select-option value="menu">{{ $t('offers.create.kindMenu') }}</ion-select-option>
        <ion-select-option value="meat">{{ $t('offers.create.kindMeat') }}</ion-select-option>
        <ion-select-option value="other">{{ $t('offers.create.kindOther') }}</ion-select-option>
      </ion-select>

      <label class="oc-label">{{ $t('offers.owner.title') }}</label>
      <ion-input v-model="f.title" :maxlength="80" class="oc-input" />

      <label class="oc-label">{{ $t('offers.owner.badge') }}</label>
      <ion-input v-model="f.label" :maxlength="24" class="oc-input" :placeholder="$t('offers.owner.badgeHint')" />

      <label class="oc-label">{{ $t('offers.owner.description') }}</label>
      <ion-textarea v-model="f.description" :maxlength="300" :rows="3" class="oc-input" />

      <div class="oc-toggle">
        <span>{{ $t('offers.create.active') }}</span>
        <ion-toggle :checked="f.active" @ionChange="f.active = $event.detail.checked" />
      </div>

      <div class="oc-collapse" @click="showSettings = !showSettings">
        <span>{{ $t('offers.create.limits') }}</span>
        <ion-icon :icon="showSettings ? chevronUp : chevronDown" />
      </div>
      <template v-if="showSettings">
        <label class="oc-label">{{ $t('offers.create.validFrom') }}</label>
        <input v-model="f.validFrom" type="datetime-local" class="oc-native" />
        <label class="oc-label">{{ $t('offers.create.validUntil') }}</label>
        <input v-model="f.validUntil" type="datetime-local" class="oc-native" />
        <label class="oc-label">{{ $t('offers.create.ttl') }}</label>
        <ion-input v-model="f.ttl" type="number" inputmode="numeric" class="oc-input" placeholder="30" />
        <label class="oc-label">{{ $t('offers.create.maxCodes') }}</label>
        <ion-input v-model="f.maxCodes" type="number" inputmode="numeric" class="oc-input" :placeholder="$t('offers.create.maxCodesHint')" />
      </template>

      <div class="oc-collapse" @click="showFollow = !showFollow">
        <span>{{ $t('offers.create.followSettings') }}</span>
        <ion-icon :icon="showFollow ? chevronUp : chevronDown" />
      </div>
      <template v-if="showFollow">
        <div class="oc-toggle">
          <span>{{ $t('offers.create.requireFollow') }}</span>
          <ion-toggle :checked="f.requireFollow" @ionChange="f.requireFollow = $event.detail.checked" />
        </div>
        <p class="oc-hint">{{ $t('offers.create.followHint') }}</p>
        <label class="oc-label">{{ $t('offers.create.followInstagram') }}</label>
        <ion-input v-model="f.ig" class="oc-input" placeholder="handle" />
        <label class="oc-label">{{ $t('offers.create.followTiktok') }}</label>
        <ion-input v-model="f.tt" class="oc-input" placeholder="handle" />
        <label class="oc-label">{{ $t('offers.create.followFacebook') }}</label>
        <ion-input v-model="f.fb" class="oc-input" placeholder="https://facebook.com/…" />
      </template>

      <!-- Live preview: the card customers will see on the place page -->
      <p class="oc-label">{{ $t('offers.owner.preview') }}</p>
      <div class="oc-preview" :class="{ paused: !f.active }">
        <div class="pv-row">
          <ion-icon :icon="pricetagOutline" class="pv-icon" />
          <div>
            <div class="pv-title">
              <strong>{{ f.title.trim() || $t('offers.create.previewTitle') }}</strong>
              <span v-if="f.label.trim()" class="pv-badge">{{ f.label.trim() }}</span>
            </div>
            <p v-if="f.description.trim()" class="pv-desc">{{ f.description.trim() }}</p>
            <span class="pv-pro">
              <ion-icon :icon="sparkles" />
              {{ $t('offers.freeThenPro', { n: 1 }) }}
            </span>
          </div>
        </div>
        <p v-if="f.requireFollow" class="pv-follow">{{ $t('offers.create.previewFollow') }}</p>
        <div class="pv-btn">{{ $t('offers.showCode') }}</div>
        <p v-if="!f.active" class="pv-paused">{{ $t('offers.owner.paused') }}</p>
      </div>

      <p class="oc-label">{{ $t('offers.create.previewAfter') }}</p>
      <div class="oc-preview" :class="{ paused: !f.active }">
        <div class="pv-row">
          <ion-icon :icon="pricetagOutline" class="pv-icon" />
          <div class="pv-title">
            <strong>{{ f.title.trim() || $t('offers.create.previewTitle') }}</strong>
            <span v-if="f.label.trim()" class="pv-badge">{{ f.label.trim() }}</span>
          </div>
        </div>
        <div class="pv-code-box">
          <img v-if="sampleQr" :src="sampleQr" alt="" class="pv-qr" />
          <div class="pv-code">{{ sampleCode }}</div>
          <p class="pv-code-hint">
            {{ $t('offers.showAtCounter') }}<br />
            <template v-if="f.requireFollow">{{ $t('offers.followStaffNote') }}<br /></template>
            {{ $t('offers.validUntil', { date: sampleExpiry }) }}
          </p>
          <p class="pv-sample">{{ $t('offers.create.sampleNote') }}</p>
        </div>
      </div>

      <ion-button color="carrot" expand="block" :disabled="busy || !canSubmit" @click="submit">
        <ion-spinner v-if="busy" name="crescent" />
        <template v-else>{{ $t('offers.create.submit') }}</template>
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import {
  IonButton, IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonToggle, toastController,
} from '@ionic/vue'
import { addCircleOutline, closeOutline, chevronDown, chevronUp, pricetagOutline, sparkles, informationCircleOutline } from 'ionicons/icons'
import { OfferService, OfferError } from '@/services/OfferService'

const props = defineProps<{ locationId: number }>()
const emit = defineEmits<{ (e: 'created'): void }>()
const { t, locale } = useI18n()

const open = ref(false)
const showFollow = ref(false)
const showSettings = ref(false)
const busy = ref(false)

const blank = () => ({
  prefix: '', kind: 'menu' as 'menu' | 'meat' | 'other', title: '', label: '', description: '',
  active: true, requireFollow: true, ig: '', tt: '', fb: '',
  validFrom: '', validUntil: '', ttl: '' as string | number, maxCodes: '' as string | number,
})
const f = reactive(blank())

// What a real code will look like: PREFIX-XXXX-XXXX (a sample, never a real code).
const sampleCode = computed(() => `${f.prefix.trim().toUpperCase() || 'CODE'}-7K4Q-X9MP`)
const sampleQr = ref('')
watch(sampleCode, async code => {
  try { sampleQr.value = await QRCode.toDataURL(code, { margin: 1, width: 160 }) } catch { sampleQr.value = '' }
}, { immediate: true })
// Codes last 30 days by default.
const sampleExpiry = computed(() =>
  new Date(Date.now() + (Number(f.ttl) > 0 ? Number(f.ttl) : 30) * 86400000).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' }))

const canSubmit = computed(() => /^[A-Za-z0-9]{2,12}$/.test(f.prefix.trim()) && f.title.trim().length > 0)

async function toast(message: string) {
  const el = await toastController.create({ message, duration: 3000, position: 'bottom' })
  await el.present()
}

async function submit() {
  busy.value = true
  try {
    await OfferService.adminCreateOffer({
      locationId: props.locationId,
      codePrefix: f.prefix,
      kind: f.kind,
      title: f.title,
      description: f.description,
      discountLabel: f.label,
      freeUses: 1, // fixed Halal Formosa rule: free members once, Pro unlimited
      isActive: f.active,
      requireFollow: f.requireFollow,
      followInstagram: f.ig,
      followTiktok: f.tt,
      followFacebook: f.fb,
      validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : null,
      validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : null,
      codeTtlDays: Number(f.ttl) > 0 ? Math.round(Number(f.ttl)) : 30,
      maxCodes: Number(f.maxCodes) > 0 ? Math.round(Number(f.maxCodes)) : null,
    })
    await toast(t('offers.create.created'))
    Object.assign(f, blank())
    open.value = false
    showFollow.value = false
    showSettings.value = false
    emit('created')
  } catch (e) {
    const code = e instanceof OfferError ? e.code : 'unknown'
    await toast(
      code === 'prefix_taken' ? t('offers.create.errPrefixTaken')
      : code === 'invalid_prefix' ? t('offers.create.errPrefix')
      : code === 'invalid_title' ? t('offers.owner.errTitle')
      : code === 'invalid_follow' ? t('offers.create.errFollow')
      : code === 'invalid_dates' ? t('offers.create.errDates')
      : code === 'invalid_ttl' || code === 'invalid_max_codes' ? t('offers.create.errNumbers')
      : code === 'not_allowed' ? t('offers.owner.errNotAllowed')
      : t('offers.owner.errGeneric')
    )
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.offer-create { margin-top: 16px; }
.oc-open { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 14px; border: 1px dashed var(--ion-color-carrot, #ff7a00); background: transparent; color: var(--ion-color-carrot, #ff7a00); font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit; }
.oc-open ion-icon { font-size: 20px; }
.oc-card { border: 1px solid var(--ion-color-carrot, #ff7a00); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.oc-head { display: flex; align-items: center; justify-content: space-between; }
.oc-close { font-size: 22px; cursor: pointer; opacity: 0.7; }
.oc-note { margin: 0; font-size: 12px; opacity: 0.7; }
.oc-rule { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0 4px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 10%, transparent); font-size: 12px; }
.oc-rule ion-icon { font-size: 20px; flex-shrink: 0; color: var(--ion-color-carrot, #ff7a00); margin-top: 1px; }
.oc-rule p { margin: 2px 0 0; opacity: 0.85; }
.oc-label { font-size: 12px; font-weight: 600; margin: 8px 0 0; opacity: 0.8; }
.oc-input { --padding-start: 10px; --padding-end: 10px; border: 1px solid var(--ion-color-medium, #999); border-radius: 10px; }
.oc-upper :deep(input) { text-transform: uppercase; }
.oc-toggle { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; font-size: 14px; }
.oc-hint { margin: 2px 0 0; font-size: 12px; opacity: 0.7; }
.oc-preview { border: 1px solid var(--ion-color-carrot, #ff7a00); border-radius: 14px; padding: 12px; background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 8%, transparent); }
.oc-preview.paused { opacity: 0.55; }
.pv-row { display: flex; gap: 10px; align-items: flex-start; }
.pv-icon { font-size: 22px; color: var(--ion-color-carrot, #ff7a00); flex-shrink: 0; margin-top: 2px; }
.pv-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-badge { background: var(--ion-color-carrot, #ff7a00); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.pv-desc { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.pv-pro { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; margin-top: 6px; opacity: 0.85; }
.pv-follow { margin: 10px 0 0; font-size: 12px; opacity: 0.8; }
.pv-btn { margin-top: 10px; text-align: center; padding: 10px; border-radius: 10px; background: var(--ion-color-carrot, #ff7a00); color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.pv-paused { margin: 8px 0 0; font-size: 12px; color: var(--ion-color-danger, #d33); }
.pv-code-box { text-align: center; padding: 10px 0 2px; }
.pv-qr { width: 140px; height: 140px; border-radius: 12px; background: #fff; padding: 6px; }
.pv-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22px; font-weight: 800; letter-spacing: 2px; margin: 8px 0; }
.pv-code-hint { font-size: 12px; opacity: 0.75; margin: 0; }
.pv-sample { margin: 8px 0 0; font-size: 11px; opacity: 0.55; font-style: italic; }
.oc-native { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 10px; border: 1px solid var(--ion-color-medium, #999); background: transparent; color: inherit; font-family: inherit; font-size: 14px; }
.oc-collapse { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(128,128,128,0.3); font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
