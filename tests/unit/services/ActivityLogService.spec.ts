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
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: { id: 'mock-user-id' } as any },
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

    it('should abort logging if no user is authenticated', async () => {
        // Override mock for this specific test
        vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
            data: { user: null },
            error: null
        } as any)

        const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
        vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any)

        await ActivityLogService.log('barcode_scan_success', { barcode: '123456789' })

        // The insert shouldn't be called because the user is not logged in
        expect(insertMock).not.toHaveBeenCalled()
    })
})
