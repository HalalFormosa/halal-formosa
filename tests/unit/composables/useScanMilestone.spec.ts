import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const state = vi.hoisted(() => ({
    native: true,
    user: { id: 'u1' } as { id: string } | null,
    count: 10,
    countError: null as unknown,
    log: vi.fn(),
    donor: { value: false },
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native } }))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: state.log } }))
vi.mock('@/composables/useSubscriptionStatus', async () => {
    const { ref } = await import('vue')
    return { isDonor: ref(false) }
})
vi.mock('@/plugins/supabaseClient', () => ({
    supabase: {
        auth: { getUser: async () => ({ data: { user: state.user } }) },
        from: () => {
            const chain: any = {
                select: () => chain,
                eq: () => chain,
                then: (resolve: (v: unknown) => void) => resolve({ count: state.count, error: state.countError }),
            }
            return chain
        },
    },
}))

async function load() {
    vi.resetModules()
    const mod = await import('@/composables/useScanMilestone')
    const sub = await import('@/composables/useSubscriptionStatus')
    ;(sub.isDonor as unknown as ReturnType<typeof ref>).value = false
    return { ...mod, isDonor: sub.isDonor as unknown as ReturnType<typeof ref<boolean>> }
}

describe('useScanMilestone', () => {
    beforeEach(() => {
        localStorage.clear()
        state.native = true
        state.user = { id: 'u1' }
        state.count = 10
        state.countError = null
        state.log.mockClear()
    })

    it('opens once the user reaches the milestone, and logs it', async () => {
        const { useScanMilestone } = await load()
        const { open, maybeShow } = useScanMilestone()
        await maybeShow()
        expect(open.value).toBe(true)
        expect(state.log).toHaveBeenCalledWith('scan_milestone_shown', { count: 10 })
    })

    it('stays closed below the milestone', async () => {
        state.count = 9
        const { useScanMilestone } = await load()
        const { open, maybeShow } = useScanMilestone()
        await maybeShow()
        expect(open.value).toBe(false)
    })

    it('never shows twice to the same user', async () => {
        const first = await load()
        await first.useScanMilestone().maybeShow()
        // A new app session: the in-memory cap resets, the stored "shown" flag does not.
        const second = await load()
        const { open, maybeShow } = second.useScanMilestone()
        await maybeShow()
        expect(open.value).toBe(false)
    })

    it('skips Pro users, the web app and signed-out users', async () => {
        const pro = await load()
        pro.isDonor.value = true
        await pro.useScanMilestone().maybeShow()
        expect(pro.useScanMilestone().open.value).toBe(false)

        state.native = false
        const web = await load()
        await web.useScanMilestone().maybeShow()
        expect(web.useScanMilestone().open.value).toBe(false)

        state.native = true
        state.user = null
        const out = await load()
        await out.useScanMilestone().maybeShow()
        expect(out.useScanMilestone().open.value).toBe(false)
    })

    it('waits, without using up its one showing, while something else owns the screen', async () => {
        const { useScanMilestone } = await load()
        const { open, maybeShow } = useScanMilestone()
        await maybeShow({ blocked: () => true })
        expect(open.value).toBe(false)
        await maybeShow()
        expect(open.value).toBe(true)
    })

    it('holds back while the app-opened paywall cap is active', async () => {
        const { useScanMilestone } = await load()
        const cap = await import('@/utils/paywallCap')
        cap.recordPaywallDismissed() // dismissed a paywall moments ago
        const { open, maybeShow } = useScanMilestone()
        await maybeShow()
        expect(open.value).toBe(false)
    })

    it('does not show when the scan count cannot be read', async () => {
        state.count = 0
        state.countError = new Error('offline')
        const { useScanMilestone } = await load()
        const { open, maybeShow } = useScanMilestone()
        await maybeShow()
        expect(open.value).toBe(false)
    })
})
