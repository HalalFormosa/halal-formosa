// src/types/highlights.ts
export interface OcrWord {
    description: string
    vertices: { x: number; y: number }[]
}

export interface HighlightBox {
    x: number
    y: number
    width: number
    height: number
}

export interface IngredientHighlight {
    keyword: string
    keyword_zh: string
    color: string
    // ✅ add this so composable can pass the chosen one
    matchedVariant?: string
    // 📍 pixel-space bounding box(es) on the OCR'd image, when the matched
    // text could be located among the raw OCR words (undefined/empty when not found,
    // e.g. a match only found via translated text with no counterpart in the source image)
    boxes?: HighlightBox[]
}

export interface BlacklistPattern {
    pattern: string
}

export type HighlightedIngredient = {
    html: string
    highlighted: boolean
}