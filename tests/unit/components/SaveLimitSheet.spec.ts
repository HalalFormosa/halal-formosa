import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const state = vi.hoisted(() => ({ log: vi.fn() }))
vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string, params?: Record<string, number>) => (params ? `${key}|${params.limit}` : key) }),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: state.log } }))
vi.mock('@/utils/proPaywall', () => ({ presentProPaywall: vi.fn() }))

import SaveLimitSheet from '@/components/SaveLimitSheet.vue'
import ProUpsellSheet from '@/components/ProUpsellSheet.vue'

const mountIt = (props: Record<string, unknown>) =>
    mount(SaveLimitSheet, { props: { open: false, kind: 'item', ...props }, global: { stubs: { ProUpsellSheet: true } } })

const inner = (w: ReturnType<typeof mountIt>) => w.findComponent(ProUpsellSheet)

describe('SaveLimitSheet', () => {
    beforeEach(() => state.log.mockClear())

    it('uses the saved-items copy and paywall source for items', () => {
        const props = inner(mountIt({ kind: 'item' })).props()
        expect(props.source).toBe('save_item_limit')
        expect(props.title).toBe('savedItems.limitSheet.title')
        expect(props.message).toBe('savedItems.limitSheet.body|5')
        expect(props.secondaryLabel).toBe('savedItems.limitSheet.manage')
    })

    it('uses the saved-locations copy and paywall source for locations', () => {
        const props = inner(mountIt({ kind: 'location', meta: { location_id: 7 } })).props()
        expect(props.source).toBe('save_location_limit')
        expect(props.title).toBe('savedLocations.limitSheet.title')
        expect(props.meta).toEqual({ location_id: 7 })
    })

    it('forwards upgraded and manage, and the secondary action means manage', async () => {
        const w = mountIt({ open: true })
        inner(w).vm.$emit('upgraded')
        inner(w).vm.$emit('secondary')
        expect(w.emitted('upgraded')).toHaveLength(1)
        expect(w.emitted('manage')).toHaveLength(1)
    })

    it('logs that the limit was hit when the sheet opens, not before', async () => {
        const w = mountIt({ kind: 'location', meta: { location_id: 7 } })
        expect(state.log).not.toHaveBeenCalled()
        await w.setProps({ open: true })
        await nextTick()
        expect(state.log).toHaveBeenCalledWith('save_limit_reached', { kind: 'location', location_id: 7 })
    })
})
