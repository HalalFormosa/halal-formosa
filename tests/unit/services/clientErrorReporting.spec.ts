import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installClientErrorReporting } from '@/plugins/clientErrorReporting'
import { ActivityLogService } from '@/services/ActivityLogService'

vi.mock('@/services/ActivityLogService', () => ({
    ActivityLogService: { log: vi.fn().mockResolvedValue(undefined) },
}))

const errorCalls = () => vi.mocked(ActivityLogService.log).mock.calls.filter(([a]) => a === 'client_error')

describe('installClientErrorReporting', () => {
    let app: any
    let consoleError: ReturnType<typeof vi.spyOn>
    const added: Array<[string, EventListener]> = []

    // Each test installs fresh listeners; remove them afterwards so tests do not see each other's.
    const realAdd = window.addEventListener.bind(window)
    beforeEach(() => {
        vi.clearAllMocks()
        app = { config: {} }
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(window, 'addEventListener').mockImplementation((type: any, fn: any, opts?: any) => {
            added.push([type, fn])
            realAdd(type, fn, opts)
        })
        installClientErrorReporting(app, () => '/item/:barcode')
    })
    afterEach(() => {
        added.splice(0).forEach(([t, fn]) => window.removeEventListener(t, fn))
        vi.restoreAllMocks()
    })

    it('reports a Vue error with the screen, still prints it, and scrubs personal data', () => {
        app.config.errorHandler(new Error('bad data for rakha@example.com'), { $options: { name: 'ItemCard' } }, 'render function')

        expect(consoleError).toHaveBeenCalled()
        expect(errorCalls()).toHaveLength(1)
        const detail = errorCalls()[0][1] as any
        expect(detail).toMatchObject({ source: 'vue', screen: '/item/:barcode', info: 'render function', component: 'ItemCard' })
        expect(detail.message).toContain('[email]')
        expect(detail.message).not.toContain('rakha@example.com')
        expect(typeof detail.signature).toBe('string')
    })

    it('reports window errors and unhandled rejections', () => {
        window.dispatchEvent(new ErrorEvent('error', { error: new Error('window boom'), message: 'window boom' }))
        const rejection = new Event('unhandledrejection') as any
        rejection.reason = new Error('promise boom')
        window.dispatchEvent(rejection)

        expect(errorCalls().map(c => (c[1] as any).source)).toEqual(['window', 'promise'])
    })

    it('sends each distinct error once per session', () => {
        for (let i = 0; i < 5; i++) app.config.errorHandler(new Error('same bug'), null, 'setup')
        expect(errorCalls()).toHaveLength(1)
    })

    it('ignores connectivity failures and failed image/script loads', () => {
        app.config.errorHandler(new TypeError('Failed to fetch'), null, 'watcher')
        const img = document.createElement('img')
        img.dispatchEvent(new ErrorEvent('error', { message: 'img failed', bubbles: true }))
        window.dispatchEvent(Object.assign(new ErrorEvent('error', { message: 'x' }), { }))
        expect(errorCalls().filter(c => (c[1] as any).message === 'Failed to fetch')).toHaveLength(0)
        expect(errorCalls().filter(c => (c[1] as any).message === 'img failed')).toHaveLength(0)
    })

    it('never throws back into the app if logging fails', () => {
        vi.mocked(ActivityLogService.log).mockImplementationOnce(() => { throw new Error('log down') })
        expect(() => app.config.errorHandler(new Error('x'), null, 'y')).not.toThrow()
    })
})
