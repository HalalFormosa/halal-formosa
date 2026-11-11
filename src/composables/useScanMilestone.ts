import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/plugins/supabaseClient'
import { isDonor } from '@/composables/useSubscriptionStatus'
import { ActivityLogService } from '@/services/ActivityLogService'
import { canAutoShowPaywall, markAutoPaywallShown } from '@/utils/paywallCap'
import { SCAN_MILESTONE } from '@/constants/scanMilestone'

const shownKey = (userId: string) => `scan_milestone_shown:${userId}`

function wasShown(userId: string): boolean {
    try {
        return localStorage.getItem(shownKey(userId)) === '1'
    } catch {
        return false
    }
}

function markShown(userId: string) {
    try {
        localStorage.setItem(shownKey(userId), '1')
    } catch {
        /* storage unavailable: worst case the sheet can show again */
    }
}

async function countSuccessfulScans(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('ingredient_scan_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('success', true)
    if (error) {
        console.warn('[Milestone] scan count failed:', error)
        return 0
    }
    return count ?? 0
}

const open = ref(false)

export interface MaybeShowOptions {
    /** Return true while something else owns the screen (another sheet, or the user left). */
    blocked?: () => boolean
}

/**
 * One-time "you've scanned 10 products" Pro sheet. Shown on Home, never mid-scan, to free users
 * on the native app, and held back by the app-opened paywall cap. It is only marked as shown
 * once it actually opens, so an announcement or a quick tab switch just delays it.
 */
export function useScanMilestone() {
    async function maybeShow(options: MaybeShowOptions = {}) {
        if (open.value || isDonor.value || !Capacitor.isNativePlatform()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || wasShown(user.id)) return
        if (!canAutoShowPaywall()) return

        const count = await countSuccessfulScans(user.id)
        if (count < SCAN_MILESTONE) return

        // Re-check after the awaits: the user may have bought Pro or moved on meanwhile.
        if (isDonor.value || options.blocked?.()) return

        markShown(user.id)
        markAutoPaywallShown()
        open.value = true
        ActivityLogService.log('scan_milestone_shown', { count })
    }

    return { open, maybeShow }
}
