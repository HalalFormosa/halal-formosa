import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MerchantService } from '@/services/MerchantService'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'

vi.mock('@/services/ActivityLogService', () => ({
    ActivityLogService: { log: vi.fn() }
}))

describe('MerchantService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: { id: 'user-123' } as any }, error: null
        } as any)
    })

    it('should submit a merchant application successfully', async () => {
        const singleMock = vi.fn().mockResolvedValue({
            data: { id: 'app-1', store_name: 'Halal Store' }, error: null
        })
        vi.mocked(supabase.from).mockReturnValue({
            upsert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: singleMock }) })
        } as any)

        const app = await MerchantService.submitApplication({
            store_name: 'Halal Store', contact_phone: '0912345678'
        })

        expect(app.id).toBe('app-1')
        expect(ActivityLogService.log).toHaveBeenCalledWith('merchant_application_submit', {
            application_id: 'app-1',
            store_name: 'Halal Store'
        })
    })

    it('should fetch the current user application', async () => {
        const maybeSingleMock = vi.fn().mockResolvedValue({
            data: { id: 'app-1', store_name: 'Halal Store' }, error: null
        })
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
                    })
                })
            })
        } as any)

        const res = await MerchantService.getUserApplication()
        expect(res?.store_name).toBe('Halal Store')
    })

    it('should throw error if user is not authenticated when submitting', async () => {
        vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
            data: { user: null }, error: new Error('Auth error')
        } as any)

        await expect(MerchantService.submitApplication({
            store_name: 'Halal Store', contact_phone: '0912345678'
        })).rejects.toThrow('User must be logged in to submit an application')
    })
})
