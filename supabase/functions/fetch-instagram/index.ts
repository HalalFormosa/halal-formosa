import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  let step = 'Initialization';
  try {
    step = 'Reading Secrets';
    const IG_TOKEN = Deno.env.get('IG_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!IG_TOKEN) throw new Error('Missing IG_TOKEN secret');

    step = 'Auto-discovering Instagram ID';
    const accountsRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${IG_TOKEN}`);
    const accountsData = await accountsRes.json();
    
    // We'll take the first linked IG account found
    const igAccount = accountsData.data?.[0]?.instagram_business_account;
    if (!igAccount?.id) {
      throw new Error(`Could not find a linked Instagram Business Account. Meta Response: ${JSON.stringify(accountsData)}`);
    }

    const activeIgId = igAccount.id;
    const activeUsername = igAccount.username || 'halalformosa';
    console.log(`Fetching media for own account: ${activeUsername} (ID: ${activeIgId})`);

    step = 'Fetching Media via /media endpoint';
    const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,children{id,media_type,media_url,thumbnail_url}';
    const mediaUrl = `https://graph.facebook.com/v21.0/${activeIgId}/media?fields=${fields}&access_token=${IG_TOKEN}&limit=50`;
    
    const mediaRes = await fetch(mediaUrl);
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      throw new Error(`Meta API Media Error: ${mediaData.error.message}`);
    }

    step = 'Parsing Media';
    const media = mediaData.data || [];
    const allResults = media.map((post: any) => {
      let effectiveThumbnail = post.thumbnail_url;
      
      // 🎠 Carousel Logic: grab the first inner photo's URL
      if (post.media_type === 'CAROUSEL_ALBUM' && post.children?.data?.length > 0) {
        const firstChild = post.children.data[0];
        effectiveThumbnail = firstChild.thumbnail_url || firstChild.media_url;
      }
      
      // 🖼️ Image Logic: if there's no thumbnail, the media_url IS the image
      if (!effectiveThumbnail && post.media_type === 'IMAGE') {
        effectiveThumbnail = post.media_url;
      }

      return {
        id: post.id,
        caption: post.caption || '',
        media_type: post.media_type,
        media_url: post.permalink, // Use permalink for media_url to maintain compatibility
        video_url: post.media_type === 'VIDEO' ? post.media_url : null, // Store the actual video blob
        permalink: post.permalink,
        thumbnail_url: effectiveThumbnail || null,
        timestamp: post.timestamp,
        username: activeUsername,
      };
    });

    step = 'Upserting to Database';
    if (allResults.length > 0) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const { error: dbError } = await supabase
        .from('instagram_posts')
        .upsert(allResults, { onConflict: 'id' });

      if (dbError) throw new Error(`Database Upsert Failed: ${dbError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      key_source: SECRET_KEY ? 'secret' : 'legacy', 
      count: allResults.length, 
      account: activeUsername
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message, 
      failed_at_step: step 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
