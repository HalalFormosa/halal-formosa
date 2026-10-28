import type { IngredientHighlight } from '@/types/Ingredient'
import { extractIonColor } from '@/utils/ingredientHelpers'
import { liveMatchKey } from '@/utils/liveVerdictMatcher'

/**
 * A single camera frame is noisy: OCR drops words, misreads letters and flickers.
 * The tracker turns per-frame matches into something steady enough to show the user:
 * a highlight appears after it is seen in a couple of frames and lingers briefly
 * after it was last seen.
 */

/** Deliberately no "clear" state: a live view only sees part of the label, so silence is not a verdict. */
export type LiveVerdict = 'scanning' | 'Haram' | 'Syubhah'

export interface LiveTrackerOptions {
    /** How long a highlight stays after it was last seen. */
    ttlMs?: number
    /** Frames (within the ttl) a highlight must be seen in before it is shown. */
    minHits?: number
}

interface TrackedEntry {
    highlight: IngredientHighlight
    hits: number
    lastSeen: number
}

export class LiveHighlightTracker {
    private entries = new Map<string, TrackedEntry>()
    private readonly ttlMs: number
    private readonly minHits: number

    constructor(options: LiveTrackerOptions = {}) {
        this.ttlMs = options.ttlMs ?? 800
        this.minHits = options.minHits ?? 2
    }

    update(matches: IngredientHighlight[], now: number) {
        for (const match of matches) {
            const key = liveMatchKey(match)
            const prev = this.entries.get(key)
            // A match that went stale starts over; it has to earn its way back in.
            const hits = prev && now - prev.lastSeen <= this.ttlMs ? prev.hits + 1 : 1
            this.entries.set(key, { highlight: match, hits, lastSeen: now })
        }
        this.prune(now)
    }

    /** Highlights that are confirmed and still fresh. */
    active(now: number): IngredientHighlight[] {
        this.prune(now)
        return [...this.entries.values()]
            .filter(e => e.hits >= this.minHits)
            .map(e => e.highlight)
    }

    verdict(now: number): LiveVerdict {
        const active = this.active(now)
        if (active.some(h => extractIonColor(h.color) === 'danger')) return 'Haram'
        if (active.some(h => extractIonColor(h.color) === 'warning')) return 'Syubhah'
        return 'scanning'
    }

    reset() {
        this.entries.clear()
    }

    private prune(now: number) {
        for (const [key, entry] of this.entries) {
            if (now - entry.lastSeen > this.ttlMs) this.entries.delete(key)
        }
    }
}
