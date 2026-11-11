// The optional "Update available" prompt used to appear on every app start while an update was pending,
// which one survey respondent called tiring. Show it at most once per window instead.
// The required-update screen (ForceUpdateModal) is separate and is never throttled.
export const UPDATE_PROMPT_KEY = 'app_update_prompt_last_shown'
export const UPDATE_PROMPT_GAP_MS = 7 * 24 * 60 * 60 * 1000

export function shouldShowUpdatePrompt(
    now: number,
    lastShownAt: number | null,
    gapMs: number = UPDATE_PROMPT_GAP_MS
): boolean {
    if (lastShownAt === null || !Number.isFinite(lastShownAt)) return true
    // A clock set backwards must not silence the prompt forever.
    if (lastShownAt > now) return true
    return now - lastShownAt >= gapMs
}

export function readUpdatePromptLastShown(): number | null {
    try {
        const raw = localStorage.getItem(UPDATE_PROMPT_KEY)
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
    } catch {
        return null
    }
}

export function markUpdatePromptShown(now: number = Date.now()): void {
    try {
        localStorage.setItem(UPDATE_PROMPT_KEY, String(now))
    } catch {
        // storage unavailable: the prompt may repeat, which is the old behaviour
    }
}
