import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const state = vi.hoisted(() => ({ present: vi.fn() }))
vi.mock('@/utils/proPaywall', () => ({ presentProPaywall: state.present }))

import ProUpsellSheet from '@/components/ProUpsellSheet.vue'

// ion-modal needs a real browser; render its content whenever it is open.
const IonModal = { props: ['isOpen'], emits: ['didDismiss'], template: '<div v-if="isOpen"><slot /></div>' }
const IonButton = { template: '<button><slot /></button>' }

const mountIt = (props: Record<string, unknown> = {}) =>
    mount(ProUpsellSheet, {
        props: {
            open: true,
            source: 'scan_limit',
            title: 'Title',
            message: 'Message',
            upgradeLabel: 'Go Pro',
            dismissLabel: 'Not now',
            secondaryLabel: 'Earn',
            ...props,
        },
        global: { stubs: { IonModal, IonButton, IonIcon: true } },
    })

const labels = (w: ReturnType<typeof mountIt>) => w.findAll('button').map(b => b.text())

describe('ProUpsellSheet', () => {
    beforeEach(() => state.present.mockReset())

    it('shows Pro, the free option and a way out', () => {
        expect(labels(mountIt())).toEqual(['Go Pro', 'Earn', 'Not now'])
    })

    it('leaves out the free option when none is given', () => {
        expect(labels(mountIt({ secondaryLabel: undefined }))).toEqual(['Go Pro', 'Not now'])
    })

    it('hides Pro where the paywall cannot run', () => {
        expect(labels(mountIt({ canUpgrade: false }))).toEqual(['Earn', 'Not now'])
    })

    it('opens the paywall with its source and closes as upgraded on purchase', async () => {
        state.present.mockResolvedValue(true)
        const w = mountIt()
        await w.findAll('button')[0].trigger('click')
        await vi.waitFor(() => expect(w.emitted('upgraded')).toHaveLength(1))
        expect(state.present).toHaveBeenCalledWith('scan_limit')
        expect(w.emitted('update:open')?.[0]).toEqual([false])

        // The dismissal that follows must not read as "user walked away".
        w.findComponent(IonModal).vm.$emit('didDismiss')
        expect(w.emitted('dismissed')).toBeUndefined()
    })

    it('stays open when the paywall is cancelled', async () => {
        state.present.mockResolvedValue(false)
        const w = mountIt()
        await w.findAll('button')[0].trigger('click')
        await vi.waitFor(() => expect(state.present).toHaveBeenCalled())
        await w.vm.$nextTick()
        expect(w.emitted('upgraded')).toBeUndefined()
        expect(w.emitted('update:open')).toBeUndefined()
    })

    it('runs the free option without reporting a dismissal', async () => {
        const w = mountIt()
        await w.findAll('button')[1].trigger('click')
        expect(w.emitted('secondary')).toHaveLength(1)
        w.findComponent(IonModal).vm.$emit('didDismiss')
        expect(w.emitted('dismissed')).toBeUndefined()
    })

    it('reports a plain dismissal (Not now, swipe or backdrop)', async () => {
        const w = mountIt()
        await w.findAll('button')[2].trigger('click')
        expect(w.emitted('update:open')?.[0]).toEqual([false])
        w.findComponent(IonModal).vm.$emit('didDismiss')
        expect(w.emitted('dismissed')).toHaveLength(1)
    })
})
