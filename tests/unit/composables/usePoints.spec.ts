import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePoints, currentPoints } from '@/composables/usePoints'
import { supabase } from '@/plugins/supabaseClient'

vi.mock('@/composables/usePointRules', () => ({
    usePointRules: () => ({ rules: { value: {} } })
}))

vi.mock('@/composables/useRewardOverlay', () => ({
    openReward: vi.fn(),
    closeReward: vi.fn()
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
vi.mock('lottie-web', () => ({ default: { load: vi.fn() } }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn().mockReturnValue(false) } }))

describe('usePoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        currentPoints.value = 100
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { access_token: 'token-123', user: { user_metadata: { avatar_url: 'avatar.png' } } } as any },
            error: null
        } as any)
    })

    it('should fetch current points from DB', async () => {
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { points: 250 }, error: null }) })
            })
        } as any)

        const { fetchCurrentPoints } = usePoints()
        await fetchCurrentPoints('user-1')
        expect(currentPoints.value).toBe(250)
    })

    it('should handle award points backend call successfully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true, json: vi.fn().mockResolvedValue({ success: true, total: 260, points: 10, label: 'Adding Product' })
        })

        const { awardPoints } = usePoints()
        const res = await awardPoints('add_product')

        expect(res.success).toBe(true)
        expect(currentPoints.value).toBe(260)
    })
})
