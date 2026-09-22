// Tracks which ad space (by its `adSpaceId`, e.g. "ad-space-explore") most
// recently failed to fill so views can swap in a HouseAdCard instead of a
// blank ad slot. Shared by both ad SDKs (AdMob in lib/admob.ts, LevelPlay in
// lib/levelplay.ts) so either one reports into the same signal.
import { ref } from 'vue'

export const failedAdSpaceId = ref<string | null>(null)

export function markAdFailed(spaceId: string | null | undefined) {
    if (!spaceId) return
    failedAdSpaceId.value = spaceId
}

// Clears the fallback for a specific space (on a successful load), or
// unconditionally when called with no id (e.g. banner hidden/torn down).
export function clearAdFailed(spaceId?: string) {
    if (!spaceId || failedAdSpaceId.value === spaceId) {
        failedAdSpaceId.value = null
    }
}
