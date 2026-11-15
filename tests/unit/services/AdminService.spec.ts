import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/plugins/supabaseClient'
import { AdminService } from '@/services/AdminService'

const rpc = vi.fn()
;(supabase as any).rpc = rpc

// a chainable stand-in for supabase.from(...).select(...).order(...).limit(...)
function chain(result: { data: unknown; error: unknown }) {
    const q: any = {
        select: vi.fn(() => q), eq: vi.fn(() => q), order: vi.fn(() => q), limit: vi.fn(() => q),
        then: (resolve: (v: unknown) => unknown) => resolve(result),
    }
    return q
}

describe('AdminService', () => {
    beforeEach(() => { rpc.mockReset(); (supabase as any).from = vi.fn() })

    it('sends the right arguments to each admin function', async () => {
        rpc.mockResolvedValue({ data: [], error: null })
        await AdminService.versionBreakdown(14)
        expect(rpc).toHaveBeenLastCalledWith('admin_app_version_breakdown', { p_days: 14 })
        await AdminService.setAppConfig('min_android_version', '2.0.2')
        expect(rpc).toHaveBeenLastCalledWith('admin_set_app_config', { p_key: 'min_android_version', p_value: '2.0.2' })
        await AdminService.opsHealth(72)
        expect(rpc).toHaveBeenLastCalledWith('admin_ops_health', { p_hours: 72 })
        await AdminService.subscriptions('expiring', 50, 100)
        expect(rpc).toHaveBeenLastCalledWith('admin_list_subscriptions', { p_filter: 'expiring', p_limit: 50, p_offset: 100 })
        await AdminService.unknownBarcodes(30, 100)
        expect(rpc).toHaveBeenLastCalledWith('admin_unknown_barcodes', { p_days: 30, p_limit: 100 })
        await AdminService.clientErrors(7, 50)
        expect(rpc).toHaveBeenLastCalledWith('admin_client_error_groups', { p_days: 7, p_limit: 50 })
        await AdminService.lineActivity(30)
        expect(rpc).toHaveBeenLastCalledWith('admin_line_activity', { p_days: 30 })
    })

    it('maps announcement and review writes to their parameter names', async () => {
        rpc.mockResolvedValue({ data: null, error: null })
        await AdminService.saveAnnouncement({ id: null, title: 'T', content: 'C', type: 'info', is_active: true, image_url: null, link_url: 'myapp://survey' })
        expect(rpc).toHaveBeenLastCalledWith('admin_upsert_announcement', {
            p_id: null, p_title: 'T', p_content: 'C', p_type: 'info', p_is_active: true, p_image_url: null, p_link_url: 'myapp://survey',
        })
        await AdminService.setAnnouncementActive('a1', false)
        expect(rpc).toHaveBeenLastCalledWith('admin_set_announcement_active', { p_id: 'a1', p_active: false })
        await AdminService.reviews(30, '2026-10-01T00:00:00Z', 2, 'noodle')
        expect(rpc).toHaveBeenLastCalledWith('admin_list_location_reviews', { p_limit: 30, p_before: '2026-10-01T00:00:00Z', p_max_rating: 2, p_search: 'noodle' })
        await AdminService.deleteReview('r1', 'spam')
        expect(rpc).toHaveBeenLastCalledWith('admin_delete_location_review', { p_id: 'r1', p_reason: 'spam' })
    })

    it('throws the database error so the page can show it', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'Admins only' } })
        await expect(AdminService.opsHealth(24)).rejects.toEqual({ message: 'Admins only' })
    })

    it('reads app_config directly and returns an empty list for no rows', async () => {
        ;(supabase as any).from = vi.fn(() => chain({ data: null, error: null }))
        await expect(AdminService.appConfig()).resolves.toEqual([])
        expect((supabase as any).from).toHaveBeenCalledWith('app_config')
    })

    it('never asks for email addresses from the update email queue', async () => {
        const q = chain({ data: [], error: null })
        ;(supabase as any).from = vi.fn(() => q)
        await AdminService.emailQueue()
        const selected = String(q.select.mock.calls[0][0])
        expect(selected).not.toMatch(/email/)
        expect(selected).toContain('status')
    })

    it('filters server events by level only when one is chosen', async () => {
        const q = chain({ data: [], error: null })
        ;(supabase as any).from = vi.fn(() => q)
        await AdminService.opsEvents(null)
        expect(q.eq).not.toHaveBeenCalled()
        await AdminService.opsEvents('error')
        expect(q.eq).toHaveBeenCalledWith('level', 'error')
    })
})
