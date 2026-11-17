import { Preferences } from '@capacitor/preferences'

/**
 * Survives Android killing our process while the native camera is open.
 *
 * On low-memory phones the system can destroy the app while the camera app is
 * in front. When the user comes back, Android restarts us, the WebView loads
 * "/" (which redirects to Home) and every in-memory form value is gone.
 * Capacitor still hands us the photo through the `appRestoredResult` event.
 *
 * Flow:
 *  1. Before opening the camera a view calls saveCameraDraft().
 *  2. If the camera returns normally the view calls clearCameraDraft().
 *  3. If the process was killed, App.vue passes the restored result to
 *     handleRestoredCameraResult(), which routes back to the form.
 *  4. The form calls consumeCameraRestore() on mount and re-applies its state.
 */

export type CameraDraftKind = 'add-product' | 'add-place'

export interface CameraDraft {
  kind: CameraDraftKind
  /** Which button opened the camera, e.g. 'front', 'back', 'ingredients', 'place'. */
  target: string
  /** Route to return to (fullPath). */
  route: string
  /** Plain JSON form state. Files and blobs are not stored, only the new photo URI is. */
  state: Record<string, unknown>
  savedAt: number
}

export interface CameraRestore {
  draft: CameraDraft
  /** webPath of the photo the camera produced, or null if it was cancelled or failed. */
  photoUri: string | null
}

const KEY = 'camera_draft_v1'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

let pending: CameraRestore | null = null

export async function saveCameraDraft(
  kind: CameraDraftKind,
  target: string,
  route: string,
  state: Record<string, unknown>,
): Promise<void> {
  try {
    const draft: CameraDraft = { kind, target, route, state, savedAt: Date.now() }
    await Preferences.set({ key: KEY, value: JSON.stringify(draft) })
  } catch (e) {
    console.warn('[cameraRestore] could not save draft', e)
  }
}

export async function clearCameraDraft(): Promise<void> {
  try {
    await Preferences.remove({ key: KEY })
  } catch {
    /* nothing to clean up */
  }
}

async function loadDraft(): Promise<CameraDraft | null> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    if (!value) return null
    const draft = JSON.parse(value) as CameraDraft
    if (!draft?.route || Date.now() - draft.savedAt > MAX_AGE_MS) {
      await clearCameraDraft()
      return null
    }
    return draft
  } catch {
    return null
  }
}

/**
 * Called from App.vue with the payload of Capacitor's `appRestoredResult`.
 * Returns the route to go back to, or null if this result is not ours.
 */
export async function handleRestoredCameraResult(result: {
  pluginId?: string
  methodName?: string
  success?: boolean
  data?: any
}): Promise<string | null> {
  if (result?.pluginId !== 'Camera') return null
  const draft = await loadDraft()
  if (!draft) return null
  const photoUri = result.success && result.data?.webPath ? String(result.data.webPath) : null
  pending = { draft, photoUri }
  return draft.route
}

/** Synchronous peek, so a form can skip auto-opening things before it restores. */
export function hasPendingCameraRestore(kind: CameraDraftKind): boolean {
  return pending?.draft.kind === kind
}

/** Called by a form on mount. Returns the restore only if it belongs to that form. */
export async function consumeCameraRestore(kind: CameraDraftKind): Promise<CameraRestore | null> {
  if (!pending || pending.draft.kind !== kind) return null
  const restore = pending
  pending = null
  await clearCameraDraft()
  return restore
}
