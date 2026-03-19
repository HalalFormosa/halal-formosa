import useOcrPipeline from "@/composables/useOcrPipeline"
import type { IngredientHighlight } from "@/types/Ingredient"

export interface OcrResult {
    textZh: string
    textEn: string
    productName: string
    highlights: IngredientHighlight[]
    autoStatus: string
    detectedLanguage: string
    ocrRaw?: string
}

export function useOcrService(options: Parameters<typeof useOcrPipeline>[0]) {
    const pipeline = useOcrPipeline(options)

    async function processFile(file: File): Promise<OcrResult | null> {
        try {
            await pipeline.runOcr(file)

            // ✅ Patch pipeline refs automatically (UI will update)
            pipeline.productName.value = pipeline.productName.value || "Unknown Product"
            pipeline.ingredientsTextZh.value = pipeline.ingredientsTextZh.value || ""
            pipeline.ingredientsText.value = pipeline.ingredientsText.value || ""
            pipeline.ingredientHighlights.value = pipeline.ingredientHighlights.value || []
            pipeline.autoStatus.value = pipeline.autoStatus.value || ""

            // Return a typed object if caller still wants to inspect it
            return {
                textZh: pipeline.ingredientsTextZh.value,
                textEn: pipeline.ingredientsText.value,
                productName: pipeline.productName.value,
                highlights: pipeline.ingredientHighlights.value,
                autoStatus: pipeline.autoStatus.value,
                detectedLanguage: pipeline.detectedLanguage.value,
                ocrRaw: pipeline.ocrRawText.value, // 👈 works perfectly now
            }
        } catch (e: any) {
            console.error("❌ OCR Service failed:", e);
            throw e; // ✅ keep throwing upward
        }
    }

    return {
        processFile,
        // Expose everything from pipeline (already includes recheckHighlightsSmart)
        ...pipeline,
    }

}
