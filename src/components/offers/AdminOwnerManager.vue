<template>
  <div class="owner-mgr">
    <div class="om-head" @click="open = !open">
      <strong>{{ $t('business.owners.title') }}</strong>
      <span class="om-count">{{ rows.length ? $t('business.owners.count', { n: rows.length }) : $t('business.owners.none') }}</span>
      <ion-icon :icon="open ? chevronUp : chevronDown" />
    </div>

    <template v-if="open">
      <p class="om-note">{{ $t('business.owners.note') }}</p>

      <ul class="om-list">
        <li v-for="r in rows" :key="r.kind + (r.user_id || r.email)">
          <div class="om-main">
            <span class="om-email">{{ r.email || r.user_id }}</span>
            <span class="om-meta">
              {{ r.display_name ? r.display_name + ' · ' : '' }}{{ r.role }}
              <span v-if="r.kind === 'invite'" class="om-pill">{{ $t('business.owners.invited') }}</span>
            </span>
          </div>
          <button v-if="r.kind === 'invite' && r.email" type="button" class="om-x" :aria-label="$t('common.delete')" @click="cancel(r.email)">
            <ion-icon :icon="closeOutline" />
          </button>
        </li>
      </ul>

      <div class="om-form">
        <ion-input v-model="email" type="email" inputmode="email" autocomplete="off" class="om-input" :placeholder="$t('business.owners.emailPlaceholder')" />
        <ion-select v-model="role" interface="popover" class="om-input om-role">
          <ion-select-option value="owner">{{ $t('business.owners.roleOwner') }}</ion-select-option>
          <ion-select-option value="manager">{{ $t('business.owners.roleManager') }}</ion-select-option>
        </ion-select>
        <ion-button color="carrot" size="small" :disabled="busy || !validEmail" @click="add">
          <ion-spinner v-if="busy" name="crescent" />
          <template v-else>{{ $t('business.owners.add') }}</template>
        </ion-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonButton, IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner, toastController } from '@ionic/vue'
import { chevronDown, chevronUp, closeOutline } from 'ionicons/icons'
import { ClaimService, type LocationOwnerRow } from '@/services/ClaimService'

const props = defineProps<{ locationId: number }>()
const { t } = useI18n()

const open = ref(false)
const rows = ref<LocationOwnerRow[]>([])
const email = ref('')
const role = ref<'owner' | 'manager'>('owner')
const busy = ref(false)

const validEmail = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()))

async function load() {
  try { rows.value = await ClaimService.adminListLocationOwners(props.locationId) } catch { rows.value = [] }
}
watch(() => props.locationId, load, { immediate: true })

async function toast(message: string) {
  const el = await toastController.create({ message, duration: 3500, position: 'bottom' })
  await el.present()
}

async function add() {
  busy.value = true
  try {
    const result = await ClaimService.adminAddLocationOwner(props.locationId, email.value.trim(), role.value)
    await toast(result === 'added' ? t('business.owners.added') : t('business.owners.invitedToast'))
    email.value = ''
    await load()
  } catch (e: any) {
    const m = String(e?.message || '')
    await toast(m.includes('invalid_email') ? t('business.owners.errEmail') : t('business.owners.errGeneric'))
  } finally {
    busy.value = false
  }
}

async function cancel(addr: string) {
  try {
    await ClaimService.adminCancelOwnerInvite(props.locationId, addr)
    await load()
  } catch { await toast(t('business.owners.errGeneric')) }
}
</script>

<style scoped>
.owner-mgr { border: 1px solid rgba(128,128,128,0.35); border-radius: 14px; padding: 12px; margin: 0 0 12px; }
.om-head { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
.om-count { flex: 1; font-size: 12px; opacity: 0.7; }
.om-note { margin: 8px 0; font-size: 12px; opacity: 0.75; }
.om-list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.om-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.om-main { display: flex; flex-direction: column; min-width: 0; }
.om-email { font-size: 13px; overflow-wrap: anywhere; }
.om-meta { font-size: 11px; opacity: 0.7; text-transform: capitalize; }
.om-pill { margin-left: 6px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--ion-color-carrot, #ff7a00); color: var(--ion-color-carrot, #ff7a00); text-transform: none; }
.om-x { background: none; border: 0; color: inherit; opacity: 0.7; cursor: pointer; font-size: 18px; padding: 4px; }
.om-form { display: flex; flex-direction: column; gap: 6px; }
.om-input { --padding-start: 10px; --padding-end: 10px; border: 1px solid var(--ion-color-medium, #999); border-radius: 10px; }
</style>
