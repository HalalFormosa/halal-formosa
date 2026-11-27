import { describe, it, expect } from 'vitest'
import {
    blobToBase64,
    getPlaceCardImage,
    onProductImageError,
    placeThumbFallbackUrl,
    placeThumbPath,
} from '@/utils/imageHelpers'

describe('place card images', () => {
    const base = 'https://x.supabase.co/storage/v1/object/public/location-image/u1/cafe/'

    it('swaps _full for _thumb on new-style place photos', () => {
        expect(getPlaceCardImage(base + '123_ab12_full.jpg')).toBe(base + '123_ab12_thumb.jpg')
        expect(getPlaceCardImage(base + '123_ab12_full.jpg?v=2')).toBe(base + '123_ab12_thumb.jpg?v=2')
    })

    it('leaves older photos, other buckets, external URLs and empty values untouched', () => {
        expect(getPlaceCardImage(base + '123_ab12.jpg')).toBe(base + '123_ab12.jpg')
        const other = 'https://x.supabase.co/storage/v1/object/public/product-images/4711/front.jpg'
        expect(getPlaceCardImage(other)).toBe(other)
        const google = 'https://lh3.googleusercontent.com/abc_full.jpg'
        expect(getPlaceCardImage(google)).toBe(google)
        expect(getPlaceCardImage(null)).toBeNull()
        expect(getPlaceCardImage('')).toBe('')
    })

    it('computes the thumbnail path for a _full path only', () => {
        expect(placeThumbPath('u1/cafe/1_a_full.jpg')).toBe('u1/cafe/1_a_thumb.jpg')
        expect(placeThumbPath('u1/cafe/1_a.jpg')).toBeNull()
    })

    it('falls back from a missing thumbnail to the full image', () => {
        expect(placeThumbFallbackUrl(base + '1_a_thumb.jpg?v=1')).toBe(base + '1_a_full.jpg?v=1')
        expect(placeThumbFallbackUrl(base + '1_a_full.jpg')).toBeNull()
        expect(placeThumbFallbackUrl(base + '1_a.jpg')).toBeNull()
    })
})

describe('imageHelpers', () => {
    it('should convert a Blob to base64 string', async () => {
        const dummyBlob = new Blob(['hello'], { type: 'text/plain' })
        const base64 = await blobToBase64(dummyBlob)
        // 'hello' in base64 is 'aGVsbG8='
        expect(base64).toBe('aGVsbG8=')
    })

    describe('onProductImageError', () => {
        const base = 'https://x.supabase.co/storage/v1/object/public/product-images/4711/'
        const fire = (src: string) => {
            const img = { src, dataset: {} as Record<string, string> } as unknown as HTMLImageElement
            onProductImageError({ target: img } as unknown as Event)
            return img
        }

        it('falls back from a missing thumbnail to the original front photo', () => {
            const img = fire(base + 'front_thumb.jpg?v=1')
            expect(img.src).toBe(base + 'front.jpg?v=1')
        })

        it('retries only once', () => {
            const img = fire(base + 'front_thumb.jpg')
            img.src = base + 'front_thumb.jpg'
            onProductImageError({ target: img } as unknown as Event)
            expect(img.src).toBe(base + 'front_thumb.jpg')
        })

        it('ignores images that are not product thumbnails', () => {
            const img = fire(base + 'back.jpg')
            expect(img.src).toBe(base + 'back.jpg')
        })
    })
})
