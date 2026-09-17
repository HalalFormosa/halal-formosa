import { supabase } from '@/plugins/supabaseClient'
import { isDonor } from '@/composables/useSubscriptionStatus'

// Keep in sync with ScanIngredientsView.vue's DAILY_SCAN_LIMIT.
const DAILY_SCAN_LIMIT = 5

async function getBonusScans(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
        .from('user_scan_bonus')
        .select('bonus_scans, last_updated')
        .eq('user_id', userId)
        .single()

    if (error || !data) return 0
    return data.last_updated === today ? (data.bonus_scans ?? 0) : 0
}

export interface ScanStatus {
    used: number
    limit: number
    remaining: number
    isDonor: boolean
}

// Mirrors ScanIngredientsView's daily counter, shared so the Auto Scan camera's
// live overlay can show the same "used/limit" badge without duplicating the query.
export async function getScanStatus(): Promise<ScanStatus | null> {
    if (isDonor.value) return { used: 0, limit: Infinity, remaining: Infinity, isDonor: true }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const today = new Date().toISOString().split('T')[0]

    const [{ data, error }, bonusScans] = await Promise.all([
        supabase
            .from('ingredient_scan_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('success', true)
            .gte('created_at', today),
        getBonusScans(user.id),
    ])

    if (error) {
        console.error('Daily scan check error:', error)
        return null
    }

    const limit = DAILY_SCAN_LIMIT + bonusScans
    const used = data.length
    return { used, limit, remaining: Math.max(0, limit - used), isDonor: false }
}

// Mirrors ScanIngredientsView's checkDailyScanLimit, shared so the Auto Scan
// camera can also stop once the user has hit their daily cap — not just when
// they tap "View Details" on the manual flow.
export async function checkDailyScanLimit(): Promise<boolean> {
    const status = await getScanStatus()
    // fail-open instead of blocking users (no session, or the query errored)
    if (!status) return true
    return status.remaining > 0
}
