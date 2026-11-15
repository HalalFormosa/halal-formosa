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

      <p class="oo-fixed">
        <ion-icon :icon="lockClosedOutline" />
        {{ d.free_uses > 0 ? $t('offers.freeThenPro', { n: d.free_uses }) : $t('offers.proPerk') }}
        · {{ $t('offers.owner.fixed') }}
      </p>

      <!-- Live preview, same card customers see -->
      <p class="oo-label">{{ $t('offers.owner.preview') }}</p>
      <div class="oo-preview" :class="{ paused: !d.is_active }">
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonButton, IonIcon, IonInput, IonSpinner, IonTextarea, IonToggle, toastController } from '@ionic/vue'
import { lockClosedOutline, pricetagOutline } from 'ionicons/icons'
import { OfferService, OfferError, type OwnerOffer } from '@/services/OfferService'

type Draft = OwnerOffer & { description: string; discount_label: string }

const props = defineProps<{ offers: OwnerOffer[] }>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const { t } = useI18n()

const drafts = ref<Draft[]>([])
const busy = ref<string | null>(null)

watch(() => props.offers, list => {
  drafts.value = list.map(o => ({ ...o, description: o.description ?? '', discount_label: o.discount_label ?? '' }))
}, { immediate: true })

function isDirty(d: Draft) {
  const o = props.offers.find(x => x.id === d.id)
  if (!o) return false
  return o.title !== d.title.trim()
    || (o.description ?? '') !== d.description.trim()
    || (o.discount_label ?? '') !== d.discount_label.trim()
    || o.is_active !== d.is_active
}

async function toast(message: string) {
  const el = await toastController.create({ message, duration: 2500, position: 'bottom' })
  await el.present()
}

async function save(d: Draft) {
  busy.value = d.id
  try {
    await OfferService.updateMyOffer(d.id, {
      title: d.title, description: d.description, discount_label: d.discount_label, is_active: d.is_active,
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
.oo-fixed { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.7; margin: 8px 0 0; }
.oo-preview { border: 1px solid var(--ion-color-carrot, #ff7a00); border-radius: 14px; padding: 12px; background: color-mix(in srgb, var(--ion-color-carrot, #ff7a00) 8%, transparent); }
.oo-preview.paused { opacity: 0.55; }
.pv-row { display: flex; gap: 10px; align-items: flex-start; }
.pv-icon { font-size: 22px; color: var(--ion-color-carrot, #ff7a00); flex-shrink: 0; margin-top: 2px; }
.pv-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-badge { background: var(--ion-color-carrot, #ff7a00); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.pv-desc { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.pv-paused { margin: 8px 0 0; font-size: 12px; color: var(--ion-color-danger, #d33); }
</style>
