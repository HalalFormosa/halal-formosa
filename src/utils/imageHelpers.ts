// src/utils/imageHelpers.ts
// --- helpers ---
export function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
        img.onerror = reject
        img.src = url
    })
}
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w/2, h/2)
    ctx.beginPath()
    ctx.moveTo(x+rr, y)
    ctx.arcTo(x+w, y, x+w, y+h, rr)
    ctx.arcTo(x+w, y+h, x, y+h, rr)
    ctx.arcTo(x, y+h, x, y, rr)
    ctx.arcTo(x, y, x+w, y, rr)
    ctx.closePath()
}

export function blobToBase64(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(((r.result as string) || '').split(',')[1] || '')
        r.onerror = reject
        r.readAsDataURL(file)
    })
}

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/150x150.webp?text=No+Photo'

// Flip to true only once every existing product has a front_thumb.jpg (all 2,107 did as of
// 2026-10-27, and new uploads create one), otherwise a product without one would show a broken
// image instead of falling back to the transform.
const USE_STORED_PRODUCT_THUMBS = true

// Requests a downsized/compressed rendition from Supabase Storage's image
// transform endpoint instead of shipping the full ~1000px upload for a
// thumbnail-sized slot — the main win on slow connections. Falls back to
// the original URL untouched for anything that isn't one of our storage
// object URLs (e.g. the placeholder).
//
// Both width AND height must be passed: giving the transform only a width
// does NOT scale proportionally — it silently returns the image cropped to
// that width while keeping the full original height, producing a mangled
// sliver instead of a resize.
export function getOptimizedImageUrl(
    url: string | undefined | null,
    width: number,
    height: number,
    resize: 'contain' | 'cover' = 'contain',
    quality = 60
): string {
    if (!url) return PLACEHOLDER_IMAGE
    if (!url.includes('/storage/v1/object/public/')) return url

    // Product fronts have a stored 500px thumbnail (front_thumb.jpg, written at
    // upload and by the backfill script) — serving it costs nothing, unlike the
    // per-image-billed transform below.
    if (USE_STORED_PRODUCT_THUMBS && /\/product-images\/[^/]+\/front\.jpg(\?|$)/.test(url)) {
        return url.replace('/front.jpg', '/front_thumb.jpg')
    }

    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const separator = transformed.includes('?') ? '&' : '?'
    return `${transformed}${separator}width=${width}&height=${height}&resize=${resize}&quality=${quality}`
}

// ---- Place (Explore card) images -------------------------------------------------------
// New place photos are uploaded as <name>_full.jpg plus a small <name>_thumb.jpg beside it
// (see uploadPlaceCardThumb). Cards load the thumbnail. Photos uploaded before this change
// have no "_full" marker, so they pass through untouched — no 404s, no transform billing.
const PLACE_FULL_RE = /\/location-image\/.+_full\.jpg(\?|$)/
const PLACE_THUMB_RE = /\/location-image\/.+_thumb\.jpg(\?|$)/

/** Storage path of the thumbnail that belongs to a `..._full.jpg` path, or null if it isn't one. */
export function placeThumbPath(fullPath: string): string | null {
    return /_full\.jpg$/.test(fullPath) ? fullPath.replace(/_full\.jpg$/, '_thumb.jpg') : null
}

/** URL to show on a card: the stored thumbnail for new uploads, the original URL otherwise. */
export function getPlaceCardImage(url: string | undefined | null): string | undefined | null {
    if (!url || !PLACE_FULL_RE.test(url)) return url
    return url.replace(/_full\.jpg(\?|$)/, '_thumb.jpg$1')
}

/** If a card's thumbnail failed to load, the full-size URL to retry with (else null). */
export function placeThumbFallbackUrl(src: string): string | null {
    return PLACE_THUMB_RE.test(src) ? src.replace(/_thumb\.jpg(\?|$)/, '_full.jpg$1') : null
}

// If a product's stored thumbnail is missing (front_thumb.jpg 404s), retry once with the
// original front.jpg so the card shows the photo instead of broken-image alt text.
export function onProductImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null
    if (!img || img.dataset.thumbFallback === '1') return
    if (!/\/front_thumb\.jpg(\?|$)/.test(img.src)) return
    img.dataset.thumbFallback = '1'
    img.src = img.src.replace('/front_thumb.jpg', '/front.jpg')
}
