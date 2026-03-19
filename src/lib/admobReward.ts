import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

export async function showRewardedAd(adUnitId: string, onReward: () => void) {
    if (!Capacitor.isNativePlatform()) {
        console.warn("Rewarded ads can only run on mobile devices.");
        return;
    }

    try {
        console.log("📌 Loading Rewarded Ad…");

        const isTesting = import.meta.env.VITE_ADMOB_TESTING === 'true';

        // 1️⃣ Load the ad
        await AdMob.prepareRewardVideoAd({
            adId: adUnitId,
            isTesting
        });

        // 2️⃣ When successfully loaded
        const loadedListener = await AdMob.addListener(
            RewardAdPluginEvents.Loaded,
            () => {
                console.log("✅ Rewarded ad LOADED.");
            }
        );

        // 3️⃣ When user earns reward
        const rewardListener = await AdMob.addListener(
            RewardAdPluginEvents.Rewarded,
            async (reward) => {
                console.log("🎉 User rewarded:", reward);
                onReward();
                await rewardListener.remove();
                await loadedListener.remove();
            }
        );

        // 4️⃣ On error showing ad
        const failListener = await AdMob.addListener(
            RewardAdPluginEvents.FailedToShow,
            async (err) => {
                console.error("❌ Rewarded Ad Failed:", err);
                await failListener.remove();
            }
        );

        // 5️⃣ show the ad
        console.log("📌 Showing Rewarded Ad…");
        await AdMob.showRewardVideoAd();

    } catch (err) {
        console.error("Rewarded ad error:", err);
    }
}
