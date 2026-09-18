import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning'
import { Html5Qrcode } from 'html5-qrcode'

const SUPPORTED_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
  BarcodeFormat.QrCode,
]

/**
 * Decodes a barcode from an image File using html5-qrcode. Needs a DOM element
 * for the library to (invisibly) render into, so one is created/torn down here
 * rather than relying on a template ref that may not exist on every screen.
 */
async function decodeBarcodeFromFileWeb(file: File): Promise<string | null> {
  const elId = `barcode-file-scan-${Date.now()}`
  const el = document.createElement('div')
  el.id = elId
  el.style.display = 'none'
  document.body.appendChild(el)

  const html5QrCode = new Html5Qrcode(elId, { verbose: false })
  try {
    const decodedText = await html5QrCode.scanFile(file, false)
    return decodedText
  } finally {
    try {
      await html5QrCode.clear()
    } catch {
      // ignore cleanup errors
    }
    el.remove()
  }
}

/**
 * Opens the native photo gallery, or a web file picker, and decodes any
 * barcode/QR code found in the chosen image.
 *
 * Returns the raw decoded value, or null if the user cancelled or no
 * barcode could be found in the picked image.
 */
export async function pickAndDecodeBarcodeFromGallery(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const image = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    })

    if (!image.path) return null

    try {
      const { barcodes } = await BarcodeScanner.readBarcodesFromImage({
        path: image.path,
        formats: SUPPORTED_FORMATS,
      })
      if (barcodes[0]?.rawValue) return barcodes[0].rawValue
    } catch (e) {
      // ML Kit's on-device barcode module can be missing/not-yet-downloaded
      // on some devices — fall through to the ZXing-based decoder below
      // rather than failing outright.
      console.warn('⚠️ [BarcodeImageScan] ML Kit read failed, falling back to ZXing:', e)
    }

    // Fallback: ML Kit found nothing (or errored) — retry with the ZXing-based
    // decoder (html5-qrcode), which uses a different algorithm and is more
    // tolerant of small/clean synthetic barcode images (e.g. screenshots).
    if (!image.webPath) return null
    try {
      const blob = await fetch(image.webPath).then((r) => r.blob())
      const file = new File([blob], `gallery-barcode-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
      return await decodeBarcodeFromFileWeb(file)
    } catch (e) {
      console.warn('⚠️ [BarcodeImageScan] ZXing fallback also failed:', e)
      return null
    }
  }

  // Web: prompt the user for an image file via a throwaway <input type="file">.
  // Dismissing the picker without choosing a file fires no 'change' event in
  // most browsers, so without the extra listeners below the promise would
  // hang forever and the caller's "reading image..." state would get stuck.
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'

    let settled = false
    const settle = (result: File | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onWindowFocus)
      input.remove()
      resolve(result)
    }

    // Chromium supports a native 'cancel' event on <input type="file">.
    input.addEventListener('cancel', () => settle(null))

    // Fallback for browsers/webviews without a 'cancel' event: once the
    // window regains focus after the picker closes, give 'change' a brief
    // moment to fire first, then treat "no file chosen" as a cancel.
    function onWindowFocus() {
      setTimeout(() => settle(input.files?.[0] ?? null), 300)
    }
    window.addEventListener('focus', onWindowFocus)

    input.onchange = () => settle(input.files?.[0] ?? null)

    document.body.appendChild(input)
    input.click()
  })

  if (!file) return null

  return decodeBarcodeFromFileWeb(file)
}
