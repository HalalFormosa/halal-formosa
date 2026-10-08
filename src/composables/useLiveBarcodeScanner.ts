import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner, BarcodeFormat, type Barcode } from '@capacitor-mlkit/barcode-scanning'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { ActivityLogService } from '@/services/ActivityLogService'

const MLKIT_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
  BarcodeFormat.QrCode,
]

const HTML5_QR_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
]

/**
 * Error codes `start()` can throw/report, used as `search.barcodeScan.<code>`
 * i18n keys by callers (see BarcodeScanOverlay.vue / BarcodeScanCamera.vue).
 */
export type BarcodeScanErrorCode =
  | 'unsupportedError'
  | 'moduleUnavailableError'
  | 'permissionError'
  | 'scanError'
  | 'cameraError'

class BarcodeScanStartError extends Error {
  constructor(public code: BarcodeScanErrorCode) {
    super(code)
  }
}

/** Maps any error thrown/emitted by this composable to an i18n key suffix. */
export function getBarcodeScanErrorCode(err: unknown): BarcodeScanErrorCode {
  if (err instanceof BarcodeScanStartError) return err.code
  return 'cameraError'
}

/**
 * Shared live-camera barcode scanning mechanics for full-screen custom
 * overlays (BarcodeScanOverlay/BarcodeScanCamera + AddProductView's step 1).
 *
 * Native: @capacitor-mlkit/barcode-scanning's startScan() renders the camera
 * as a native layer BELOW the WebView, so the caller's overlay must toggle
 * `body.barcode-scanner-active` (see theme/variables.css) for it to show
 * through, and must keep its own background transparent.
 *
 * Web: html5-qrcode renders a real <video> into the given container element.
 */
export function useLiveBarcodeScanner() {
  const isNative = Capacitor.isNativePlatform()
  const torchAvailable = ref(false)
  const torchOn = ref(false)

  let barcodeListenerHandle: { remove: () => Promise<void> } | null = null
  let scanErrorListenerHandle: { remove: () => Promise<void> } | null = null
  let html5QrCode: Html5Qrcode | null = null

  /**
   * @param onError Called for scan failures that happen *after* `start()`
   * has already resolved (the plugin's own `scanError` event) — e.g. the
   * ML Kit pipeline dying mid-session. Startup failures (missing module,
   * unsupported device, denied permission) instead reject the returned
   * promise, since the caller is already in a try/catch for that.
   */
  async function start(
    elementId: string,
    onDetected: (rawValue: string) => void,
    onError?: (code: BarcodeScanErrorCode) => void
  ) {
    if (isNative) {
      const { supported } = await BarcodeScanner.isSupported()
      if (!supported) throw new BarcodeScanStartError('unsupportedError')

      // On Android, ML Kit's barcode model is a separate module fetched via
      // Google Play Services on first use (and unavailable at all without
      // GMS) — startScan() would otherwise fail with an opaque native error.
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
        if (!available) {
          // Fire-and-forget: kicks off the download for next time, but this
          // attempt still needs to fail now so the caller can tell the user.
          BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {})
          throw new BarcodeScanStartError('moduleUnavailableError')
        }
      }

      const { camera } = await BarcodeScanner.checkPermissions()
      if (camera !== 'granted') {
        const { camera: newStatus } = await BarcodeScanner.requestPermissions()
        ActivityLogService.log('permission_result', { permission: 'camera', status: newStatus, source: 'barcode_scan' })
        if (newStatus !== 'granted') throw new BarcodeScanStartError('permissionError')
      }

      document.body.classList.add('barcode-scanner-active')

      barcodeListenerHandle = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        const barcode: Barcode | undefined = event.barcodes[0]
        if (barcode?.rawValue) onDetected(barcode.rawValue)
      })

      scanErrorListenerHandle = await BarcodeScanner.addListener('scanError', (event) => {
        console.error('❌ [useLiveBarcodeScanner] Native scan error:', event.message)
        onError?.('scanError')
      })

      try {
        await BarcodeScanner.startScan({ formats: MLKIT_FORMATS })
      } catch {
        document.body.classList.remove('barcode-scanner-active')
        await barcodeListenerHandle?.remove()
        await scanErrorListenerHandle?.remove()
        barcodeListenerHandle = null
        scanErrorListenerHandle = null
        throw new BarcodeScanStartError('cameraError')
      }

      try {
        const { available } = await BarcodeScanner.isTorchAvailable()
        torchAvailable.value = available
      } catch {
        torchAvailable.value = false
      }
    } else {
      html5QrCode = new Html5Qrcode(elementId, { verbose: false, formatsToSupport: HTML5_QR_FORMATS })
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 15 },
        (decodedText) => onDetected(decodedText),
        () => { /* silent per-frame miss */ }
      )
    }
  }

  async function stop() {
    if (isNative) {
      document.body.classList.remove('barcode-scanner-active')
      try {
        await BarcodeScanner.stopScan()
      } catch {
        // scan may never have started (e.g. permission denied) — nothing to stop
      }
      if (barcodeListenerHandle) {
        await barcodeListenerHandle.remove()
        barcodeListenerHandle = null
      }
      if (scanErrorListenerHandle) {
        await scanErrorListenerHandle.remove()
        scanErrorListenerHandle = null
      }
      torchAvailable.value = false
      torchOn.value = false
    } else if (html5QrCode) {
      try {
        if (html5QrCode.isScanning) await html5QrCode.stop()
        html5QrCode.clear()
      } catch (err) {
        console.warn('⚠️ [useLiveBarcodeScanner] Error stopping web scanner:', err)
      } finally {
        html5QrCode = null
      }
    }
  }

  async function toggleTorch() {
    try {
      await BarcodeScanner.toggleTorch()
      torchOn.value = !torchOn.value
    } catch (err) {
      console.warn('⚠️ [useLiveBarcodeScanner] Torch toggle failed:', err)
    }
  }

  return { isNative, torchAvailable, torchOn, start, stop, toggleTorch }
}
