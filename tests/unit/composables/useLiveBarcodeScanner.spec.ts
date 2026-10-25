import { describe, it, expect, vi, beforeEach } from 'vitest'

let releasePermission: (v: { camera: string }) => void
const startScan = vi.fn().mockResolvedValue(undefined)

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}))
vi.mock('html5-qrcode', () => ({ Html5Qrcode: vi.fn(), Html5QrcodeSupportedFormats: {} }))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: vi.fn() } }))
vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeFormat: {},
  BarcodeScanner: {
    isSupported: vi.fn().mockResolvedValue({ supported: true }),
    checkPermissions: vi.fn(() => new Promise((r) => { releasePermission = r })),
    requestPermissions: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
    startScan: (...a: unknown[]) => startScan(...a),
    stopScan: vi.fn().mockResolvedValue(undefined),
    isTorchAvailable: vi.fn().mockResolvedValue({ available: false }),
  },
}))

import { useLiveBarcodeScanner } from '@/composables/useLiveBarcodeScanner'

describe('useLiveBarcodeScanner start/stop race', () => {
  beforeEach(() => {
    document.body.className = ''
    startScan.mockClear()
  })

  it('does not hide the WebView if stop() ran while start() awaited permissions', async () => {
    const scanner = useLiveBarcodeScanner()
    const starting = scanner.start('reader', () => {})
    await Promise.resolve()
    await Promise.resolve()

    await scanner.stop()
    releasePermission({ camera: 'granted' })
    await starting

    expect(document.body.classList.contains('barcode-scanner-active')).toBe(false)
    expect(startScan).not.toHaveBeenCalled()
  })

  it('hides the WebView normally when not stopped', async () => {
    const scanner = useLiveBarcodeScanner()
    const starting = scanner.start('reader', () => {})
    await Promise.resolve()
    await Promise.resolve()
    releasePermission({ camera: 'granted' })
    await starting

    expect(document.body.classList.contains('barcode-scanner-active')).toBe(true)
    expect(startScan).toHaveBeenCalled()
  })
})
