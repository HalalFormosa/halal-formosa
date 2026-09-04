import { supabase } from "@/plugins/supabaseClient";
import { ref } from "vue";
import { usePointRules } from "@/composables/usePointRules";
import { openReward, closeReward } from "@/composables/useRewardOverlay";
import { useAchievements } from "@/composables/useAchievements";
import { i18n } from "@/i18n";
import confetti from "canvas-confetti";
import lottie from "lottie-web";
import { Capacitor } from "@capacitor/core";

const EDGE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const currentPoints = ref<number | null>(null); // 👈 exported

const fallbackRules: Record<string, { points: number; label: string }> = {
    add_product: { points: 10, label: "Adding Product" },
    add_place: { points: 10, label: "Adding Place" },
    create_news: { points: 20, label: "Creating News" },
    share_card: { points: 5, label: "Sharing Card" },
    daily_mission_bonus: { points: 50, label: "Daily Missions Completion" },
    mission_open_app: { points: 5, label: "Opening App" },
    mission_find_muslim_friendly: { points: 5, label: "Find Muslim-friendly product" },
    mission_scan_barcode: { points: 5, label: "Scan Barcode" },
    mission_scan_ingredients: { points: 5, label: "Scan Ingredients" },
    mission_view_place_details: { points: 5, label: "Check location details" },
    location_review: { points: 10, label: "Reviewing Place" },
    mission_review_place: { points: 10, label: "Review Place Daily Mission" },
};

// 🎉 Confetti helper
function fireConfetti() {
    if (Capacitor.isNativePlatform()) {
        // 👉 Use Lottie for native
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.pointerEvents = "none";
        container.style.zIndex = "9999";
        document.body.appendChild(container);

        lottie.loadAnimation({
            container,
            renderer: "svg",
            loop: false,
            autoplay: true,
            path: "/lottie/Confetti.json",
        });

        setTimeout(() => container.remove(), 10000);
        return;
    }

    // 👉 Web fallback with canvas-confetti
    confetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.4 } });
    confetti({ particleCount: 60, spread: 100, origin: { x: 0.2, y: 0.6 } });
    confetti({ particleCount: 60, spread: 100, origin: { x: 0.8, y: 0.6 } });
}

// 🏆 Checks whether the action that just earned points also crossed an
// achievement tier, and queues a trophy-flavored reward toast for each one
// unlocked — staggered to play after the XP toast (and any earlier trophy
// toasts) finish, since they all share the same overlay state.
async function celebrateNewAchievements(userId: string, avatar: string) {
    const { syncAchievements, fetchDefinitions, definitions } = useAchievements();
    const unlocked = await syncAchievements(userId);
    if (!unlocked.length) return;

    await fetchDefinitions();

    let delay = 4200; // let the XP toast (4000ms) finish first
    for (const u of unlocked) {
        const def = definitions.value.find((d) => d.id === u.unlocked_achievement_id);
        const label = def
            ? i18n.global.t(`achievements.categories.${def.category}.tiers.${def.tier}`)
            : i18n.global.t("achievements.title");
        const icon = def?.icon ?? "🏆";

        setTimeout(() => {
            const newTotal = (currentPoints.value ?? 0) + u.points_reward;
            currentPoints.value = newTotal;
            openReward(u.points_reward, label, avatar, newTotal, 4500, { icon, isAchievement: true });
            fireConfetti();
        }, delay);

        delay += 4700;
    }
}

export function usePoints() {
    const { rules } = usePointRules();

    async function awardAndCelebrate(action: string, autoCloseMs = 5000) {
        console.log("🚀 awardAndCelebrate called with", action);

        const rule = rules.value[action] ?? fallbackRules[action];
        const optimisticPoints = rule?.points ?? 0;
        const optimisticLabel = rule?.label ?? action;

        // 🔑 Get session for avatar
        const session = (await supabase.auth.getSession()).data.session;
        const avatar = session?.user?.user_metadata?.avatar_url || "";

        // Show optimistic popup
        openReward(optimisticPoints, optimisticLabel, avatar, (currentPoints.value ?? 0) + optimisticPoints);

        fireConfetti();

        // Call backend
        const res = await awardPoints(action);

        if (res.success) {
            openReward(
                res.points ?? optimisticPoints,
                res.label ?? optimisticLabel,
                avatar,
                res.total
            );
            currentPoints.value = res.total ?? currentPoints.value;
            console.log(
                `✅ Confirmed ${res.points} pts for ${res.label}. Total = ${res.total}`
            );

            const userId = session?.user?.id;
            if (userId) celebrateNewAchievements(userId, avatar);
        } else {
            console.warn("❌ Failed:", res.error);
            closeReward();
        }

        return res;
    }


    async function awardPoints(action: string) {
        try {
            const session = (await supabase.auth.getSession()).data.session;
            if (!session) throw new Error("❌ Not logged in");

            const prevPoints = currentPoints.value ?? 0;
            const rule = rules.value[action] ?? fallbackRules[action];
            const optimisticIncrement = rule?.points ?? 0;

            currentPoints.value = prevPoints + optimisticIncrement;
            fireConfetti();

            const res = await fetch(`${EDGE_BASE_URL}/award-points`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                currentPoints.value = prevPoints; // rollback
                throw new Error(json.error || "Unknown error");
            }

            if (json.total !== undefined) {
                currentPoints.value = json.total;
            }

            return json;
        } catch (err) {
            console.error("❌ Error in awardPoints:", err);
            return { success: false, error: String(err) };
        }
    }

    // 🔄 Fetch current points from DB
    async function fetchCurrentPoints(userId: string) {
        const { data, error } = await supabase
            .from("user_profiles")
            .select("points, spendable_points")
            .eq("id", userId)
            .single();

        if (!error && data) {
            currentPoints.value = data.points ?? 0;
        }
    }

    return { awardPoints, awardAndCelebrate, fetchCurrentPoints, currentPoints };
}
