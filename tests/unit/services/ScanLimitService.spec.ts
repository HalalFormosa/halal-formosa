import { describe, it, expect } from 'vitest'
import { canEarnMoreScans, MAX_CONTRIBUTION_SCANS_PER_DAY } from '@/services/ScanLimitService'

describe('canEarnMoreScans', () => {
    it('is true until the daily contribution cap is reached', () => {
        expect(canEarnMoreScans({ bonus: 0 })).toBe(true)
        expect(canEarnMoreScans({ bonus: MAX_CONTRIBUTION_SCANS_PER_DAY - 1 })).toBe(true)
        expect(canEarnMoreScans({ bonus: MAX_CONTRIBUTION_SCANS_PER_DAY })).toBe(false)
    })

    it('stays true when the status is unknown, so the free option is not hidden by mistake', () => {
        expect(canEarnMoreScans(null)).toBe(true)
    })
})
