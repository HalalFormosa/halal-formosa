import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    requestConsentInfo: vi.fn().mockResolvedValue(undefined),
    requestTrackingAuthorization: vi.fn().mockResolvedValue(undefined),
    createBanner: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    loadRewarded: vi.fn().mockResolvedValue(undefined),
    isRewardedReady: vi.fn().mockResolvedValue({ isReady: true }),
    showRewarded: vi.fn().mockResolvedValue(undefined),
    markAdFailed: vi.fn(),
    clearAdFailed: vi.fn(),
    markAdLoaded: vi.fn(),
    clearAdLoaded: vi.fn(),
}))

vi.mock('capacitor-levelplay-ads', () => ({
    LevelPlayAds: {
        initialize: mocks.initialize,
        requestConsentInfo: mocks.requestConsentInfo,
        requestTrackingAuthorization: mocks.requestTrackingAuthorization,
        createBanner: mocks.createBanner,
        addListener: mocks.addListener,
        loadRewarded: mocks.loadRewarded,
        isRewardedReady: mocks.isRewardedReady,
        showRewarded: mocks.showRewarded,
    },
    AdEvent: {
        BannerLoaded: 'bannerLoaded',
        BannerLoadFailed: 'bannerLoadFailed',
        BannerDisplayFailed: 'bannerDisplayFailed',
        RewardedRewarded: 'rewardedRewarded',
        RewardedClosed: 'rewardedClosed',
    },
}))

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
    },
}))

vi.mock('@/composables/useAdFallback', () => ({
    markAdFailed: mocks.markAdFailed,
    clearAdFailed: mocks.clearAdFailed,
    markAdLoaded: mocks.markAdLoaded,
    clearAdLoaded: mocks.clearAdLoaded,
}))

// levelplay.ts keeps module-level state (initPromise etc.), so re-import fresh
// for each test.
async function load() {
    vi.resetModules()
    return import('@/lib/levelplay')
}

describe('LevelPlay kill switch (VITE_LEVELPLAY_ENABLED)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    describe('disabled (= "false")', () => {
        beforeEach(() => vi.stubEnv('VITE_LEVELPLAY_ENABLED', 'false'))

        it('isLevelPlayEnabled() is false', async () => {
            const lp = await load()
            expect(lp.isLevelPlayEnabled()).toBe(false)
        })

        it('initLevelPlay() never initializes the SDK', async () => {
            const lp = await load()
            await lp.initLevelPlay()
            expect(mocks.initialize).not.toHaveBeenCalled()
            expect(mocks.requestConsentInfo).not.toHaveBeenCalled()
        })

        it('banner goes straight to the house-ad fallback', async () => {
            const lp = await load()
            await lp.showLevelPlayBanner('unit-id', 'search')
            expect(mocks.markAdFailed).toHaveBeenCalledWith('search')
            expect(mocks.initialize).not.toHaveBeenCalled()
            expect(mocks.createBanner).not.toHaveBeenCalled()
        })

        it('rewarded ad rejects with a clear error and never loads', async () => {
            const lp = await load()
            const onReward = vi.fn()
            await expect(lp.showLevelPlayRewardedAd('unit-id', onReward))
                .rejects.toThrow('LevelPlay is disabled')
            expect(mocks.initialize).not.toHaveBeenCalled()
            expect(mocks.loadRewarded).not.toHaveBeenCalled()
            expect(onReward).not.toHaveBeenCalled()
        })
    })

    describe.each([
        ['true', 'true'],
        ['unset', undefined],
    ])('enabled (%s)', (_label, value) => {
        beforeEach(() => {
            if (value !== undefined) vi.stubEnv('VITE_LEVELPLAY_ENABLED', value)
            else vi.stubEnv('VITE_LEVELPLAY_ENABLED', undefined as any)
        })

        it('isLevelPlayEnabled() is true', async () => {
            const lp = await load()
            expect(lp.isLevelPlayEnabled()).toBe(true)
        })

        it('initLevelPlay() initializes the SDK', async () => {
            const lp = await load()
            await lp.initLevelPlay()
            expect(mocks.initialize).toHaveBeenCalledTimes(1)
            expect(mocks.requestConsentInfo).toHaveBeenCalledTimes(1)
        })

        it('banner is created via LevelPlay and not immediately marked failed', async () => {
            const lp = await load()
            await lp.showLevelPlayBanner('unit-id', 'search')
            expect(mocks.createBanner).toHaveBeenCalledTimes(1)
            expect(mocks.markAdFailed).not.toHaveBeenCalled()
        })
    })
})
