import { describe, it, expect } from 'vitest'
import { blobToBase64 } from '@/utils/imageHelpers'

describe('imageHelpers', () => {
    it('should convert a Blob to base64 string', async () => {
        const dummyBlob = new Blob(['hello'], { type: 'text/plain' })
        const base64 = await blobToBase64(dummyBlob)
        // 'hello' in base64 is 'aGVsbG8='
        expect(base64).toBe('aGVsbG8=')
    })
})
