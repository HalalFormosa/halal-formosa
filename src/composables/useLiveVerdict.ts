import { ref, shallowRef } from 'vue'
import type { PluginListenerHandle } from '@capacitor/core'
import { LiveText } from '@/plugins/liveText'
import { invokeFunction, supabase } from '@/plugins/supabaseClient'
import type { IngredientHighlight } from '@/types/Ingredient'
import useHighlightCache from '@/composables/useHighlightCache'
import { countRecognizedChars, createLiveMatcher } from '@/utils/liveVerdictMatcher'
import { extractLiveProductName, LiveProductNameTracker } from '@/utils/liveProductName'
import { LiveNameTranslator, type LiveNameTranslatorStorage } from '@/utils/liveNameTranslator'
import { LiveProductLookup, type LiveLookupState } from '@/utils/liveProductLookup'
import { extractCoreProductName, pickBestProductMatch } from '@/utils/productNameMatch'
import { LiveHighlightTracker, type LiveVerdict } from '@/utils/liveVerdictTracker'

const ACTIVE_CLASS = 'live-verdict-active'
const TRANSLATE_TIMEOUT_MS = 8000
const TRANSLATIONS_KEY = 'liveNameTranslations'
const CJK = /[\u3400-\u9fff]/

/**
 * Is a product with this (English) name already in our database? Same ranked search and
 * name rule the ingredient scan uses. A failed search returns null, never "not found".
 */
async function productExists(name: string): Promise<boolean | null> {
    const core = extractCoreProductName(name) || name
    const { data, error } = await supabase.rpc('search_products', {
        p_query: core,
        p_limit: 5,
        p_offset: 0,
        p_sort: 'relevance',
    })
    if (error) return null
    return pickBestProductMatch(name, (data ?? []) as { name: string }[]) !== null
}

/** Translated product names kept on the device so a product scanned before is not translated (paid for) again. */
const translationStorage: LiveNameTranslatorStorage = {
    load() {
        try {
            return JSON.parse(localStorage.getItem(TRANSLATIONS_KEY) || '{}')
        } catch {
            return {}
        }
    },
    save(entries) {
        try {
            localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(entries))
        } catch {
            /* storage full or blocked */
        }
    },
}

/** Sends only the recognised product name text (never an image) to the existing translate function. */
async function translateToEnglish(text: string): Promise<string | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), TRANSLATE_TIMEOUT_MS))
    const result = await Promise.race([invokeFunction('google-translate', { body: { text, target: 'en' } }), timeout])
    if (!result || result.error || !result.data?.translatedText) return null
    return String(result.data.translatedText)
}

/**
 * Live "point the camera and read the verdict" mode (experimental, Android only for now).
 * Camera frames are analysed on the device by ML Kit and discarded; this composable
 * only ever sees the recognised text and its boxes.
 */
export default function useLiveVerdict() {
    const { allHighlights, fetchHighlightsWithCache } = useHighlightCache()

    const running = ref(false)
    const starting = ref(false)
    const error = ref('')
    const verdict = ref<LiveVerdict>('scanning')
    const highlights = shallowRef<IngredientHighlight[]>([])
    const productName = ref('')
    const productNameEn = ref('')
    const translatingName = ref(false)
    const lookupName = ref('')
    const productMatch = ref<LiveLookupState>('unknown')
    const frameSize = ref({ width: 0, height: 0 })
    const torchOn = ref(false)

    const tracker = new LiveHighlightTracker()
    const nameTracker = new LiveProductNameTracker()
    const nameTranslator = new LiveNameTranslator(translateToEnglish, { onUpdate: syncEnglishName, storage: translationStorage })

    const productLookup = new LiveProductLookup(productExists, { onUpdate: syncProductMatch })

    /** The name we search the database with: the English name, or the label's own name if it is not Chinese. */
    function currentLookupName(): string {
        if (productNameEn.value) return productNameEn.value
        return productName.value && !CJK.test(productName.value) ? productName.value : ''
    }

    function syncProductMatch() {
        lookupName.value = currentLookupName()
        productMatch.value = productLookup.state(lookupName.value)
    }

    function syncEnglishName() {
        productNameEn.value = nameTranslator.get(productName.value)
        translatingName.value = nameTranslator.pending(productName.value)
    }
    let listener: PluginListenerHandle | null = null

    async function start() {
        if (running.value || starting.value) return
        starting.value = true
        error.value = ''
        try {
            if (!allHighlights.value.length) await fetchHighlightsWithCache()
            if (!allHighlights.value.length) {
                error.value = 'Ingredient list is not available yet. Check your connection and try again.'
                return
            }
            const matchFrame = createLiveMatcher(allHighlights.value)

            let perm = await LiveText.checkPermissions()
            if (perm.camera !== 'granted') perm = await LiveText.requestPermissions()
            if (perm.camera !== 'granted') {
                error.value = 'Camera permission is needed to read labels.'
                return
            }

            tracker.reset()
            nameTracker.reset()
            nameTranslator.reset()
            listener = await LiveText.addListener('textFrame', frame => {
                const now = Date.now()
                tracker.update(matchFrame(frame), countRecognizedChars(frame), now)
                nameTracker.update(extractLiveProductName(frame), now)
                productName.value = nameTracker.current(now)
                nameTranslator.update(productName.value, now)
                syncEnglishName()
                productLookup.update(currentLookupName(), now)
                syncProductMatch()
                frameSize.value = { width: frame.width, height: frame.height }
                highlights.value = tracker.active(now)
                verdict.value = tracker.verdict(now)
            })

            document.documentElement.classList.add(ACTIVE_CLASS)
            await LiveText.start()
            running.value = true
        } catch (e) {
            console.error('[LiveVerdict] start failed', e)
            await stop()
            error.value = 'Could not start the camera.'
        } finally {
            starting.value = false
        }
    }

    async function stop() {
        const handle = listener
        listener = null
        try { await handle?.remove() } catch { /* already removed */ }
        try { await LiveText.stop() } catch { /* not running */ }
        document.documentElement.classList.remove(ACTIVE_CLASS)
        running.value = false
        torchOn.value = false
        tracker.reset()
        nameTracker.reset()
        nameTranslator.reset()
        productName.value = ''
        productNameEn.value = ''
        translatingName.value = false
        lookupName.value = ''
        productMatch.value = 'unknown'
        highlights.value = []
        verdict.value = 'scanning'
    }

    async function toggleTorch() {
        const next = !torchOn.value
        try {
            await LiveText.setTorch({ enabled: next })
            torchOn.value = next
        } catch (e) {
            console.warn('[LiveVerdict] torch unavailable', e)
        }
    }

    return { running, starting, error, verdict, productName, productNameEn, translatingName, lookupName, productMatch, highlights, frameSize, torchOn, start, stop, toggleTorch }
}
