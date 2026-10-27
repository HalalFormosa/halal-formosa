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

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // 🔑 API Key from the User
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') || '2728e3f902msh1b2c56dff4c59b2p19faebjsn5500fcd75412';
    const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
    const USERNAME = 'halal_formosa';
    
    console.log(`🚀 Starting TikTok fetch for @${USERNAME} using RapidAPI`);

    // 1️⃣ Step 1: Get User Info to find the secUid
    const infoRes = await fetch(`https://${RAPIDAPI_HOST}/api/user/info?uniqueId=${USERNAME}`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
        'Content-Type': 'application/json'
      }
    });

    const infoData = await infoRes.json();
    if (!infoData.userInfo?.user?.secUid) {
      throw new Error(`Failed to get user info: ${JSON.stringify(infoData)}`);
    }

    const secUid = infoData.userInfo.user.secUid;
    console.log(`📍 Found secUid: ${secUid}`);

    // 2️⃣ Step 2: Get User Posts using the secUid
    const postsRes = await fetch(`https://${RAPIDAPI_HOST}/api/user/posts?secUid=${secUid}&count=15&cursor=0`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
        'Content-Type': 'application/json'
      }
    });

    const postsData = await postsRes.json();
    const dataObj = postsData.data || postsData;
    const itemList = dataObj.itemList || [];
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
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const { error: dbError } = await supabase
        .from('tiktok_posts')
        .upsert(posts, { onConflict: 'id' });

      if (dbError) throw dbError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      key_source: SECRET_KEY ? 'secret' : 'legacy', 
      count: posts.length,
      username: USERNAME 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ RapidAPI Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
