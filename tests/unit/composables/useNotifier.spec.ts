import { describe, it, expect, vi } from 'vitest'
import { useNotifier } from '@/composables/useNotifier'

describe('useNotifier', () => {
    it('should send notification via edge function', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('ok') })
        const { notifyEvent } = useNotifier()
        const res = await notifyEvent('new_product', 'Title', 'Msg', '', { barcode: '123' })
        expect(res.success).toBe(true)
        expect(global.fetch).toHaveBeenCalled()
    })
})
