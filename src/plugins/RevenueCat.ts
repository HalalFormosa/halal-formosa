// src/plugins/RevenueCat.ts
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

export async function initRevenueCat(userId?: string) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

    const apiKey = Capacitor.getPlatform() === 'ios'
        ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
        : import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;

    if (!apiKey) {
        console.warn("⚠️ RevenueCat API key is missing for platform:", Capacitor.getPlatform());
        return;
    }

    if (userId) {
        await Purchases.configure({
            apiKey,
            appUserID: userId
        });

        console.log("🔐 RevenueCat configured with userId:", userId);
    } else {
        await Purchases.configure({ apiKey });
        console.log("👤 RevenueCat configured anonymously");
    }
}