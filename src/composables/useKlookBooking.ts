import { useRouter } from 'vue-router'
import { Browser } from '@capacitor/browser'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'
import type { TripItem } from '@/types/Trip'

const AFFILIATE_ID = import.meta.env.VITE_KLOOK_AFFILIATE_ID as string | undefined

/** Appends our affiliate + campaign tracking params onto a Klook deep link. */
function buildTrackingUrl(deepLink: string, trip: TripItem): string {
  const url = new URL(deepLink)
  if (AFFILIATE_ID) url.searchParams.set('aid', AFFILIATE_ID)
  url.searchParams.set('aff_trip_id', trip.id)
  if (trip.klook?.klook_activity_id) url.searchParams.set('aff_activity_id', trip.klook.klook_activity_id)
  url.searchParams.set('utm_source', 'halal_formosa_app')
  url.searchParams.set('utm_medium', 'trip_list')
  url.searchParams.set('utm_campaign', 'muslim_friendly_trips')
  return url.toString()
}

export function useKlookBooking() {
  const router = useRouter()

  async function book(trip: TripItem) {
    ActivityLogService.log('trip_book_click', {
      trip_id: trip.id,
      booking_mode: trip.booking_mode,
      klook_package_id: trip.klook?.klook_package_id ?? null,
      integration_mode: trip.klook?.integration_mode ?? null,
      price: trip.live_price ?? trip.min_price
    })

    // 'in_app' and 'klook_b2b' both stay inside the app: the checkout view
    // handles the purchase, and for klook_b2b it calls Klook's Open API
    // server-side (klook-create-order edge function) — the user never sees
    // Klook's site.
    if (trip.booking_mode === 'in_app' || trip.booking_mode === 'klook_b2b') {
      await router.push({
        name: 'TripCheckout',
        params: { tripId: trip.id },
        query: { packageId: trip.klook?.klook_package_id ?? undefined }
      })
      return
    }

    await supabase.rpc('increment_trip_view', { p_trip_id: trip.id })

    // 'external_link': our own / partner-curated trip — just open their page
    // as-is, no Klook tracking params (there's nothing to track).
    if (trip.booking_mode === 'external_link') {
      if (!trip.external_url) {
        console.error('[useKlookBooking] Trip has no external link', trip.id)
        return
      }

      await Browser.open({
        url: trip.external_url,
        windowName: '_self',
        toolbarColor: '#e67e22',
        presentationStyle: 'fullscreen'
      })
      return
    }

    // 'klook_affiliate': legacy fallback for products not yet onboarded to
    // B2B — redirect out to Klook, carrying affiliate tracking params.
    const deepLink = trip.klook?.affiliate_deep_link || trip.external_url
    if (!deepLink) {
      console.error('[useKlookBooking] Trip has no bookable link', trip.id)
      return
    }

    const url = buildTrackingUrl(deepLink, trip)

    await Browser.open({
      url,
      windowName: '_self',
      toolbarColor: '#e67e22',
      presentationStyle: 'fullscreen'
    })
  }

  function ctaLabelKey(trip: TripItem): string {
    if (trip.booking_mode === 'in_app' || trip.booking_mode === 'klook_b2b') return 'trip.bookNow'
    if (trip.booking_mode === 'external_link') return 'trip.viewDetails'
    return 'trip.viewOnKlook'
  }

  return { book, ctaLabelKey }
}
