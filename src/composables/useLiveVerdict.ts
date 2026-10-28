import { ref, shallowRef } from 'vue'
import type { PluginListenerHandle } from '@capacitor/core'
import { LiveText } from '@/plugins/liveText'
import type { IngredientHighlight } from '@/types/Ingredient'
import useHighlightCache from '@/composables/useHighlightCache'
import { countRecognizedChars, createLiveMatcher } from '@/utils/liveVerdictMatcher'
import { LiveHighlightTracker, type LiveVerdict } from '@/utils/liveVerdictTracker'

const ACTIVE_CLASS = 'live-verdict-active'

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
    const frameSize = ref({ width: 0, height: 0 })
    const torchOn = ref(false)

    const tracker = new LiveHighlightTracker()
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
            listener = await LiveText.addListener('textFrame', frame => {
                const now = Date.now()
                tracker.update(matchFrame(frame), countRecognizedChars(frame), now)
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

    return { running, starting, error, verdict, highlights, frameSize, torchOn, start, stop, toggleTorch }
}
