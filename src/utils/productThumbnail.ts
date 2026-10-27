// src/utils/productThumbnail.ts
import { supabase } from '@/plugins/supabaseClient'
import { useImageResizer } from '@/composables/useImageResizer'

// Stores <barcode>/front_thumb.jpg next to <barcode>/front.jpg so list and
// grid slots can load a small file without Supabase's per-image transform
// billing. Best-effort: a failed thumbnail must never block the product save
// (getOptimizedImageUrl falls back to the original when the thumb is missing).
export async function uploadProductFrontThumb(barcode: string, frontFile: File | Blob): Promise<void> {
    try {
        const { makeThumbnail } = useImageResizer()
        const thumb = await makeThumbnail(frontFile as File)
        const { error } = await supabase.storage
            .from('product-images')
            .upload(`${barcode}/front_thumb.jpg`, thumb, {
                upsert: true,
                contentType: 'image/jpeg',
                cacheControl: '31536000',
            })
        if (error) console.warn('⚠️ Thumbnail upload failed:', error.message)
    } catch (err) {
        console.warn('⚠️ Thumbnail creation failed:', err)
    }
}
