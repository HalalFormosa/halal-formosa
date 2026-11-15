export type LiveLookupState = 'unknown' | 'checking' | 'found' | 'missing'

export interface LiveProductLookupOptions {
    /** Hard cap on lookups for one Live Verdict session. */
    maxRequests?: number
    /** Minimum gap between two lookups. */
    minIntervalMs?: number
    /** After a failed lookup (offline, server error), wait this long before trying the same name again. */
    retryMs?: number
    onUpdate?: () => void
}

/**
 * Checks, once per product name, whether the product is already in our database.
 * `lookup` resolves true (found), false (not found) or null (could not check). A failed
 * check never counts as "missing", so a flaky connection cannot trigger a contribute prompt.
 */
export class LiveProductLookup {
    private results = new Map<string, boolean>()
    private inFlight = new Set<string>()
    private retryAt = new Map<string, number>()
    private lastRequestAt = -Infinity
    private requests = 0
    private readonly maxRequests: number
    private readonly minIntervalMs: number
    private readonly retryMs: number
    private readonly onUpdate?: () => void

    constructor(
        private readonly lookup: (name: string) => Promise<boolean | null>,
        options: LiveProductLookupOptions = {},
    ) {
        this.maxRequests = options.maxRequests ?? 10
        this.minIntervalMs = options.minIntervalMs ?? 1500
        this.retryMs = options.retryMs ?? 30000
        this.onUpdate = options.onUpdate
    }

    /** Call once per frame with the name to look up ('' when there is none yet). */
    update(name: string, now: number) {
        if (!name || this.results.has(name) || this.inFlight.size > 0) return
        if (this.requests >= this.maxRequests) return
        if (now - this.lastRequestAt < this.minIntervalMs) return
        if (now < (this.retryAt.get(name) ?? 0)) return

        this.requests++
        this.lastRequestAt = now
        this.inFlight.add(name)
        void this.lookup(name)
            .then(found => {
                if (found === null) this.retryAt.set(name, Date.now() + this.retryMs)
                else this.results.set(name, found)
            })
            .catch(() => this.retryAt.set(name, Date.now() + this.retryMs))
            .finally(() => {
                this.inFlight.delete(name)
                this.onUpdate?.()
            })
    }

    state(name: string): LiveLookupState {
        if (!name) return 'unknown'
        if (this.inFlight.has(name)) return 'checking'
        const found = this.results.get(name)
        if (found === undefined) return 'unknown'
        return found ? 'found' : 'missing'
    }
}
