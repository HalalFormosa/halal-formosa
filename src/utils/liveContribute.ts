import type { OcrResult } from '@/composables/useOcrService'

/** Decodes the base64 JPEG returned by the native capture into a File. */
export function base64ToFile(base64: string, fileName: string, type = 'image/jpeg'): File {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], fileName, { type })
}

function usableName(name: string | undefined): string {
    const trimmed = (name ?? '').trim()
    return trimmed && trimmed !== 'Unknown Product' && trimmed !== 'Unknown' ? trimmed : ''
}

/**
 * Query for /add, the same shape ScanIngredientsView.goToAddProduct sends, so the add-product
 * flow prefills the name, ingredients, status and back photo. No barcode is passed on purpose:
 * the add-product flow then opens its barcode scanner first.
 */
export function buildAddProductQuery(args: {
    ocr: OcrResult | null
    /** Name Live Verdict already detected; used when the label OCR cannot find one. */
    fallbackName: string
    imageUrl: string
}): Record<string, string> {
    const { ocr, fallbackName, imageUrl } = args
    return {
        fromScan: 'true',
        name: usableName(ocr?.productName) || fallbackName,
        ingredients: ocr ? ocr.textEn || ocr.textZh : '',
        status: ocr?.autoStatus ?? '',
        image: imageUrl,
        analysis: JSON.stringify(ocr?.highlights ?? []),
        rawOcr: ocr?.textZh ?? '',
    }
}

export type ContributePromptKind = 'missing' | 'general'

/**
 * Whether, and how, to invite the user to add the product they are scanning.
 *  - 'missing': we looked it up and it is not in the database.
 *  - 'general': something is being read (a label, a name, flagged ingredients) but we have not
 *    confirmed either way, e.g. the name is not translated yet. The invitation stays, so
 *    people using the live verdict are still nudged to contribute.
 * Never shown for a product the database already has, or once the user said "Not now" for it.
 */
export function contributePromptKind(args: {
    available: boolean
    running: boolean
    hasError: boolean
    limitReached: boolean
    /** Any detection: enough label text read, a product name, or a flagged ingredient. */
    detected: boolean
    match: 'unknown' | 'checking' | 'found' | 'missing'
    dismissed: boolean
}): ContributePromptKind | null {
    const { available, running, hasError, limitReached, detected, match, dismissed } = args
    if (!available || !running || hasError || limitReached || dismissed || !detected) return null
    if (match === 'found') return null
    return match === 'missing' ? 'missing' : 'general'
}
