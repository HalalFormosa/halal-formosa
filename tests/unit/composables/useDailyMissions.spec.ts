import { describe, it, expect, vi } from 'vitest'
import { useDailyMissions } from '@/composables/useDailyMissions'
import { supabase } from '@/plugins/supabaseClient'

vi.mock('@/composables/usePoints', () => ({
    usePoints: () => ({ awardAndCelebrate: vi.fn().mockResolvedValue(true) })
}))

describe('useDailyMissions', () => {
    it('should fetch activity logs and calculate progress', async () => {
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                        lt: vi.fn().mockResolvedValue({
                            data: [
                                { activity_type: 'home_page_open', activity_detail: {} },
                                { activity_type: 'location_review_success', activity_detail: {} }
                            ],
                            error: null
                        })
                    })
                })
            })
        } as any)

        const { fetchProgress, missions } = useDailyMissions()
        await fetchProgress()
        
        const openApp = missions.value.find(m => m.id === 'open_app')
        expect(openApp?.current).toBeGreaterThan(0)

        const reviewPlace = missions.value.find(m => m.id === 'review_place')
        expect(reviewPlace?.current).toBeGreaterThan(0)
    })
})
