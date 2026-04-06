<script setup lang="ts">
import {
  IonIcon, IonSkeletonText, IonChip, IonLabel
} from '@ionic/vue'
import {
  storefrontOutline, pricetagsOutline, shieldCheckmarkOutline
} from 'ionicons/icons'
import StoreLogoBar from "@/components/StoreLogoBar.vue";

interface Store {
  id: string
  name: string
  logo_url?: string | null
}

interface Category {
  id: number
  name: string
}

const props = withDefaults(defineProps<{
  loadingStores?: boolean
  stores?: Store[]
  activeStores?: Store[]
  loadingCategories?: boolean
  categories?: Category[]
  activeCategories?: Category[]
  statuses?: { key: string; emoji: string }[]
  activeStatuses?: string[]
  hasActiveFilters?: boolean
  categoryIcons?: Record<string, string>
  STATUS_COLOR_MAP?: Record<string, string>
}>(), {
  loadingStores: false,
  stores: () => [],
  activeStores: () => [],
  loadingCategories: false,
  categories: () => [],
  activeCategories: () => [],
  statuses: () => [],
  activeStatuses: () => [],
  hasActiveFilters: false,
  categoryIcons: () => ({}),
  STATUS_COLOR_MAP: () => ({})
})

const emit = defineEmits<{
  (e: 'update:activeStores', value: Store[]): void
  (e: 'toggleCategory', cat: Category): void
  (e: 'toggleStatus', status: string): void
  (e: 'clearAllFilters'): void
}>()

function toggleCategory(cat: Category) {
  emit('toggleCategory', cat)
}

function toggleStatus(status: string) {
  emit('toggleStatus', status)
}

function clearAllFilters() {
  emit('clearAllFilters')
}

// Local wrapper for modelValue to stay consistent with v-model
const localActiveStores = computed({
  get: () => props.activeStores || [],
  set: (val) => emit('update:activeStores', val)
})

import { computed } from 'vue'

</script>

<template>
  <div>
    <!-- Stores -->
    <div class="filter-group">
      <div class="filter-title">
        <ion-icon :icon="storefrontOutline"/>
        {{ $t('search.filters.stores') }}
      </div>
      <div class="store-scroll">
        <template v-if="loadingStores">
          <ion-skeleton-text
              v-for="n in 10"
              :key="'store-skeleton-' + n"
              animated
              class="skeleton-store"
          />
        </template>
        <template v-else>
          <StoreLogoBar
              :stores="stores"
              mode="filter"
              v-model:activeStores="localActiveStores"
          />
        </template>
      </div>
    </div>

    <!-- Categories -->
    <div class="filter-group">
      <div class="filter-title">
        <ion-icon :icon="pricetagsOutline"/>
        {{ $t('search.filters.categories') }}
      </div>
      <div class="category-bar">
        <template v-if="loadingCategories">
          <ion-skeleton-text
              v-for="n in 4"
              :key="'cat-skeleton-' + n"
              animated
              style="width: 100px; height: 28px; border-radius: 100px; margin-right: 8px;"
          />
        </template>
        <template v-else>
          <ion-chip
              v-for="cat in categories"
              :key="cat.id"
              class="modern-category-chip"
              :class="{ active: activeCategories.some(c => c.id === cat.id) }"
              :style="{ 
                        '--cat-color': 'var(--ion-color-carrot)',
                        '--cat-contrast': 'var(--ion-color-carrot-contrast)',
                        '--cat-bg': activeCategories.some(c => c.id === cat.id) ? 'var(--ion-color-carrot)' : 'transparent'
                      }"
              @click="toggleCategory(cat)"
          >
            <span class="category-emoji">{{ categoryIcons[cat.name] || '📦' }}</span>
            <ion-label>{{ $te('search.categoriesList.' + cat.name) ? $t('search.categoriesList.' + cat.name) : cat.name }}</ion-label>
          </ion-chip>
        </template>
      </div>
    </div>

    <!-- Status Filter -->
    <div class="filter-group">
      <div class="filter-title">
        <ion-icon :icon="shieldCheckmarkOutline"/>
        {{ $t('search.filters.statuses') }}
      </div>
      <div class="category-bar">
        <ion-chip
            v-for="status in statuses"
            :key="status.key"
            class="modern-category-chip"
            :class="{ active: activeStatuses.includes(status.key) }"
            :style="{ 
                      '--cat-color': `var(--ion-color-${STATUS_COLOR_MAP[status.key]})`,
                      '--cat-contrast': `var(--ion-color-${STATUS_COLOR_MAP[status.key]}-contrast)`,
                      '--cat-bg': activeStatuses.includes(status.key) ? `var(--ion-color-${STATUS_COLOR_MAP[status.key]})` : 'transparent'
                    }"
            @click="toggleStatus(status.key)"
        >
          <span class="category-emoji">{{ status.emoji }}</span>
          <ion-label>
            {{ $t(`search.status.${status.key}`) }}
          </ion-label>
        </ion-chip>
      </div>
    </div>

    <!-- 🔥 Clear Filters -->
    <div class="filter-clear-row">
      <ion-chip
          v-if="hasActiveFilters"
          class="clear-chip"
          @click="clearAllFilters"
      >
        {{ $t('search.clear') }}
      </ion-chip>
    </div>
  </div>
</template>

<style scoped>
.filter-group {
  margin: 12px 0;
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-dark);
  padding: 0 16px;
  margin-bottom: 8px;
}

.filter-title ion-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
}

.category-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 8px;
}

ion-chip.modern-category-chip {
  --cat-color: var(--ion-color-dark);
  --cat-bg: var(--ion-background-color);
  background: var(--cat-bg);
  color: var(--cat-color);
  height: 38px;
  border-radius: 100px !important;
  --border-radius: 100px !important;
  padding: 0 16px;
  border: 1.5px solid var(--cat-color);
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  margin: 0;
  flex-shrink: 0;
  width: auto;
  overflow: hidden;
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: var(--cat-contrast, #ffffff);
  border-color: var(--cat-color) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.category-emoji { margin-right: 6px; font-size: 1.1rem; }

.filter-clear-row {
  display: flex;
  justify-content: flex-start;
  padding: 4px 12px 4px;
}

.clear-chip {
    --background: var(--ion-color-light);
    --color: var(--ion-color-medium);
    font-weight: 700;
    font-size: 0.75rem;
}

.store-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 6px 8px;
  flex-wrap: nowrap;
  width: 100%;
}

.skeleton-store {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
