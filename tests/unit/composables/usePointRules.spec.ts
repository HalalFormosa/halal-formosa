import { describe, it, expect, vi } from 'vitest'
import { usePointRules } from '@/composables/usePointRules'
import { supabase } from '@/plugins/supabaseClient'

describe('usePointRules', () => {
    it('should fetch point rules from supabase', async () => {
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                data: [{ action: 'add_product', points: 10, label: 'Add Product' }],
                error: null
            })
        } as any)

        const { fetchRules, rules } = usePointRules()
        await fetchRules()
        expect(rules.value['add_product'].points).toBe(10)
    })
})
