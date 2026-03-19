// src/plugins/RevenueCat.ts
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

export async function initRevenueCat(userId?: string) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

    const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY;

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