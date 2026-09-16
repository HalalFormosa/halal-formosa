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

// Mirrors ScanIngredientsView's checkDailyScanLimit, shared so the Auto Scan
// camera can also stop once the user has hit their daily cap — not just when
// they tap "View Details" on the manual flow.
export async function checkDailyScanLimit(): Promise<boolean> {
    if (isDonor.value) return true

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return true

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
        return true // fail-open instead of blocking users
    }

    return data.length < (DAILY_SCAN_LIMIT + bonusScans)
}
