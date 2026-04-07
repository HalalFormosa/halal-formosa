<script setup lang="ts">
import {
  IonIcon, IonChip, IonLabel
} from '@ionic/vue'
import {
  mapOutline, locationOutline
} from 'ionicons/icons'

interface Category {
  id: number
  name: string
  emoji: string
}

interface City {
  slug: string
  name: string
  name_zh: string
  emoji: string
}

defineProps<{
  categories: Category[]
  activeCategoryIds: number[]
  cities: City[]
  activeCityIds: string[]
  hasActiveFilters: boolean
}>()

defineEmits<{
  (e: 'toggleCategory', id: number): void
  (e: 'toggleCity', slug: string): void
  (e: 'clearFilters'): void
}>()
</script>

<template>
  <div class="filter-modal-inner">
    <!-- Categories -->
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="mapOutline" />
        {{ $t('trip.categories') }}
      </h3>
      <div class="category-bar">
        <ion-chip
            v-for="cat in categories"
            :key="cat.id"
            class="modern-category-chip"
            :class="{ active: activeCategoryIds.includes(cat.id) }"
            :style="{ 
              '--cat-color': 'var(--ion-color-carrot)',
              '--cat-contrast': 'var(--ion-color-carrot-contrast)',
              '--cat-bg': activeCategoryIds.includes(cat.id) ? 'var(--ion-color-carrot)' : 'transparent'
            }"
            @click="$emit('toggleCategory', cat.id)"
        >
          <span class="category-emoji">{{ cat.emoji }}</span>
          <ion-label>{{ $t(cat.name) }}</ion-label>
        </ion-chip>
      </div>
    </div>

    <!-- Cities -->
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="locationOutline" />
        {{ $t('trip.cities') }}
      </h3>
      <div class="category-bar">
        <ion-chip
            v-for="city in cities"
            :key="city.slug"
            class="modern-category-chip"
            :class="{ active: activeCityIds.includes(city.slug) }"
            :style="{ 
              '--cat-color': 'var(--ion-color-carrot)',
              '--cat-contrast': 'var(--ion-color-carrot-contrast)',
              '--cat-bg': activeCityIds.includes(city.slug) ? 'var(--ion-color-carrot)' : 'transparent'
            }"
            @click="$emit('toggleCity', city.slug)"
        >
          <span class="category-emoji">{{ city.emoji }}</span>
          <ion-label>
            {{ $i18n.locale === 'zh-tw' ? city.name_zh : city.name }}
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
</style>
