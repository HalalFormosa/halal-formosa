<script setup lang="ts">
import {
  IonIcon, IonChip, IonLabel, IonSkeletonText
} from '@ionic/vue'
import {
  pricetagOutline, closeCircleOutline, school, sparkles
} from 'ionicons/icons'

interface Category {
  id: number
  name: string
  color: string | null
  emoji: string | null
  icon: string | null
}

interface Campus {
  id: string
  name: string
  slug: string
}

defineProps<{
  categories: Category[]
  activeCategoryIds: number[]
  campusPartners: Campus[]
  activeTag: string | null
  loadingCategories: boolean
  categoryIconMap: Record<string, any>
}>()

defineEmits<{
  (e: 'toggleCategory', cat: Category): void
  (e: 'toggleTag', slug: string): void
  (e: 'clearFilters'): void
}>()
</script>

<template>
  <div class="filter-modal-inner">
    <!-- Active Tags Row (Show only if not a campus partner tag) -->
    <div v-if="activeTag && !campusPartners.some(c => c.slug === activeTag)" class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="pricetagOutline" />
        {{ $t('explore.activeFilters') }}
      </h3>
      <div class="category-bar">
        <ion-chip
            class="modern-category-chip active"
            style="--cat-color: var(--ion-color-tertiary); --cat-bg: var(--ion-color-tertiary);"
            @click="$emit('toggleTag', activeTag!)"
        >
          <ion-icon :icon="pricetagOutline" class="category-icon" />
          <ion-label style="text-transform: capitalize">{{ activeTag }}</ion-label>
          <ion-icon :icon="closeCircleOutline" style="margin-left: 4px; font-size: 16px;" />
        </ion-chip>
      </div>
    </div>

    <!-- Categories -->
    <div class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="pricetagOutline" />
        {{ $t('explore.categories') }}
      </h3>
      <div v-if="loadingCategories" class="category-skeletons" style="display: flex; gap: 10px; padding: 0 16px;">
        <ion-skeleton-text animated style="width:110px; height:36px; border-radius:100px; margin: 0;"/>
        <ion-skeleton-text animated style="width:85px; height:36px; border-radius:100px; margin: 0;"/>
        <ion-skeleton-text animated style="width:120px; height:36px; border-radius:100px; margin: 0;"/>
      </div>
      <div v-else class="category-bar">
        <ion-chip
            v-for="cat in categories"
            :key="cat.id"
            class="modern-category-chip"
            :class="{ active: activeCategoryIds.includes(cat.id) }"
            :style="{ 
              '--cat-color': cat.color || 'var(--ion-color-carrot)',
              '--cat-bg': activeCategoryIds.includes(cat.id) ? (cat.color || 'var(--ion-color-carrot)') : 'transparent'
            }"
            @click="$emit('toggleCategory', cat)"
        >
          <span v-if="typeof categoryIconMap[cat.name] === 'string' && categoryIconMap[cat.name].length === 2" class="category-emoji">
            {{ categoryIconMap[cat.name] }}
          </span>
          <ion-icon v-else-if="categoryIconMap[cat.name]" :icon="categoryIconMap[cat.name]" class="category-icon" />
          <ion-label>{{ cat.name }}</ion-label>
        </ion-chip>
      </div>
    </div>

    <!-- Campus Partners -->
    <div v-if="campusPartners.length > 0" class="filter-section">
      <h3 class="filter-section-title">
        <ion-icon :icon="school" />
        {{ $t('explore.campusPartners') }}
      </h3>
      <div class="category-bar campus-bar">
        <div
            v-for="campus in campusPartners"
            :key="campus.id"
            class="campus-filter-wrapper"
        >
          <div class="special-promo-tag">{{ $t('explore.specialPromo') }}</div>
          <ion-chip
              class="modern-category-chip campus-chip"
              :class="{ active: activeTag === campus.slug }"
              style="--cat-color: var(--ion-color-tertiary); --cat-bg: var(--ion-color-tertiary);"
              @click="$emit('toggleTag', campus.slug)"
          >
            <ion-icon :icon="school" class="category-icon" />
            <ion-label>{{ $t('explore.campusFilter', { name: campus.slug.toUpperCase() }) }}</ion-label>
          </ion-chip>
        </div>
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

.campus-bar {
  align-items: flex-end;
}

.campus-filter-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px;
}

.special-promo-tag {
  position: absolute;
  top: 0;
  font-size: 0.55rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
  color: #422006;
  padding: 1px 6px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(250, 204, 21, 0.4);
  z-index: 10;
  white-space: nowrap;
  transform: translateY(8px);
}

.modern-category-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-background-color) !important;
  color: var(--cat-color);
  height: 38px;
  border-radius: 100px;
  padding: 0 16px;
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.12);
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  margin: 0;
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: #ffffff !important;
  border-color: var(--cat-color) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.category-emoji, .category-icon { margin-right: 6px; font-size: 1.1rem; }
</style>
