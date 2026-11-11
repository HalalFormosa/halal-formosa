import type { ScanDecisionChoice } from '@/utils/scanDecisionNotice'

// Payload builders for the two activity_log events behind the "What will you do with this
// product?" card. Pure functions so the shapes are unit-tested. Keys that already existed keep
// their names and meaning; scan_log_id and flagged_ingredients are additive.

/** ingredient_scan_logs.id of the scan the card belongs to. Null when the log insert failed or was skipped. */
export type ScanLogId = string | number | null

export const FLAGGED_INGREDIENTS_MAX = 10
export const FLAGGED_INGREDIENT_MAX_LENGTH = 60

/**
 * The slice of a highlight this module reads: the English keyword from ingredient_highlights.
 * Anything else on the highlight (Chinese name, colour, matched variant, pixel boxes) is ignored.
 */
export interface FlaggedHighlightLike {
    keyword?: string | null
}

/**
 * Short, de-duplicated, lower-case English names of the ingredients that caused the verdict.
 * `keyword` can hold several spellings separated by "|", so the first one is the name.
 * Names are cut to 60 characters and the list to 10. Never throws; returns [] for bad input.
 */
export function flaggedIngredientNames(highlights: FlaggedHighlightLike[] | null | undefined): string[] {
    const names: string[] = []
    const seen = new Set<string>()
    for (const h of highlights ?? []) {
        if (names.length >= FLAGGED_INGREDIENTS_MAX) break
        const raw = typeof h?.keyword === 'string' ? h.keyword : ''
        const name = raw
            .split('|')[0]
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .slice(0, FLAGGED_INGREDIENT_MAX_LENGTH)
            .trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        names.push(name)
    }
    return names
}

export interface ScanDecisionShownInput {
    autoStatus: string | null | undefined
    scanLogId?: ScanLogId
}

export function buildScanDecisionShownDetail(input: ScanDecisionShownInput) {
    return {
        auto_status: input.autoStatus,
        source: 'ingredient_scan' as const,
        scan_log_id: input.scanLogId ?? null,
    }
}

export interface ScanDecisionInput {
    choice: ScanDecisionChoice
    autoStatus: string | null | undefined
    /** What the user saw on screen; falls back to the scan's own verdict. */
    shownStatus?: string | null
    inDatabase?: boolean | null
    scanLogId?: ScanLogId
    /** Already-built names; re-cleaned here so a caller cannot exceed the caps. */
    flaggedIngredients?: string[] | null
}

export function buildScanDecisionDetail(input: ScanDecisionInput) {
    return {
        choice: input.choice,
        auto_status: input.autoStatus,
        shown_status: input.shownStatus ?? input.autoStatus,
        in_database: input.inDatabase ?? null,
        source: 'ingredient_scan' as const,
        scan_log_id: input.scanLogId ?? null,
        flagged_ingredients: flaggedIngredientNames((input.flaggedIngredients ?? []).map(keyword => ({ keyword }))),
    }
}
