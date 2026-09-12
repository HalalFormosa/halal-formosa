// dHash (difference hash): a coarse 64-bit fingerprint of an image's shape,
// robust to re-compression/resizing but not meant to catch genuinely
// different photos. Used to flag "this looks like the same product photo"
// during admin duplicate review — see
// supabase/migrations/20260912000000_add_product_image_similarity.sql, which
// stores/compares this as a `bigint` column via Hamming distance.

const HASH_WIDTH = 9
const HASH_HEIGHT = 8

async function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  const isRemote = typeof source === 'string'
  const url = isRemote ? source : URL.createObjectURL(source)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      if (isRemote) img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image for hashing'))
      img.src = url
    })
  } finally {
    if (!isRemote) URL.revokeObjectURL(url)
  }
}

/**
 * Computes a 64-bit difference hash and returns it as the base-10 string of
 * its two's-complement signed form — matching how `image_hash bigint` is
 * stored in and compared by Postgres. Always recompute from the actual image
 * rather than reading a previously-stored hash back into JS: Postgres bigint
 * values come back through PostgREST as JSON numbers, which silently lose
 * precision outside ±2^53 and would desync the hash from its own image.
 */
export async function computeImageHash(source: File | Blob | string): Promise<string> {
  const img = await loadImageElement(source)

  const canvas = document.createElement('canvas')
  canvas.width = HASH_WIDTH
  canvas.height = HASH_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, HASH_WIDTH, HASH_HEIGHT)

  const { data } = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT)
  const gray = new Array<number>(HASH_WIDTH * HASH_HEIGHT)
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }

  let hash = 0n
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = gray[row * HASH_WIDTH + col]
      const right = gray[row * HASH_WIDTH + col + 1]
      hash = (hash << 1n) | (left > right ? 1n : 0n)
    }
  }

  // Reinterpret the unsigned 64-bit pattern as Postgres bigint's signed
  // two's-complement range (-2^63..2^63-1) so it round-trips exactly.
  if (hash >= 1n << 63n) hash -= 1n << 64n
  return hash.toString()
}

/**
 * Fetches a (CORS-enabled) image URL and hashes it. Returns null instead of
 * throwing on failure — a CORS-blocked or missing legacy photo shouldn't
 * break the review flow, since this is always a best-effort signal.
 */
export async function computeImageHashFromUrl(url: string): Promise<string | null> {
  try {
    return await computeImageHash(url)
  } catch {
    return null
  }
}
