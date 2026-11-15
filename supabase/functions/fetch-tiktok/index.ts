import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (typeof key === 'string' && key !== '') return key;
  } catch { /* fall through to the legacy key */ }
  return '';
}
const SECRET_KEY = readSecretKey();

const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
const USERNAME = 'halalformosa';
// The account's secUid never changes, so it is looked up once and cached in app_config.
// That makes a normal run cost 1 RapidAPI request instead of 2 (the plan has a small monthly quota).
const SECUID_CACHE_KEY = 'tiktok_secuid';
// Quota protection: only the server cron may reach RapidAPI (the anon key is public, so app clients must not),
// at most one real run per COOLDOWN_MS, and nothing at all until the next month once RapidAPI reports the quota.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const LAST_RUN_KEY = 'tiktok_last_run';
const BLOCKED_UNTIL_KEY = 'tiktok_blocked_until';
const COOLDOWN_MS = 20 * 60 * 60 * 1000;
const isQuotaMessage = (msg: string) => /quota|exceed|rate limit|too many/i.test(msg);

Deno.serve(async (req) => {
  const { method } = req;
  const requestHeaders = req.headers.get('Access-Control-Request-Headers');
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': requestHeaders || 'authorization, x-client-info, apikey, content-type, x-csrf-token, x-recaptcha-token, x-app-client'
  };

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  // Anyone but the cron (including old app versions holding the public anon key) gets a quiet 200 and no RapidAPI call
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (CRON_SECRET === '' || secret !== CRON_SECRET) {
    return reply({ skipped: true, reason: 'not_cron' });
  }

  let requestsUsed = 0;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Persist what the run did (visible to admins in ops_events)
  const opsLog = async (level: 'info' | 'warn' | 'error', event: string, detail: unknown) => {
    try { await supabase.from('ops_events').insert({ source: 'fetch-tiktok', level, event, detail }); } catch { /* never break the job */ }
  };
  const setConfig = async (key: string, value: string, description: string) => {
    const { error } = await supabase.from('app_config').upsert(
      { key, value, description, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) console.error(`⚠️ Could not write app_config ${key}: ${error.message}`);
    return !error;
  };

  try {
    // 🔑 RapidAPI key comes from the RAPIDAPI_KEY secret only (never hardcode it in source)
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    if (!RAPIDAPI_KEY) throw new Error('Missing RAPIDAPI_KEY secret');

    // Guards: quota block first, then the 20h cooldown. Both skip before any RapidAPI request.
    const { data: guardRows } = await supabase.from('app_config').select('key, value').in('key', [BLOCKED_UNTIL_KEY, LAST_RUN_KEY]);
    const guard = Object.fromEntries((guardRows ?? []).map((r: any) => [r.key, r.value]));
    const now = Date.now();

    const blockedUntilMs = Date.parse(guard[BLOCKED_UNTIL_KEY] ?? '');
    if (!Number.isNaN(blockedUntilMs) && blockedUntilMs > now) {
      const until = new Date(blockedUntilMs).toISOString();
      await opsLog('info', 'skipped', { reason: 'quota_blocked', until });
      return reply({ skipped: true, reason: 'quota_blocked', until });
    }

    const lastRunMs = Date.parse(guard[LAST_RUN_KEY] ?? '');
    if (!Number.isNaN(lastRunMs) && now - lastRunMs < COOLDOWN_MS) {
      const next = new Date(lastRunMs + COOLDOWN_MS).toISOString();
      await opsLog('info', 'skipped', { reason: 'cooldown', next_run_after: next });
      return reply({ skipped: true, reason: 'cooldown', next_run_after: next });
    }

    // Stamped before the first RapidAPI request so a failing run cannot be retried in a loop
    await setConfig(LAST_RUN_KEY, new Date(now).toISOString(), 'Last real fetch-tiktok run (20h cooldown)');

    console.log(`🚀 Starting TikTok fetch for @${USERNAME} using RapidAPI`);

    const rapid = async (path: string) => {
      requestsUsed++;
      const res = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
          'Content-Type': 'application/json'
        }
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error(`RapidAPI rate limit (HTTP 429): ${JSON.stringify(body).slice(0, 300)}`);
      return body;
    };

    // Looks the secUid up from RapidAPI and stores it for next time
    const lookupSecUid = async (): Promise<string> => {
      const infoData = await rapid(`/api/user/info?uniqueId=${USERNAME}`);
      const found = infoData.userInfo?.user?.secUid;
      if (!found) throw new Error(`Failed to get user info: ${JSON.stringify(infoData)}`);
      await setConfig(SECUID_CACHE_KEY, found, 'Cached TikTok secUid for fetch-tiktok (saves one RapidAPI request per run)');
      return found;
    };

    // An empty list is a real "no videos"; anything without itemList is an API error (quota, auth, ...)
    const fetchPosts = async (id: string): Promise<any[]> => {
      const postsData = await rapid(`/api/user/posts?secUid=${encodeURIComponent(id)}&count=15&cursor=0`);
      const dataObj = postsData.data || postsData;
      if (!Array.isArray(dataObj.itemList)) {
        throw new Error(`Failed to get posts: ${JSON.stringify(postsData).slice(0, 300)}`);
      }
      return dataObj.itemList;
    };

    // 1️⃣ Step 1: secUid from the cache, or one lookup request if it is not cached yet
    const { data: cached } = await supabase.from('app_config').select('value').eq('key', SECUID_CACHE_KEY).maybeSingle();
    let secUid: string = cached?.value || '';
    let usedCache = secUid !== '';
    if (!secUid) secUid = await lookupSecUid();

    // 2️⃣ Step 2: posts. If a cached secUid is rejected (not a quota/rate-limit problem), refresh it once.
    let itemList: any[];
    try {
      itemList = await fetchPosts(secUid);
    } catch (err: any) {
      if (usedCache && !isQuotaMessage(String(err?.message))) {
        console.warn('♻️ Cached secUid was rejected, refreshing it once');
        secUid = await lookupSecUid();
        usedCache = false;
        itemList = await fetchPosts(secUid);
      } else {
        throw err;
      }
    }
    console.log(`📸 Found ${itemList.length} videos`);

    // 3️⃣ Step 3: Map and Upsert
    const posts = itemList.map((item: any) => {
      const thumb = item.video?.dynamicCover || item.video?.cover || item.video?.originCover;

      return {
        id: item.id,
        caption: item.desc || '',
        media_type: 'VIDEO',
        media_url: `https://www.tiktok.com/@${USERNAME}/video/${item.id}`,
        video_url: item.video?.playAddr || null, // Store the actual video blob
        thumbnail_url: thumb,
        permalink: `https://www.tiktok.com/@${USERNAME}/video/${item.id}`,
        username: USERNAME,
        timestamp: new Date(item.createTime * 1000).toISOString(),
      };
    });

    if (posts.length > 0) {
      const { error: dbError } = await supabase
        .from('tiktok_posts')
        .upsert(posts, { onConflict: 'id' });

      if (dbError) throw dbError;
    }

    await opsLog('info', 'ok', { count: posts.length, requests_used: requestsUsed, user_id_cached: usedCache });
    return reply({
      success: true,
      key_source: SECRET_KEY ? 'secret' : 'legacy',
      count: posts.length,
      username: USERNAME,
      requests_used: requestsUsed,
      user_id_cached: usedCache
    });

  } catch (error) {
    console.error(`❌ RapidAPI Error: ${error.message}`);

    // RapidAPI quota / rate limit: stay quiet until the first day of next month (UTC)
    if (isQuotaMessage(String(error?.message))) {
      const today = new Date();
      const until = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)).toISOString();
      await setConfig(BLOCKED_UNTIL_KEY, until, 'fetch-tiktok makes no RapidAPI calls until this time (monthly quota reached)');
      await opsLog('warn', 'quota', { until, requests_used: requestsUsed, message: String(error.message).slice(0, 300) });
      return reply({ skipped: true, reason: 'quota_blocked', until, requests_used: requestsUsed });
    }

    await opsLog('error', 'failed', { message: String(error?.message).slice(0, 300), requests_used: requestsUsed });
    return reply({ error: error.message, requests_used: requestsUsed }, 500);
  }
});
