import { ref } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  action_path: string | null
  related_table: string | null
  related_id: string | null
  image_url: string | null
  is_read: boolean
  created_at: string
}

export type BroadcastCategory = 'products' | 'locations' | 'news' | 'trips' | 'store'

export interface CategoryItem {
  id: string
  title: string
  image: string | null
  actionPath: string
  date: string
}

export interface CategoryBadge {
  category: BroadcastCategory
  label: string
  count: number
  actionPath: string
  // Populated only when count <= ITEM_THRESHOLD, so a lone new item can be
  // shown as its own notification row instead of a vague "1 new X" card.
  items: CategoryItem[]
}

interface CategoryConfig {
  category: BroadcastCategory
  table: string
  dateColumn: string
  approvedOnly?: boolean
  activeOnly?: boolean
  label: string
  actionPath: string
  selectFields: string
  mapItem: (row: any) => Omit<CategoryItem, 'date'>
}

const ITEM_THRESHOLD = 5

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    category: 'products', table: 'products', dateColumn: 'approved_at', approvedOnly: true,
    label: 'New products added', actionPath: '/search',
    selectFields: 'id, name, barcode, photo_front_url',
    mapItem: (row) => ({ id: row.id, title: row.name || 'New product', image: row.photo_front_url, actionPath: `/item/${row.barcode}` })
  },
  {
    category: 'locations', table: 'locations', dateColumn: 'approved_at', approvedOnly: true,
    label: 'New places added', actionPath: '/explore',
    selectFields: 'id, name, image',
    mapItem: (row) => ({ id: String(row.id), title: row.name || 'New place', image: row.image, actionPath: `/place/${row.id}` })
  },
  {
    category: 'news', table: 'news', dateColumn: 'created_at',
    label: 'New announcements', actionPath: '/news',
    selectFields: 'id, title, header_image',
    mapItem: (row) => ({ id: row.id, title: row.title || 'New announcement', image: row.header_image, actionPath: `/news/${row.id}` })
  },
  {
    category: 'trips', table: 'trips', dateColumn: 'created_at', activeOnly: true,
    label: 'New trips available', actionPath: '/trip',
    selectFields: 'id, title, cover_url',
    mapItem: (row) => ({ id: row.id, title: row.title || 'New trip', image: row.cover_url, actionPath: '/trip' })
  },
  {
    category: 'store', table: 'store_products', dateColumn: 'created_at', activeOnly: true,
    label: 'New store items', actionPath: '/store',
    selectFields: 'id, name, images',
    mapItem: (row) => ({ id: row.id, title: row.name || 'New store item', image: row.images?.[0] || null, actionPath: `/store/product/${row.id}` })
  },
]

// Module-level singleton state so every view sharing this composable sees the same badge state.
const personalNotifications = ref<AppNotification[]>([])
const unreadPersonalCount = ref(0)
const categoryBadges = ref<CategoryBadge[]>([])
const hasUnread = ref(false)
const totalUnreadCount = ref(0)
const loading = ref(false)

let personalChannel: RealtimeChannel | null = null
let broadcastChannel: RealtimeChannel | null = null
let broadcastRefreshTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function scheduleBroadcastRefresh() {
  if (broadcastRefreshTimer) clearTimeout(broadcastRefreshTimer)
  // Debounce: an admin approving several items in a row shouldn't trigger a
  // burst of re-fetches, one per row change.
  broadcastRefreshTimer = setTimeout(() => {
    fetchCategoryBadges()
  }, 800)
}

function recomputeHasUnread() {
  const categoryTotal = categoryBadges.value.reduce((sum, b) => sum + b.count, 0)
  totalUnreadCount.value = unreadPersonalCount.value + categoryTotal
  hasUnread.value = totalUnreadCount.value > 0
}

async function fetchPersonalNotifications() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    personalNotifications.value = []
    unreadPersonalCount.value = 0
    recomputeHasUnread()
    return
  }

  // Only unread items show in the Activity feed — once read, users have
  // ProfileView's own submission history to look things up, so read
  // notifications don't need to linger here.
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!error && data) {
    personalNotifications.value = data as AppNotification[]
    unreadPersonalCount.value = data.length
  }
  recomputeHasUnread()
}

async function fetchCategoryBadges() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    categoryBadges.value = []
    recomputeHasUnread()
    return
  }
  const userId = session.user.id

  const { data: viewRows } = await supabase
    .from('user_notification_views')
    .select('category, last_seen_at')
    .eq('user_id', userId)

  const seenMap = new Map<string, string>((viewRows || []).map(r => [r.category, r.last_seen_at]))
  const missingCategories = CATEGORY_CONFIG.filter(c => !seenMap.has(c.category))

  // First-ever check for a category: baseline "now" so we don't flood the
  // user with every historical item as "new" the moment this feature ships.
  if (missingCategories.length > 0) {
    const nowIso = new Date().toISOString()
    await supabase.from('user_notification_views').upsert(
      missingCategories.map(c => ({ user_id: userId, category: c.category, last_seen_at: nowIso }))
    )
    missingCategories.forEach(c => seenMap.set(c.category, nowIso))
  }

  const badges: CategoryBadge[] = []
  for (const cfg of CATEGORY_CONFIG) {
    const lastSeen = seenMap.get(cfg.category) as string
    let query = supabase
      .from(cfg.table)
      .select('id', { count: 'exact', head: true })
      .gt(cfg.dateColumn, lastSeen)

    if (cfg.approvedOnly) query = query.eq('approved', true)
    if (cfg.activeOnly) query = query.eq('is_active', true)

    const { count } = await query

    let items: CategoryItem[] = []
    if (count && count > 0 && count <= ITEM_THRESHOLD) {
      let itemQuery = supabase
        .from(cfg.table)
        .select(`${cfg.selectFields}, ${cfg.dateColumn}`)
        .gt(cfg.dateColumn, lastSeen)

      if (cfg.approvedOnly) itemQuery = itemQuery.eq('approved', true)
      if (cfg.activeOnly) itemQuery = itemQuery.eq('is_active', true)

      const { data: itemRows } = await itemQuery.order(cfg.dateColumn, { ascending: false }).limit(ITEM_THRESHOLD)
      items = (itemRows || []).map((row: any) => ({ ...cfg.mapItem(row), date: row[cfg.dateColumn] }))
    }

    badges.push({ category: cfg.category, label: cfg.label, count: count || 0, actionPath: cfg.actionPath, items })
  }

  categoryBadges.value = badges
  recomputeHasUnread()
}

async function markCategorySeen(category: BroadcastCategory) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('user_notification_views').upsert({
    user_id: session.user.id,
    category,
    last_seen_at: new Date().toISOString()
  })
  const badge = categoryBadges.value.find(b => b.category === category)
  if (badge) {
    badge.count = 0
    badge.items = []
  }
  recomputeHasUnread()
}

async function markRead(id: string) {
  const index = personalNotifications.value.findIndex(n => n.id === id)
  if (index === -1) return
  personalNotifications.value.splice(index, 1)
  unreadPersonalCount.value = Math.max(0, unreadPersonalCount.value - 1)
  recomputeHasUnread()
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

async function markAllPersonalRead() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  personalNotifications.value = []
  unreadPersonalCount.value = 0
  recomputeHasUnread()
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false)
}

async function refreshAll() {
  loading.value = true
  await Promise.all([fetchPersonalNotifications(), fetchCategoryBadges()])
  loading.value = false
}

// Clears every unread signal at once: personal notifications plus every
// broadcast category currently showing a count. Used when the notifications
// page is closed, so counts stay visible while the user is actually reading
// them and only clear once they've moved on.
async function markAllSeen() {
  await Promise.all([
    markAllPersonalRead(),
    ...categoryBadges.value.filter(b => b.count > 0).map(b => markCategorySeen(b.category))
  ])
}

async function initNotifications() {
  if (initialized) {
    await refreshAll()
    return
  }
  initialized = true

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  await refreshAll()

  personalChannel = supabase
    .channel('global-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
      (payload) => {
        const notif = payload.new as AppNotification
        personalNotifications.value.unshift(notif)
        unreadPersonalCount.value++
        recomputeHasUnread()
        ActivityLogService.log('notification_received', { notification_id: notif.id, type: notif.type })
      }
    )
    .subscribe()

  const uniqueTables = [...new Set(CATEGORY_CONFIG.map(c => c.table))]
  let channel = supabase.channel('global-broadcast-badges')
  for (const table of uniqueTables) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => scheduleBroadcastRefresh()
    )
  }
  broadcastChannel = channel.subscribe()

  supabase.auth.onAuthStateChange((_event, newSession) => {
    if (!newSession) {
      personalNotifications.value = []
      categoryBadges.value = []
      unreadPersonalCount.value = 0
      totalUnreadCount.value = 0
      hasUnread.value = false
      if (personalChannel) {
        supabase.removeChannel(personalChannel)
        personalChannel = null
      }
      if (broadcastChannel) {
        supabase.removeChannel(broadcastChannel)
        broadcastChannel = null
      }
      if (broadcastRefreshTimer) {
        clearTimeout(broadcastRefreshTimer)
        broadcastRefreshTimer = null
      }
      initialized = false
    }
  })
}

export function useNotifications() {
  return {
    personalNotifications,
    unreadPersonalCount,
    categoryBadges,
    hasUnread,
    totalUnreadCount,
    loading,
    initNotifications,
    refreshAll,
    markRead,
    markAllPersonalRead,
    markCategorySeen,
    markAllSeen,
  }
}
