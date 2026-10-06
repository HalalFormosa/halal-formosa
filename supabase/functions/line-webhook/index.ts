// functions/line-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// After this much USER inactivity, a saved "chat" mode expires and the menu is shown again.
// (Note: admin replies sent from the LINE OA app are NOT visible to this webhook,
//  so only the user's own messages keep the session alive.)
const CHAT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const LIMIT_MESSAGE = `⚠️ You've reached your daily limit of 3 analyses on LINE.\n\n📊 To check your usage stats, send @usage.\n\nTo continue analyzing without limits, please download the app or access our web version at:\n🌐 https://halalformosa.com`;

const MENU_MESSAGE = `👋 Halal Formosa\n\nReply with a number:\n1️⃣  Analyze a product image\n2️⃣  Chat with the developer\n\n📊 Send @usage to check your daily quota.\n🌐 https://halalformosa.com`;

const ANALYZE_PROMPT = `📸 Please send the product image to analyze.`;

const CHAT_MESSAGE = `💬 You're now connected with the developer. Type your message here and we'll reply directly — no image needed.\n\n(Send 1 or \"analyze\" anytime to switch back to image analysis.)`;

/* ---------------- Signature verification ---------------- */
// LINE signs every webhook call: x-line-signature = base64(HMAC-SHA256(channel secret, raw request body)).
// Without this check anyone could POST fake events to this public URL (spoof users, burn AI analysis quota).
async function verifyLineSignature(rawBody, signature) {
  if (!LINE_CHANNEL_SECRET || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(LINE_CHANNEL_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
    const given = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    if (given.length !== mac.length) return false;
    let diff = 0; // constant-time comparison
    for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ given[i];
    return diff === 0;
  } catch {
    return false;
  }
}

/* ---------------- Helpers ---------------- */
async function replyMessage(replyToken, text) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }]
      })
    });
    console.log(`LINE reply status: ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("❌ replyMessage exception:", err);
    return false;
  }
}

async function pushMessage(to, text) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }]
      })
    });
    console.log(`LINE push status: ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("❌ pushMessage exception:", err);
    return false;
  }
}

function getResetTime() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const tomorrowStr = formatter.format(tomorrow);
  const nextMidnightTaipei = new Date(`${tomorrowStr}T00:00:00+08:00`);
  const diffMs = nextMidnightTaipei.getTime() - now.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHrs}h ${diffMins}m`;
}

async function getDailyUsage(sourceKey) {
  try {
    const taipeiDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const startOfDay = `${taipeiDate}T00:00:00+08:00`;
    const { count, error } = await supabase
      .from("line_usage_log")
      .select("*", { count: 'exact', head: true })
      .eq("source_key", sourceKey)
      .gte("created_at", startOfDay);
    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error("❌ Error checking usage:", err);
    return 0;
  }
}

async function recordUsage(sourceKey) {
  const { error } = await supabase
    .from("line_usage_log")
    .insert({ source_key: sourceKey });
  if (error) console.error("❌ Error logging usage:", error);
}

async function getModeRow(sourceKey) {
  try {
    const { data } = await supabase
      .from("line_modes")
      .select("mode, updated_at")
      .eq("source_key", sourceKey)
      .maybeSingle();
    return data;
  } catch (err) {
    console.error("❌ getModeRow error:", err);
    return null;
  }
}

async function setMode(sourceKey, mode) {
  const { error } = await supabase
    .from("line_modes")
    .upsert({ source_key: sourceKey, mode, updated_at: new Date().toISOString() });
  if (error) console.error("❌ setMode error:", error);
}

function statusEmoji(status) {
  switch(status){
    case "Muslim-friendly": return "🟢";
    case "Syubhah": return "🟡";
    case "Haram": return "🔴";
    default: return "⚪";
  }
}

/* ---------------- Main ---------------- */
Deno.serve(async (req) => {
  try {
    // Read the raw bytes first: the signature is computed over the exact body LINE sent.
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const signature = req.headers.get("x-line-signature");
    if (!(await verifyLineSignature(rawBody, signature))) {
      console.warn("⛔ Rejected LINE webhook call: missing or invalid x-line-signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(new TextDecoder().decode(rawBody));
    console.log("📥 Incoming LINE event");
    await handleEvents(body.events ?? []);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ LINE webhook error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

/* ---------------- Event Handler ---------------- */
async function handleEvents(events) {
  for (const event of events) {
    const sourceType = event.source?.type;
    const userId = event.source?.userId;
    const sourceKey = event.source?.groupId || event.source?.roomId || userId || "unknown";
    const to = event.source?.groupId || event.source?.roomId || userId;

    // Deduplication
    const eventId = event.message?.id || `${event.type}-${event.timestamp}-${sourceKey}`;
    const { data: seen } = await supabase.from("line_events").select("id").eq("id", eventId).maybeSingle();
    if (seen) continue;

    await supabase.from("line_events").insert({
      id: eventId,
      source_key: sourceKey,
      event_type: event.type,
      created_at: new Date().toISOString()
    });

    // New friend adds the OA → greet with the menu
    if (event.type === "follow") {
      await replyMessage(event.replyToken, MENU_MESSAGE);
      continue;
    }

    if (event.type === "join") {
      const welcomeMsg = `👋 Thanks for inviting Halal Formosa!\n\n📖 How to use:\n1️⃣ Tag me first with @Halal Formosa\n2️⃣ Then send a product image right after\n3️⃣ Wait for the analysis 🟢🟡🔴\n\nℹ️ You can also private message me directly.\n\n📊 Check usage: send @usage\n\n🌐 https://halalformosa.com`;
      await replyMessage(event.replyToken, welcomeMsg);
      continue;
    }

    if (event.type !== "message") continue;

    const messageType = event.message.type;
    const text = (messageType === "text" ? event.message.text.trim() : "");
    const lower = text.toLowerCase();
    const isUsageCmd = lower === "@usage";
    const isTag = /@Halal\s*Formosa/i.test(text);

    // Usage command works everywhere
    if (isUsageCmd) {
      const usage = await getDailyUsage(sourceKey);
      const remaining = Math.max(0, 3 - usage);
      const resetIn = getResetTime();
      const msg = `📊 Usage Status (Today):\n- Used: ${usage}/3\n- Remaining: ${remaining}\n- Next reset in: ${resetIn}\n\n🌐 https://halalformosa.com`;
      await replyMessage(event.replyToken, msg);
      continue;
    }

    /* ---------- DM (1-on-1): keyword menu + persisted mode ---------- */
    if (sourceType === "user") {
      // Load saved mode + last activity, expiring stale "chat" sessions.
      const row = await getModeRow(sourceKey);
      let mode = row?.mode || "analyze";
      const lastActive = row?.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (mode === "chat" && (Date.now() - lastActive) > CHAT_IDLE_TIMEOUT_MS) {
        // User was idle too long → reset to default so they get the menu again.
        await setMode(sourceKey, "analyze");
        mode = "analyze";
      }

      if (messageType === "text") {
        const wantsMenu = ["menu", "0", "help", "@menu"].includes(lower);
        const wantsChat = text === "2";
        const wantsAnalyze = text === "1" || /analy[sz]/i.test(lower);

        if (wantsMenu) {
          await replyMessage(event.replyToken, MENU_MESSAGE);
          continue;
        }
        if (wantsChat) {
          await setMode(sourceKey, "chat");
          await replyMessage(event.replyToken, CHAT_MESSAGE);
          continue;
        }
        if (wantsAnalyze) {
          await setMode(sourceKey, "analyze");
          await replyMessage(event.replyToken, ANALYZE_PROMPT);
          continue;
        }

        // Unknown text
        if (mode === "chat") {
          // Keep the chat session alive (slide the idle window) and stay silent —
          // the developer answers manually via the LINE OA app.
          await setMode(sourceKey, "chat");
          continue;
        }
        // default/analyze → offer the menu instead of nagging
        await replyMessage(event.replyToken, MENU_MESSAGE);
        continue;
      }

      if (messageType === "image") {
        if (mode === "chat") {
          // Keep session alive; don't auto-analyze while chatting with the developer.
          await setMode(sourceKey, "chat");
          continue;
        }
        const usage = await getDailyUsage(sourceKey);
        if (usage >= 3) {
          await replyMessage(event.replyToken, LIMIT_MESSAGE);
          continue;
        }
        await recordUsage(sourceKey);
        await analyzeAndReply(event.message.id, event.replyToken);
        continue;
      }

      // Other DM message types → ignore
      continue;
    }

    /* ---------- Group / Room (tag then image) ---------- */
    if (messageType === "image") {
      const { data: trigger } = await supabase.from("line_triggers").select("timestamp").eq("source_key", sourceKey).maybeSingle();
      if (!trigger) continue;
      await supabase.from("line_triggers").delete().eq("source_key", sourceKey);

      const usage = await getDailyUsage(sourceKey);
      if (usage >= 3) {
        await replyMessage(event.replyToken, LIMIT_MESSAGE);
        continue;
      }
      await recordUsage(sourceKey);
      await replyMessage(event.replyToken, "⏳ Got the image, analyzing...");
      await analyzeAndPush(event.message.id, to);
      continue;
    }

    if (isTag) {
      await supabase.from("line_triggers").upsert({ source_key: sourceKey, timestamp: Date.now() });
      await replyMessage(event.replyToken, "👀 Please send me a product image…");
      continue;
    }
  }
}

async function analyzeAndReply(messageId, replyToken) {
  const resText = await runAnalysis(messageId);
  await replyMessage(replyToken, resText);
}

async function analyzeAndPush(messageId, to) {
  const resText = await runAnalysis(messageId);
  await pushMessage(to, resText);
}

async function runAnalysis(messageId) {
  console.log(`🚀 Starting analysis for message: ${messageId}`);
  try {
    const imgRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
    });
    if (!imgRes.ok) return "❌ Failed to fetch image from LINE.";
    const buffer = await imgRes.arrayBuffer();

    // analyze-product only accepts server callers: authenticate with the service role key.
    const apiRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-product`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: buffer
    });
    const raw = await apiRes.text();
    console.log(`📦 analyze-product result: ${raw}`);

    let result = {};
    try { result = JSON.parse(raw); } catch { }
    if (!apiRes.ok || result.error) return `❌ Analysis failed: ${result.error || "Unknown error"}`;

    const emoji = statusEmoji(result.status ?? "");
    const header = `${emoji} ${result.productName ?? "Unknown Product"}`;
    const status = `Status: ${result.status ?? "N/A"}`;
    const reason = `Reason: ${result.reasoning ?? "N/A"}`;

    return `${header}\n${status}\n${reason}\n\n` +
           `Want more features?\nDownload or access at:\n` +
           `🌐 https://halalformosa.com`;
  } catch (err) {
    console.error("❌ runAnalysis error:", err);
    return "❌ An error occurred during analysis.";
  }
}
