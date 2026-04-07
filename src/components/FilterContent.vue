<script setup lang="ts">
import {
  IonIcon, IonSkeletonText, IonChip, IonLabel
} from '@ionic/vue'
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
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
  set: (val: Store[]) => emit('update:activeStores', val)
})

</script>

<template>
  <div class="filter-modal-inner">
    <!-- Stores -->
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="storefrontOutline"/>
        {{ $t('search.filters.stores') }}
      </h3>
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
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="pricetagsOutline"/>
        {{ $t('search.filters.categories') }}
      </h3>
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
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="shieldCheckmarkOutline"/>
        {{ $t('search.filters.statuses') }}
      </h3>
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
  </div>
</template>

<style scoped>
.filter-modal-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-section {
  margin-bottom: 16px;
}

.filter-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ion-text-color);
  padding: 0 16px;
  margin-bottom: 12px;
}

.filter-section-title ion-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
}

.category-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 8px;
  scrollbar-width: none;
}

.category-bar::-webkit-scrollbar {
  display: none;
}

ion-chip.modern-category-chip {
  --cat-color: var(--ion-color-dark);
  --cat-bg: var(--ion-background-color);
  background: var(--cat-bg) !important;
  color: var(--cat-color);
  height: 38px;
  border-radius: 100px !important;
  --border-radius: 100px !important;
  padding: 0 16px;
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.12);
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  margin: 0;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: var(--cat-contrast, #ffffff) !important;
  border-color: var(--cat-color) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.category-emoji { margin-right: 6px; font-size: 1.1rem; }

.store-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 6px 16px;
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
