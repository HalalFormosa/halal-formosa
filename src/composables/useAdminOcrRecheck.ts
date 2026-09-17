import { ref } from 'vue'
import useOcrPipeline from './useOcrPipeline'
import { diffIngredientTokens, nameSimilarity, verdictForSimilarity, type IngredientTokenDiff, type SimilarityVerdict } from '@/utils/textDiff'

export type OcrVerdict = SimilarityVerdict | 'unavailable'

export interface OcrNameCheck {
  ocrName: string | null
  submittedName: string
  similarity: number | null
  verdict: OcrVerdict
  source: 'back' | 'front' | null
}

export interface OcrIngredientsCheck {
  ocrText: string
  diff: IngredientTokenDiff
  verdict: OcrVerdict
}

export interface OcrRecheckResult {
  name: OcrNameCheck
  ingredients: OcrIngredientsCheck
}

// Admin-only re-check: re-runs the same OCR pipeline contributors use, but
// against the ALREADY-STORED product photos, to diff fresh OCR text against
// what was submitted. Deliberately never calls logIngredientScan() — that's
// the actual daily-scan-quota mechanism (ScanLimitService counts rows it
// writes), and an admin re-checking a submission must never burn a
// contributor-style quota or pollute ingredient_scan_logs.
export function useAdminOcrRecheck() {
  const checking = ref(false)
  const checkingFront = ref(false)
  const error = ref<string | null>(null)
  const result = ref<OcrRecheckResult | null>(null)

  const pipeline = useOcrPipeline({
    allHighlights: ref([]),
    blacklistPatterns: ref([]),
    incrementUsageCount: () => 0,
    fetchHighlightsWithCache: async () => null,
    setError: (msg: string) => { error.value = msg },
    t: (key: string) => key,
  })

  let token = 0

  function buildNameCheck(ocrName: string, submittedName: string, source: 'back' | 'front'): OcrNameCheck {
    const similarity = nameSimilarity(ocrName, submittedName)
    return {
      ocrName,
      submittedName,
      similarity,
      source,
      verdict: verdictForSimilarity(similarity),
    }
  }

  async function urlToFile(url: string, filename: string): Promise<File> {
    const res = await fetch(url)
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/jpeg' })
  }

  async function runCheck(params: { backPhotoUrl: string; submittedName: string; submittedIngredients: string }) {
    const myToken = ++token
    checking.value = true
    error.value = null
    result.value = null
    try {
      const file = await urlToFile(params.backPhotoUrl, 'admin-back-recheck.jpg')
      if (myToken !== token) return

      await pipeline.runOcr(file)
      if (myToken !== token) return
      if (error.value) return // runOcr degraded gracefully (e.g. "no text detected") via setError, without throwing

      const ocrIngredientsText = pipeline.ingredientsText.value || ''
      const diff = diffIngredientTokens(params.submittedIngredients || '', ocrIngredientsText)
      const ocrName = pipeline.productName.value || ''

      result.value = {
        name: ocrName
          ? buildNameCheck(ocrName, params.submittedName, 'back')
          : { ocrName: null, submittedName: params.submittedName, similarity: null, verdict: 'unavailable', source: null },
        ingredients: {
          ocrText: ocrIngredientsText,
          diff,
          verdict: !ocrIngredientsText ? 'unavailable' : verdictForSimilarity(diff.jaccard),
        },
      }
    } catch (e: any) {
      if (myToken !== token) return
      error.value = e?.message || 'Could not check photo text right now.'
    } finally {
      if (myToken === token) checking.value = false
    }
  }

  // Manual, opt-in fallback — only surfaced in the UI when the back-photo
  // check found no labeled name field. Uses the pipeline's low-level
  // primitives directly (skips ingredients-specific cleaning, which doesn't
  // apply to a front-of-pack image), costing one extra Vision call (plus one
  // Translate call only if the front text isn't English) only when the admin
  // actually taps for it.
  async function runFrontPhotoNameCheck(params: { frontPhotoUrl: string; submittedName: string }) {
    const myToken = token
    checkingFront.value = true
    try {
      const file = await urlToFile(params.frontPhotoUrl, 'admin-front-recheck.jpg')
      const { text } = await pipeline.extractTextFromImage(file)
      if (myToken !== token || !text) return

      const lang = pipeline.detectLanguage(text)
      const nameSourceText = (lang === 'chinese' || lang === 'mixed')
        ? (await pipeline.translateToEnglish(text)) || text
        : text
      if (myToken !== token) return

      const ocrName = pipeline.extractProductName(nameSourceText)
      if (!result.value) return
      result.value = {
        ...result.value,
        name: ocrName
          ? buildNameCheck(ocrName, params.submittedName, 'front')
          : { ocrName: null, submittedName: params.submittedName, similarity: null, verdict: 'unavailable', source: null },
      }
    } catch (e: any) {
      error.value = e?.message || 'Could not check front photo text right now.'
    } finally {
      checkingFront.value = false
    }
  }

  function reset() {
    token++
    checking.value = false
    checkingFront.value = false
    error.value = null
    result.value = null
  }

  return { checking, checkingFront, error, result, runCheck, runFrontPhotoNameCheck, reset }
}
