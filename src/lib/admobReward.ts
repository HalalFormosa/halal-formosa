import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

export async function showRewardedAd(adUnitId: string, onReward: () => void): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        console.warn("Rewarded ads can only run on mobile devices.");
        return;
    }

    return new Promise<void>(async (resolve, reject) => {
        const listeners: any[] = [];
        
        const cleanup = async () => {
            console.log("🧹 Cleaning up AdMob listeners...");
            for (const handle of listeners) {
                try {
                    await handle.remove();
                } catch (e) {
                    console.debug("Listener remove skip", e);
                }
            }
        };

        try {
            console.log("📌 Preparing Rewarded Ad…");

            const isTesting = import.meta.env.VITE_ADMOB_TESTING === 'true';
            let finalAdId = adUnitId;
            if (isTesting) {
                finalAdId = Capacitor.getPlatform() === 'ios'
                    ? 'ca-app-pub-3940256099942544/1712485313'  // Google iOS demo rewarded ID
                    : 'ca-app-pub-3940256099942544/5224354917'; // Google Android demo rewarded ID
            }

            // Register listeners BEFORE preparing the ad so we don't miss any events
            const loadedListener = await AdMob.addListener(
                RewardAdPluginEvents.Loaded,
                async () => {
                    console.log("✅ Rewarded ad LOADED. Showing ad now...");
                    try {
                        await AdMob.showRewardVideoAd();
                    } catch (showErr) {
                        console.error("❌ Failed to show rewarded ad after load:", showErr);
                        await cleanup();
                        reject(showErr);
                    }
                }
            );
            listeners.push(loadedListener);

            const failedToLoadListener = await AdMob.addListener(
                RewardAdPluginEvents.FailedToLoad,
                async (err) => {
                    console.error("❌ Rewarded ad failed to load:", err);
                    await cleanup();
                    reject(err);
                }
            );
            listeners.push(failedToLoadListener);

            const rewardListener = await AdMob.addListener(
                RewardAdPluginEvents.Rewarded,
                async (reward) => {
                    console.log("🎉 User rewarded:", reward);
                    try {
                        await onReward();
                    } catch (e) {
                        console.error("Error in onReward callback:", e);
                    }
                }
            );
            listeners.push(rewardListener);

            const failListener = await AdMob.addListener(
                RewardAdPluginEvents.FailedToShow,
                async (err) => {
                    console.error("❌ Rewarded Ad Failed to Show:", err);
                    await cleanup();
                    reject(err);
                }
            );
            listeners.push(failListener);

            const dismissedListener = await AdMob.addListener(
                RewardAdPluginEvents.Dismissed,
                async () => {
                    console.log("ℹ️ Rewarded ad dismissed by user.");
                    await cleanup();
                    resolve();
                }
            );
            listeners.push(dismissedListener);

            // Now prepare the ad
            await AdMob.prepareRewardVideoAd({
                adId: finalAdId,
                isTesting
            });

        } catch (err) {
            console.error("Rewarded ad setup error:", err);
            await cleanup();
            reject(err);
        }
    });
}
