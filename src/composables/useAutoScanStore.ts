import { ref } from 'vue'
import type { IngredientHighlight } from '@/types/Ingredient'

export interface AutoScanResult {
    blob: Blob
    roi: {
        left: number
        top: number
        width: number
        height: number
    } | null
    // Present when the live scanner already ran the full OCR/translation pipeline
    // (see AutoScanCamera.vue) — lets the results screen skip re-analyzing the image.
    productName?: string
    textEn?: string
    textZh?: string
    highlights?: IngredientHighlight[]
    autoStatus?: string
    detectedLanguage?: string
    ocrRaw?: string
    ocrImageWidth?: number
    ocrImageHeight?: number
    // Set once the live detection has already been counted as a completed scan
    // (see AutoScanView.vue's onStableResult) — lets ScanIngredientsView avoid
    // double-counting it if the user goes on to tap "View Details".
    loggedAsScan?: boolean
}

const autoScanResult = ref<AutoScanResult | null>(null)

export function useAutoScanStore() {
    function setResult(result: AutoScanResult) {
        autoScanResult.value = result
    }

    function clearResult() {
        autoScanResult.value = null
    }

    return {
        autoScanResult,
        setResult,
        clearResult
    }
}
