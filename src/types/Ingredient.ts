// src/types/highlights.ts
export interface IngredientHighlight {
    keyword: string
    keyword_zh: string
    color: string
    // ✅ add this so composable can pass the chosen one
    matchedVariant?: string
}

export interface BlacklistPattern {
    pattern: string
}

export type HighlightedIngredient = {
    html: string
    highlighted: boolean
}