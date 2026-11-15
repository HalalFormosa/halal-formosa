import { describe, it, expect } from 'vitest'
import { blobToBase64, onProductImageError } from '@/utils/imageHelpers'

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
