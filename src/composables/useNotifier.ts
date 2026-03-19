import {supabase} from "@/plugins/supabaseClient";

type NotifyChannel = 'discord' | 'onesignal'

/**
 * Centralized notifier composable
 * Sends notifications via Supabase Edge Function `/notify-event`
 * ✅ OneSignal push
 * ✅ Discord embed
 * ✅ Cooldown logging (server-side)
 * ✅ Deep link support (myapp:// for native, https:// for web)
 */
export function useNotifier() {
    /**
     * Send unified notification to OneSignal + Discord.
     * @param type    Internal category (e.g. "new_place", "new_product")
     * @param title   Notification title (e.g. "🕌 New Halal Place Added!")
     * @param message Body text for both OneSignal and Discord
     * @param image   Optional image URL
     * @param data    Optional extra JSON payload (e.g. { barcode, status })
     */
    const notifyEvent = async (
        type: string,
        title: string,
        message: string,
        image?: string,
        data: Record<string, any> = {},
        channels: NotifyChannel[] = ['discord', 'onesignal'] // ✅ DEFAULT = BOTH
    ) => {
        try {

            // 🧩 2️⃣ Base URL — automatic switch for native/web
            const baseUrl = "myapp://";

            // 🧩 3️⃣ Generate a deep link automatically if missing
            if (!data.link) {
                if ((type === "new_product" || type === "update_product") && data.barcode) {
                    // no slash after baseUrl for native (myapp://item/...)
                    data.link = `${baseUrl}item/${data.barcode}`;
                } else if ((type === "new_place" || type === "update_place") && data.id) {
                    data.link = `${baseUrl}place/${data.id}`;
                } else if ((type === "new_article" || type === "update_article") && data.id) {
                    data.link = `${baseUrl}news/${data.id}`;
                }
            }

            // 🧩 4️⃣ Get Supabase session (for auth header)
            const {
                data: {session},
            } = await supabase.auth.getSession();

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            } else if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
                headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
            }

            // 🧩 5️⃣ Payload for Edge Function
            const payload = {
                type: type ?? "unknown",
                title: title ?? "Notification",
                message: message ?? "",
                image: image || null,
                data: data || {},
                channels, // ✅ NEW
            };

            // 🧩 6️⃣ Send to Supabase Edge Function
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-event`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                console.error("❌ notifyEvent failed:", await res.text());
                return {success: false};
            }

            console.log("✅ notifyEvent sent:", type, data.link || "no link");
            return {success: true};
        } catch (err) {
            console.error("❌ notifyEvent exception:", err);
            return {success: false, error: String(err)};
        }
    };

    return {notifyEvent};
}
