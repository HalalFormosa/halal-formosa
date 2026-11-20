/**
 * Animated launch splash (markup + CSS live in index.html so it paints before JS).
 * Shown at least MIN_VISIBLE_MS so the animation reads, then the logo expands and
 * dissolves while the white fades out to reveal the app.
 */
const MIN_VISIBLE_MS = 1500
const EXIT_MS = 640 // 140ms delay + 480ms fade in index.html, plus a little slack

let dismissed = false

export function hideSplash(): void {
    if (dismissed) return
    dismissed = true

    const el = document.getElementById('hf-splash')
    if (!el) return

    const start = (window as any).__hfSplashStart as number | undefined
    const elapsed = start ? Date.now() - start : MIN_VISIBLE_MS
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

    // Two frames so the first real screen has painted underneath before we start the exit.
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            // Start the expansion from the logo's current "breathing" scale so there is no jump.
            const logo = el.querySelector<HTMLElement>('.hf-splash-logo')
            if (logo) {
                const m = new DOMMatrixReadOnly(getComputedStyle(logo).transform)
                if (Number.isFinite(m.a) && m.a > 0) logo.style.setProperty('--hf-from', String(m.a))
            }
            el.classList.add('hf-splash-hide')
            setTimeout(() => el.remove(), EXIT_MS + 150)
        }))
    }, wait)
}
