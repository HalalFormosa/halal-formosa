import { nameSimilarity } from '@/utils/liveProductName'

const CJK = /[㐀-鿿]/

export interface LiveNameTranslatorStorage {
    load(): Record<string, string>
    save(entries: Record<string, string>): void
}

export interface LiveNameTranslatorOptions {
    /** The name must stay the same this long before it is sent, so OCR misreads are not translated. */
    settleMs?: number
    /** After a failed attempt, wait this long before trying the same name again. */
    retryMs?: number
    /** Minimum gap between two requests. */
    minIntervalMs?: number
    /** Hard cap on requests for this translator's lifetime (one Live Verdict session). */
    maxRequests?: number
    /**
     * A name this similar to an already translated one reuses its translation instead of a new request.
     * Kept high on purpose: two flavours of one product differ by only a character or two.
     */
    reuseSimilarity?: number
    /** Translations kept on the device so a product scanned before costs nothing. */
    storage?: LiveNameTranslatorStorage
    maxStored?: number
    /** Called when a translation arrives, so the screen can refresh without waiting for the next frame. */
    onUpdate?: () => void
}

/**
 * Translates the detected product name to English while keeping the number of paid
 * translation calls small:
 *  - only once the name has been stable for a moment (OCR misreads are not sent),
 *  - one request at a time, spaced apart, with a hard cap per session,
 *  - a near-identical name reuses the translation we already have,
 *  - results are kept on the device, so a product seen before is free.
 *
 * Only the recognised name text is sent, never an image. Failures (offline, server error)
 * are swallowed: the Chinese name stays on screen and the same name is not retried straight away.
 */
export class LiveNameTranslator {
    private cache = new Map<string, string>()
    private inFlight = new Set<string>()
    private retryAt = new Map<string, number>()
    private candidate = ''
    private since = 0
    private lastRequestAt = -Infinity
    private requests = 0
    private readonly settleMs: number
    private readonly retryMs: number
    private readonly minIntervalMs: number
    private readonly maxRequests: number
    private readonly reuseSimilarity: number
    private readonly maxStored: number
    private readonly storage?: LiveNameTranslatorStorage
    private readonly onUpdate?: () => void

    constructor(
        private readonly translate: (text: string) => Promise<string | null>,
        options: LiveNameTranslatorOptions = {},
    ) {
        this.settleMs = options.settleMs ?? 1200
        this.retryMs = options.retryMs ?? 30000
        this.minIntervalMs = options.minIntervalMs ?? 4000
        this.maxRequests = options.maxRequests ?? 10
        this.reuseSimilarity = options.reuseSimilarity ?? 0.85
        this.maxStored = options.maxStored ?? 100
        this.storage = options.storage
        this.onUpdate = options.onUpdate

        try {
            for (const [name, english] of Object.entries(this.storage?.load() ?? {})) {
                if (name && english) this.cache.set(name, english)
            }
        } catch {
            /* unreadable storage: start empty */
        }
    }

    /** Call once per frame with the current (already vote-stabilised) product name. */
    update(name: string, now: number) {
        if (name !== this.candidate) {
            this.candidate = name
            this.since = now
        }
        if (!name || !CJK.test(name)) return
        if (this.cache.has(name)) return

        // Same name misread a little differently: reuse, do not pay again.
        const similar = this.findSimilar(name)
        if (similar) {
            this.cache.set(name, similar)
            return
        }

        if (this.inFlight.size > 0) return
        if (this.requests >= this.maxRequests) return
        if (now - this.lastRequestAt < this.minIntervalMs) return
        if (now - this.since < this.settleMs) return
        if (now < (this.retryAt.get(name) ?? 0)) return

        this.requests++
        this.lastRequestAt = now
        this.inFlight.add(name)
        void this.translate(name)
            .then(text => {
                const english = text?.trim()
                if (english) {
                    this.cache.set(name, english)
                    this.persist()
                } else {
                    this.retryAt.set(name, Date.now() + this.retryMs)
                }
            })
            .catch(() => this.retryAt.set(name, Date.now() + this.retryMs))
            .finally(() => {
                this.inFlight.delete(name)
                this.onUpdate?.()
            })
    }

    /** English name for this exact Chinese name, or '' if not translated (yet). */
    get(name: string): string {
        return this.cache.get(name) ?? ''
    }

    /** True while a request for this name is running. */
    pending(name: string): boolean {
        return this.inFlight.has(name)
    }

    reset() {
        this.candidate = ''
        this.since = 0
    }

    private findSimilar(name: string): string {
        for (const [known, english] of this.cache) {
            if (nameSimilarity(known, name) >= this.reuseSimilarity) return english
        }
        return ''
    }

    private persist() {
        if (!this.storage) return
        // Keep the newest entries only (a Map iterates in insertion order).
        const entries = [...this.cache.entries()].slice(-this.maxStored)
        try {
            this.storage.save(Object.fromEntries(entries))
        } catch {
            /* storage full or blocked: the in-memory cache still works */
        }
    }
}
