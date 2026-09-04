import { ref, computed } from "vue";
import { supabase } from "@/plugins/supabaseClient";

export interface AchievementDefinition {
  id: string;
  category: string;
  tier: number;
  threshold: number;
  name: string;
  icon: string;
  points_reward: number;
  sort_order: number;
}

export interface UnlockedAchievement {
  achievement_id: string;
  unlocked_at: string;
}

export interface AchievementTierView extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  isNextTier: boolean;
}

export interface AchievementCategoryView {
  category: string;
  currentCount: number;
  tiers: AchievementTierView[];
  highestUnlocked: AchievementTierView | null;
  nextTier: AchievementTierView | null;
}

export const ACHIEVEMENT_CATEGORIES = [
  "scanner",
  "halal_hunter",
  "explorer",
  "community_pillar",
  "community_voice",
  "halal_habit",
] as const;

export const definitions = ref<AchievementDefinition[]>([]);
export const unlockedAchievements = ref<UnlockedAchievement[]>([]);
export const categoryCounts = ref<Record<string, number>>({});
export const loadingAchievements = ref(false);

let definitionsLoaded = false;

export function useAchievements() {
  async function fetchDefinitions() {
    if (definitionsLoaded) return;
    const { data, error } = await supabase
      .from("achievement_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("tier", { ascending: true });

    if (!error && data) {
      definitions.value = data as AchievementDefinition[];
      definitionsLoaded = true;
    }
  }

  async function fetchUserAchievements(userId: string) {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId);

    if (!error && data) {
      unlockedAchievements.value = data as UnlockedAchievement[];
    }
  }

  async function fetchCounts(userId: string) {
    const { data, error } = await supabase.rpc("get_user_achievement_counts", {
      p_user_id: userId,
    });

    if (!error && data) {
      const map: Record<string, number> = {};
      for (const row of data as { category: string; current_count: number }[]) {
        map[row.category] = row.current_count ?? 0;
      }
      categoryCounts.value = map;
    }
  }

  // Checks for newly-earned tiers, awards their points, and returns what
  // just unlocked (empty array if nothing new) so callers can celebrate it.
  async function syncAchievements(userId: string) {
    const { data, error } = await supabase.rpc("sync_user_achievements", {
      p_user_id: userId,
    });

    if (error || !data) return [];
    return data as {
      unlocked_achievement_id: string;
      category: string;
      tier: number;
      points_reward: number;
      threshold: number;
    }[];
  }

  async function setShowcaseAchievement(achievementId: string | null) {
    const { error } = await supabase.rpc("set_showcase_achievement", {
      p_achievement_id: achievementId,
    });
    return !error;
  }

  async function loadAll(userId: string) {
    loadingAchievements.value = true;
    try {
      await fetchDefinitions();
      await Promise.all([fetchUserAchievements(userId), fetchCounts(userId)]);
      await syncAchievements(userId);
      // Refresh after sync in case new tiers were just unlocked.
      await Promise.all([fetchUserAchievements(userId), fetchCounts(userId)]);
    } finally {
      loadingAchievements.value = false;
    }
  }

  const unlockedIds = computed(
    () => new Set(unlockedAchievements.value.map((u) => u.achievement_id))
  );
  const unlockedAtMap = computed(() => {
    const map: Record<string, string> = {};
    for (const u of unlockedAchievements.value) map[u.achievement_id] = u.unlocked_at;
    return map;
  });

  const categorizedAchievements = computed<AchievementCategoryView[]>(() => {
    return ACHIEVEMENT_CATEGORIES.map((category) => {
      const tiers = definitions.value
        .filter((d) => d.category === category)
        .sort((a, b) => a.tier - b.tier)
        .map((d) => ({
          ...d,
          unlocked: unlockedIds.value.has(d.id),
          unlockedAt: unlockedAtMap.value[d.id] ?? null,
          isNextTier: false,
        }));

      const currentCount = categoryCounts.value[category] ?? 0;
      const highestUnlocked = [...tiers].reverse().find((t) => t.unlocked) ?? null;
      const nextTier = tiers.find((t) => !t.unlocked) ?? null;
      if (nextTier) nextTier.isNextTier = true;

      return { category, currentCount, tiers, highestUnlocked, nextTier };
    });
  });

  const totalUnlockedCount = computed(() => unlockedAchievements.value.length);
  const totalTierCount = computed(() => definitions.value.length);

  return {
    definitions,
    unlockedAchievements,
    categoryCounts,
    loadingAchievements,
    categorizedAchievements,
    totalUnlockedCount,
    totalTierCount,
    fetchDefinitions,
    fetchUserAchievements,
    fetchCounts,
    syncAchievements,
    setShowcaseAchievement,
    loadAll,
  };
}
