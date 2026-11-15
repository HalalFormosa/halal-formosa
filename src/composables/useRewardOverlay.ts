// useRewardOverlay.ts
import {computed, ref} from "vue";
import { currentPoints } from "@/composables/usePoints";
import {xpForLevel} from "@/utils/xp";

export const rewardOpen = ref(false);
export const rewardPoints = ref(0);
export const rewardAction = ref("");
export const rewardAvatar = ref(""); // 👈 user avatar
export const rewardTotal = ref(0);   // final total
export const rewardDisplay = ref(0); // animated total
export const rewardIcon = ref("");        // overrides the ✨ fallback icon (e.g. a trophy tier's emoji)
export const rewardIsAchievement = ref(false); // trophy-flavored toast instead of a plain XP grant

let animFrame: number | null = null;
let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

export const rewardLevel = computed(() => {
    let lvl = 1;
    while (rewardDisplay.value >= xpForLevel(lvl + 1)) {
        lvl++;
    }
    return lvl;
});

export const rewardPrevXp = computed(() => xpForLevel(rewardLevel.value));
export const rewardNextXp = computed(() => xpForLevel(rewardLevel.value + 1));

export const rewardProgress = computed(() => {
    const xp = rewardDisplay.value;
    return (xp - rewardPrevXp.value) / (rewardNextXp.value - rewardPrevXp.value);
});

export function openReward(
    points: number,
    action: string,
    avatar?: string,
    newTotal?: number,
    durationMs = 4000,
    opts?: { icon?: string; isAchievement?: boolean }
) {
    const nextTotal = newTotal ?? (currentPoints.value ?? 0);

    if (nextTotal === rewardTotal.value && rewardOpen.value && !opts?.isAchievement) {
        // 👀 nothing changed, skip re-animation if already open
        return;
    }

    rewardPoints.value = points;
    rewardAction.value = action;
    rewardAvatar.value = avatar || "";
    rewardIcon.value = opts?.icon || "";
    rewardIsAchievement.value = opts?.isAchievement ?? false;
    rewardTotal.value = nextTotal;
    rewardDisplay.value = Math.max(0, rewardTotal.value - points);
    rewardOpen.value = true;

    animateReward();

    if (dismissTimeout) clearTimeout(dismissTimeout);
    dismissTimeout = setTimeout(() => {
        closeReward();
    }, durationMs);
}



export function closeReward() {
    rewardOpen.value = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
    }
}

function animateReward(duration = 1200) {
    if (animFrame) cancelAnimationFrame(animFrame); // ✅ clear old animation
    const start = rewardDisplay.value;
    const end = rewardTotal.value;
    const startTime = performance.now();

    function step(now: number) {
        const progress = Math.min((now - startTime) / duration, 1);
        rewardDisplay.value = Math.round(start + (end - start) * progress);
        if (progress < 1) {
            animFrame = requestAnimationFrame(step);
        }
    }

    animFrame = requestAnimationFrame(step);
}

