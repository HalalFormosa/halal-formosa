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

  let requestsUsed = 0;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // 🔑 RapidAPI key comes from the RAPIDAPI_KEY secret only (never hardcode it in source)
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    if (!RAPIDAPI_KEY) throw new Error('Missing RAPIDAPI_KEY secret');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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
      return await res.json();
    };

    // Looks the secUid up from RapidAPI and stores it for next time
    const lookupSecUid = async (): Promise<string> => {
      const infoData = await rapid(`/api/user/info?uniqueId=${USERNAME}`);
      const found = infoData.userInfo?.user?.secUid;
      if (!found) throw new Error(`Failed to get user info: ${JSON.stringify(infoData)}`);
      const { error } = await supabase.from('app_config').upsert({
        key: SECUID_CACHE_KEY,
        value: found,
        description: 'Cached TikTok secUid for fetch-tiktok (saves one RapidAPI request per run)',
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) console.warn(`⚠️ Could not cache secUid: ${error.message}`);
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
      const limited = /quota|exceed|rate limit|too many/i.test(String(err?.message));
      if (usedCache && !limited) {
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

    return new Response(JSON.stringify({
      success: true,
      key_source: SECRET_KEY ? 'secret' : 'legacy',
      count: posts.length,
      username: USERNAME,
      requests_used: requestsUsed,
      user_id_cached: usedCache
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ RapidAPI Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message, requests_used: requestsUsed }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
