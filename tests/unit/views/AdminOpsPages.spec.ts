import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { adminStubs, i18n, ionicMock, emitIonic } from './adminTestKit'

vi.mock('@ionic/vue', async (orig) => ionicMock(orig as any, 'confirm'))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/AppHeader.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/services/AdminService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/AdminService')>()
    const fn = () => vi.fn()
    return {
        ...actual,
        AdminService: {
            versionBreakdown: fn(), appConfig: fn(), setAppConfig: fn(), opsHealth: fn(), opsEvents: fn(), securityAudit: fn(),
            subscriptionSummary: fn(), subscriptions: fn(), announcements: fn(), saveAnnouncement: fn(), setAnnouncementActive: fn(),
            notificationsLog: fn(), emailQueue: fn(), unknownBarcodes: fn(), clientErrors: fn(), reviews: fn(), deleteReview: fn(), lineActivity: fn(),
        },
    }
})

import AppVersionsView from '@/views/admin/AppVersionsView.vue'
import AppSettingsView from '@/views/admin/AppSettingsView.vue'
import SubscriptionsView from '@/views/admin/SubscriptionsView.vue'
import UnknownBarcodesView from '@/views/admin/UnknownBarcodesView.vue'
import ReviewModerationView from '@/views/admin/ReviewModerationView.vue'
import SystemHealthView from '@/views/admin/SystemHealthView.vue'
import AppErrorsView from '@/views/admin/AppErrorsView.vue'
import LineActivityView from '@/views/admin/LineActivityView.vue'
import { AdminService } from '@/services/AdminService'

const A = vi.mocked(AdminService)
const show = (C: any) => mount(C, { global: { plugins: [i18n], stubs: adminStubs } })

beforeEach(() => vi.clearAllMocks())

describe('AppVersionsView', () => {
    const rows = [
        { platform: 'android', app_version: '2.0.1', users: 8, live_users: 0, last_seen: '2026-10-08T06:00:00Z' },
        { platform: 'android', app_version: '1.9.2', users: 2, live_users: 0, last_seen: '2026-10-02T02:00:00Z' },
        { platform: 'ios', app_version: '2.0.0', users: 3, live_users: 1, last_seen: '2026-10-08T07:00:00Z' },
    ] as any
    const config = [
        { key: 'min_android_version', value: '2.0.1', description: null, updated_at: null },
        { key: 'min_ios_version', value: '2.0.1', description: null, updated_at: null },
    ]

    it('counts users below each platform minimum and marks those versions', async () => {
        A.versionBreakdown.mockResolvedValue(rows)
        A.appConfig.mockResolvedValue(config as any)
        const w = show(AppVersionsView)
        await flushPromises()

        const tiles = w.find('[data-testid="admin-tiles"]').text()
        expect(tiles).toContain('13') // users seen
        expect(tiles).toMatch(/Below minimum\s*$|Below minimum/)
        expect(w.find('[data-testid="versions-android"]').text()).toContain('Below minimum') // 1.9.2
        expect(w.find('[data-testid="versions-ios"]').text()).toContain('Below minimum') // 2.0.0 < 2.0.1
        expect(w.find('[data-testid="versions-note"]').text()).toContain('1 of 13')
    })

    it('says so when nobody was seen', async () => {
        A.versionBreakdown.mockResolvedValue([])
        A.appConfig.mockResolvedValue(config as any)
        const w = show(AppVersionsView)
        await flushPromises()
        expect(w.find('[data-testid="versions-empty"]').exists()).toBe(true)
    })

    it('shows a retry when loading fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        A.versionBreakdown.mockRejectedValue(new Error('x'))
        A.appConfig.mockResolvedValue(config as any)
        const w = show(AppVersionsView)
        await flushPromises()
        expect(w.text()).toContain('Could not load')
    })
})

describe('AppSettingsView', () => {
    const config = [
        { key: 'android_store_url', value: 'https://play.google.com/store/apps/details?id=x', description: null, updated_at: '2026-10-01T00:00:00Z' },
        { key: 'business_plan_features', value: '{"free":{"menu":false}}', description: null, updated_at: null },
        { key: 'enforce_ocr_auth', value: 'true', description: null, updated_at: null },
        { key: 'ios_store_url', value: 'https://apps.apple.com/tw/app/x/id1', description: null, updated_at: null },
        { key: 'min_android_version', value: '2.0.1', description: null, updated_at: '2026-10-08T09:15:00Z' },
        { key: 'min_ios_version', value: '2.0.1', description: null, updated_at: null },
    ] as any
    const versions = [
        { platform: 'android', app_version: '2.0.1', users: 8, live_users: 0, last_seen: '' },
        { platform: 'android', app_version: '1.9.2', users: 2, live_users: 0, last_seen: '' },
    ] as any

    async function open() {
        A.appConfig.mockResolvedValue(config)
        A.versionBreakdown.mockResolvedValue(versions)
        const w = show(AppSettingsView)
        await flushPromises()
        return w
    }

    it('fills the inputs from the saved values and keeps Save off until something changes', async () => {
        const w = await open()
        expect((w.find('[data-testid="input-min_android_version"]').element as HTMLInputElement).value).toBe('2.0.1')
        expect(w.find('[data-testid="save-min_android_version"]').attributes('disabled')).toBeDefined()
    })

    it('shows how many users a new minimum would affect, and rejects a malformed version', async () => {
        const w = await open()
        const input = w.find('[data-testid="input-min_android_version"]').element
        emitIonic(input, 'ionInput', { value: '2.1.0' })
        await flushPromises()
        expect(w.find('[data-testid="setting-min_android_version"]').text()).toContain('10 of 10 users')
        expect(w.find('[data-testid="save-min_android_version"]').attributes('disabled')).toBeUndefined()

        emitIonic(input, 'ionInput', { value: 'abc' })
        await flushPromises()
        expect(w.find('[data-testid="setting-min_android_version"]').text()).toContain('Use a version like 2.0.1')
        expect(w.find('[data-testid="save-min_android_version"]').attributes('disabled')).toBeDefined()
    })

    it('describes the current minimum, not a change, when nothing was edited', async () => {
        const w = await open()
        // android min 2.0.1 with 2 of 10 recent users on 1.9.2: they are already being asked to update
        const note = w.find('[data-testid="impact-current"]')
        expect(note.exists()).toBe(true)
        expect(note.text()).toContain('2 of 10')
        expect(note.text()).toContain('already asked to update')
        expect(note.text()).not.toContain('would be asked')
    })

    it('saves after confirmation, with the trimmed value', async () => {
        A.setAppConfig.mockResolvedValue({ key: 'min_android_version', old: '2.0.1', new: '2.0.2' })
        const w = await open()
        emitIonic(w.find('[data-testid="input-min_android_version"]').element, 'ionInput', { value: ' 2.0.2 ' })
        await flushPromises()
        await w.find('[data-testid="save-min_android_version"]').trigger('click')
        await flushPromises()
        expect(A.setAppConfig).toHaveBeenCalledWith('min_android_version', '2.0.2')
    })

    it('shows settings it cannot edit as read-only text', async () => {
        const w = await open()
        expect(w.text()).toContain('business_plan_features')
        expect(w.find('[data-testid="setting-business_plan_features"]').exists()).toBe(false)
    })
})

describe('SubscriptionsView', () => {
    const summary = { active: 6, not_renewing: 3, expiring_14d: 2, lapsed: 434, total_rows: 440, flag_mismatch: 0, granted_active: 2 }
    const row = (over: object) => ({
        user_id: 'u1', display_name: 'Ayu', avatar_url: null, donor_type: 'Pro', entitlement_active: true, will_renew: true,
        first_purchase_at: '2026-01-01T00:00:00Z', latest_expiration_at: '2026-11-01T00:00:00Z', products: [], grant_active: false, flag_mismatch: false, ...over,
    })

    it('shows the summary and one card per subscription with its status', async () => {
        A.subscriptionSummary.mockResolvedValue(summary)
        A.subscriptions.mockResolvedValue([row({}), row({ user_id: 'u2', display_name: 'Budi', will_renew: false }), row({ user_id: 'u3', display_name: 'Cici', flag_mismatch: true })] as any)
        const w = show(SubscriptionsView)
        await flushPromises()

        expect(A.subscriptions).toHaveBeenCalledWith('active', 50, 0)
        expect(w.find('[data-testid="subs-note"]').text()).toContain('434 lapsed')
        const cards = w.findAll('[data-testid="subs-row"]')
        expect(cards).toHaveLength(3)
        expect(cards[1].text()).toContain('Not renewing')
        expect(cards[2].text()).toContain('Profile mismatch')
    })

    it('asks for the chosen filter from the start, and offers more only on a full page', async () => {
        A.subscriptionSummary.mockResolvedValue(summary)
        A.subscriptions.mockResolvedValue([row({})] as any)
        const w = show(SubscriptionsView)
        await flushPromises()
        expect(w.find('[data-testid="subs-more"]').exists()).toBe(false)

        emitIonic(w.find('[data-testid="subs-filter"]').element, 'ionChange', { value: 'lapsed' })
        await flushPromises()
        expect(A.subscriptions).toHaveBeenLastCalledWith('lapsed', 50, 0)
    })

    it('says so when a filter has no subscriptions', async () => {
        A.subscriptionSummary.mockResolvedValue(summary)
        A.subscriptions.mockResolvedValue([])
        const w = show(SubscriptionsView)
        await flushPromises()
        expect(w.find('[data-testid="subs-empty"]').exists()).toBe(true)
    })
})

describe('UnknownBarcodesView', () => {
    it('lists missing barcodes and copies one on request', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.assign(navigator, { clipboard: { writeText } })
        A.unknownBarcodes.mockResolvedValue({
            summary: { distinct_barcodes: 686, scans: 744, repeated_3plus: 6, already_added: 3, still_missing: 683 },
            rows: [{ barcode: '8999999999999', scans: 5, users: 2, first_seen: '2026-10-01T00:00:00Z', last_seen: '2026-10-10T00:00:00Z', added: false }],
        })
        const w = show(UnknownBarcodesView)
        await flushPromises()

        expect(w.find('[data-testid="admin-tiles"]').text()).toContain('683')
        const row = w.find('[data-testid="barcode-row"]')
        expect(row.text()).toContain('8999999999999')
        expect(row.text()).toContain('5 scan(s)')
        await row.find('button').trigger('click')
        expect(writeText).toHaveBeenCalledWith('8999999999999')
    })

    it('says so when nothing is missing', async () => {
        A.unknownBarcodes.mockResolvedValue({ summary: { distinct_barcodes: 0, scans: 0, repeated_3plus: 0, already_added: 0, still_missing: 0 }, rows: [] })
        const w = show(UnknownBarcodesView)
        await flushPromises()
        expect(w.find('[data-testid="barcodes-empty"]').exists()).toBe(true)
    })
})

describe('ReviewModerationView', () => {
    const review = { id: 'r1', location_id: 7, location_name: 'Halal Noodles', user_id: 'u1', user_name: 'Ayu', rating: 1, comment: 'Terrible', created_at: '2026-10-01T00:00:00Z', owner_response: null }

    it('lists reviews with place, stars and comment', async () => {
        A.reviews.mockResolvedValue([review])
        const w = show(ReviewModerationView)
        await flushPromises()
        expect(A.reviews).toHaveBeenCalledWith(30, null, null, null)
        const row = w.find('[data-testid="review-row"]')
        expect(row.text()).toContain('Halal Noodles')
        expect(row.text()).toContain('Terrible')
    })
})

describe('SystemHealthView', () => {
    const health = (over: object = {}) => ({
        generated_at: '2026-10-16T01:00:00Z', window_hours: 24, flagged: false, flags: [],
        checks: {
            scan_log: { success_events: 10, logged_rows: 10, missing: 0, worst_users: [] }, purchases_not_synced: [], pro_flag_mismatches: 0,
            login_failures: { last_window: 1, expected: 2 }, server_job_errors: { count: 0, latest: [] },
            webhook: { purchases_in_window: 0, events_processed_in_window: 0, events_processed_ever: 5 }, cron_failures: [],
            scheduled_calls: { http_5xx: 0, http_401: 0 }, sensitive_changes: { by_non_admin_users: [], total_audited_changes_in_window: 4 },
        }, ...over,
    }) as any

    it('shows "all clear" when nothing is flagged', async () => {
        A.opsHealth.mockResolvedValue(health())
        const w = show(SystemHealthView)
        await flushPromises()
        expect(w.find('[data-testid="health-banner"]').text()).toContain('All clear')
    })

    it('names each flagged problem in plain words', async () => {
        A.opsHealth.mockResolvedValue(health({ flagged: true, flags: ['webhook_silent', 'cron_job_failed'] }))
        const w = show(SystemHealthView)
        await flushPromises()
        const banner = w.find('[data-testid="health-banner"]').text()
        expect(banner).toContain('2 thing(s) need a look')
        expect(banner).toContain('Webhook silent')
        expect(banner).toContain('Scheduled job failed')
    })
})

describe('AppErrorsView', () => {
    it('groups errors and shows the error rate per 1,000 views', async () => {
        A.clientErrors.mockResolvedValue({
            total: 5, users: 0, screen_views: 800,
            groups: [{ signature: 's1', occurrences: 5, users: 0, first_seen: '2026-10-10T00:00:00Z', last_seen: '2026-10-15T00:00:00Z', message: 'Unable to preload CSS', name: 'Error', screen: '(unmatched)', source: 'promise', stack: null }],
        })
        const w = show(AppErrorsView)
        await flushPromises()
        expect(w.find('[data-testid="admin-tiles"]').text()).toContain('6.3') // 5 errors in 800 views = 6.3 per 1,000
        expect(w.find('[data-testid="error-group"]').text()).toContain('Unable to preload CSS')
    })
})

describe('LineActivityView', () => {
    it('shows totals, days and masked account ids', async () => {
        A.lineActivity.mockResolvedValue({
            events_total: 48, usage_total: 3, sources: 8,
            by_type: [{ event_type: 'message', count: 40 }], by_day: [{ day: '2026-10-15', events: 5, usage: 1 }], top_sources: [{ source: 'U040…e73', events: 39 }],
        })
        const w = show(LineActivityView)
        await flushPromises()
        expect(w.find('[data-testid="admin-tiles"]').text()).toContain('48')
        expect(w.find('[data-testid="line-days"]').text()).toContain('10-15')
        expect(w.text()).toContain('U040…e73')
    })
})

describe('Operations tools hub', () => {
    it('only links to pages that exist in the router', () => {
        const hub = readFileSync('src/views/admin/AdminToolsView.vue', 'utf-8')
        const router = readFileSync('src/router/index.ts', 'utf-8')
        const paths = [...hub.matchAll(/path: '(\/admin\/[a-z-]+)'/g)].map((m) => m[1])
        expect(paths.length).toBe(10)
        for (const p of paths) expect(router).toContain(`path: '${p}'`)
    })

    it('protects every new route with the admin guard', () => {
        const router = readFileSync('src/router/index.ts', 'utf-8')
        for (const p of ['tools', 'app-versions', 'app-settings', 'system-health', 'subscriptions', 'announcements', 'unknown-barcodes', 'app-errors', 'reviews', 'line-activity']) {
            const at = router.indexOf(`path: '/admin/${p}'`)
            expect(at).toBeGreaterThan(-1)
            expect(router.slice(at, at + 220)).toContain('requiresAdmin: true')
        }
    })
})
