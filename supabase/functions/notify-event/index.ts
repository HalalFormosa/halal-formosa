// supabase/functions/notify-event/index.ts
//
// SECURITY MODEL (hardened 2026-10-07). This function is public (verify_jwt = false) because guests and DB
// triggers post Discord notices, so what a caller may DO is decided here:
//   * Push to ALL users (OneSignal "All" segment) only when the caller is a verified ADMIN (or the service role)
//     AND the type is one of BROADCAST_TYPES (public content: new/updated product, place, article).
//   * Admin-review types (product/location/contributor needs review) are pushed to ADMINS ONLY (by user id), and
//     only for a real, still-pending submission that belongs to the caller; the push text comes from the database.
//   * Everything else is delivered to Discord only.
//   * Push content is sanitized: deep links are built/validated server-side, only a small allowlist of data
//     keys is forwarded (never emails/user ids), titles/messages are length-capped, images must be https.
//   * Discord: mentions are disabled, an explicit webhook override must be a real Discord webhook URL.
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------------------------------------------------
   Environment
--------------------------------------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY");

// Default Fallback
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL");

// Specific Channels (Optional Environment Variables)
const DISCORD_WEBHOOK_URL_REGISTRATIONS = Deno.env.get("DISCORD_WEBHOOK_URL_REGISTRATIONS");
const DISCORD_WEBHOOK_URL_CONTRIBUTIONS = Deno.env.get("DISCORD_WEBHOOK_URL_CONTRIBUTIONS");
const DISCORD_WEBHOOK_URL_GROWTH = Deno.env.get("DISCORD_WEBHOOK_URL_GROWTH");
const DISCORD_WEBHOOK_URL_ALERTS = Deno.env.get("DISCORD_WEBHOOK_URL_ALERTS");

const WEB_BASE_URL = "https://app.halalformosa.com";
const COOLDOWN_MINUTES = 60;

// The ONLY types that may push to every user, and only when sent by an admin.
const BROADCAST_TYPES = new Set([
  "new_product", "update_product", "new_place", "update_place", "new_article", "update_article",
]);
// Review requests: pushed to admins' devices only (see verifyReviewSubmission / sendAdminPush).
const ADMIN_REVIEW_TYPES = new Set([
  "product_needs_review", "location_needs_review", "contributor_application_needs_review",
]);

// A single user can trigger at most this many admin pushes per hour (a real submission is required for each).
const ADMIN_PUSH_MAX_PER_HOUR = 10;

const MAX_BODY_CHARS = 20_000;
const MAX_TITLE = 120;
const MAX_PUSH_MESSAGE = 300;
const MAX_DISCORD_MESSAGE = 1800;

/* ---------------------------------------------------
   Clients
--------------------------------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ---------------------------------------------------
   CORS
--------------------------------------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* ---------------------------------------------------
   Helpers
--------------------------------------------------- */
const clamp = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const isHttps = (u: unknown) => typeof u === "string" && /^https:\/\/\S+$/.test(u) && u.length <= 1000;
const DISCORD_HOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const LINK_RE = /^myapp:\/\/(item|place|news)\/[A-Za-z0-9._~-]{1,64}$/;

// Who is calling? Admin / service role are the only callers allowed to push to everyone.
async function resolveCaller(req: Request): Promise<{ userId: string | null; isAdmin: boolean }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { userId: null, isAdmin: false };
  if (token === SUPABASE_SERVICE_ROLE_KEY) return { userId: null, isAdmin: true };
  try {
    const { data, error } = await supabase.auth.getUser(token); // fails for the public anon key
    if (error || !data?.user) return { userId: null, isAdmin: false };
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    return { userId: data.user.id, isAdmin: !!role };
  } catch {
    return { userId: null, isAdmin: false };
  }
}

// Deep link built from validated values only (a client-supplied link is accepted only if it matches our own scheme).
function buildDeepLink(type: string, data: any): string | undefined {
  if (data?.link && LINK_RE.test(String(data.link))) return String(data.link);
  const native = !!data?.isNative;
  const barcode = data?.barcode != null ? String(data.barcode) : "";
  const id = data?.id != null ? String(data.id) : "";
  if (/^[0-9A-Za-z_-]{1,40}$/.test(barcode)) {
    return native ? `myapp://item/${barcode}` : `${WEB_BASE_URL}/item/${barcode}`;
  }
  if (/^[0-9A-Za-z_-]{1,64}$/.test(id)) {
    if (type.includes("place") || type.includes("location")) return native ? `myapp://place/${id}` : `${WEB_BASE_URL}/place/${id}`;
    if (type.includes("article")) return native ? `myapp://news/${id}` : `${WEB_BASE_URL}/news/${id}`;
  }
  return undefined;
}

// Only these keys ever travel inside a push payload (no emails, no user ids, nothing caller-defined).
function pushData(data: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["barcode", "id", "status"]) {
    if (data?.[k] != null && /^[\w .-]{1,64}$/.test(String(data[k]))) out[k] = String(data[k]);
  }
  return out;
}

async function opsLog(level: "info" | "warn" | "error", event: string, detail: unknown) {
  try { await supabase.from("ops_events").insert({ source: "notify-event", level, event, detail }); } catch { /* never break notifications */ }
}

/* ---------------------------------------------------
   Admin-targeted push (review requests)
   Delivered ONLY to admins' devices (OneSignal external_id = Supabase user id, set by OneSignal.login in the app).
   The submission must be real and belong to the caller, and the push text comes from the database.
--------------------------------------------------- */
async function getAdminIds(): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
}

async function verifyReviewSubmission(
  type: string, data: any, userId: string | null,
): Promise<{ ok: boolean; title?: string; body?: string; link?: string; why?: string }> {
  if (!userId) return { ok: false, why: "not_logged_in" };

  if (type === "product_needs_review") {
    const barcode = data?.barcode != null ? String(data.barcode) : "";
    if (!/^[0-9A-Za-z_-]{1,40}$/.test(barcode)) return { ok: false, why: "bad_barcode" };
    const { data: p } = await supabase.from("products").select("name, approved, added_by").eq("barcode", barcode).maybeSingle();
    if (!p || p.added_by !== userId || p.approved === true) return { ok: false, why: "product_not_pending_or_not_yours" };
    return { ok: true, title: "🔍 Product needs review", body: clamp(p.name, 120), link: `myapp://item/${barcode}` };
  }
  if (type === "location_needs_review") {
    const id = data?.id != null ? String(data.id) : "";
    if (!/^[0-9]{1,12}$/.test(id)) return { ok: false, why: "bad_location_id" };
    const { data: l } = await supabase.from("locations").select("name, approved, created_by").eq("id", id).maybeSingle();
    if (!l || l.created_by !== userId || l.approved === true) return { ok: false, why: "location_not_pending_or_not_yours" };
    return { ok: true, title: "🔍 Place needs review", body: clamp(l.name, 120), link: `myapp://place/${id}` };
  }
  if (type === "contributor_application_needs_review") {
    const { data: a } = await supabase.from("contributor_applications").select("id").eq("user_id", userId).eq("status", "pending").limit(1);
    if (!a || a.length === 0) return { ok: false, why: "no_pending_application" };
    return { ok: true, title: "🔍 Contributor application", body: "A new contributor application is waiting for review." };
  }
  return { ok: false, why: "not_a_review_type" };
}

async function sendAdminPush(title: string, body: string, link?: string, extra?: Record<string, string>) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) return { sent: false, why: "onesignal_not_configured" };
  const adminIds = await getAdminIds();
  if (adminIds.length === 0) return { sent: false, why: "no_admins" };
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: adminIds },
      target_channel: "push",
      headings: { en: clamp(title, MAX_TITLE) },
      contents: { en: clamp(body, MAX_PUSH_MESSAGE) },
      data: extra ?? {},
      url: link,
      ttl: 3600,
    }),
  });
  const text = await res.text();
  let notificationId = "";
  try { notificationId = JSON.parse(text)?.id ?? ""; } catch { /* not JSON */ }
  // OneSignal answers 200 with an empty id when nobody matched, so require a real notification id.
  return { sent: res.ok && !!notificationId, status: res.status, admins: adminIds.length, notification_id: notificationId, response: text.slice(0, 300) };
}

/* ---------------------------------------------------
   Server
--------------------------------------------------- */
serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`🚀 notify-event start [${requestId}]`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    if (!text) {
      return new Response("Empty request body", { status: 400, headers: corsHeaders });
    }

    if (text.length > MAX_BODY_CHARS) {
      return new Response("Payload too large", { status: 413, headers: corsHeaders });
    }

    const event = JSON.parse(text);
    const { type, title, message, image, data, channels, discord_webhook } = event;

    if (!type || !message || typeof type !== "string" || !/^[A-Za-z0-9_]{1,64}$/.test(type)) {
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }

    const safeTitle = clamp(title ?? "Notification", MAX_TITLE);
    const safeMessage = clamp(message, MAX_DISCORD_MESSAGE);

    /* ---------------------------------------------------
       Channel resolution (the security decision)
    --------------------------------------------------- */
    const requested: string[] = Array.isArray(channels) && channels.length ? channels : ["discord", "onesignal"]; // legacy default = both
    const sendDiscord = requested.includes("discord");
    const wantsPush = requested.includes("onesignal");

    const caller = wantsPush ? await resolveCaller(req) : { userId: null, isAdmin: false };
    const pushAllowed = wantsPush && BROADCAST_TYPES.has(type) && caller.isAdmin;
    let sendOneSignal = pushAllowed;

    // Review requests are pushed to ADMINS ONLY, and only for a real submission that belongs to the caller.
    let adminPushSent = false;
    if (wantsPush && ADMIN_REVIEW_TYPES.has(type)) {
      try {
        const v = await verifyReviewSubmission(type, data, caller.userId);
        if (!v.ok) {
          await opsLog("warn", "admin_push_unverified", { type, caller: caller.userId, why: v.why });
        } else {
          const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { count } = await supabase.from("ops_events").select("id", { count: "exact", head: true })
            .eq("source", "notify-event").eq("event", "admin_push_sent").eq("detail->>caller", caller.userId!).gte("created_at", since);
          if ((count ?? 0) >= ADMIN_PUSH_MAX_PER_HOUR) {
            await opsLog("warn", "admin_push_rate_limited", { type, caller: caller.userId });
          } else {
            const r = await sendAdminPush(v.title!, v.body!, v.link, pushData(data));
            adminPushSent = r.sent;
            await opsLog(r.sent ? "info" : "error", r.sent ? "admin_push_sent" : "admin_push_failed", { type, caller: caller.userId, result: r });
            console.log(`📲 [${requestId}] admin push ${r.sent ? "sent" : "FAILED"} type=${type}`);
          }
        }
      } catch (e) {
        console.error(`❌ [${requestId}] admin push error`, e);
        await opsLog("error", "admin_push_failed", { type, error: String(e).slice(0, 200) });
      }
    } else if (wantsPush && !pushAllowed) {
      console.warn(`🛡️ [${requestId}] push to all users blocked: type=${type} admin=${caller.isAdmin}`);
      // A non-admin (or an unknown type) asked to push to everyone: worth a record admins can see.
      await opsLog("warn", "push_blocked", { type, caller: caller.userId, is_admin: caller.isAdmin });
    }

    // What was ACTUALLY delivered (this is what notifications_log records).
    const resolvedChannels = [
      ...(sendDiscord ? ["discord"] : []),
      ...(pushAllowed ? ["onesignal"] : []),
      ...(adminPushSent ? ["onesignal_admin"] : []),
    ];

    /* ---------------------------------------------------
       1️⃣ Discord (conditional)
    --------------------------------------------------- */
    if (sendDiscord) {
      // An explicit webhook is honoured only if it is a genuine Discord webhook URL.
      let webhookUrl = (typeof discord_webhook === "string" && DISCORD_HOOK_RE.test(discord_webhook)) ? discord_webhook : DISCORD_WEBHOOK_URL;
      const explicit = webhookUrl !== DISCORD_WEBHOOK_URL;

      if (!explicit) {
        // 🟢 REGISTRATIONS: Merchant signups, new user activations, onboarding skipped
        if (
          type === "new_merchant_application" ||
          type === "registration" ||
          type === "user_activated" ||
          type === "onboarding_skipped"
        ) {
          webhookUrl = DISCORD_WEBHOOK_URL_REGISTRATIONS || webhookUrl;
        }
        // 🔴 ALERTS: Reports, unknown scans, errors
        else if (
          type.includes("report") ||
          type === "unknown_product_scanned" ||
          type === "alert" ||
          type === "error"
        ) {
          webhookUrl = DISCORD_WEBHOOK_URL_ALERTS || webhookUrl;
        }
        // 💰 GROWTH: Subscriptions/Payments
        else if (type === "pro_purchase_success") {
          webhookUrl = DISCORD_WEBHOOK_URL_GROWTH || webhookUrl;
        }
        // 🛠️ CONTRIBUTIONS: Adding/Creating products, places, articles
        else if (
          type.includes("product") ||
          type.includes("place") ||
          type.includes("location") ||
          type.includes("article")
        ) {
          webhookUrl = DISCORD_WEBHOOK_URL_CONTRIBUTIONS || webhookUrl;
        }
      }

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Halal Formosa Bot",
            content: `**${safeTitle}**\n${safeMessage}`.slice(0, 1990),
            allowed_mentions: { parse: [] }, // never let a caller ping @everyone / roles
            embeds: isHttps(image) ? [{ image: { url: image } }] : undefined,
          }),
        });
        console.log(`💬 Discord notification sent to ${explicit ? "explicit" : (webhookUrl === DISCORD_WEBHOOK_URL ? "default" : "type-specific")} channel`);
      } else {
        console.warn("⚠️ Discord requested but no webhook URL found");
      }
    }

    /* ---------------------------------------------------
       2️⃣ OneSignal cooldown (only if used)
    --------------------------------------------------- */
    if (sendOneSignal) {
      const since = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

      console.log(`⏳ [${requestId}] Checking cooldown since ${since} for type=${type}`);

      const { data: recent, error: cooldownError } = await supabase
        .from("notifications_log")
        .select("id, created_at")
        .eq("type", type)
        .contains("channels", ["onesignal"]) // only earlier real pushes count (not Discord-only rows)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cooldownError) {
        console.error(`❌ [${requestId}] Cooldown query failed`, cooldownError);
      }

      if (recent?.length) {
        console.log(`⏳ [${requestId}] Cooldown HIT for type=${type}, last=${recent[0].created_at}`);
        sendOneSignal = false;
      } else {
        console.log(`✅ [${requestId}] Cooldown MISS for type=${type}`);
      }
    }

    /* ---------------------------------------------------
       3️⃣ Deep link resolution (server-built / validated)
    --------------------------------------------------- */
    const finalUrl = buildDeepLink(type, data);
    console.log("🔗 Final URL:", finalUrl ?? "none");

    /* ---------------------------------------------------
       4️⃣ OneSignal push (admin + broadcast type only)
    --------------------------------------------------- */
    if (sendOneSignal && ONESIGNAL_APP_ID && ONESIGNAL_API_KEY) {
      const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: safeTitle || "📢 New Update" },
        contents: { en: clamp(safeMessage, MAX_PUSH_MESSAGE) },
        big_picture: isHttps(image) ? image : undefined,
        data: pushData(data),
        url: finalUrl,
        ttl: 600,
      };

      const res = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("🔔 OneSignal response:", await res.text());
    }

    /* ---------------------------------------------------
       5️⃣ Log (what was actually delivered)
    --------------------------------------------------- */
    console.log(`📝 [${requestId}] Attempting insert into notifications_log`);

    const { error: insertError, data: insertData } = await supabase
      .from("notifications_log")
      .insert({
        type,
        message: safeMessage,
        channels: resolvedChannels,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`❌ [${requestId}] INSERT FAILED`, insertError);
    } else {
      console.log(`✅ [${requestId}] INSERT SUCCESS id=${insertData.id}`);
    }

    return new Response("✅ Notification processed", { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("❌ notify-event error:", err);

    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
