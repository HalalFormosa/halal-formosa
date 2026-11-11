// Frequency cap for paywalls the app opens by itself (limit sheets, milestones, offers).
// A paywall the user opens by tapping an upgrade button or a locked row is never capped.

const LAST_DISMISS_KEY = 'paywall_last_dismissed_at'
const DISMISS_COUNT_KEY = 'paywall_dismiss_count'
const DAY_MS = 24 * 60 * 60 * 1000

// At most one app-opened paywall per app session.
let shownThisSession = false

function readNumber(key: string): number {
    try {
        const n = Number(localStorage.getItem(key))
        return Number.isFinite(n) ? n : 0
    } catch {
        return 0
    }
}

function writeNumber(key: string, value: number) {
    try {
        localStorage.setItem(key, String(value))
    } catch {
        /* storage unavailable: the cap just won't persist */
    }
}

/** 24 hours after a dismissal, 7 days once the user has dismissed two or more. */
export function canAutoShowPaywall(now = Date.now()): boolean {
    if (shownThisSession) return false
    const last = readNumber(LAST_DISMISS_KEY)
    if (!last) return true
    const cooldown = readNumber(DISMISS_COUNT_KEY) >= 2 ? 7 * DAY_MS : DAY_MS
    return now - last >= cooldown
}

export function markAutoPaywallShown() {
    shownThisSession = true
}

export function recordPaywallDismissed(now = Date.now()) {
    writeNumber(LAST_DISMISS_KEY, now)
    writeNumber(DISMISS_COUNT_KEY, readNumber(DISMISS_COUNT_KEY) + 1)
}

export function resetPaywallDismissals() {
    try {
        localStorage.removeItem(LAST_DISMISS_KEY)
        localStorage.removeItem(DISMISS_COUNT_KEY)
    } catch {
        /* ignore */
    }
}
