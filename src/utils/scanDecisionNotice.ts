export type ScanDecisionChoice = 'use' | 'skip' | 'check'

// Team-facing (Discord) wording, always English.
const DECISION_LABEL: Record<ScanDecisionChoice, string> = {
    use: 'Buy / eat it',
    skip: 'Skip it',
    check: 'Check further',
}

// Discord caps a message at 2,000 characters; these keep the worst case under ~1,800.
const FLAGGED_MAX = 200
const INGREDIENTS_ZH_MAX = 550
const INGREDIENTS_EN_MAX = 650
const PRODUCT_MAX = 100
const MATCHED_MAX = 80

/** One-line text for a Discord message: no mentions, no line breaks, bounded length. */
function clean(value: string | null | undefined, max: number): string {
    const text = (value ?? '')
        .replace(/\s+/g, ' ')
        .replace(/@(everyone|here)/gi, '@​$1') // never ping the channel
        .replace(/<@[!&]?\d+>/g, '[mention]')
        .trim()
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export interface ScanDecisionNoticeInput {
    productName?: string | null
    /** The verdict the user saw (the database product's status when it was matched). */
    status?: string | null
    choice: ScanDecisionChoice
    /** Names of ingredients the scan flagged. */
    flagged?: string[]
    /** Detected (and cleaned) Chinese ingredient text from the scan. */
    ingredientsZh?: string | null
    /** English ingredient text (translation) from the scan. */
    ingredients?: string | null
    /** Whether the product is already in our database; null/undefined = not checked yet. */
    inDatabase?: boolean | null
    /** Name of the matched database product, when there is one. */
    matchedName?: string | null
}

/**
 * Builds the title + body for the internal Discord notification sent when a user
 * answers the "what will you do with this product?" prompt.
 * Deliberately contains no user identity (no name, email or ID).
 */
export function buildScanDecisionNotice(input: ScanDecisionNoticeInput): { title: string; message: string } {
    // Flagged ingredients are only informative for a new, unverified scan. A product we
    // already have, or one whose final result is Muslim-friendly, is settled: its
    // ingredients (e.g. an emulsifier) are treated as Muslim-friendly too.
    const settled = input.inDatabase === true || input.status === 'Muslim-friendly'
    const flagged = settled ? '' : clean((input.flagged ?? []).filter(Boolean).join(', '), FLAGGED_MAX)
    const ingredientsZh = clean(input.ingredientsZh, INGREDIENTS_ZH_MAX)
    const ingredientsEn = clean(input.ingredients, INGREDIENTS_EN_MAX)

    const matched = clean(input.matchedName, MATCHED_MAX)
    const inDatabase =
        input.inDatabase === true ? `Yes${matched ? ` — ${matched}` : ''}`
        : input.inDatabase === false ? 'No (new product)'
        : 'Not checked yet'

    const lines = [
        `**Product:** ${clean(input.productName, PRODUCT_MAX) || 'Unknown'}`,
        `**In database:** ${inDatabase}`,
        `**Result:** ${clean(input.status, 40) || 'Unknown'}`,
        `**Decision:** ${DECISION_LABEL[input.choice]}`,
        flagged ? `**Flagged:** ${flagged}` : null,
        ingredientsZh ? `**Ingredients (中文):** ${ingredientsZh}` : null,
        ingredientsEn ? `**Ingredients (EN):** ${ingredientsEn}` : null,
    ].filter((line): line is string => line !== null)

    return {
        title: `🧾 Scan decision: ${DECISION_LABEL[input.choice]}`,
        message: lines.join('\n'),
    }
}
