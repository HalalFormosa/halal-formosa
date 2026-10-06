import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge function to send push notifications to users for facility reviews.
// Auth: requires `x-cron-secret` header == CRON_SECRET, OR a service-role bearer.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface PendingPromptRow {
  visit_id: string;
  user_id: string;
  location_id: number;
  location_name: string;
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const authorized = (CRON_SECRET !== '' && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`
  if (!authorized) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.rpc('get_pending_visit_prompts')
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const rows = (data ?? []) as PendingPromptRow[]

  if (!ONESIGNAL_REST_API_KEY || !ONESIGNAL_APP_ID) {
    return new Response(
      JSON.stringify({
        skipped: true,
        reason: 'ONESIGNAL_REST_API_KEY or ONESIGNAL_APP_ID not set',
        pending_count: rows.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  let sent = 0
  let failed = 0

  for (const r of rows) {
    const headings = {
      en: `Did you visit ${r.location_name}?`,
      id: `Apakah Anda mengunjungi ${r.location_name}?`,
      zh: `您造訪了 ${r.location_name} 嗎？`,
      "zh-Hant": `您造訪了 ${r.location_name} 嗎？`,
      "zh-Hans": `您造訪了 ${r.location_name} 嗎？`
    }
    
    const contents = {
      en: "Mind sharing its Muslim facilities? It really helps other travelers.",
      id: "Yuk bagikan fasilitas Muslim di sana! Sangat membantu traveler lain.",
      zh: "方便分享這裡的穆斯林友善設施嗎？這對其他旅客非常有幫助。",
      "zh-Hant": "方便分享這裡的穆斯林友善設施嗎？這對其他旅客非常有幫助。",
      "zh-Hans": "方便分享這裡的穆斯林友善設施嗎？這對其他旅客非常有幫助。"
    }

    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          filters: [
            { field: 'tag', key: 'user_id', relation: '=', value: r.user_id }
          ],
          headings,
          contents,
          data: {
            link: `myapp://place/${r.location_id}?review=1`
          }
        })
      })

      if (res.ok) {
        sent++
        // Mark the visit as prompted
        await supabase.rpc('mark_visit_prompted', { p_visit_id: r.visit_id })
      } else {
        failed++
        const errText = await res.text()
        console.error(`[OneSignal] Failed to send push to user ${r.user_id}:`, errText)
      }
    } catch (e) {
      failed++
      console.error(`[OneSignal] Exception sending push to user ${r.user_id}:`, e)
    }
  }

  return new Response(
    JSON.stringify({ sent, failed, total: rows.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
