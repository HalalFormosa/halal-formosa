import { ref } from 'vue'
import type { Router } from 'vue-router'

export type ScanMode = 'camera' | 'gallery' | 'auto' | 'live'
type ScanAction = 'camera' | 'gallery'

/**
 * Camera and Gallery are actions on the scan page (open the native camera / the photo picker),
 * so switching to them from a full-screen scan mode goes back to that page and asks it to
 * start the action as soon as it is shown.
 */
const pendingAction = ref<ScanAction | null>(null)

export function requestScanAction(action: ScanAction) {
    pendingAction.value = action
}

/** Returns the action waiting for the scan page, once. */
export function takeScanAction(): ScanAction | null {
    const action = pendingAction.value
    pendingAction.value = null
    return action
}

function isScanHome(path: string | null | undefined): boolean {
    return path === '/scan' || (path ?? '').startsWith('/scan?')
}

/**
 * Switch straight to another scan mode without going through the mode picker.
 *  - Auto Scan and Live Verdict replace the current screen, so Back still returns to wherever
 *    the user started.
 *  - Camera and Gallery return to the scan page (back if it is right behind us, otherwise a
 *    replace) and it starts the action.
 */
export function switchScanMode(
    router: Pick<Router, 'replace' | 'back'>,
    mode: ScanMode,
    previousPath?: string | null,
) {
    if (mode === 'auto') {
        void router.replace('/scan/auto')
    } else if (mode === 'live') {
        void router.replace('/scan/live')
    } else {
        requestScanAction(mode)
        if (isScanHome(previousPath)) router.back()
        else void router.replace('/scan')
    }
}
