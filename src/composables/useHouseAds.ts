// Pool of "house ads" — promo cards for Gold/Silver/Bronze partners (and
// their products, locations and trips) shown in place of a real ad banner
// when the ad network reports no fill. Rotation has two nested rules:
//  1. Category never repeats back-to-back — it strictly cycles
//     partner -> product -> location -> trip -> partner -> ...
//  2. Within a given category's own turns over time, gold/silver/bronze
//     are weighted 3:2:1 (see TIER_WEIGHTS/turnDurationForTier), mirroring
//     the featured-tier pattern in ExploreView.vue/SearchView.vue.
// Re-rolls on a timer sized to the current item's own tier, and on each
// fresh view entry.
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient'

export type HouseAdKind = 'partner' | 'product' | 'location' | 'trip'
export type HouseAdTier = 'gold' | 'silver' | 'bronze'

export interface HouseAdItem {
    kind: HouseAdKind
    id: string | number
    tier: HouseAdTier
    title: string
    subtitle?: string | null
    image?: string | null
    to: RouteLocationRaw
    // Trips open in an in-app browser tab to their provider's own booking
    // page (TripListView.vue's openTrip) rather than an internal route —
    // set only for kind:'trip', where `to` is just a harmless fallback.
    externalUrl?: string | null
    // The partner who sells/provides/certifies this item — unset for
    // kind:'partner' (it IS the partner, nothing else to attribute it to).
    providerName?: string | null
}

const TIER_ORDER: HouseAdTier[] = ['gold', 'silver', 'bronze']
const KIND_ORDER: HouseAdKind[] = ['partner', 'product', 'location', 'trip']
const ROTATION_KEY = 'hf_house_ad_rotation_index'

// Same 3:2:1 tier weighting already used elsewhere for sort priority
// (PartnersListView.vue's TIER_PRIORITY, TripListView.vue's
// TRIP_TIER_WEIGHTS, HomeView.vue's TIER_PRIORITY) — applied here as each
// tier's turn LENGTH: gold stays up for weight x BASE_TURN_MS (30s),
// silver for 20s, bronze for 10s, still cycling gold -> silver -> bronze.
export const TIER_WEIGHTS: Record<HouseAdTier, number> = { gold: 3, silver: 2, bronze: 1 }
export const BASE_TURN_MS = 10000

export function turnDurationForTier(tier: HouseAdTier): number {
    return TIER_WEIGHTS[tier] * BASE_TURN_MS
}

const pool = ref<Record<HouseAdTier, HouseAdItem[]>>({ gold: [], silver: [], bronze: [] })
const poolLoaded = ref(false)
let poolPromise: Promise<void> | null = null

function readStoredIndex(): number {
    try {
        const raw = Number(localStorage.getItem(ROTATION_KEY) || '0')
        return Number.isFinite(raw) && raw >= 0 ? raw : 0
    } catch {
        return 0
    }
}

const rotationIndex = ref(readStoredIndex())
// When the CURRENT turn began (module-scoped, so it survives a HouseAdCard
// unmounting/remounting across a view change) — lets a freshly-mounted
// progress bar pick up mid-fill instead of restarting from 0%.
const turnStartedAt = ref(Date.now())
let lastBumpAt = 0
let rotationTimeout: ReturnType<typeof setTimeout> | null = null

// Debounced the same way as ExploreView's partner rotation to survive
// Ionic's occasional double-fire of view-enter lifecycle hooks.
export function bumpHouseAdRotation() {
    const now = Date.now()
    if (now - lastBumpAt < 500) return
    lastBumpAt = now
    const next = rotationIndex.value + 1
    rotationIndex.value = next
    turnStartedAt.value = now
    try { localStorage.setItem(ROTATION_KEY, String(next)) } catch { /* ignore */ }
}

// Self-rescheduling instead of a fixed setInterval, since the turn length
// depends on whichever item's tier is actually showing right now (see
// turnDurationForTier) — after bumping we re-read the new item's tier and
// schedule the following bump for that long, rather than a constant interval.
function scheduleNextRotationBump() {
    const current = getHouseAd()
    const tier = current?.tier ?? 'bronze'
    rotationTimeout = setTimeout(() => {
        bumpHouseAdRotation()
        scheduleNextRotationBump()
    }, turnDurationForTier(tier))
}

// Waits for the pool before scheduling the first bump — calling this
// before loadHouseAdPool() resolves would otherwise lock in a wrong
// fallback ('bronze', the shortest turn) for the very first turn, since
// getHouseAd() can't return a real item until the pool has data.
export async function startHouseAdRotationTimer() {
    if (rotationTimeout) return
    await loadHouseAdPool()
    if (rotationTimeout) return // someone else started it while we awaited
    scheduleNextRotationBump()
}

export function stopHouseAdRotationTimer() {
    if (rotationTimeout) {
        clearTimeout(rotationTimeout)
        rotationTimeout = null
    }
}

function tierOf(raw: string | null | undefined): HouseAdTier | null {
    const t = (raw || '').toLowerCase()
    return t === 'gold' || t === 'silver' || t === 'bronze' ? t : null
}

async function loadHouseAdPool(): Promise<void> {
    if (poolPromise) return poolPromise
    poolPromise = (async () => {
        const byTier: Record<HouseAdTier, HouseAdItem[]> = { gold: [], silver: [], bronze: [] }

        const [partnersRes, productsRes, locationsRes, tripsRes] = await Promise.all([
            supabase.from('partners')
                .select('id, name, logo_url, partner_tier')
                .eq('is_active', true)
                .in('partner_tier', TIER_ORDER),
            supabase.from('products')
                .select('id, name, photo_front_url, partner_tier, barcode, partner:partners(name)')
                .eq('approved', true)
                .in('partner_tier', TIER_ORDER)
                .limit(60),
            supabase.from('locations')
                .select('id, name, image, partner_tier, partner:partners(name)')
                .in('partner_tier', TIER_ORDER)
                .limit(60),
            supabase.from('trips')
                .select('id, title, cover_url, external_url, is_active, provider:partners(name, partner_tier)')
                .eq('is_active', true)
                .limit(60),
        ])

        for (const p of partnersRes.data ?? []) {
            const tier = tierOf(p.partner_tier)
            if (!tier) continue
            byTier[tier].push({
                kind: 'partner', id: p.id, tier, title: p.name, image: p.logo_url,
                to: { name: 'PartnerDetail', params: { id: p.id } },
            })
        }

        for (const p of productsRes.data ?? []) {
            const tier = tierOf(p.partner_tier)
            if (!tier) continue
            const partner = Array.isArray((p as any).partner) ? (p as any).partner[0] : (p as any).partner
            byTier[tier].push({
                kind: 'product', id: p.id, tier, title: p.name, image: p.photo_front_url,
                to: { name: 'item-details', params: { barcode: p.barcode } },
                providerName: partner?.name ?? null,
            })
        }

        for (const l of locationsRes.data ?? []) {
            const tier = tierOf(l.partner_tier)
            if (!tier) continue
            const partner = Array.isArray((l as any).partner) ? (l as any).partner[0] : (l as any).partner
            byTier[tier].push({
                kind: 'location', id: l.id, tier, title: l.name, image: l.image,
                to: { name: 'PlaceDetail', params: { id: l.id } },
                providerName: partner?.name ?? null,
            })
        }

        for (const t of tripsRes.data ?? []) {
            const provider = Array.isArray((t as any).provider) ? (t as any).provider[0] : (t as any).provider
            const tier = tierOf(provider?.partner_tier)
            if (!tier) continue
            byTier[tier].push({
                kind: 'trip', id: t.id, tier, title: t.title, image: t.cover_url,
                to: { path: '/trip' },
                externalUrl: t.external_url,
                providerName: provider?.name ?? null,
            })
        }

        pool.value = byTier
        poolLoaded.value = true
    })().catch((e) => {
        console.debug('[HouseAds] pool load skipped', e)
        poolLoaded.value = true
    })
    return poolPromise
}

// Picks the item due for this category's own turn, gold -> silver -> bronze
// weighted 3:2:1 (see TIER_WEIGHTS), within that category — skipping tiers
// that have no eligible content in this category.
function pickForKind(kind: HouseAdKind, kindTurn: number): HouseAdItem | null {
    for (let attempt = 0; attempt < TIER_ORDER.length; attempt++) {
        const tier = TIER_ORDER[(kindTurn + attempt) % TIER_ORDER.length]
        const group = pool.value[tier].filter(i => i.kind === kind)
        if (group.length) {
            const itemIndex = Math.floor((kindTurn + attempt) / TIER_ORDER.length) % group.length
            return group[itemIndex]
        }
    }
    return null
}

// Picks the item due at a given rotation position — category strictly
// cycles partner -> product -> location -> trip -> partner -> ..., never
// repeating back-to-back, skipping any category with no eligible content.
// excludeKind drops one category from the cycle entirely — used so a
// native ad woven into e.g. the product feed doesn't turn into "sponsored
// product" (redundant with the real gold products already featured first
// in that same feed); everywhere else still rotates all four.
function pickAt(baseIdx: number, excludeKind?: HouseAdKind): HouseAdItem | null {
    const kinds = excludeKind ? KIND_ORDER.filter(k => k !== excludeKind) : KIND_ORDER
    for (let attempt = 0; attempt < kinds.length; attempt++) {
        const idx = baseIdx + attempt
        const kind = kinds[idx % kinds.length]
        const kindTurn = Math.floor(idx / kinds.length)
        const picked = pickForKind(kind, kindTurn)
        if (picked) return picked
    }
    return null
}

// The item due for the CURRENT turn (used by the single rotating banner
// fallback, HouseAdCard.vue).
export function getHouseAd(): HouseAdItem | null {
    return pickAt(rotationIndex.value)
}

// The item due `offset` turns ahead of the current one — lets several
// simultaneously-visible native placements (HouseAdNativeCard.vue, one per
// recurring feed slot) each show a different sponsor instead of all
// repeating the same current turn, while still advancing together as the
// shared rotation index ticks forward over time.
export function getHouseAdAtOffset(offset: number, excludeKind?: HouseAdKind): HouseAdItem | null {
    return pickAt(rotationIndex.value + offset, excludeKind)
}

export function useHouseAds() {
    return {
        pool,
        poolLoaded,
        loadHouseAdPool,
        rotationIndex,
        turnStartedAt,
        bumpHouseAdRotation,
        startHouseAdRotationTimer,
        stopHouseAdRotationTimer,
        getHouseAd,
    }
}
