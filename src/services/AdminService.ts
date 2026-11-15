import { supabase } from '@/plugins/supabaseClient'
import type { LocalizedText } from '@/services/SurveyService'

// Typed wrappers for the admin-only database functions behind the operations pages (app versions, settings,
// system health, subscriptions, announcements, unknown barcodes, app errors, review moderation, LINE activity).
// Each function checks is_admin() on the server; the app only decides what to show.

export type Platform = 'ios' | 'android'

export interface VersionRow {
    platform: Platform
    app_version: string
    users: number
    live_users: number
    last_seen: string
}

export interface AppConfigRow {
    key: string
    value: string
    description: string | null
    updated_at: string | null
}

export interface OpsHealth {
    generated_at: string
    window_hours: number
    flagged: boolean
    flags: string[]
    checks: {
        scan_log: { success_events: number; logged_rows: number; missing: number; worst_users: { user_id: string; events: number; logged: number; missing: number }[] }
        purchases_not_synced: { user_id: string; last_purchase_event: string; server_state: string }[]
        pro_flag_mismatches: number
        login_failures: { last_window: number; expected: number }
        server_job_errors: { count: number; latest: { at: string; source: string; event: string; detail: unknown }[] }
        webhook: { purchases_in_window: number; events_processed_in_window: number; events_processed_ever: number }
        cron_failures: { job: string; at: string; status: string; message: string }[]
        scheduled_calls: { http_5xx: number; http_401: number }
        sensitive_changes: { by_non_admin_users: { at: string; table: string; op: string; row: string; actor: string }[]; total_audited_changes_in_window: number }
    }
}

export interface OpsEvent {
    id: number
    created_at: string
    source: string
    level: string
    event: string
    user_id: string | null
    detail: unknown
}

export interface SecurityAuditRow {
    id: number
    created_at: string
    table_name: string
    op: string
    row_key: string | null
    actor: string | null
    actor_role: string | null
    via: string | null
    changes: Record<string, unknown> | null
}

export interface SubscriptionSummary {
    active: number
    not_renewing: number
    expiring_14d: number
    lapsed: number
    total_rows: number
    flag_mismatch: number
    granted_active: number
}

export type SubscriptionFilter = 'all' | 'active' | 'expiring' | 'not_renewing' | 'lapsed' | 'mismatch'

export interface SubscriptionRow {
    user_id: string
    display_name: string | null
    avatar_url: string | null
    donor_type: string | null
    entitlement_active: boolean
    will_renew: boolean | null
    first_purchase_at: string | null
    latest_expiration_at: string | null
    products: unknown
    grant_active: boolean
    flag_mismatch: boolean
}

export interface AnnouncementRow {
    id: string
    title: string
    content: string
    type: 'info' | 'warning'
    is_active: boolean
    created_at: string
    image_url: string | null
    link_url: string | null
}

export interface AnnouncementInput {
    id: string | null
    title: string
    content: string
    type: 'info' | 'warning'
    is_active: boolean
    image_url: string | null
    link_url: string | null
}

export interface NotificationLogRow {
    id: number | string
    type: string | null
    message: string | null
    created_at: string
    channels: unknown
}

export interface EmailQueueRow {
    id: number
    platform: string | null
    app_version: string | null
    status: string
    attempts: number
    sent_at: string | null
    error: string | null
    created_at: string
}

export interface UnknownBarcodes {
    summary: { distinct_barcodes: number; scans: number; repeated_3plus: number; already_added: number; still_missing: number }
    rows: { barcode: string; scans: number; users: number; first_seen: string; last_seen: string; added: boolean }[]
}

export interface ClientErrorGroups {
    total: number
    users: number
    screen_views: number
    groups: {
        signature: string
        occurrences: number
        users: number
        first_seen: string
        last_seen: string
        message: string | null
        name: string | null
        screen: string | null
        source: string | null
        stack: string | null
    }[]
}

export interface ReviewRow {
    id: string
    location_id: number
    location_name: string | null
    user_id: string
    user_name: string | null
    rating: number
    comment: string | null
    created_at: string
    owner_response: string | null
}

export interface LineActivity {
    events_total: number
    usage_total: number
    sources: number
    by_type: { event_type: string; count: number }[]
    by_day: { day: string; events: number; usage: number }[]
    top_sources: { source: string; events: number }[]
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) throw error
    return data as T
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as T[]
}

export const AdminService = {
    // app versions + settings
    versionBreakdown: (days: number) => rpc<VersionRow[]>('admin_app_version_breakdown', { p_days: days }),
    appConfig: () =>
        rows<AppConfigRow>(supabase.from('app_config').select('key, value, description, updated_at').order('key')),
    setAppConfig: (key: string, value: string) =>
        rpc<{ key: string; old: string; new: string }>('admin_set_app_config', { p_key: key, p_value: value }),

    // system health
    opsHealth: (hours: number) => rpc<OpsHealth>('admin_ops_health', { p_hours: hours }),
    opsEvents: (level: string | null, limit = 50) => {
        let q = supabase.from('ops_events').select('id, created_at, source, level, event, user_id, detail')
        if (level) q = q.eq('level', level)
        return rows<OpsEvent>(q.order('created_at', { ascending: false }).limit(limit))
    },
    securityAudit: (limit = 50) =>
        rows<SecurityAuditRow>(
            supabase.from('security_audit')
                .select('id, created_at, table_name, op, row_key, actor, actor_role, via, changes')
                .order('created_at', { ascending: false }).limit(limit)
        ),

    // subscriptions
    subscriptionSummary: () => rpc<SubscriptionSummary>('admin_subscription_summary'),
    subscriptions: (filter: SubscriptionFilter, limit: number, offset: number) =>
        rpc<SubscriptionRow[]>('admin_list_subscriptions', { p_filter: filter, p_limit: limit, p_offset: offset }),

    // announcements, notifications, update emails
    announcements: () =>
        rows<AnnouncementRow>(supabase.from('announcements').select('*').order('created_at', { ascending: false })),
    saveAnnouncement: (a: AnnouncementInput) =>
        rpc<string>('admin_upsert_announcement', {
            p_id: a.id, p_title: a.title, p_content: a.content, p_type: a.type, p_is_active: a.is_active,
            p_image_url: a.image_url, p_link_url: a.link_url,
        }),
    setAnnouncementActive: async (id: string, active: boolean) => {
        await rpc<null>('admin_set_announcement_active', { p_id: id, p_active: active })
    },
    notificationsLog: (limit = 50) =>
        rows<NotificationLogRow>(
            supabase.from('notifications_log').select('id, type, message, created_at, channels')
                .order('created_at', { ascending: false }).limit(limit)
        ),
    // the queue's email addresses are deliberately not selected
    emailQueue: () =>
        rows<EmailQueueRow>(
            supabase.from('update_email_queue')
                .select('id, platform, app_version, status, attempts, sent_at, error, created_at')
                .order('created_at', { ascending: false }).limit(500)
        ),

    // unknown barcodes, app errors, reviews, LINE
    unknownBarcodes: (days: number, limit = 100) => rpc<UnknownBarcodes>('admin_unknown_barcodes', { p_days: days, p_limit: limit }),
    clientErrors: (days: number, limit = 50) => rpc<ClientErrorGroups>('admin_client_error_groups', { p_days: days, p_limit: limit }),
    reviews: (limit: number, before: string | null, maxRating: number | null, search: string | null) =>
        rpc<ReviewRow[]>('admin_list_location_reviews', {
            p_limit: limit, p_before: before, p_max_rating: maxRating, p_search: search,
        }),
    deleteReview: async (id: string, reason: string) => {
        await rpc<null>('admin_delete_location_review', { p_id: id, p_reason: reason })
    },
    lineActivity: (days: number) => rpc<LineActivity>('admin_line_activity', { p_days: days }),
}

/** Plain-text label for admin pages that show wording stored per language. */
export function pickText(text: LocalizedText | null | undefined, locale: string): string {
    if (!text) return ''
    return text[locale] ?? text[locale.split('-')[0]] ?? text.en ?? Object.values(text)[0] ?? ''
}
