// Pure helpers for on-device background removal with the U²-Net (u2netp) model.
// Kept free of DOM and ONNX imports so they can be unit-tested in plain Node.
// Pre/post-processing follows the reference U²-Net / rembg pipeline.

export const MODEL_SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/**
 * RGBA pixels of the photo stretched to MODEL_SIZE x MODEL_SIZE -> normalised NCHW float tensor data.
 * Pixel values are first scaled by the image's own maximum (as the reference pipeline does).
 */
export function rgbaToTensorData(rgba: ArrayLike<number>, size = MODEL_SIZE): Float32Array {
    const plane = size * size
    let max = 1
    for (let i = 0; i < plane; i++) {
        const o = i * 4
        if (rgba[o] > max) max = rgba[o]
        if (rgba[o + 1] > max) max = rgba[o + 1]
        if (rgba[o + 2] > max) max = rgba[o + 2]
    }
    const out = new Float32Array(3 * plane)
    for (let i = 0; i < plane; i++) {
        const o = i * 4
        for (let c = 0; c < 3; c++) {
            out[c * plane + i] = (rgba[o + c] / max - MEAN[c]) / STD[c]
        }
    }
    return out
}

/** Model output (any range) -> 0..255 alpha values, min-max normalised like the reference pipeline. */
export function predictionToAlpha(pred: ArrayLike<number>, size = MODEL_SIZE): Uint8ClampedArray {
    const plane = size * size
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < plane; i++) {
        if (pred[i] < lo) lo = pred[i]
        if (pred[i] > hi) hi = pred[i]
    }
    const range = hi - lo || 1
    const alpha = new Uint8ClampedArray(plane)
    for (let i = 0; i < plane; i++) alpha[i] = Math.round(((pred[i] - lo) / range) * 255)
    return alpha
}

/** Alpha values -> RGBA pixels (white, with the mask as alpha) ready for putImageData onto a canvas. */
export function alphaToRgba(alpha: ArrayLike<number>): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(alpha.length * 4)
    for (let i = 0; i < alpha.length; i++) {
        const o = i * 4
        rgba[o] = 255
        rgba[o + 1] = 255
        rgba[o + 2] = 255
        rgba[o + 3] = alpha[i]
    }
    return rgba
}
