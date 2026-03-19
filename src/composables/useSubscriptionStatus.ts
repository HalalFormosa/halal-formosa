import { ref } from "vue";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/plugins/supabaseClient";

export const isDonor = ref(false);
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

        // ✅ ONLY responsibility
        isDonor.value = hasPro;

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

            console.log("✅ [Sub] sync-subscription success", data)
            return data   // ✅ ADD THIS

        } else {
            console.log("⏭️ [Sub] syncToServer disabled, skipping backend sync");
        }

    } catch (err) {
        console.error("❌ [Sub] refreshSubscriptionStatus failed:", err);
        isDonor.value = false;
    }
}
