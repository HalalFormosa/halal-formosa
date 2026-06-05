// composables/useBadgeCosmetics.ts
import { ref, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'

export interface BadgeCosmetic {
  id: string
  slug: string
  name: string
  category: 'glow' | 'aura' | 'outline' | 'background' | 'frame' | 'nameplate'
  tier: 'free' | 'xp' | 'pro'
  xp_cost: number
  css_value: Record<string, string>
  preview_color: string
  sort_order: number
  is_active: boolean
}

export interface OwnedCosmetic {
  id: string
  user_id: string
  cosmetic_id: string
  equipped: boolean
  purchased_at: string
  cosmetic?: BadgeCosmetic
}

const catalog = ref<BadgeCosmetic[]>([])
const ownedCosmetics = ref<OwnedCosmetic[]>([])
const loadingCatalog = ref(false)
const loadingOwned = ref(false)
const spendablePoints = ref<number>(0)

const EDGE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export function useBadgeCosmetics() {
  async function fetchCatalog() {
    if (catalog.value.length > 0) return // cache
    loadingCatalog.value = true
    const { data, error } = await supabase
      .from('badge_cosmetics')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (!error && data) {
      catalog.value = data as BadgeCosmetic[]
    }
    loadingCatalog.value = false
  }

  async function fetchOwnedCosmetics(userId: string) {
    loadingOwned.value = true
    const { data, error } = await supabase
      .from('user_badge_cosmetics')
      .select('*, cosmetic:badge_cosmetics(*)')
      .eq('user_id', userId)

    if (!error && data) {
      ownedCosmetics.value = data.map((d: any) => ({
        ...d,
        cosmetic: d.cosmetic as BadgeCosmetic
      }))
    }
    loadingOwned.value = false
  }

  async function fetchSpendablePoints(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('spendable_points')
      .eq('id', userId)
      .single()

    if (!error && data) {
      spendablePoints.value = data.spendable_points ?? 0
    }
  }

  async function purchaseCosmetic(cosmeticId: string): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session) return { success: false, error: 'Not logged in' }

      const res = await fetch(`${EDGE_BASE_URL}/purchase-cosmetic`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cosmetic_id: cosmeticId })
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Purchase failed' }
      }

      // Update local state
      spendablePoints.value = json.new_balance ?? spendablePoints.value
      await fetchOwnedCosmetics(session.user.id)
      return { success: true, newBalance: json.new_balance }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  async function equipCosmetic(cosmeticId: string, category: string) {
    const session = (await supabase.auth.getSession()).data.session
    if (!session) return

    const userId = session.user.id

    // Unequip all in same category first
    const sameCategory = ownedCosmetics.value.filter(
      o => o.cosmetic?.category === category && o.equipped
    )
    for (const item of sameCategory) {
      await supabase
        .from('user_badge_cosmetics')
        .update({ equipped: false })
        .eq('id', item.id)
    }

    // Equip the selected one
    await supabase
      .from('user_badge_cosmetics')
      .update({ equipped: true })
      .eq('user_id', userId)
      .eq('cosmetic_id', cosmeticId)

    // Refresh owned
    await fetchOwnedCosmetics(userId)
  }

  async function unequipCosmetic(cosmeticId: string) {
    const session = (await supabase.auth.getSession()).data.session
    if (!session) return

    await supabase
      .from('user_badge_cosmetics')
      .update({ equipped: false })
      .eq('user_id', session.user.id)
      .eq('cosmetic_id', cosmeticId)

    await fetchOwnedCosmetics(session.user.id)
  }

  async function refundCosmetic(cosmeticId: string): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    try {
      const { data, error } = await supabase.rpc('refund_cosmetic', {
        p_cosmetic_id: cosmeticId
      })
      if (error) {
        return { success: false, error: error.message }
      }

      const result = data as any
      const row = Array.isArray(result) ? result[0] : result
      if (!row || !row.success) {
        return { success: false, error: row?.error_msg || 'Refund failed' }
      }

      // Update local state
      spendablePoints.value = row.new_balance ?? spendablePoints.value
      
      const session = (await supabase.auth.getSession()).data.session
      if (session) {
        await fetchOwnedCosmetics(session.user.id)
      }

      return { success: true, newBalance: row.new_balance }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  const equippedCosmetics = computed<BadgeCosmetic[]>(() =>
    ownedCosmetics.value.filter(o => o.equipped).map(o => o.cosmetic).filter((c): c is BadgeCosmetic => !!c)
  )

  const catalogByCategory = computed(() => {
    const grouped: Record<string, BadgeCosmetic[]> = {}
    for (const item of catalog.value) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }
    return grouped
  })

  function isOwned(cosmeticId: string): boolean {
    return ownedCosmetics.value.some(o => o.cosmetic_id === cosmeticId)
  }

  function isEquipped(cosmeticId: string): boolean {
    return ownedCosmetics.value.some(o => o.cosmetic_id === cosmeticId && o.equipped)
  }

  return {
    catalog,
    ownedCosmetics,
    equippedCosmetics,
    catalogByCategory,
    spendablePoints,
    loadingCatalog,
    loadingOwned,
    fetchCatalog,
    fetchOwnedCosmetics,
    fetchSpendablePoints,
    purchaseCosmetic,
    equipCosmetic,
    unequipCosmetic,
    refundCosmetic,
    isOwned,
    isEquipped
  }
}
