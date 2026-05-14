<template>
  <ion-page>
    <ion-header>
      <app-header 
        :title="type === 'products' ? $t('analytics.productTitle') : $t('analytics.locationTitle')" 
        :showBack="true"
        :useRouterBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding">
      <div class="analytics-intro">
        <p class="analytics-subtitle">
          {{ type === 'products' ? $t('analytics.productDesc') : $t('analytics.locationDesc') }}
        </p>
      </div>

      <div v-if="loading" class="analytics-grid">
        <div v-for="n in 6" :key="n" class="insight-card skeleton">
          <ion-skeleton-text animated style="width: 48px; height: 48px; border-radius: 14px;" />
          <div style="flex: 1;">
            <ion-skeleton-text animated style="width: 40%; height: 20px; margin-bottom: 4px;" />
            <ion-skeleton-text animated style="width: 60%; height: 14px;" />
          </div>
        </div>
      </div>

      <div v-else class="analytics-grid">
        <div 
          v-for="(count, label) in stats" 
          :key="label" 
          class="insight-card stat-card"
          @click="handleCardClick(label)"
        >
          <div class="stat-icon-wrapper" :class="getIconClass(label)">
            <ion-icon :icon="getIcon(label)" />
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ formatLabel(label) }}</span>
            <h2 class="stat-value">{{ count }}</h2>
          </div>
        </div>
      </div>

      <div class="footer-actions">
        <ion-button expand="block" class="action-btn" @click="handleSeeAll">
          {{ type === 'products' ? $t('analytics.seeAllProducts') : $t('analytics.seeAllLocations') }}
          <ion-icon :icon="openOutline" slot="end" />
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  IonPage, IonHeader, IonContent, IonButton, 
  IonIcon, IonSkeletonText 
} from '@ionic/vue'
import { 
  openOutline, checkmarkCircleOutline, 
  personOutline, warningOutline, closeCircleOutline,
  restaurantOutline, homeOutline, bedOutline,
  fastFoodOutline, leafOutline,
  sparkles, locationOutline
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import { useHomeData } from '@/composables/useHomeData'
import AppHeader from "@/components/AppHeader.vue"

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const { withCache } = useHomeData()

const type = computed(() => route.params.type as string || 'products')
const loading = ref(true)
const stats = ref<Record<string, number>>({})

async function fetchData() {
  loading.value = true
  try {
    if (type.value === 'products') {
      const data = await withCache('product_stats', async () => {
        const { data: products, error } = await supabase.from('products').select('status').eq('is_archived', false)
        if (error) throw error
        const statusCount: Record<string, number> = { Halal: 0, 'Muslim-friendly': 0, Syubhah: 0, Haram: 0 }
        products?.forEach((p) => {
          const s = p.status as string
          if (statusCount[s] !== undefined) statusCount[s]++
        })
        return { statusCount }
      })
      if (data) stats.value = data.statusCount
    } else {
      const data = await withCache('location_category_stats', async () => {
        const { data, error } = await supabase
          .from("locations")
          .select(`id, location_types ( name )`)
          .eq('approved', true)
          .eq('is_archived', false)
        if (error) throw error
        const counts: Record<string, number> = {}
        data?.forEach(loc => {
          const rawType = Array.isArray(loc.location_types) ? loc.location_types[0] : loc.location_types
          const typeKey = rawType?.name || t('common.unknown')
          counts[typeKey] = (counts[typeKey] || 0) + 1
        })
        // Sort categories by count (desc)
        const sortedCounts = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
        return { counts: sortedCounts }
      })
      if (data) stats.value = data.counts
    }
  } catch (err) {
    console.error("Failed to fetch analytics:", err)
  } finally {
    loading.value = false
  }
}

function getIcon(label: string) {
  const l = label.toLowerCase()
  if (l === 'halal') return checkmarkCircleOutline
  if (l === 'muslim-friendly') return personOutline
  if (l === 'syubhah') return warningOutline
  if (l === 'haram') return closeCircleOutline
  
  if (l.includes('restaurant')) return restaurantOutline
  if (l.includes('room') || l.includes('mosque')) return homeOutline
  if (l.includes('accomodation') || l.includes('hotel')) return bedOutline
  if (l.includes('stall')) return fastFoodOutline
  if (l.includes('vegan')) return leafOutline
  if (l.includes('shop') || l.includes('butcher')) return sparkles
  
  return locationOutline
}

function getIconClass(label: string) {
  const l = label.toLowerCase()
  if (l === 'halal') return 'status-halal'
  if (l === 'muslim-friendly') return 'status-friendly'
  if (l === 'syubhah') return 'status-syubhah'
  if (l === 'haram') return 'status-haram'
  return 'status-accent'
}

function formatLabel(label: string) {
  if (type.value === 'products') {
    return te(`search.status.${label}`) ? t(`search.status.${label}`) : label
  }
  return te(`explore.types.${label}`) ? t(`explore.types.${label}`) : label
}

function handleSeeAll() {
  if (type.value === 'products') {
    router.push('/search')
  } else {
    router.push('/explore')
  }
}

function handleCardClick(label: string) {
  if (type.value === 'products') {
    router.push({ path: '/search', query: { status: label } })
  } else {
    router.push({ path: '/explore', query: { type: label } })
  }
}

watch(type, () => {
  stats.value = {}
  fetchData()
})

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.analytics-intro {
  margin-bottom: 24px;
  padding: 0 4px;
}

.analytics-subtitle {
  font-size: 0.95rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
  margin: 0;
}

.analytics-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

/* Match HomeView insight-card style */
.insight-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s ease, background 0.2s ease;
  cursor: pointer;
}

.insight-card:active {
  transform: scale(0.98);
  background: var(--ion-color-step-50);
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

/* Color thematic wrappers */
.status-halal { background: rgba(var(--ion-color-success-rgb), 0.1); color: var(--ion-color-success); }
.status-friendly { background: rgba(var(--ion-color-primary-rgb), 0.1); color: var(--ion-color-primary); }
.status-syubhah { background: rgba(var(--ion-color-warning-rgb), 0.1); color: var(--ion-color-warning); }
.status-haram { background: rgba(var(--ion-color-danger-rgb), 0.1); color: var(--ion-color-danger); }
.status-accent { background: rgba(var(--ion-color-carrot-rgb), 0.1); color: var(--ion-color-carrot); }

.stat-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  margin: 2px 0 0;
  font-size: 1.6rem;
  font-weight: 850;
  color: var(--ion-color-dark);
}

.footer-actions {
  margin-top: 16px;
  padding-bottom: 32px;
}

.action-btn {
  --background: var(--ion-color-carrot);
  --border-radius: 16px;
  font-weight: 700;
  height: 54px;
  margin: 0;
  text-transform: none;
}

.skeleton {
  cursor: default;
}

@media (min-width: 768px) {
  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
