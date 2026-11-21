import type { Router } from 'vue-router'

/**
 * A new web deploy removes the old hashed chunks. A tab still running the old
 * bundle then fails on its next lazy import ("Importing a module script
 * failed", "Unable to preload CSS ..."). Reloading once picks up the new
 * bundle. The sessionStorage stamp stops a reload loop if the failure is
 * something else (offline, blocked host): at most one reload per 60 seconds.
 */
const RELOAD_KEY = 'hf_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 60_000

const CHUNK_ERROR_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Unable to preload/i

function reloadOnce(target?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false // storage blocked: can't guard against a loop, so don't reload
  }
  // A failed navigation never committed, so reload straight to where the user was headed.
  if (target) window.location.assign(target)
  else window.location.reload()
  return true
}

export function installChunkReload(router: Router) {
  // Vite fires this when a dynamic import's JS/CSS preload fails.
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault()
  })

  // Safari's "Importing a module script failed" can surface as a plain
  // navigation error instead, so catch it on the router too.
  router.onError((error, to) => {
    const message = error instanceof Error ? error.message : String(error)
    if (!CHUNK_ERROR_RE.test(message)) return
    reloadOnce(router.resolve(to.fullPath).href)
  })
}
