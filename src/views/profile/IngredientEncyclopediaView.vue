<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.ingredientEncyclopedia')" show-back back-route="/profile" :icon="libraryOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Paywall state for non-Pro users -->
      <div v-if="!isDonor" class="paywall-container animate__animated animate__fadeIn">
        <div class="lock-icon-wrapper">
          <ion-icon :icon="lockClosedOutline" class="lock-icon" />
        </div>
        <h2 class="paywall-title">{{ $t('profile.ingredientEncyclopedia') }}</h2>
        <p class="paywall-description">
          The Ingredient Encyclopedia is a premium feature available on Halal Formosa Pro. Learn exactly why an
          ingredient is Haram or Syubhah, with sources and scholarly opinions behind every verdict.
        </p>
        <ion-button expand="block" color="carrot" @click="presentRcPaywall">
          Upgrade to Pro
        </ion-button>
      </div>

      <!-- Main content for Pro users -->
      <template v-else>
        <ion-segment v-model="activeStatus" scrollable>
          <ion-segment-button value="haram">
            <ion-label>Haram</ion-label>
          </ion-segment-button>
          <ion-segment-button value="syubhah">
            <ion-label>Syubhah</ion-label>
          </ion-segment-button>
        </ion-segment>

        <div v-if="loading" class="ion-text-center ion-margin-top">
          <ion-spinner name="crescent" color="carrot" />
        </div>

        <template v-else>
          <div v-if="filteredArticles.length === 0" class="empty-state">
            <ion-icon :icon="documentTextOutline" class="empty-icon" />
            <h3>No articles yet</h3>
            <p>We're still writing up this category. Check back soon.</p>
          </div>

          <ion-list v-else lines="none" class="ion-margin-top">
            <ion-item
              v-for="article in filteredArticles"
              :key="article.id"
              button
              @click="$router.push(`/profile/ingredient-encyclopedia/${article.slug}`)"
              class="article-item"
            >
              <ion-thumbnail v-if="article.image_url" slot="start" class="article-thumbnail">
                <img :src="article.image_url" :alt="article.title" />
              </ion-thumbnail>
              <ion-label>
                <h3 class="article-title">{{ article.title }}</h3>
                <p class="article-summary">{{ article.summary }}</p>
              </ion-label>
              <span slot="end" :class="['status-badge', article.status]">
                {{ statusLabel(article.status) }}
              </span>
            </ion-item>
          </ion-list>
        </template>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  IonPage,
  IonHeader,
  IonContent,
  IonButton,
  IonIcon,
  IonLabel,
  IonSpinner,
  IonList,
  IonItem,
  IonThumbnail,
  IonSegment,
  IonSegmentButton
} from '@ionic/vue'
import { lockClosedOutline, documentTextOutline, libraryOutline } from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import AppHeader from '@/components/AppHeader.vue'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import {
  fetchIngredientArticles,
  type IngredientArticleListItem,
  type IngredientArticleStatus
} from '@/composables/useIngredientArticles'

const loading = ref(false)
const articles = ref<IngredientArticleListItem[]>([])
const activeStatus = ref<IngredientArticleStatus>('haram')

const filteredArticles = computed(() => articles.value.filter(a => a.status === activeStatus.value))

function statusLabel(status: IngredientArticleStatus) {
  if (status === 'haram') return 'Haram'
  if (status === 'syubhah') return 'Syubhah'
  return 'Muslim-friendly'
}

async function loadArticles() {
  if (!isDonor.value) return
  loading.value = true
  try {
    articles.value = await fetchIngredientArticles()
  } catch (err) {
    console.error('Error loading ingredient articles:', err)
  } finally {
    loading.value = false
  }
}

async function presentRcPaywall() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[RC] Paywall can only run on native apps.')
    return
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall()
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await refreshSubscriptionStatus({ syncToServer: true })
      await ActivityLogService.log(
        result === PAYWALL_RESULT.PURCHASED ? 'pro_purchase_success' : 'pro_restore_success',
        { source: 'ingredient_encyclopedia_view' }
      )
      await loadArticles()
    }
  } catch (err) {
    console.error('Paywall failed:', err)
  }
}

watch(isDonor, (newValue) => {
  if (newValue) loadArticles()
})

onMounted(loadArticles)
</script>

<style scoped>
.paywall-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  text-align: center;
  padding: 24px;
}

.lock-icon-wrapper {
  background: var(--ion-color-light);
  border-radius: 50%;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.lock-icon {
  font-size: 48px;
  color: var(--ion-color-carrot);
}

.paywall-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.paywall-description {
  font-size: 1rem;
  color: var(--ion-color-medium);
  margin-bottom: 32px;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  height: 40vh;
}

.empty-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.article-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  border-bottom: 1px solid var(--ion-color-light);
  margin-bottom: 8px;
}

.article-thumbnail {
  --border-radius: 8px;
  width: 56px;
  height: 56px;
  margin-right: 12px;
}

.article-title {
  font-size: 15px;
  font-weight: 600;
}

.article-summary {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  text-align: center;
  min-width: 70px;
  align-self: flex-start;
}

.status-badge.haram {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
}

.status-badge.syubhah {
  background: rgba(var(--ion-color-warning-rgb), 0.1);
  color: var(--ion-color-warning);
}

.status-badge.muslim_friendly {
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success);
}
</style>
