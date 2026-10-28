import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LiveText } from '@/plugins/liveText'
import useHighlightCache from '@/composables/useHighlightCache'
import { useOcrService, type OcrResult } from '@/composables/useOcrService'
import { base64ToFile, buildAddProductQuery } from '@/utils/liveContribute'

/**
 * "Add this product" from Live Verdict: take one photo of what the camera is pointed at,
 * read the label with the normal ingredient pipeline, then hand over to the usual
 * add-product flow (which asks for the barcode first).
 *
 * This is the one place Live Verdict keeps an image, and only because the user pressed
 * the button; the photo becomes the product's back photo in the add flow.
 */
export default function useLiveContribute(options: { stopCamera: () => Promise<void> }) {
    const router = useRouter()
    const { t } = useI18n()
    const { allHighlights, blacklistPatterns, fetchHighlightsWithCache, incrementUsageCount } = useHighlightCache()
    const { processFile } = useOcrService({
        allHighlights,
        blacklistPatterns,
        fetchHighlightsWithCache,
        incrementUsageCount,
        setError: (msg: string) => console.warn('[LiveContribute] label analysis:', msg),
        t,
    })

    const busy = ref(false)
    const busyMessage = ref('')
    const error = ref('')

    async function contribute(fallbackName: string) {
        if (busy.value) return
        busy.value = true
        error.value = ''
        try {
            busyMessage.value = 'Taking photo…'
            const photo = await LiveText.takePhoto()
            const file = base64ToFile(photo.base64, 'live-capture.jpg')

            // The shot is in hand; release the camera before the slower label reading.
            await options.stopCamera()

            busyMessage.value = 'Reading the label…'
            let ocr: OcrResult | null = null
            try {
                ocr = await processFile(file)
            } catch (e) {
                // The add flow still works without it: the photo and name carry over.
                console.warn('[LiveContribute] label reading failed, continuing without it', e)
            }

            await router.push({
                path: '/add',
                query: buildAddProductQuery({ ocr, fallbackName, imageUrl: URL.createObjectURL(file) }),
            })
        } catch (e) {
            console.error('[LiveContribute] could not take the photo', e)
            error.value = 'Could not take the photo. Please try again.'
        } finally {
            busy.value = false
        }
    }

    return { busy, busyMessage, error, contribute }
}
