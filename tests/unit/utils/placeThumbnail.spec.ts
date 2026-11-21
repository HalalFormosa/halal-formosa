import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upload, from, resizeImage } = vi.hoisted(() => {
  const upload = vi.fn()
  return { upload, from: vi.fn(() => ({ upload })), resizeImage: vi.fn() }
})

vi.mock('@/plugins/supabaseClient', () => ({ supabase: { storage: { from } } }))
vi.mock('@/composables/useImageResizer', () => ({ useImageResizer: () => ({ resizeImage }) }))

import { uploadPlaceCardThumb } from '@/utils/placeThumbnail'

describe('uploadPlaceCardThumb', () => {
  const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
  const thumb = new File(['t'], 'image.jpg', { type: 'image/jpeg' })

  beforeEach(() => {
    vi.clearAllMocks()
    resizeImage.mockResolvedValue(thumb)
    upload.mockResolvedValue({ error: null })
  })

  it('uploads a 640px thumbnail beside the _full image', async () => {
    await uploadPlaceCardThumb('u1/cafe/123_ab12_full.jpg', file)

    expect(resizeImage).toHaveBeenCalledWith(file, 640, 0.65)
    expect(from).toHaveBeenCalledWith('location-image')
    expect(upload).toHaveBeenCalledWith(
      'u1/cafe/123_ab12_thumb.jpg',
      thumb,
      expect.objectContaining({ upsert: false, contentType: 'image/jpeg' })
    )
  })

  it('does nothing for a path without the _full marker', async () => {
    await uploadPlaceCardThumb('u1/cafe/123_ab12.jpg', file)
    expect(resizeImage).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('never throws when resizing or uploading fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    resizeImage.mockRejectedValueOnce(new Error('decode failed'))
    await expect(uploadPlaceCardThumb('a/b/1_x_full.jpg', file)).resolves.toBeUndefined()

    upload.mockResolvedValueOnce({ error: { message: 'quota' } })
    await expect(uploadPlaceCardThumb('a/b/1_x_full.jpg', file)).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
