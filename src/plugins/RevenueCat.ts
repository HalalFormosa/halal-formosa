// src/plugins/RevenueCat.ts
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { isDeviceOnline } from '@/utils/connectivity';

const INIT_TIMEOUT_MS = 6000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

export async function initRevenueCat(userId?: string) {
    // No point trying (and no risk of hanging) if we're already known to be offline —
    // the app should just keep running on whatever entitlement state is already cached.
    if (!isDeviceOnline()) {
        console.warn("📴 [RC] Device offline, skipping RevenueCat init — using cached entitlement state");
        return;
    }

    const apiKey = Capacitor.getPlatform() === 'ios'
        ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
        : import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;

    if (!apiKey) {
        console.warn("⚠️ RevenueCat API key is missing for platform:", Capacitor.getPlatform());
        return;
    }

    try {
        await withTimeout(Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }), INIT_TIMEOUT_MS, 'RevenueCat setLogLevel');

        if (userId) {
            await withTimeout(
                Purchases.configure({ apiKey, appUserID: userId }),
                INIT_TIMEOUT_MS,
                'RevenueCat configure'
            );
            console.log("🔐 RevenueCat configured with userId:", userId);
        } else {
            await withTimeout(Purchases.configure({ apiKey }), INIT_TIMEOUT_MS, 'RevenueCat configure');
            console.log("👤 RevenueCat configured anonymously");
        }
    } catch (err) {
        // A hung/failed native call must never block app startup — fall back to
        // whatever entitlement state is already cached from a previous session.
        console.warn("⚠️ RevenueCat init failed/timed out, using cached entitlement state:", err);
    }
}