<template>
  <ion-page>
    <ion-header>
      <app-header
          title="Merge Duplicate Products"
          :icon="copyOutline"
          show-back
          backRoute="/profile"
      />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner name="dots" />
        <p>Scanning the catalog for products with the same name…</p>
      </div>

      <template v-else>
        <p v-if="!groups.length" class="ion-text-center empty-state">
          🎉 No duplicate-name products found right now.
          <span v-if="dismissedCount" class="dismissed-note">({{ dismissedCount }} previously marked "keep separate")</span>
        </p>

        <template v-else>
          <p class="summary-line">
            {{ groups.length }} group{{ groups.length === 1 ? '' : 's' }} found,
            {{ totalListings }} listings involved. Matched on exact name (case/whitespace-insensitive) —
            always check the photos before merging, a shared name doesn't always mean the same product.
            <span v-if="dismissedCount">{{ dismissedCount }} other group{{ dismissedCount === 1 ? '' : 's' }} previously marked "keep separate" {{ dismissedCount === 1 ? 'is' : 'are' }} hidden.</span>
          </p>

          <ion-card v-for="group in groups" :key="group.name" class="group-card">
            <ion-card-header>
              <div class="group-header-row">
                <ion-card-title>{{ group.name }}</ion-card-title>
                <div class="group-badges">
                  <ion-badge v-if="group.statusConflict" color="danger">Status conflict</ion-badge>
                  <ion-badge v-if="group.categoryConflict" color="warning">Category conflict</ion-badge>
                </div>
              </div>
            </ion-card-header>

            <ion-card-content>
              <ion-radio-group v-model="survivorChoice[group.name]">
                <div v-for="listing in group.listings" :key="listing.id" class="listing-row">
                  <div
                      class="listing-clickable"
                      role="button"
                      tabindex="0"
                      @click="goToProduct(listing.barcode)"
                      @keydown.enter="goToProduct(listing.barcode)"
                  >
                    <img
                        :src="listing.photo_front_url || 'https://placehold.co/96x96'"
                        alt=""
                        class="listing-photo"
                    />
                    <div class="listing-info">
                      <div class="listing-barcode">{{ listing.barcode }}</div>
                      <div class="listing-meta">
                        <ion-chip :class="statusToChipClass(listing.status)" class="listing-chip">{{ listing.status }}</ion-chip>
                        <span class="listing-category">{{ listing.category_name || '—' }}</span>
                      </div>
                      <div class="listing-sub">{{ listing.view_count }} views · added {{ fromNowToTaipei(listing.created_at) }}</div>
                    </div>
                    <ion-icon :icon="chevronForwardOutline" class="listing-open-icon" />
                  </div>
                  <ion-radio :value="listing.id" label-placement="start">Keep this one</ion-radio>
                </div>
              </ion-radio-group>

              <ion-item v-if="group.statusConflict" class="resolve-item">
                <ion-select
                    label="Final status"
                    label-placement="stacked"
                    v-model="resolvedStatus[group.name]"
                >
                  <ion-select-option v-for="s in uniqueStatuses(group)" :key="s" :value="s">{{ s }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item v-if="group.categoryConflict" class="resolve-item">
                <ion-select
                    label="Final category"
                    label-placement="stacked"
                    v-model="resolvedCategoryId[group.name]"
                >
                  <ion-select-option
                      v-for="c in uniqueCategories(group)"
                      :key="c.id ?? 'none'"
                      :value="c.id"
                  >{{ c.name || 'Uncategorized' }}</ion-select-option>
                </ion-select>
              </ion-item>

              <div class="action-row">
                <ion-button
                    expand="block"
                    color="carrot"
                    class="merge-btn"
                    :disabled="merging[group.name] || dismissing[group.name]"
                    @click="mergeGroup(group)"
                >
                  <ion-spinner v-if="merging[group.name]" name="dots" />
                  <template v-else>Merge into selected</template>
                </ion-button>

                <ion-button
                    expand="block"
                    fill="outline"
                    color="medium"
                    class="dismiss-btn"
                    :disabled="merging[group.name] || dismissing[group.name]"
                    @click="dismissGroup(group)"
                >
                  <ion-spinner v-if="dismissing[group.name]" name="dots" />
                  <template v-else>Not a duplicate — keep separate</template>
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </template>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonBadge, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonItem, IonButton,
  IonSpinner, IonChip, IonIcon, alertController, toastController
} from '@ionic/vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { copyOutline, chevronForwardOutline } from 'ionicons/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import { supabase } from '@/plugins/supabaseClient'
import AppHeader from '@/components/AppHeader.vue'
import { statusToChipClass } from '@/utils/ingredientHelpers'

const router = useRouter()

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

interface DuplicateListing {
  id: string
  barcode: string
  status: string
  product_category_id: number | null
  category_name: string | null
  photo_front_url: string | null
  view_count: number
  created_at: string
}

interface DuplicateGroup {
  name: string
  listings: DuplicateListing[]
  statusConflict: boolean
  categoryConflict: boolean
}

const loading = ref(true)
const groups = ref<DuplicateGroup[]>([])
const survivorChoice = ref<Record<string, string>>({})
const resolvedStatus = ref<Record<string, string>>({})
const resolvedCategoryId = ref<Record<string, number | null>>({})
const merging = ref<Record<string, boolean>>({})
const dismissing = ref<Record<string, boolean>>({})
const dismissedCount = ref(0)

const totalListings = computed(() => groups.value.reduce((sum, g) => sum + g.listings.length, 0))

function goToProduct(barcode: string) {
  router.push(`/item/${barcode}`)
}

function uniqueStatuses(group: DuplicateGroup): string[] {
  return Array.from(new Set(group.listings.map(l => l.status)))
}

function uniqueCategories(group: DuplicateGroup): { id: number | null; name: string | null }[] {
  const seen = new Map<number | string, { id: number | null; name: string | null }>()
  for (const l of group.listings) {
    const key = l.product_category_id ?? 'none'
    if (!seen.has(key)) seen.set(key, { id: l.product_category_id, name: l.category_name })
  }
  return Array.from(seen.values())
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({ message, duration: 2500, color, position: 'bottom' })
  await toast.present()
}

async function fetchAllApprovedProducts(): Promise<any[]> {
  const pageSize = 1000
  const all: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
        .from('products')
        .select('id, barcode, name, status, product_category_id, product_categories(name), photo_front_url, view_count, created_at')
        .eq('approved', true)
        .eq('is_archived', false)
        .range(from, from + pageSize - 1)

    if (error) {
      console.error('Failed to load products for duplicate scan:', error)
      break
    }
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

// The fingerprint captures exactly the fields that matter for "is this still
// the same duplicate situation" — status/category/barcode. A name change
// already dissolves the grouping on its own (the group key IS the name), so
// it doesn't need to be in here.
function buildFingerprint(listings: DuplicateListing[]) {
  return [...listings]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(l => ({ id: l.id, status: l.status, product_category_id: l.product_category_id, barcode: l.barcode }))
}

function memberIdsOf(listings: DuplicateListing[]): string[] {
  return listings.map(l => l.id).sort()
}

// Postgres's jsonb storage reorders object keys on write, so a value read
// back never has the same key order it was written with — a plain
// JSON.stringify comparison against a freshly-built fingerprint would always
// mismatch. Recursively sort keys before stringifying so both sides compare
// on content, not incidental key order.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function loadDuplicates() {
  loading.value = true
  try {
    const [data, dismissalsRes] = await Promise.all([
      fetchAllApprovedProducts(),
      supabase.from('product_duplicate_dismissals').select('member_ids, fingerprint')
    ])

    if (!data.length) {
      groups.value = []
      dismissedCount.value = 0
      return
    }

    const dismissals = dismissalsRes.data ?? []
    // Keyed by the sorted member_ids joined into a string, for O(1) lookup.
    const dismissalByMembers = new Map<string, any>()
    for (const d of dismissals) {
      dismissalByMembers.set([...d.member_ids].sort().join(','), d.fingerprint)
    }

    const byName = new Map<string, any[]>()
    for (const row of data) {
      const key = String(row.name || '').trim().toLowerCase()
      if (!key) continue
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key)!.push(row)
    }

    const nextSurvivor: Record<string, string> = {}
    const nextStatus: Record<string, string> = {}
    const nextCategory: Record<string, number | null> = {}
    const result: DuplicateGroup[] = []
    let dismissed = 0

    for (const rows of byName.values()) {
      if (rows.length < 2) continue

      const listings: DuplicateListing[] = rows
          .map((r: any): DuplicateListing => ({
            id: r.id,
            barcode: r.barcode,
            status: r.status,
            product_category_id: r.product_category_id,
            category_name: Array.isArray(r.product_categories) ? r.product_categories[0]?.name : r.product_categories?.name,
            photo_front_url: r.photo_front_url,
            view_count: r.view_count ?? 0,
            created_at: r.created_at
          }))
          .sort((a, b) => (b.view_count - a.view_count) || (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))

      const memberKey = memberIdsOf(listings).join(',')
      const storedFingerprint = dismissalByMembers.get(memberKey)
      if (storedFingerprint && canonicalJson(storedFingerprint) === canonicalJson(buildFingerprint(listings))) {
        dismissed++
        continue
      }

      const statusConflict = new Set(listings.map(l => l.status)).size > 1
      const categoryConflict = new Set(listings.map(l => l.product_category_id)).size > 1
      const name = rows[0].name

      result.push({ name, listings, statusConflict, categoryConflict })

      nextSurvivor[name] = listings[0].id
      if (statusConflict) nextStatus[name] = listings[0].status
      if (categoryConflict) nextCategory[name] = listings[0].product_category_id
    }

    result.sort((a, b) => a.name.localeCompare(b.name))
    groups.value = result
    dismissedCount.value = dismissed
    survivorChoice.value = nextSurvivor
    resolvedStatus.value = nextStatus
    resolvedCategoryId.value = nextCategory
  } finally {
    loading.value = false
  }
}

async function dismissGroup(group: DuplicateGroup) {
  dismissing.value[group.name] = true
  try {
    const { error } = await supabase
        .from('product_duplicate_dismissals')
        .upsert({
          member_ids: memberIdsOf(group.listings),
          fingerprint: buildFingerprint(group.listings)
        }, { onConflict: 'member_ids' })

    if (error) {
      console.error('Failed to save dismissal:', error)
      await showToast(`Couldn't save that: ${error.message}`, 'danger')
      return
    }

    await showToast(`"${group.name}" won't show up here again unless it changes.`, 'medium')
    await loadDuplicates()
  } finally {
    dismissing.value[group.name] = false
  }
}

async function mergeGroup(group: DuplicateGroup) {
  const survivorId = survivorChoice.value[group.name]
  if (!survivorId) {
    await showToast('Pick which listing to keep first.', 'warning')
    return
  }

  const losers = group.listings.filter(l => l.id !== survivorId)
  if (!losers.length) return

  const alert = await alertController.create({
    header: 'Merge these barcodes?',
    message: `${losers.length} other listing${losers.length === 1 ? '' : 's'} will be merged into the one you kept, and removed. This can't be undone.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Merge',
        handler: async () => {
          merging.value[group.name] = true
          try {
            for (const loser of losers) {
              const { error } = await supabase.rpc('merge_products', {
                p_survivor_id: survivorId,
                p_loser_id: loser.id,
                p_resolved_status: group.statusConflict ? resolvedStatus.value[group.name] : null,
                p_resolved_category_id: group.categoryConflict ? resolvedCategoryId.value[group.name] : null
              })
              if (error) {
                console.error('Merge failed:', error)
                await showToast(`Merge failed: ${error.message}`, 'danger')
                return
              }
            }
            await showToast(`Merged "${group.name}".`, 'success')
            await loadDuplicates()
          } finally {
            merging.value[group.name] = false
          }
        }
      }
    ]
  })
  await alert.present()
}

onMounted(() => {
  loadDuplicates()
})
</script>

<style scoped>
.summary-line {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 0 0 16px;
}

.empty-state {
  margin-top: 48px;
  font-size: 16px;
  color: var(--ion-color-medium);
}

.group-card {
  margin-bottom: 16px;
}

.group-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.group-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.listing-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.06));
}

.listing-row:last-of-type {
  border-bottom: none;
}

.listing-clickable {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 4px;
  margin: -4px;
}

.listing-clickable:hover,
.listing-clickable:focus-visible {
  background: var(--ion-color-step-50, rgba(0,0,0,0.04));
  outline: none;
}

.listing-open-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--ion-color-medium);
}

.listing-photo {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--ion-color-step-50, #f4f4f4);
}

.listing-info {
  flex: 1;
  min-width: 0;
}

.listing-barcode {
  font-family: monospace;
  font-size: 13px;
}

.listing-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  flex-wrap: wrap;
}

.listing-chip {
  margin: 0;
  height: 22px;
  font-size: 11px;
}

.listing-category {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.listing-sub {
  font-size: 11px;
  color: var(--ion-color-medium);
}

.resolve-item {
  margin-top: 8px;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.dismissed-note {
  display: block;
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
</style>
