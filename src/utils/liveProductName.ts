import type { LiveTextFrame } from '@/plugins/liveText'

/**
 * Reads the product name straight off the label, the way the photo flow does
 * (useOcrPipeline.extractProductName), but per live frame and without any network call.
 * Taiwanese labels print it as "品名：…" or just "名：…" (the 品 is often read as a
 * separate fragment), English ones as "Product name: …".
 */

const NAME_LINE = new RegExp(
    '^\\W{0,2}(?:' +
        '(?:商品名稱|商品名|品名|名稱|名)\\s*[:：]\\s*' +
        '|(?:product\\s*name|item\\s*name|name)\\s*[:：]\\s*' +
    ')(.+)$',
    'i',
)

const MAX_NAME_LENGTH = 40

function cleanName(raw: string): string {
    return raw
        .replace(/[™®©*]+/g, '')
        .replace(/^[\s:：\-·.、,，]+|[\s:：\-·.、,，]+$/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, MAX_NAME_LENGTH)
        .trim()
}

/** The product name printed in this frame, or '' when no name line is in view. */
export function extractLiveProductName(frame: LiveTextFrame): string {
    for (const block of frame.blocks) {
        for (const line of block.lines) {
            const m = NAME_LINE.exec(line.text.trim())
            if (!m) continue
            const name = cleanName(m[1])
            if (name.length >= 2) return name
        }
    }
    return ''
}

function bigrams(s: string): Set<string> {
    const out = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
    return out
}

/** Dice coefficient over character bigrams: 1 = identical, 0 = nothing in common. */
export function nameSimilarity(a: string, b: string): number {
    if (a === b) return 1
    const A = bigrams(a)
    const B = bigrams(b)
    if (!A.size || !B.size) return 0
    let shared = 0
    for (const g of A) if (B.has(g)) shared++
    return (2 * shared) / (A.size + B.size)
}

export interface LiveProductNameOptions {
    /** How long a reading counts after it was seen. */
    ttlMs?: number
    /** Similar readings needed before a name is shown. */
    minVotes?: number
    /** Two readings this similar are treated as the same name misread differently. */
    similarity?: number
}

/**
 * OCR reads the same name slightly differently each frame ("咔辣姆久" / "咔辣好久").
 * This groups similar readings and shows the most common spelling in the biggest
 * group, so the name settles instead of flickering, and goes away after the camera
 * moves to another product.
 */
export class LiveProductNameTracker {
    private readings: { name: string; at: number }[] = []
    private readonly ttlMs: number
    private readonly minVotes: number
    private readonly similarity: number

    constructor(options: LiveProductNameOptions = {}) {
        this.ttlMs = options.ttlMs ?? 3000
        this.minVotes = options.minVotes ?? 2
        this.similarity = options.similarity ?? 0.6
    }

    update(name: string, now: number) {
        if (name) this.readings.push({ name, at: now })
        this.prune(now)
    }

    current(now: number): string {
        this.prune(now)

        const groups: { names: string[]; last: number }[] = []
        for (const r of this.readings) {
            const group = groups.find(g => nameSimilarity(g.names[0], r.name) >= this.similarity)
            if (group) {
                group.names.push(r.name)
                group.last = r.at
            } else {
                groups.push({ names: [r.name], last: r.at })
            }
        }

        const best = groups
            .filter(g => g.names.length >= this.minVotes)
            .sort((a, b) => b.names.length - a.names.length || b.last - a.last)[0]
        if (!best) return ''

        const counts = new Map<string, number>()
        for (const n of best.names) counts.set(n, (counts.get(n) ?? 0) + 1)
        // Most frequent spelling; ties go to the one seen most recently.
        return [...counts.entries()].sort(
            (a, b) => b[1] - a[1] || best.names.lastIndexOf(b[0]) - best.names.lastIndexOf(a[0]),
        )[0][0]
    }

    reset() {
        this.readings = []
    }

    private prune(now: number) {
        this.readings = this.readings.filter(r => now - r.at <= this.ttlMs)
    }
}
