import { ref } from "vue";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/plugins/supabaseClient";

const SUB_CACHE_KEY = "user_pro_status";

// Initialize from cache if available to prevent UI flicker/ads on bad internet
const cachedStatus = localStorage.getItem(SUB_CACHE_KEY) === "true";
export const isDonor = ref(import.meta.env.DEV ? true : cachedStatus);
export const lastSyncedEntitlement = ref<string | null>(null);

export async function refreshSubscriptionStatus(options?: {
    syncToServer?: boolean;
}) {
    if (!Capacitor.isNativePlatform()) {
        console.log("⏭️ [Sub] Not native platform, skipping");
        return;
    }

    try {
        console.log("🔄 [Sub] Fetching RevenueCat customer info...");

        const { customerInfo } = await Purchases.getCustomerInfo();

        const hasPro = Boolean(
            customerInfo.entitlements.active["Halal Formosa Pro"]
        );

        // ✅ Update ref and cache
        isDonor.value = hasPro;
        localStorage.setItem(SUB_CACHE_KEY, String(hasPro));

        console.log("⭐ [Sub] Pro entitlement =", hasPro);

        /* ---------------------------------------------
         * Optional backend sync
         * --------------------------------------------- */
        if (options?.syncToServer) {
            console.log("🚀 [Sub] Calling sync-subscription Edge Function");

            const { data, error } = await supabase.functions.invoke(
                "sync-subscription",
                { body: { customerInfo } }
            )

            if (error) {
                console.error("❌ [Sub] sync-subscription failed", error)
                throw error
            }

            console.log("✅ [Sub] sync-subscription success")
            return data

        } else {
            console.log("⏭️ [Sub] syncToServer disabled, skipping backend sync");
        }

    } catch (err) {
        console.error("❌ [Sub] refreshSubscriptionStatus failed:", err);
        // 🛡️ IMPORTANT: Don't set isDonor to false on network error.
        // Keep the last known status (cachedStatus) to allow offline/poor-internet access.
    }
}
