import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { supabase } from '@/plugins/supabaseClient'

// Ionic's web components need a real browser; for these tests every Ion* component is a plain
// element that renders its slot, and the Ionic lifecycle hook runs on mount.
const ion = vi.hoisted(() => {
    const tags = [
        'IonPage', 'IonHeader', 'IonContent', 'IonRefresher', 'IonRefresherContent', 'IonSegment', 'IonSegmentButton',
        'IonLabel', 'IonSelect', 'IonSelectOption', 'IonChip', 'IonIcon', 'IonBadge', 'IonButton', 'IonSpinner',
        'IonInfiniteScroll', 'IonInfiniteScrollContent',
    ]
    return tags
})

vi.mock('@ionic/vue', async () => {
    const { defineComponent, h, onMounted } = await import('vue')
    const stub = (tag: string) => defineComponent({ name: tag, setup: (_p, { slots, attrs }) => () => h('div', { 'data-ion': tag, ...attrs }, slots.default?.()) })
    const mod: Record<string, any> = {}
    ion.forEach(t => { mod[t] = stub(t) })
    mod.onIonViewWillEnter = (cb: () => void) => onMounted(cb)
    mod.toastController = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) }
    return mod
})

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
        te: () => false,
    }),
}))
vi.mock('@/components/AppHeader.vue', () => ({ default: { name: 'AppHeader', template: '<header />' } }))

import AuditLogView from '@/views/admin/AuditLogView.vue'

const entry = (over: Record<string, unknown> = {}) => ({
    id: 10,
    created_at: '2026-10-08T10:00:00Z',
    actor_id: 'aaaaaaaa-1111-2222-3333-444444444444',
    actor_name: 'Rakha',
    actor_kind: 'admin',
    action: 'approve',
    table_name: 'products',
    row_key: 'f0f0f0f0-aaaa-bbbb-cccc-dddddddddddd',
    target_user_id: 'bbbbbbbb-1111-2222-3333-444444444444',
    location_id: null,
    changes: { approved: { old: false, new: true }, phone: { old: '[redacted]', new: '[redacted]' } },
    user_agent: 'Mozilla/5.0 test',
    ...over,
})

const factory = () =>
    mount(AuditLogView, { global: { mocks: { $t: (k: string, p?: unknown) => (p ? `${k}:${JSON.stringify(p)}` : k) } } })

describe('AuditLogView', () => {
    const rpc = vi.fn()
    beforeEach(() => {
        vi.clearAllMocks()
        ;(supabase as any).rpc = rpc
    })

    it('loads the first page through admin_get_audit_log and renders each entry', async () => {
        rpc.mockResolvedValue({ data: [entry(), entry({ id: 9, action: 'delete', table_name: 'location_photos', changes: { url: 'x' } })], error: null })
        const w = factory()
        await flushPromises()

        expect(rpc).toHaveBeenCalledWith('admin_get_audit_log', expect.objectContaining({
            p_limit: 30, p_before_id: null, p_table: null, p_actor: null, p_target_user: null, p_kind: null,
        }))
        expect(w.findAll('.audit-card')).toHaveLength(2)
        expect(w.text()).toContain('products')
        expect(w.text()).toContain('location photos')
        expect(w.text()).toContain('Rakha')
    })

    it('shows an update as old -> new and hides redacted values once expanded', async () => {
        rpc.mockResolvedValue({ data: [entry()], error: null })
        const w = factory()
        await flushPromises()

        expect(w.find('.changes').exists()).toBe(false)
        await w.find('button.toggle').trigger('click')

        expect(w.find('.old').text()).toBe('false')
        expect(w.find('.new').text()).toBe('true')
        expect(w.find('.hidden-val').exists()).toBe(true)
        expect(w.text()).not.toContain('[redacted]')
    })

    it('pages with the last id as the cursor and stops when a page comes back short', async () => {
        rpc.mockResolvedValueOnce({ data: Array.from({ length: 30 }, (_, i) => entry({ id: 100 - i })), error: null })
        const w = factory()
        await flushPromises()
        expect(w.findAll('.audit-card')).toHaveLength(30)

        rpc.mockResolvedValueOnce({ data: [entry({ id: 70 })], error: null })
        await (w.vm as any).load(false)
        await flushPromises()

        expect(rpc).toHaveBeenLastCalledWith('admin_get_audit_log', expect.objectContaining({ p_before_id: 71 }))
        expect(w.findAll('.audit-card')).toHaveLength(31)

        await (w.vm as any).load(false) // noMore is set, so no extra request
        expect(rpc).toHaveBeenCalledTimes(2)
    })

    it('filters by actor when its chip is tapped and reloads from the start', async () => {
        rpc.mockResolvedValue({ data: [entry()], error: null })
        const w = factory()
        await flushPromises()

        await w.find('.meta-chip').trigger('click')
        await flushPromises()

        expect(rpc).toHaveBeenLastCalledWith('admin_get_audit_log', expect.objectContaining({
            p_actor: 'aaaaaaaa-1111-2222-3333-444444444444', p_before_id: null,
        }))
        expect(w.find('.active-filters').exists()).toBe(true)
    })

    it('shows the empty state, then the failure state with a retry', async () => {
        rpc.mockResolvedValueOnce({ data: [], error: null })
        const w = factory()
        await flushPromises()
        expect(w.find('.state-box').text()).toContain('admin.auditLog.empty')

        rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
        await (w.vm as any).load(true)
        await flushPromises()
        expect(w.find('.state-box').text()).toContain('admin.auditLog.loadFailed')
    })
})
