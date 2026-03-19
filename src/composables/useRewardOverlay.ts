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

let animFrame: number | null = null;

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

export function openReward(points: number, action: string, avatar?: string, newTotal?: number) {
    const nextTotal = newTotal ?? (currentPoints.value ?? 0);

    if (nextTotal === rewardTotal.value) {
        // 👀 nothing changed, skip re-animation
        return;
    }

    rewardPoints.value = points;
    rewardAction.value = action;
    rewardAvatar.value = avatar || "";
    rewardTotal.value = nextTotal;
    rewardDisplay.value = rewardTotal.value - points;
    rewardOpen.value = true;

    animateReward();
}



export function closeReward() {
    rewardOpen.value = false;
    if (animFrame) cancelAnimationFrame(animFrame);
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

