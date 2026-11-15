import { describe, it, expect } from 'vitest'
import { MODEL_SIZE, rgbaToTensorData, predictionToAlpha, alphaToRgba } from '@/utils/bgRemoval'

const PLANE = MODEL_SIZE * MODEL_SIZE

describe('bgRemoval helpers', () => {
    it('builds a normalised NCHW tensor, scaling by the image maximum', () => {
        // every pixel is (255, 0, 0): after max-scaling R=1, G=0, B=0
        const rgba = new Uint8ClampedArray(PLANE * 4)
        for (let i = 0; i < PLANE; i++) { rgba[i * 4] = 255; rgba[i * 4 + 3] = 255 }
        const t = rgbaToTensorData(rgba)
        expect(t.length).toBe(3 * PLANE)
        expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 5)              // R plane
        expect(t[PLANE]).toBeCloseTo((0 - 0.456) / 0.224, 5)          // G plane
        expect(t[2 * PLANE]).toBeCloseTo((0 - 0.406) / 0.225, 5)      // B plane
        expect(t[PLANE - 1]).toBeCloseTo(t[0], 5)                     // plane layout is contiguous per channel
    })

    it('does not divide by zero on an all-black image', () => {
        const t = rgbaToTensorData(new Uint8ClampedArray(PLANE * 4))
        expect(Number.isFinite(t[0])).toBe(true)
    })

    it('min-max normalises the prediction to 0..255', () => {
        const pred = new Float32Array(PLANE).fill(0.2)
        pred[0] = 0.1
        pred[1] = 0.9
        const a = predictionToAlpha(pred)
        expect(a[0]).toBe(0)
        expect(a[1]).toBe(255)
        expect(a[2]).toBe(Math.round(((0.2 - 0.1) / 0.8) * 255))
    })

    it('handles a flat prediction without NaN', () => {
        const a = predictionToAlpha(new Float32Array(PLANE).fill(0.5))
        expect(a[0]).toBe(0)
        expect(a.every(v => v === 0)).toBe(true)
    })

    it('turns alpha values into white RGBA pixels carrying the mask', () => {
        const rgba = alphaToRgba([0, 128, 255])
        expect(Array.from(rgba)).toEqual([255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255])
    })
})
