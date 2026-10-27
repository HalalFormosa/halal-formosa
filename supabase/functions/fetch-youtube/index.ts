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

  let step = 'Initialization';
  try {
    step = 'Reading Secrets';
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!YOUTUBE_API_KEY) throw new Error('Missing YOUTUBE_API_KEY secret');

    const HANDLE = '@HalalFormosa';
    const USERNAME = 'HalalFormosa';

    step = 'Resolving channel uploads playlist';
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(HANDLE)}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelRes.json();

    if (channelData.error) {
      throw new Error(`YouTube API Channel Error: ${channelData.error.message}`);
    }

    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error(`Could not resolve uploads playlist for ${HANDLE}: ${JSON.stringify(channelData)}`);
    }

    step = 'Fetching playlist items';
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=15&key=${YOUTUBE_API_KEY}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();

    if (playlistData.error) {
      throw new Error(`YouTube API Playlist Error: ${playlistData.error.message}`);
    }

    step = 'Mapping videos';
    const items = playlistData.items || [];
    const posts = items
      .filter((item: any) => item.contentDetails?.videoId)
      .map((item: any) => {
        const videoId = item.contentDetails.videoId;
        const thumb =
          item.snippet?.thumbnails?.maxres?.url ||
          item.snippet?.thumbnails?.standard?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          null;

        return {
          id: videoId,
          caption: item.snippet?.title || '',
          media_type: 'VIDEO',
          media_url: `https://www.youtube.com/watch?v=${videoId}`,
          video_url: null, // YouTube doesn't expose a direct video file URL for hover preview
          thumbnail_url: thumb,
          permalink: `https://www.youtube.com/watch?v=${videoId}`,
          username: USERNAME,
          timestamp: item.snippet?.publishedAt || new Date().toISOString(),
        };
      });

    step = 'Upserting to Database';
    if (posts.length > 0) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const { error: dbError } = await supabase
        .from('youtube_posts')
        .upsert(posts, { onConflict: 'id' });

      if (dbError) throw new Error(`Database Upsert Failed: ${dbError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      key_source: SECRET_KEY ? 'secret' : 'legacy',
      count: posts.length,
      username: USERNAME
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
