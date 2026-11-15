/**
 * Product-name matching shared by the ingredient scan and Live Verdict.
 * Moved out of ScanIngredientsView.vue unchanged so both use the same rule for
 * "is this the same product as the one in our database".
 */

// OCR-extracted product names often carry trailing packaging details
// (e.g. "Coffee Plaza Net Weight: 300ml") that the stored product name
// won't contain, so an exact substring match against the raw OCR text
// misses real matches. Strip that noise down to the core name first.
export function extractCoreProductName(raw: string): string {
    return raw
        .replace(/net\s*weight\s*[:\-]?\s*[\d.,]+\s*(ml|l|g|kg|oz|lbs?)\b/gi, '')
        .replace(/\b[\d.,]+\s*(ml|l|g|kg|oz|lbs?)\b/gi, '')
        .replace(/[:\-–]+\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

export const STOP_WORDS = new Set(['the', 'and', 'with', 'for', 'net', 'weight'])

export function significantWords(name: string): string[] {
    return name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
}

// Jaccard similarity (overlap ÷ union) between two texts' significant words. Used for
// both name and ingredient comparison — union-based so a short text matching inside a
// much longer, unrelated one doesn't score as a near-perfect match (overlap ÷ min-size
// would: e.g. "Strawberry Milk" vs. "Ultra Milk Long-lasting Flavored Milk - Strawberry
// Flavor" scored 100% under that formula despite being different products).
export function wordJaccard(a: string, b: string): number {
    const wordsA = new Set(significantWords(a))
    const wordsB = new Set(significantWords(b))
    if (wordsA.size === 0 || wordsB.size === 0) return 0
    const overlap = [...wordsA].filter(w => wordsB.has(w)).length
    const union = new Set([...wordsA, ...wordsB]).size
    return overlap / Math.max(1, union)
}

/** Name similarity at which a search hit counts as "the same product". */
export const NAME_MATCH_THRESHOLD = 0.6

/** Best search hit for this name, or null when nothing is close enough. */
export function pickBestProductMatch<T extends { name: string }>(name: string, rows: T[]): T | null {
    const core = extractCoreProductName(name) || name
    const best = rows
        .map(row => ({ row, ratio: wordJaccard(core, row.name) }))
        .filter(entry => entry.ratio >= NAME_MATCH_THRESHOLD)
        .sort((a, b) => b.ratio - a.ratio)[0]
    return best?.row ?? null
}
