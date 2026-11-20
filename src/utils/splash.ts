/**
 * Animated launch splash (markup + CSS live in index.html so it paints before JS).
 * Shown at least MIN_VISIBLE_MS so the animation reads, then fades out.
 */
const MIN_VISIBLE_MS = 1100
const FADE_MS = 380

let dismissed = false

export function hideSplash(): void {
    if (dismissed) return
    dismissed = true

    const el = document.getElementById('hf-splash')
    if (!el) return

    const start = (window as any).__hfSplashStart as number | undefined
    const elapsed = start ? Date.now() - start : MIN_VISIBLE_MS
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

    // Two frames so the first real screen has painted underneath before we fade.
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            el.classList.add('hf-splash-hide')
            setTimeout(() => el.remove(), FADE_MS + 50)
        }))
    }, wait)
}
