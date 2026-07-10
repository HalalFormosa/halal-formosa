import { supabase } from '@/plugins/supabaseClient'
import { isDonor } from '@/composables/useSubscriptionStatus'
import { userRole } from '@/composables/userProfile'

/**
 * Awards bonus scan quota to the current user (e.g. for contributing a product or location).
 * @param amount Number of scans to reward. Defaults to 5.
 */
export async function awardScanBonus(amount = 1) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('⏩ No user logged in, skipping scan bonus reward.')
      return false
    }

    const today = new Date().toISOString().split('T')[0]

    // Fetch existing bonus record
    const { data, error } = await supabase
      .from('user_scan_bonus')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      // First time today or first time ever
      const { error: insertError } = await supabase.from('user_scan_bonus').insert({
        user_id: user.id,
        bonus_scans: amount,
        daily_ad_uses: 0,
        last_updated: today
      })
      if (insertError) throw insertError
      console.log(`🎉 Awarded first ${amount} bonus scans to user ${user.id}`)
      return true
    }

    // Determine base values depending on date
    const isToday = data.last_updated === today
    const currentBonus = isToday ? (data.bonus_scans || 0) : 0
    const currentAdUses = isToday ? (data.daily_ad_uses || 0) : 0

    // 🔒 Cap: limit contribution rewards to a maximum of 3 scans per day
    // contribution_scans = total_bonus_scans - ad_uses
    const contributionScans = currentBonus - currentAdUses
    if (contributionScans >= 3) {
      console.log('📈 Daily contribution scan reward limit reached (max 3/day). No scans awarded.')
      return false
    }

    const { error: updateError } = await supabase
      .from('user_scan_bonus')
      .update({
        bonus_scans: currentBonus + amount,
        daily_ad_uses: currentAdUses,
        last_updated: today
      })
      .eq('user_id', user.id)

    if (updateError) throw updateError
    console.log(`🎉 Successfully awarded ${amount} bonus scans (Total today: ${currentBonus + amount})`)
    return true

  } catch (err) {
    console.error('❌ Failed to award scan bonus:', err)
    return false
  }
}

/**
 * Checks if the current user has reached the daily limit of 3 contributions.
 */
export async function isContributionLimitReached(): Promise<boolean> {
  if (isDonor.value) return false // Pro users have no limit
  if (userRole.value === 'admin' || userRole.value === 'contributor') return false // Admins and approved contributors have no limit

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('user_scan_bonus')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error || !data) return false

    if (data.last_updated !== today) return false

    const contributionScans = (data.bonus_scans || 0) - (data.daily_ad_uses || 0)
    return contributionScans >= 3
  } catch {
    return false
  }
}
