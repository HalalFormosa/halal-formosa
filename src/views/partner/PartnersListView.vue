<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('partner.title')"
          :showBack="true"
          backRoute="/home"
          icon="none"
      />

      <!-- Search bar -->
      <ion-toolbar style="padding: 8px;">
        <ion-searchbar
            v-model="searchQuery"
            :placeholder="$t('partner.searchPlaceholder')"
            :debounce="500"
            class="rounded"
            @ionInput="handleSearchInput"
        />
      </ion-toolbar>

      <!-- Filter toggle -->
      <ion-toolbar class="search-toolbar">
        <ion-button fill="clear" size="small" @click="showFilters = !showFilters">
          <ion-icon :icon="funnelOutline" />
          <ion-text class="toolbar-label">
            &nbsp; {{ $t('common.filters') }}
          </ion-text>
          <ion-icon :icon="showFilters ? chevronUpOutline : chevronDownOutline" />
        </ion-button>

        <transition name="collapse">
          <div v-show="showFilters" class="filter-section">
            <!-- Categories -->
            <div class="filter-title">
              <ion-icon :icon="pricetagsOutline" />
              {{ $t('partner.categories') }}
            </div>

            <div class="category-bar">
              <ion-chip
                  v-for="cat in categories"
                  :key="cat.id"
                  class="category-chip"
                  :class="{ active: activeCategoryIds.includes(cat.id) }"
                  @click="toggleCategory(cat.id)"
              >
                <ion-label>
                  {{ cat.name }}
                </ion-label>
              </ion-chip>

            </div>
          </div>
        </transition>
      </ion-toolbar>
    </ion-header>



    <ion-content class="ion-padding">

      <ion-button
          v-if="activeCategoryIds.length"
          size="small"
          fill="clear"
          color="medium"
          @click="clearFilters"
      >
        {{ $t('partner.actions.clearFilters') }}
      </ion-button>



      <!-- List -->
      <div class="discover-grid">

        <!-- Skeleton -->
        <template v-if="loading">
          <ion-card
              v-for="n in 4"
              :key="'skeleton-' + n"
              class="discover-item"
          >
            <ion-skeleton-text
                animated
                style="width:100%;height:140px;border-radius:12px;"
            />
            <ion-skeleton-text
                animated
                style="width:80%;height:16px;margin:8px auto;"
            />
          </ion-card>
        </template>

        <!-- Data -->
        <template v-else>
          <ion-card
              v-for="body in filteredBodies"
              :key="body.id"
              :class="['discover-item', body.tier, { 'has-tier': !!body.tier }]"
              button
              @click="openPartner(body)"
          >
            <!-- Tier Badge -->
            <div v-if="body.tier" :class="['premium-badge', body.tier]">
              <ion-icon :icon="checkmarkCircle" v-if="body.tier === 'gold'" />
              <span>{{ $t('home.partnerTier', { tier: body.tier.toUpperCase() }) }}</span>
            </div>

            <!-- Logo Container -->
            <div class="logo-wrapper">
              <img
                  :src="body.logo || `https://placehold.co/300x300?text=${encodeURIComponent(body.name)}`"
                  :alt="body.name"
                  class="partner-logo"
              />
            </div>

            <!-- Info Container -->
            <div class="partner-info">
              <div class="scope-chips">
                <span
                    v-for="s in body.scopes.slice(0, 2)"
                    :key="s"
                    class="scope-tag"
                >
                  {{ s }}
                </span>
                <span v-if="body.scopes.length > 2" class="scope-tag more">
                  +{{ body.scopes.length - 2 }}
                </span>
              </div>

              <h3 class="partner-name">
                {{ body.name }}
              </h3>
              
              <div v-if="body.tier === 'gold'" class="verified-label">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>{{ $t('admin.verifiedPartner') }}</span>
              </div>
            </div>
          </ion-card>
        </template>

      </div>


      <p
          v-if="!loading && filteredBodies.length === 0"
          class="text-center text-sm text-gray-500 mt-8"
      >
        {{ $t('partner.noPartnerFound') }}
      </p>


    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage,
  IonContent,
  IonSearchbar,
  IonChip,
  IonCard,
  IonLabel,
  IonSkeletonText,
  IonIcon,
    IonHeader,
    IonButton,
    IonToolbar,
    IonText,
    IonBadge
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  chevronDownOutline,
  chevronUpOutline,
  funnelOutline,
  pricetagsOutline,
  checkmarkCircle,
  shieldCheckmarkOutline,
  closeCircleOutline
} from "ionicons/icons";
import {ActivityLogService} from "@/services/ActivityLogService";

/* ---------------- State ---------------- */
const router = useRouter()
const loading = ref(true)
const activeCategoryIds = ref<string[]>([])

import { supabase } from '@/plugins/supabaseClient'
const searchQuery = ref('')
const showFilters = ref(false)

const TIER_PRIORITY: Record<string, number> = {
  gold: 3,
  silver: 2,
  bronze: 1
}

/* ---------------- Scopes ---------------- */
type PartnerCategory = {
  id: string
  name: string
  slug: string
  icon?: string | null
  color?: string | null
}


const categories = ref<PartnerCategory[]>([])


async function fetchCategories() {
  const { data, error } = await supabase
      .from('partner_scopes')
      .select('id, name, slug, icon, color')
      .eq('is_active', true)
      .order('name')

  if (error) {
    console.error('[Scopes]', error)
    return
  }

  categories.value = data ?? []
}

async function fetchPartners() {
  const { data, error } = await supabase
      .from('partners')
      .select(`
      id,
      name,
      logo_url,
      partner_tier,
      partners_scopes (
        scope_id,
        partner_scopes (
          id,
          name
        )
      )
    `)
      .eq('is_active', true)

  if (error) {
    console.error('[Partners]', error)
    return
  }

  bodies.value = (data ?? []).map((b: any) => ({
    id: b.id as string,
    name: b.name as string,
    logo: b.logo_url as string | null,
    tier: b.partner_tier as 'gold' | 'silver' | 'bronze' | null,
    scopeIds: (b.partners_scopes ?? []).map(
        (s: any) => s.scope_id as string
    ),
    scopes: (b.partners_scopes ?? []).map(
        (s: any) => s.partner_scopes.name as string
    )
  }))
}

/* ---------------- Placeholder Data ---------------- */
const bodies = ref<any[]>([])


/* ---------------- Computed ---------------- */
const filteredBodies = computed(() => {
  return bodies.value
      .filter(body => {
        const matchesSearch =
            body.name.toLowerCase().includes(searchQuery.value.toLowerCase())

        if (!activeCategoryIds.value.length) {
          return matchesSearch
        }

        const matchesCategory = body.scopeIds.some((id: string) =>
            activeCategoryIds.value.includes(id)
        )

        return matchesSearch && matchesCategory
      })
      .sort((a, b) => {
        const tierA = TIER_PRIORITY[a.tier ?? ''] ?? 0
        const tierB = TIER_PRIORITY[b.tier ?? ''] ?? 0

        // 🔥 Tier first
        if (tierA !== tierB) {
          return tierB - tierA
        }

        // 🔤 Then name
        return a.name.localeCompare(b.name)
      })
})




/* ---------------- Methods ---------------- */
function handleSearchInput(ev: Event) {
  const q = (ev.target as HTMLInputElement).value.trim()
  searchQuery.value = q

  if (q.length > 1) {
    ActivityLogService.log('partner_search', { query: q })
  }
}


function toggleCategory(id: string) {
  const idx = activeCategoryIds.value.indexOf(id)

  if (idx === -1) {
    activeCategoryIds.value.push(id)
    ActivityLogService.log('partner_filter_add', { category_id: id })
  } else {
    activeCategoryIds.value.splice(idx, 1)
    ActivityLogService.log('partner_filter_remove', { category_id: id })
  }
}





function openPartner(partner: any) {
  ActivityLogService.log('partner_click', {
    source: 'partners_page',
    partner_id: partner.id,
    partner_name: partner.name,
    partner_tier: partner.tier,
    active_categories: activeCategoryIds.value,
    search_query: searchQuery.value || null
  })

  router.push(`/partner/${partner.id}`)
}

function clearFilters() {
  ActivityLogService.log('partner_filter_clear', {
    cleared_categories: activeCategoryIds.value
  })

  activeCategoryIds.value = []
}

/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  ActivityLogService.log('partners_page_open')

  loading.value = true
  await Promise.all([
    fetchCategories(),
    fetchPartners()
  ])
  loading.value = false
})


</script>

<style scoped>
/* =========================
   Grid & Card
   ========================= */

.discover-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 0;
}

@media (min-width: 768px) {
  .discover-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

.discover-item {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--card-border-color, rgba(0,0,0,0.05));
  box-shadow: 0 4px 12px var(--card-shadow-color, rgba(0,0,0,0.05));
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
  
  /* Theme Variables Default (Light) */
  --card-bg: var(--ion-card-background, #ffffff);
  --card-border-color: rgba(0,0,0,0.08);
  --card-shadow-color: rgba(0,0,0,0.05);
  --partner-text-color: var(--ion-color-dark, #000000);
  --logo-area-bg: #ffffff;
  --tag-bg: rgba(var(--ion-color-primary-rgb), 0.08);
  --tag-text: var(--ion-color-primary);
  
  background: var(--card-bg);
}

.discover-item:active {
  transform: scale(0.97);
}

/* =========================
   Grid & Card
   ========================= */

.discover-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 0;
}

@media (min-width: 768px) {
  .discover-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

.discover-item {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--card-border-color);
  box-shadow: 0 4px 12px var(--card-shadow-color);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
  
  /* Theme Variables Default (Light) */
  --card-border-color: rgba(0,0,0,0.08);
  --card-shadow-color: rgba(0,0,0,0.05);
  
  /* Area Specific */
  --logo-bg: #ffffff;
  --info-bg: #f9fafb;
  --partner-text-color: #111827;
  --tag-bg: rgba(var(--ion-color-primary-rgb), 0.08);
  --tag-text: var(--ion-color-primary);
  
  background: var(--info-bg);
}

.discover-item:active {
  transform: scale(0.97);
}

/* Tier Specific Styles (Light Mode) */
.discover-item.gold {
  grid-column: span 2;
  --card-border-color: #facc15;
  --info-bg: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); /* Light Gold Info Area */
  --partner-text-color: #854d0e; /* Dark Brown for readability */
  --tag-bg: rgba(133, 77, 14, 0.1);
  --tag-text: #854d0e;
  box-shadow: 0 8px 32px rgba(250, 204, 21, 0.25);
}

.discover-item.silver {
  --card-border-color: #d1d5db;
  --info-bg: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}

.discover-item.has-tier:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0,0,0,0.1);
}

/* 🌑 Dark Mode Variables Overrides */
@media (prefers-color-scheme: dark) {
  .discover-item {
    --card-border-color: rgba(255, 255, 255, 0.1);
    --card-shadow-color: rgba(0,0,0,0.4);
    --info-bg: #1f2937;
    --partner-text-color: #f3f4f6;
    --logo-bg: #ffffff; /* Keep white for seamless logo integration as per user request */
    --tag-bg: rgba(var(--ion-color-primary-rgb), 0.2);
    --tag-text: var(--ion-color-primary-tint);
  }
  
  .discover-item.gold {
    --info-bg: linear-gradient(135deg, #713f12 0%, #422006 100%); /* Deep Gold Info Area */
    --partner-text-color: #fef3c7;
    --card-border-color: #facc15;
    --tag-bg: rgba(254, 243, 199, 0.15);
    --tag-text: #fef3c7;
    box-shadow: 0 8px 24px rgba(250, 204, 21, 0.2);
  }
}

/* 🌑 Ionic Palette Dark Class Support */
.ion-palette-dark .discover-item,
:host-context(.ion-palette-dark) .discover-item {
  --card-border-color: rgba(255, 255, 255, 0.1);
  --card-shadow-color: rgba(0,0,0,0.4);
  --info-bg: #1f2937;
  --partner-text-color: #f3f4f6;
  --logo-bg: #ffffff;
}

.ion-palette-dark .discover-item.gold,
:host-context(.ion-palette-dark) .discover-item.gold {
  --info-bg: linear-gradient(135deg, #713f12 0%, #422006 100%);
  --partner-text-color: #fef3c7;
  --card-border-color: #facc15;
}

@media (min-width: 768px) {
  .discover-item.gold {
    grid-column: span 1;
  }
}

/* =========================
   Logo & Info Layout
   ========================= */

.logo-wrapper {
  width: 100%;
  height: 140px;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--logo-bg); /* Always White-ish Area */
  border-bottom: 2px solid var(--card-border-color);
  transition: background 0.3s ease;
}

.partner-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  /* Remove multiply blend to maintain original logo colors on white */
  mix-blend-mode: normal;
}

.partner-info {
  padding: 20px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--info-bg); /* Themed Bottom Area */
}

.partner-name {
  margin: 10px 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--partner-text-color);
  line-height: 1.3;
}

/* =========================
   Badges & Labels
   ========================= */

.premium-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 99px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.premium-badge.gold {
  background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
  color: #422006;
}

.premium-badge.silver {
  background: linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%);
  color: #1f2937;
}

.premium-badge.bronze {
  background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
  color: #ffffff;
}

.verified-label {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #ca8a04;
  font-size: 0.75rem;
  font-weight: 700;
}

.verified-label ion-icon {
  font-size: 14px;
}

/* =========================
   Scope Chips (Custom Tags)
   ========================= */

.scope-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scope-tag {
  background: var(--tag-bg);
  color: var(--tag-text);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  transition: background 0.3s ease;
  white-space: nowrap;
}

.scope-tag.more {
  background: rgba(var(--ion-color-medium-rgb), 0.1);
  color: var(--ion-color-medium);
}

/* =========================
   Filters & categories
   ========================= */

.category-bar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 12px 16px;
  scrollbar-width: none;
}

.category-bar::-webkit-scrollbar {
  display: none;
}

.category-chip {
  --border-color: rgba(var(--ion-color-medium-rgb), 0.3);
  
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--ion-color-medium);
  padding: 8px 16px;
  border-radius: 14px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.category-chip.active {
  background: var(--ion-color-carrot);
  color: #ffffff;
  border-color: var(--ion-color-carrot);
  box-shadow: 0 4px 12px rgba(230, 126, 34, 0.25);
}

/* =========================
   Search Extras
   ========================= */

ion-searchbar.rounded {
  --border-radius: 12px;
  --box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  padding: 0;
}

.filter-section {
  padding: 8px 16px 16px;
  background: var(--ion-toolbar-background);
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  margin-bottom: 6px;
}

.search-toolbar {
  --border-style: none;
}

.text-center { text-align: center; }
.text-sm { font-size: 0.875rem; }
.text-gray-500 { color: var(--ion-color-medium); }
.mt-8 { margin-top: 2rem; }</style>
