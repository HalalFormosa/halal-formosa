// Creates <folder>/front_thumb.jpg (next to each product's front.jpg) for products whose thumbnail is missing.
// Matches the app's makeThumbnail(): 500x500 square cover-crop, JPEG quality 65.
//
// Dry run (lists what is missing; read-only, the anon key is enough):
//   SUPABASE_ANON_KEY=... node scripts/backfill-missing-thumbs.mjs
// Apply (uploads the missing thumbnails; needs the service role key):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-missing-thumbs.mjs --apply
//
// Options: --limit=N (only first N missing), --include-unapproved
// Never overwrites an existing thumbnail. Never prints keys.
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const URL_ = process.env.SUPABASE_URL || 'https://svmlwnzmheiishkdwafk.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = SERVICE || process.env.SUPABASE_ANON_KEY
const APPLY = process.argv.includes('--apply')
const INCLUDE_UNAPPROVED = process.argv.includes('--include-unapproved')
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity
const BUCKET = 'product-images'
const SIZE = 500
const QUALITY = 65
const CONCURRENCY = 8

if (!KEY) {
    console.error('Set SUPABASE_ANON_KEY (dry run) or SUPABASE_SERVICE_ROLE_KEY (--apply).')
    process.exit(1)
}
if (APPLY && !SERVICE) {
    console.error('--apply needs SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
}

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } })

async function fetchProducts() {
    const rows = []
    for (let from = 0; ; from += 1000) {
        let q = supabase
            .from('products')
            .select('barcode, photo_front_url, approved')
            .not('photo_front_url', 'is', null)
            .order('created_at', { ascending: true })
            .range(from, from + 999)
        if (!INCLUDE_UNAPPROVED) q = q.eq('approved', true)
        const { data, error } = await q
        if (error) throw error
        rows.push(...data)
        if (data.length < 1000) break
    }
    return rows
}

// Path of front.jpg inside the bucket, taken from the stored public URL. The folder is not
// always the product's barcode (merged / re-keyed products keep their old folder), and the app
// derives the thumbnail address from this same path (front.jpg -> front_thumb.jpg).
function frontPath(url) {
    const m = String(url).match(/\/product-images\/([^?]+)/)
    return m ? decodeURIComponent(m[1]) : null
}

function thumbPath(url) {
    const path = frontPath(url)
    return path && /\/front\.jpg$/.test(path) ? path.replace(/front\.jpg$/, 'front_thumb.jpg') : null
}

async function hasThumb(url) {
    const tp = thumbPath(url)
    if (!tp) return true // not a front.jpg URL: the app does not rewrite it, nothing to backfill
    const res = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${tp.split('/').map(encodeURIComponent).join('/')}`, { method: 'HEAD' })
    return res.ok
}

async function mapLimit(items, n, fn) {
    const out = []
    let i = 0
    await Promise.all(Array.from({ length: n }, async () => {
        while (i < items.length) {
            const idx = i++
            out[idx] = await fn(items[idx], idx)
        }
    }))
    return out
}

const products = await fetchProducts()
console.log(`Checking ${products.length} products for a missing front_thumb.jpg...`)

const flags = await mapLimit(products, CONCURRENCY, p => hasThumb(p.photo_front_url))
const missing = products.filter((_, i) => !flags[i]).slice(0, LIMIT)
console.log(`Missing thumbnails: ${missing.length}`)
for (const p of missing) console.log(`  ${p.barcode}  ${thumbPath(p.photo_front_url)}`)

if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply (and the service role key) to create them.')
    process.exit(0)
}

let ok = 0, failed = 0
for (const p of missing) {
    try {
        const path = frontPath(p.photo_front_url)
        if (!path) throw new Error('cannot parse photo_front_url')
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
        if (dlErr) throw dlErr
        const input = Buffer.from(await blob.arrayBuffer())
        const thumb = await sharp(input)
            .rotate() // honour EXIF orientation like the browser does
            .resize(SIZE, SIZE, { fit: 'cover', position: 'centre', withoutEnlargement: false })
            .jpeg({ quality: QUALITY })
            .toBuffer()
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(thumbPath(p.photo_front_url), thumb, {
            upsert: false, // never overwrite
            contentType: 'image/jpeg',
            cacheControl: '31536000',
        })
        if (upErr) throw upErr
        ok++
        console.log(`  ok   ${p.barcode} (${thumb.length} bytes)`)
    } catch (e) {
        failed++
        console.warn(`  FAIL ${p.barcode}: ${e.message || e}`)
    }
}
console.log(`\nDone. Created ${ok}, failed ${failed}.`)
process.exit(failed ? 1 : 0)
