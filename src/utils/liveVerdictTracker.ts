import type { IngredientHighlight } from '@/types/Ingredient'
import { extractIonColor } from '@/utils/ingredientHelpers'
import { liveMatchKey } from '@/utils/liveVerdictMatcher'

/**
 * A single camera frame is noisy: OCR drops words, misreads letters and flickers.
 * The tracker turns per-frame matches into something steady enough to show the user:
 * a highlight appears after it is seen in a couple of frames and lingers briefly
 * after it was last seen.
 */

/**
 * With no flagged ingredient the verdict defaults to Muslim-friendly, but only once
 * enough label text has actually been read; until then the screen just says it is scanning.
 */
export type LiveVerdict = 'scanning' | 'Haram' | 'Syubhah' | 'Muslim-friendly'

export interface LiveTrackerOptions {
    /** How long a highlight stays after it was last seen. */
    ttlMs?: number
    /** Frames (within the ttl) a highlight must be seen in before it is shown. */
    minHits?: number
    /** Letters/digits a frame needs to count as "a label with text in view". */
    minTextChars?: number
    /** Consecutive text-bearing frames needed before the verdict can default to Muslim-friendly. */
    minTextFrames?: number
}

interface TrackedEntry {
    highlight: IngredientHighlight
    hits: number
    lastSeen: number
}

export class LiveHighlightTracker {
    private entries = new Map<string, TrackedEntry>()
    private textFrames = 0
    private lastTextAt = 0
    private readonly ttlMs: number
    private readonly minHits: number
    private readonly minTextChars: number
    private readonly minTextFrames: number

    constructor(options: LiveTrackerOptions = {}) {
        this.ttlMs = options.ttlMs ?? 800
        this.minHits = options.minHits ?? 2
        this.minTextChars = options.minTextChars ?? 20
        this.minTextFrames = options.minTextFrames ?? 3
    }

    update(matches: IngredientHighlight[], recognizedChars: number, now: number) {
        for (const match of matches) {
            const key = liveMatchKey(match)
            const prev = this.entries.get(key)
            // A match that went stale starts over; it has to earn its way back in.
            const hits = prev && now - prev.lastSeen <= this.ttlMs ? prev.hits + 1 : 1
            this.entries.set(key, { highlight: match, hits, lastSeen: now })
        }

        if (recognizedChars >= this.minTextChars) {
            this.textFrames = now - this.lastTextAt <= this.ttlMs ? this.textFrames + 1 : 1
            this.lastTextAt = now
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
        const readingText = now - this.lastTextAt <= this.ttlMs && this.textFrames >= this.minTextFrames
        return readingText ? 'Muslim-friendly' : 'scanning'
    }

    reset() {
        this.entries.clear()
        this.textFrames = 0
        this.lastTextAt = 0
    }

    private prune(now: number) {
        for (const [key, entry] of this.entries) {
            if (now - entry.lastSeen > this.ttlMs) this.entries.delete(key)
        }
    }
}
