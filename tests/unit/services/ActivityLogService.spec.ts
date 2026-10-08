import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'

// Mock the SessionService internally used by ActivityLogService
vi.mock('@/services/SessionService', () => {
    return {
        default: {
            getSessionId: vi.fn().mockReturnValue('mock-session-id')
        }
    }
})

describe('ActivityLogService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset the default auth mock behavior
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'mock-user-id' } } as any },
            error: null
        } as any)
    })

    it('should log a barcode scan activity with the correct product entity resolution', async () => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('barcode_scan_success', { barcode: '123456789' })

        expect(supabase.from).toHaveBeenCalledWith('activity_log')
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'mock-user-id',
            session_id: 'mock-session-id',
            activity_type: 'barcode_scan_success',
            activity_group: 'product',
            entity_type: 'product',
            entity_id: '123456789',
            activity_detail: { barcode: '123456789' }
        }))
    })

    it('should log a place detail view with the correct place entity resolution', async () => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('explore_place_detail_open', { id: 'place-999' })

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            activity_type: 'explore_place_detail_open',
            activity_group: 'place',
            entity_type: 'place',
            entity_id: 'place-999'
        }))
    })

    it('never throws into the caller when the backend call fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.mocked(supabase.from).mockReturnValue({ insert: vi.fn().mockRejectedValue(new Error('network down')) } as any)

        await expect(ActivityLogService.log('points_awarded', { action: 'add_product' })).resolves.toBeUndefined()
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })

    it('resolves reward events to their own entity and group', async () => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('mission_completed', { mission_id: 'scan_barcode' })
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            activity_group: 'rewards', entity_type: 'mission', entity_id: 'scan_barcode'
        }))

        await ActivityLogService.log('privacy_setting_change', { setting: 'public_profile', enabled: true })
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            activity_group: 'privacy', entity_type: 'privacy_setting', entity_id: 'public_profile'
        }))
    })

    it.each([
        ['saved_folder_create', { kind: 'product', folder_id: 'f1' }, 'saved', 'saved_folder', 'f1'],
        ['location_move', { id: 42, to_folder_id: 'f2' }, 'saved', 'place', '42'],
        ['product_save_success', { barcode: '471', folder_id: 'f1' }, 'saved', 'product', '471'],
        ['referral_invite_share', { method: 'whatsapp' }, 'sharing', 'share_method', 'whatsapp'],
        ['search_results', { query: 'tofu', result_count: 7 }, 'search', 'search_query', 'tofu'],
        ['store_chat_message_sent', { conversation_id: 'c9' }, 'store', 'store_conversation', 'c9'],
        ['store_pay_now_click', { order_id: 'o5' }, 'store', 'store_order', 'o5'],
        ['report_reply_sent', { kind: 'product', report_id: 'r3' }, 'reports', 'report', 'r3'],
        ['onboarding_step_view', { step: 2 }, 'onboarding', 'onboarding_step', '2'],
        ['app_review_prompt_response', { choice: 'later' }, 'app', 'review_choice', 'later'],
        ['app_open', { platform: 'android' }, 'app', null, null],
        ['screen_view', { screen: '/item/:barcode', from: '/home' }, 'navigation', 'screen', '/item/:barcode'],
        ['client_error', { signature: 'k3j2h1', source: 'vue' }, 'errors', 'error', 'k3j2h1'],
    ])('maps %s to group, entity and id', async (activity, detail, group, entityType, entityId) => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log(activity as string, detail)

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            activity_group: group, entity_type: entityType, entity_id: entityId
        }))
    })

    it('reads the user from the local session and never calls the auth server', async () => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('screen_view', { screen: '/home', from: null })

        expect(supabase.auth.getSession).toHaveBeenCalled()
        expect(supabase.auth.getUser).not.toHaveBeenCalled()
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'mock-user-id' }))
    })

    it('logs as anonymous instead of dropping the event when the session cannot be read', async () => {
        vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error('storage unavailable'))
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('app_open', { platform: 'android' })

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: null, activity_type: 'app_open' }))
    })

    it('should still log activity for anonymous (logged-out) users, with a null user_id', async () => {
        // Override mock for this specific test: no authenticated user
        vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
            data: { session: null },
            error: null
        } as any)

        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('barcode_scan_success', { barcode: '123456789' })

        // Anonymous events must NOT be dropped - they should insert with a null
        // user_id but a real session_id, so pre-signup activity is still captured.
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            user_id: null,
            session_id: 'mock-session-id',
            activity_type: 'barcode_scan_success',
            entity_type: 'product',
            entity_id: '123456789'
        }))
    })

    it('should not insert if the activity_log table returns an error', async () => {
        const insertMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await ActivityLogService.log('barcode_scan_success', { barcode: '123456789' })

        expect(insertMock).toHaveBeenCalled()
        expect(consoleErrorSpy).toHaveBeenCalledWith('[ActivityLogService] Insert error:', { message: 'insert failed' })
        consoleErrorSpy.mockRestore()
    })

    describe('business claim funnel events', () => {
        it.each([
            'business_claim_start',
            'business_claim_step_view',
            'business_claim_submit',
            'business_claim_submit_error',
            'business_claim_approve',
            'business_claim_reject',
        ])('resolves %s to the place entity via location_id and the "merchant" group', async (activity) => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log(activity, { location_id: 42 })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                activity_type: activity,
                activity_group: 'merchant',
                entity_type: 'place',
                entity_id: '42'
            }))
        })

        it('logs a null entity_id when business_claim_submit_error has no location_id', async () => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log('business_claim_submit_error', { message: 'Network error' })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                entity_type: 'place',
                entity_id: null,
                activity_detail: { message: 'Network error' }
            }))
        })
    })

    describe('notification events', () => {
        it('resolves notification_received to the notification entity and "notifications" group', async () => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log('notification_received', { notification_id: 'notif-1', type: 'product_approved' })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                activity_type: 'notification_received',
                activity_group: 'notifications',
                entity_type: 'notification',
                entity_id: 'notif-1'
            }))
        })

        it('resolves notification_opened to the notification entity', async () => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log('notification_opened', { notification_id: 'notif-2', type: 'report_reply' })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                entity_type: 'notification',
                entity_id: 'notif-2'
            }))
        })

        it.each(['notification_category_opened', 'notification_newitem_opened'])(
            'groups %s under "notifications" without a resolved entity',
            async (activity) => {
                const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
                vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

                await ActivityLogService.log(activity, { category: 'products' })

                expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                    activity_group: 'notifications',
                    entity_type: null,
                    entity_id: null
                }))
            }
        )
    })

    describe('search_filter_status', () => {
        it('resolves entity_id from the last item of the statuses array', async () => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log('search_filter_status', { statuses: ['open', 'closed'] })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                activity_group: 'search',
                entity_type: 'status',
                entity_id: 'closed'
            }))
        })

        it('resolves a null entity_id when statuses is empty', async () => {
            const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
            vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

            await ActivityLogService.log('search_filter_status', { statuses: [] })

            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
                entity_type: 'status',
                entity_id: null
            }))
        })
    })
})
