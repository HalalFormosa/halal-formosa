import type { App } from 'vue'
import { Capacitor } from '@capacitor/core'
import { ActivityLogService } from '@/services/ActivityLogService'
import { createErrorGate, describeError, errorSignature, isIgnorableError } from '@/utils/clientErrors'

declare const __APP_VERSION__: string

type Source = 'vue' | 'window' | 'promise'

/**
 * Reports uncaught client errors as `client_error` activity events: Vue render/lifecycle errors, global
 * `error` events and unhandled promise rejections. Each distinct error is sent once per session (max 10),
 * text is scrubbed of emails/tokens/numbers, and nothing here can throw back into the app.
 */
export function installClientErrorReporting(app: App, getScreen: () => string | null = () => null) {
    const gate = createErrorGate(10)
    let reporting = false  // never report an error that happens while reporting one

    function report(source: Source, raw: unknown, extra: Record<string, unknown> = {}) {
        if (reporting) return
        reporting = true
        try {
            const err = describeError(raw)
            if (isIgnorableError(err.message, err.name)) return

            const signature = errorSignature(err.message, source)
            if (!gate.shouldReport(signature)) return

            ActivityLogService.log('client_error', {
                signature,
                source,
                message: err.message,
                name: err.name,
                stack: err.stack,
                screen: getScreen(),
                platform: Capacitor.getPlatform(),
                app_version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
                ...extra,
            })
        } catch {
            /* reporting must never throw */
        } finally {
            reporting = false
        }
    }

    // Vue replaces its default console output once a handler is set, so keep logging to the console.
    app.config.errorHandler = (err, instance, info) => {
        console.error(err)
        const component = (instance as { $options?: { name?: string; __name?: string } } | null)?.$options
        report('vue', err, { info, component: component?.name ?? component?.__name })
    }

    window.addEventListener('error', (event: ErrorEvent) => {
        // A failed <img>/<script> load fires 'error' on that element (only seen here if it bubbles): not a JS error.
        if (event.target instanceof Element) return
        report('window', event.error ?? event.message)
    })

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        report('promise', event.reason)
    })
}
