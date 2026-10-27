// One-off: create <barcode>/front_thumb.jpg (500x500 cover, q65) for every
// product that doesn't have one yet, so the app can stop using Supabase's
// per-image-billed storage transform (see src/utils/imageHelpers.ts).
//
//   npm i --no-save sharp
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/backfill-product-thumbs.mjs            # dry run, uploads nothing
//   ... node scripts/backfill-product-thumbs.mjs --apply  # create the thumbnails
//
// Safe to re-run: products that already have a thumbnail are skipped. The
// service-role key is read from the environment only — never commit it.
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
const apply = process.argv.includes('--apply')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const BUCKET = 'product-images'
const CONCURRENCY = 4

const barcodes = []
for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('products').select('barcode').not('photo_front_url', 'is', null).range(from, from + 999)
    if (error) throw error
    barcodes.push(...data.map((r) => r.barcode))
    if (data.length < 1000) break
}
console.log(`${barcodes.length} products with a front photo${apply ? '' : ' (dry run)'}`)

async function hasThumb(barcode) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${barcode}/front_thumb.jpg`)
    const res = await fetch(data.publicUrl, { method: 'HEAD' })
    return res.ok
}

let created = 0, skipped = 0, failed = 0
let next = 0
async function worker() {
    while (next < barcodes.length) {
        const barcode = barcodes[next++]
        try {
            if (await hasThumb(barcode)) { skipped++; continue }
            if (!apply) { created++; continue }
            const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(`${barcode}/front.jpg`)
            if (dlErr) throw dlErr
            const thumb = await sharp(Buffer.from(await blob.arrayBuffer()))
                .rotate()
                .resize(500, 500, { fit: 'cover' })
                .jpeg({ quality: 65 })
                .toBuffer()
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(`${barcode}/front_thumb.jpg`, thumb, {
                contentType: 'image/jpeg',
                cacheControl: '31536000',
                upsert: false,
            })
            if (upErr) throw upErr
            created++
        } catch (err) {
            failed++
            console.warn(`✗ ${barcode}: ${err.message ?? err}`)
        }
    }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`${apply ? 'created' : 'would create'}: ${created}, already had thumb: ${skipped}, failed: ${failed}`)
