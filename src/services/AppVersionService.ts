import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Device } from '@capacitor/device'
import { supabase } from '@/plugins/supabaseClient'

// Reports which app version a signed-in user is actually running, via the
// record_app_version() RPC (table user_app_versions). Unlike ingredient_scan_logs
// this covers everyone who opens the app, not just people who scan. Called from
// updateLastSeen(), which already runs on launch, on resume and every 5 minutes.

const STORAGE_KEY = 'app_version_reported'
const REPORT_INTERVAL_MS = 12 * 60 * 60 * 1000

type Reported = { userId: string; version: string; build: string; at: number }

function readReported(): Reported | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as Reported) : null
    } catch {
        return null
    }
}

/** Pure throttle rule: report on a new user/version/build, or once the interval has passed. */
export function shouldReport(last: Reported | null, current: Omit<Reported, 'at'>, now = Date.now()): boolean {
    if (!last) return true
    if (last.userId !== current.userId || last.version !== current.version || last.build !== current.build) return true
    return now - last.at >= REPORT_INTERVAL_MS
}

let inFlight = false

export async function recordAppVersion(userId: string): Promise<void> {
    if (!userId || !Capacitor.isNativePlatform() || inFlight) return
    inFlight = true
    try {
        const [{ version, build }, { platform, model, osVersion }] = await Promise.all([
            CapApp.getInfo(),
            Device.getInfo(),
        ])
        if (platform !== 'ios' && platform !== 'android') return

        const current = { userId, version, build: String(build ?? '') }
        if (!shouldReport(readReported(), current)) return

        const { error } = await supabase.rpc('record_app_version', {
            p_platform: platform,
            p_app_version: version,
            p_app_build: String(build ?? ''),
            p_os_version: osVersion ?? null,
            p_device_model: model ?? null,
        })
        if (error) {
            console.warn('[AppVersionService] record failed:', error.message)
            return
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, at: Date.now() }))
        } catch { /* storage unavailable: we will just report again next time */ }
    } catch (err) {
        console.warn('[AppVersionService] skipped:', err)
    } finally {
        inFlight = false
    }
}
