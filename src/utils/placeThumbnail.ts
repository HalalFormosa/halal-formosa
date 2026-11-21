// src/utils/placeThumbnail.ts
import { supabase } from '@/plugins/supabaseClient'
import { useImageResizer } from '@/composables/useImageResizer'
import { placeThumbPath } from '@/utils/imageHelpers'

// Card-sized width: the Explore card is shown well under this on phones.
const THUMB_WIDTH = 640
const THUMB_QUALITY = 0.65

// Stores <name>_thumb.jpg next to <name>_full.jpg in the location-image bucket so Explore
// cards can load a small file without Supabase's per-image transform billing. Aspect ratio
// is kept (not cropped), so the card frames the photo exactly as the original would.
// Best-effort: a failed thumbnail must never block saving the place (cards fall back to the
// full image when the thumbnail is missing).
export async function uploadPlaceCardThumb(fullPath: string, file: File | Blob): Promise<void> {
    const thumbPath = placeThumbPath(fullPath)
    if (!thumbPath) return
    try {
        const { resizeImage } = useImageResizer()
        const thumb = await resizeImage(file as File, THUMB_WIDTH, THUMB_QUALITY)
        const { error } = await supabase.storage
            .from('location-image')
            .upload(thumbPath, thumb, {
                upsert: false,
                contentType: 'image/jpeg',
                cacheControl: '31536000',
            })
        if (error) console.warn('⚠️ Place thumbnail upload failed:', error.message)
    } catch (err) {
        console.warn('⚠️ Place thumbnail creation failed:', err)
    }
}
