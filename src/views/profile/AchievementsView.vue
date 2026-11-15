<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('achievements.title')" show-back back-route="/profile" :icon="trophyOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="definitions.length === 0" class="ion-text-center ion-margin-top">
        <ion-spinner name="crescent" color="carrot" />
      </div>

      <template v-else>
        <div class="achievements-summary">
          <ion-icon :icon="trophyOutline" class="summary-trophy-icon" />
          <div class="summary-text">
            <span class="summary-count">{{ totalUnlockedCount }} / {{ totalTierCount }}</span>
            <span class="summary-label">{{ $t('achievements.summaryLabel') }}</span>
          </div>
        </div>

        <ion-card v-for="cat in categorizedAchievements" :key="cat.category" class="achievement-card">
          <div class="achievement-card-header">
            <span class="achievement-category-icon">{{ categoryIcon(cat.category) }}</span>
            <div class="achievement-category-heading">
              <h3>{{ $t('achievements.categories.' + cat.category + '.title') }}</h3>
              <p>{{ $t('achievements.categories.' + cat.category + '.description') }}</p>
            </div>
          </div>

          <div class="achievement-progress-row">
            <span class="achievement-progress-count">{{ cat.currentCount }}</span>
            <div class="progress-container">
              <div
                class="progress-bar-fill"
                :style="{ width: categoryProgressPercent(cat) + '%' }"
              ></div>
            </div>
            <span class="achievement-progress-target">
              {{ cat.nextTier ? cat.nextTier.threshold : cat.tiers[cat.tiers.length - 1]?.threshold }}
            </span>
          </div>
          <p v-if="cat.nextTier" class="achievement-next-hint">
            {{ $t('achievements.nextTierHint', { count: cat.nextTier.threshold - cat.currentCount, tier: $t('achievements.categories.' + cat.category + '.tiers.' + cat.nextTier.tier) }) }}
          </p>
          <p v-else class="achievement-next-hint achievement-maxed">{{ $t('achievements.allTiersUnlocked') }}</p>

          <div class="tier-row">
            <button
              v-for="tier in cat.tiers"
              :key="tier.id"
              type="button"
              class="tier-medal"
              :class="{ unlocked: tier.unlocked, showcased: showcaseId === tier.id }"
              @click="onTierClick(tier)"
            >
              <span class="tier-medal-icon">{{ tier.unlocked ? tier.icon : '🔒' }}</span>
              <span class="tier-medal-name">{{ $t('achievements.categories.' + cat.category + '.tiers.' + tier.tier) }}</span>
              <span class="tier-medal-threshold">{{ tier.threshold }}</span>
            </button>
          </div>
        </ion-card>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonIcon,
  IonSpinner,
  toastController,
} from "@ionic/vue";
import { trophyOutline } from "ionicons/icons";
import AppHeader from "@/components/AppHeader.vue";
import { supabase } from "@/plugins/supabaseClient";
import {
  useAchievements,
  definitions,
  type AchievementCategoryView,
  type AchievementTierView,
} from "@/composables/useAchievements";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const {
  categorizedAchievements,
  totalUnlockedCount,
  totalTierCount,
  loadAll,
  setShowcaseAchievement,
} = useAchievements();

const CATEGORY_ICONS: Record<string, string> = {
  scanner: "📷",
  halal_hunter: "🔍",
  explorer: "🗺️",
  community_pillar: "🏗️",
  community_voice: "✍️",
  halal_habit: "🔥",
};

function categoryIcon(category: string) {
  return CATEGORY_ICONS[category] ?? "🏆";
}

const showcaseId = ref<string | null>(null);
let currentUserId: string | null = null;

function categoryProgressPercent(cat: AchievementCategoryView) {
  const target = cat.nextTier ? cat.nextTier.threshold : cat.tiers[cat.tiers.length - 1]?.threshold ?? 1;
  const prevThreshold = cat.highestUnlocked?.threshold ?? 0;
  const span = target - prevThreshold;
  if (span <= 0) return 100;
  const progressed = Math.min(cat.currentCount - prevThreshold, span);
  return Math.max(0, Math.min(100, (progressed / span) * 100));
}

async function onTierClick(tier: AchievementTierView) {
  if (!tier.unlocked) return;

  const makingActive = showcaseId.value !== tier.id;
  const newValue = makingActive ? tier.id : null;
  const ok = await setShowcaseAchievement(newValue);

  if (ok) {
    showcaseId.value = newValue;
    const toast = await toastController.create({
      message: makingActive ? t("achievements.showcaseSet") : t("achievements.showcaseCleared"),
      duration: 1800,
      color: "carrot",
      position: "bottom",
    });
    toast.present();
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return;
  currentUserId = userId;

  const [{ data: profile }] = await Promise.all([
    supabase.from("user_profiles").select("showcase_achievement_id").eq("id", userId).single(),
    loadAll(userId),
  ]);

  showcaseId.value = profile?.showcase_achievement_id ?? null;
});
</script>

<style scoped>
.achievements-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, var(--ion-color-carrot) 0%, #ff9f43 100%);
  color: white;
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.summary-trophy-icon {
  font-size: 2.4rem;
}

.summary-text {
  display: flex;
  flex-direction: column;
}

.summary-count {
  font-size: 1.4rem;
  font-weight: 700;
}

.summary-label {
  font-size: 0.8rem;
  opacity: 0.9;
}

.achievement-card {
  padding: 16px;
  border-radius: 16px;
}

.achievement-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.achievement-category-icon {
  font-size: 2rem;
  line-height: 1;
}

.achievement-category-heading h3 {
  margin: 0 0 2px 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.achievement-category-heading p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.achievement-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.achievement-progress-count,
.achievement-progress-target {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  min-width: 32px;
  text-align: center;
}

.progress-container {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--ion-color-light-shade, #e6e6e6);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--ion-color-carrot);
  transition: width 0.4s ease;
}

.achievement-next-hint {
  margin: 4px 0 12px 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.achievement-maxed {
  color: var(--ion-color-carrot);
  font-weight: 600;
}

.tier-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.tier-medal {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 74px;
  padding: 10px 4px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--ion-color-light, #f4f4f4);
  opacity: 0.55;
  filter: grayscale(70%);
  font-family: inherit;
}

.tier-medal.unlocked {
  opacity: 1;
  filter: none;
  background: rgba(255, 159, 67, 0.12);
}

.tier-medal.showcased {
  border-color: var(--ion-color-carrot);
}

.tier-medal-icon {
  font-size: 1.6rem;
}

.tier-medal-name {
  font-size: 0.62rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.1;
  color: var(--ion-color-dark);
}

.tier-medal-threshold {
  font-size: 0.62rem;
  color: var(--ion-color-medium);
}
</style>
