// Helpers for the admin Audit Log page (rows come from the admin_get_audit_log RPC).

export type AuditKind = 'admin' | 'merchant' | 'business_owner'

export interface AuditEntry {
    id: number
    created_at: string
    actor_id: string
    actor_name: string | null
    actor_kind: AuditKind
    action: string
    table_name: string
    row_key: string | null
    target_user_id: string | null
    location_id: number | null
    changes: Record<string, any>
    user_agent: string | null
}

// The server replaces personal/secret values with this marker; the page shows a lock instead.
export const REDACTED = '[redacted]'

// Tables that carry the trg_admin_audit trigger (see migration 20261009000000_admin_audit_log.sql).
// The page also adds any table it sees in the data, so a table added later still shows up.
export const AUDITED_TABLES: string[] = [
    'achievement_definitions', 'announcements', 'badge_cosmetics', 'category_rules', 'cities',
    'contributor_applications', 'donations', 'halal_trip_metadata', 'halalify_phrases', 'ingredient_article_aliases',
    'ingredient_article_products', 'ingredient_article_sources', 'ingredient_articles', 'ingredient_blacklist',
    'ingredient_highlights', 'klook_product_bindings', 'loading_reflections', 'location_certifications',
    'location_claims', 'location_drafts', 'location_edit_requests', 'location_menu_items', 'location_photos',
    'location_promotions', 'location_reports', 'location_types', 'locations', 'merchant_applications',
    'merchant_stores', 'news', 'partner_programs', 'partner_scopes', 'partners', 'partners_scopes', 'point_logs',
    'point_rules', 'pro_subscriptions', 'product_barcodes', 'product_categories', 'product_certifications',
    'product_duplicate_dismissals', 'product_reports', 'products', 'referral_campaign_tiers', 'referral_campaigns',
    'referral_config', 'referral_rewards', 'store_orders', 'store_product_categories', 'store_products',
    'store_promo_banners', 'stores', 'trip_categories', 'trip_cities', 'trips', 'user_profiles', 'user_scan_bonus',
]

export function prettyTable(table: string): string {
    return table.replace(/_/g, ' ')
}

/** Ionic colour for an action badge. */
export function actionColor(action: string): string {
    switch (action) {
        case 'create':
        case 'approve':
        case 'activate':
            return 'success'
        case 'delete':
        case 'reject':
            return 'danger'
        case 'unapprove':
        case 'deactivate':
            return 'warning'
        case 'status_change':
            return 'tertiary'
        default:
            return 'primary'
    }
}

/** One cell of a change, as short readable text. */
export function formatAuditValue(v: unknown): string {
    if (v === null || v === undefined) return '∅'
    if (typeof v === 'string') return v === '' ? '""' : v
    if (typeof v === 'boolean' || typeof v === 'number') return String(v)
    const json = JSON.stringify(v)
    return json.length > 160 ? json.slice(0, 160) + '…' : json
}

export interface ChangeRow {
    column: string
    /** update: the value before; create/delete: undefined */
    before?: string
    /** update: the value after; create/delete: the value written/removed */
    after: string
    redacted: boolean
    isDiff: boolean
}

/** Turns the stored `changes` jsonb into rows the page can render. Columns are sorted for a stable order. */
export function toChangeRows(entry: Pick<AuditEntry, 'action' | 'changes'>): ChangeRow[] {
    const changes = entry.changes ?? {}
    const isCreateOrDelete = entry.action === 'create' || entry.action === 'delete'

    return Object.keys(changes)
        .sort()
        .map((column) => {
            const raw = changes[column]
            if (!isCreateOrDelete && raw && typeof raw === 'object' && 'new' in raw) {
                return {
                    column,
                    before: formatAuditValue(raw.old),
                    after: formatAuditValue(raw.new),
                    redacted: raw.old === REDACTED || raw.new === REDACTED,
                    isDiff: true,
                }
            }
            return { column, after: formatAuditValue(raw), redacted: raw === REDACTED, isDiff: false }
        })
}
