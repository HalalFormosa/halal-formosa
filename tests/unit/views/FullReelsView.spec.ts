import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'

const ion = vi.hoisted(() => [
    'IonPage', 'IonContent', 'IonHeader', 'IonToolbar', 'IonTitle', 'IonButtons', 'IonIcon', 'IonAvatar', 'IonButton', 'IonSpinner',
])
vi.mock('@ionic/vue', async () => {
    const { defineComponent, h } = await import('vue')
    const mod: Record<string, any> = {}
    ion.forEach(t => {
        mod[t] = defineComponent({ name: t, setup: (_p, { slots }) => () => h('div', { 'data-ion': t }, slots.default?.()) })
    })
    return mod
})
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }))
// the template references /logo-raw/logo.png, which Vite turns into an asset import vitest cannot read
vi.mock('/logo-raw/logo.png', () => ({ default: 'logo.png' }))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: vi.fn().mockResolvedValue(undefined) } }))

import FullReelsView from '@/views/home/FullReelsView.vue'

const logged = (name: string) => vi.mocked(ActivityLogService.log).mock.calls.filter(([a]) => a === name)

const igPost = {
    id: 'ig1',
    timestamp: '2026-10-01T00:00:00Z',
    caption: 'A reel',
    video_url: 'https://cdn.example/v.mp4',
    thumbnail_url: 'https://cdn.example/t.jpg',
    media_url: 'https://cdn.example/m.jpg',
    permalink: 'https://instagram.com/p/1',
}

describe('FullReelsView preview limit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
        // jsdom does not implement media playback
        HTMLMediaElement.prototype.pause = vi.fn()
        HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)

        const table = (data: unknown[]) => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data, error: null }) }) }) })
        vi.mocked(supabase.from).mockImplementation(((name: string) => table(name === 'instagram_posts' ? [igPost] : [])) as any)
    })

    it('logs reels_preview_limit_reached once even though snapping currentTime fires more timeupdate events', async () => {
        const w = mount(FullReelsView, { global: { mocks: { $t: (k: string) => k } } })
        await flushPromises()

        const video = w.find('video.main-media').element as HTMLVideoElement
        expect(video).toBeTruthy()

        // Behave like a browser: assigning currentTime fires another timeupdate (asynchronously).
        let time = 0
        let events = 0
        const fire = () => {
            if (events++ >= 60) return  // safety net so a regression fails the assertion instead of hanging
            queueMicrotask(() => video.dispatchEvent(new Event('timeupdate')))
        }
        Object.defineProperty(video, 'currentTime', {
            configurable: true,
            get: () => time,
            set: (v: number) => { time = v; fire() },
        })

        time = 11  // playback passes the 10 s Instagram limit
        video.dispatchEvent(new Event('timeupdate'))
        await flushPromises()
        await new Promise(r => setTimeout(r, 20))

        expect(logged('reels_preview_limit_reached')).toHaveLength(1)
        expect(events).toBeLessThan(5)  // the snap did not keep re-triggering itself
        expect(w.find('.limit-overlay').exists()).toBe(true)
    })

    it('does not log the limit before playback reaches it', async () => {
        const w = mount(FullReelsView, { global: { mocks: { $t: (k: string) => k } } })
        await flushPromises()

        const video = w.find('video.main-media').element as HTMLVideoElement
        Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 4, set: () => {} })
        video.dispatchEvent(new Event('timeupdate'))
        await flushPromises()

        expect(logged('reels_preview_limit_reached')).toHaveLength(0)
    })
})
