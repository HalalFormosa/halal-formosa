<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('admin.editRequests.title')" show-back back-route="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="admin-container">
        <div v-if="loading" class="ion-text-center ion-padding">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <div v-if="requests.length === 0" class="empty-state fade-in">
            <ion-icon :icon="checkmarkCircleOutline" size="large" color="success" />
            <h3>{{ $t('admin.editRequests.noPending') }}</h3>
          </div>

          <div v-else class="applications-list">
            <ion-card v-for="req in requests" :key="req.id" class="application-card fade-in">
              <ion-card-header>
                <div class="card-title-row">
                  <ion-card-title>{{ req.locations?.name || `#${req.location_id}` }}</ion-card-title>
                  <ion-badge color="warning">{{ $t('admin.editRequests.pending') }}</ion-badge>
                </div>
                <ion-card-subtitle v-if="req.locations?.address">{{ req.locations.address }}</ion-card-subtitle>
                <p class="submitted-at">{{ $t('admin.editRequests.submitted', { date: formatDate(req.created_at) }) }}</p>
              </ion-card-header>

              <ion-card-content>
                <div class="diff-list">
                  <div v-for="d in diffRows(req)" :key="d.field" class="diff-row">
                    <label>{{ d.label }}</label>
                    <div class="diff-values">
                      <span class="old">{{ d.current }}</span>
                      <ion-icon :icon="arrowForwardOutline" class="diff-arrow" />
                      <span class="new">{{ d.proposed }}</span>
                    </div>
                  </div>
                </div>

                <div class="action-buttons ion-margin-top">
                  <ion-button fill="outline" color="danger" class="action-btn" @click="handleReject(req)">
                    {{ $t('admin.editRequests.reject') }}
                  </ion-button>
                  <ion-button color="success" class="action-btn" @click="handleApprove(req)">
                    {{ $t('admin.editRequests.approve') }}
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonContent, IonSpinner, IonCard, IonCardHeader,
  IonCardTitle, IonCardSubtitle, IonCardContent, IonBadge, IonButton, IonIcon,
  alertController, toastController
} from '@ionic/vue'
import { checkmarkCircleOutline, arrowForwardOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { ClaimService } from '@/services/ClaimService'
import { supabase } from '@/plugins/supabaseClient'
import type { LocationEditRequest } from '@/types/Business'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const loading = ref(true)
const requests = ref<LocationEditRequest[]>([])
// id -> type name, for rendering high-risk type_id changes readably
const typeNames = ref<Record<number, string>>({})

// The only fields the review_location_edit_request RPC applies. Order = display order.
const FIELD_ORDER = ['name', 'address', 'type_id', 'halal_status', 'lat', 'lng'] as const

async function fetchRequests() {
  loading.value = true
  try {
    const [rows] = await Promise.all([
      ClaimService.getPendingEditRequests(),
      loadTypeNames(),
    ])
    requests.value = rows
  } catch {
    showToast(t('common.error'), 'danger')
  } finally {
    loading.value = false
  }
}

async function loadTypeNames() {
  const { data } = await supabase.from('location_types').select('id, name')
  const map: Record<number, string> = {}
  for (const row of data ?? []) map[row.id] = row.name
  typeNames.value = map
}

interface DiffRow { field: string; label: string; current: string; proposed: string }

function diffRows(req: LocationEditRequest): DiffRow[] {
  const changes = req.changes || {}
  const loc = req.locations
  const rows: DiffRow[] = []
  for (const field of FIELD_ORDER) {
    if (!(field in changes)) continue
    rows.push({
      field,
      label: t(`admin.editRequests.fields.${field}`),
      current: formatValue(field, currentValue(field, loc)),
      proposed: formatValue(field, (changes as Record<string, unknown>)[field]),
    })
  }
  // Surface any other queued keys we don't have a dedicated label for.
  for (const key of Object.keys(changes)) {
    if ((FIELD_ORDER as readonly string[]).includes(key)) continue
    rows.push({
      field: key,
      label: key,
      current: '—',
      proposed: formatValue(key, (changes as Record<string, unknown>)[key]),
    })
  }
  return rows
}

function currentValue(field: string, loc: LocationEditRequest['locations']): unknown {
  if (!loc) return null
  return (loc as unknown as Record<string, unknown>)[field]
}

function formatValue(field: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (field === 'type_id') {
    const id = Number(val)
    return typeNames.value[id] || `#${id}`
  }
  if (field === 'halal_status') {
    return t(`admin.editRequests.halalStatus.${val}`, String(val))
  }
  return String(val)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function handleApprove(req: LocationEditRequest) {
  const alert = await alertController.create({
    header: t('admin.editRequests.confirmApprove'),
    message: t('admin.editRequests.confirmApproveMsg', { name: req.locations?.name || '' }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('admin.editRequests.approve'),
        handler: async () => {
          try {
            await ClaimService.approveEditRequest(req.id)
            showToast(t('admin.editRequests.approveSuccess'), 'success')
            fetchRequests()
          } catch {
            showToast(t('common.error'), 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function handleReject(req: LocationEditRequest) {
  const alert = await alertController.create({
    header: t('admin.editRequests.confirmReject'),
    message: t('admin.editRequests.confirmRejectMsg'),
    inputs: [{ name: 'reason', type: 'textarea', placeholder: t('admin.editRequests.reasonPlaceholder') }],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('admin.editRequests.reject'),
        handler: async (data) => {
          if (!data.reason) { showToast(t('admin.editRequests.reasonRequired'), 'warning'); return false }
          try {
            await ClaimService.rejectEditRequest(req.id, data.reason)
            showToast(t('admin.editRequests.rejectSuccess'), 'medium')
            fetchRequests()
          } catch {
            showToast(t('common.error'), 'danger')
          }
        }
      }
    ]
  })
  await alert.present()
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({ message, duration: 2000, color, position: 'bottom' })
  await toast.present()
}

onMounted(fetchRequests)
</script>

<style scoped>
.admin-container { max-width: 800px; margin: 0 auto; }
.application-card { border-radius: 20px; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.card-title-row { display: flex; justify-content: space-between; align-items: flex-start; }
.submitted-at { margin: 6px 0 0; font-size: .75rem; color: var(--ion-color-medium); }
.diff-list { display: flex; flex-direction: column; gap: 14px; }
.diff-row label { display: block; font-size: .7rem; color: var(--ion-color-medium); text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
.diff-values { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.diff-values .old { color: var(--ion-color-medium); text-decoration: line-through; }
.diff-values .new { color: var(--ion-color-dark); font-weight: 700; }
.diff-arrow { color: var(--ion-color-carrot); font-size: 1rem; flex-shrink: 0; }
.action-buttons { display: flex; gap: 12px; }
.action-btn { flex: 1; --border-radius: 12px; font-weight: 700; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-state h3 { color: var(--ion-color-medium); font-weight: 600; margin-top: 16px; }
.fade-in { animation: fadeIn .4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
