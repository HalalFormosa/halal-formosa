import { beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 24 * 60 * 60 * 1000

// The session flag is module state, so each test loads a fresh copy.
async function loadCap() {
  vi.resetModules()
  return await import('@/utils/paywallCap')
}

describe('paywallCap', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('allows an auto paywall for a user who never dismissed one', async () => {
    const cap = await loadCap()
    expect(cap.canAutoShowPaywall()).toBe(true)
  })

  it('allows only one auto paywall per session', async () => {
    const cap = await loadCap()
    cap.markAutoPaywallShown()
    expect(cap.canAutoShowPaywall()).toBe(false)
  })

  it('waits 24 hours after one dismissal', async () => {
    const cap = await loadCap()
    cap.recordPaywallDismissed(1_000)
    expect(cap.canAutoShowPaywall(1_000 + DAY - 1)).toBe(false)
    expect(cap.canAutoShowPaywall(1_000 + DAY)).toBe(true)
  })

  it('waits 7 days once the user has dismissed twice', async () => {
    const cap = await loadCap()
    cap.recordPaywallDismissed(1_000)
    cap.recordPaywallDismissed(2_000)
    expect(cap.canAutoShowPaywall(2_000 + 6 * DAY)).toBe(false)
    expect(cap.canAutoShowPaywall(2_000 + 7 * DAY)).toBe(true)
  })

  it('clears the cooldown after a purchase', async () => {
    const cap = await loadCap()
    cap.recordPaywallDismissed(1_000)
    cap.recordPaywallDismissed(2_000)
    cap.resetPaywallDismissals()
    expect(cap.canAutoShowPaywall(2_001)).toBe(true)
  })
})
