import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import { useNotifications, type AppNotification } from '@/composables/useNotifications'

// Generic chainable Supabase query-builder stub: every chain method returns
// itself, and awaiting it resolves to a safe empty result regardless of how
// deep the chain goes (select/eq/gt/order/limit/upsert all land here).
function makeChainable(result: any = { data: [], error: null, count: 0 }) {
    const handler: any = {
        select: vi.fn(() => handler),
        eq: vi.fn(() => handler),
        gt: vi.fn(() => handler),
        order: vi.fn(() => handler),
        limit: vi.fn(() => handler),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn(() => handler),
        then: (resolve: any) => resolve(result),
    }
    return handler
}

describe('useNotifications', () => {
    let capturedInsertCallback: ((payload: { new: AppNotification }) => void) | null = null

    beforeEach(() => {
        vi.clearAllMocks()
        capturedInsertCallback = null

        vi.mocked(supabase.from).mockImplementation(() => makeChainable())

        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { access_token: 'mock-token', user: { id: 'mock-user-id' } } as any },
            error: null
        } as any)
        ;(supabase.auth as any).onAuthStateChange = vi.fn()
        ;(supabase as any).removeChannel = vi.fn()

        const channelMock: any = {
            on: vi.fn((_event: string, filter: any, cb: any) => {
                if (filter?.table === 'notifications') capturedInsertCallback = cb
                return channelMock
            }),
            subscribe: vi.fn(() => channelMock),
        }
        ;(supabase as any).channel = vi.fn(() => channelMock)

        vi.spyOn(ActivityLogService, 'log').mockResolvedValue(undefined)
    })

    it('logs notification_received when a realtime INSERT arrives for the personal notifications channel', async () => {
        const { initNotifications, personalNotifications, unreadPersonalCount } = useNotifications()
        await initNotifications()

        expect(capturedInsertCallback).toBeTypeOf('function')

        const incoming: AppNotification = {
            id: 'notif-123',
            type: 'product_approved',
            title: 'Your product was approved',
            body: null,
            action_path: '/item/123',
            related_table: null,
            related_id: null,
            image_url: null,
            is_read: false,
            created_at: new Date().toISOString(),
        }

        capturedInsertCallback!({ new: incoming })

        expect(ActivityLogService.log).toHaveBeenCalledWith('notification_received', {
            notification_id: 'notif-123',
            type: 'product_approved'
        })
        expect(personalNotifications.value[0]?.id).toBe('notif-123')
        expect(unreadPersonalCount.value).toBeGreaterThan(0)
    })
})
