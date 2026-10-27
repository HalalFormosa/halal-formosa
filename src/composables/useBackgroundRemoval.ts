import { ref } from 'vue';
import * as ort from 'onnxruntime-web/wasm';
// Relative paths on purpose: the package's "exports" map does not expose dist/*, but Vite can still
// emit these as hashed assets (they are only fetched when background removal is first used).
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import loaderUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import { useImageResizer } from '@/composables/useImageResizer';
import { MODEL_SIZE, rgbaToTensorData, predictionToAlpha, alphaToRgba } from '@/utils/bgRemoval';

// On-device background removal: U²-Net "u2netp" (~4.6 MB, shipped in /public/models) run with
// onnxruntime-web (MIT). See THIRD_PARTY_NOTICES.md for model attribution.
const MODEL_URL = '/models/u2netp.onnx';

// No cross-origin isolation in the app webview, so run single-threaded.
ort.env.wasm.numThreads = 1;

let runtimeReady: Promise<void> | null = null;

// The runtime dynamically imports its loader script. App webviews can serve unknown extensions such
// as .mjs without a JavaScript MIME type, which blocks module imports, so fetch the loader and import
// it from a Blob URL that we label correctly ourselves.
function configureRuntime(): Promise<void> {
  if (!runtimeReady) {
    runtimeReady = (async () => {
      const code = await (await fetch(loaderUrl)).text();
      const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      ort.env.wasm.wasmPaths = { mjs: blobUrl, wasm: wasmUrl };
    })().catch((err) => {
      runtimeReady = null;
      throw err;
    });
  }
  return runtimeReady;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = configureRuntime().then(() => ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })).catch((err) => {
      sessionPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return sessionPromise;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for background removal'));
    };
    img.src = url;
  });
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get 2d canvas context');
  return [canvas, ctx];
}

/** Runs the model on the photo and returns the subject mask (0..255) at MODEL_SIZE x MODEL_SIZE. */
async function predictMask(img: HTMLImageElement): Promise<Uint8ClampedArray> {
  const [, ctx] = makeCanvas(MODEL_SIZE, MODEL_SIZE);
  ctx.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE); // stretched, as the model expects
  const { data } = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);

  const session = await getSession();
  const input = new ort.Tensor('float32', rgbaToTensorData(data), [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const output = await session.run({ [session.inputNames[0]]: input });
  return predictionToAlpha(output[session.outputNames[0]].data as Float32Array);
}

export function useBackgroundRemoval() {
  const isProcessing = ref(false);
  const progressPercent = ref(0);
  const progressStatus = ref('');
  const { resizeImage } = useImageResizer();

  /**
   * Loads the model into memory in the background.
   * Call this on component mount so background removal is quick when clicked.
   */
  async function preloadAIModel() {
    try {
      await getSession();
      console.log('⚡ AI Background Removal model (u2netp) preloaded successfully!');
    } catch (err) {
      console.warn('⚠️ AI preload warning (will load on demand):', err);
    }
  }

  async function getOptimizedSource(source: string | File | Blob): Promise<Blob> {
    // 1. Convert string URL or Blob to a File object for the resizer
    let fileObj: File;
    if (typeof source === 'string') {
      const res = await fetch(source);
      const blob = await res.blob();
      fileObj = new File([blob], 'temp.jpg', { type: blob.type || 'image/jpeg' });
    } else if (source instanceof Blob && !(source instanceof File)) {
      fileObj = new File([source], 'temp.jpg', { type: source.type || 'image/jpeg' });
    } else {
      fileObj = source as File;
    }

    // 2. Pre-scale image to max 800px width/height.
    // Reducing pixel count by 70-85% speeds up AI inference exponentially while maintaining high quality.
    try {
      return await resizeImage(fileObj, 800, 0.85);
    } catch (e) {
      console.warn('⚠️ Pre-scale failed, using original source for AI:', e);
      return fileObj;
    }
  }

  /**
   * Removes background from an image source and composites the subject onto a solid white canvas.
   * Returns a high-quality JPEG File object and a Data URL preview.
   */
  async function removeAndAddWhiteBg(
    source: string | File | Blob,
    fileName = 'product_clean.jpg'
  ): Promise<{ file: File; previewUrl: string }> {
    isProcessing.value = true;
    progressPercent.value = 10;
    progressStatus.value = 'Optimizing image for AI...';

    try {
      const inputBlob = await getOptimizedSource(source);
      const img = await loadImage(inputBlob);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      progressStatus.value = 'Loading AI model...';
      progressPercent.value = 25;
      await getSession();

      progressStatus.value = 'Removing background via AI...';
      progressPercent.value = 45;
      // Yield to the browser event loop before WASM locks the main thread
      await new Promise(r => setTimeout(r, 50));
      const alpha = await predictMask(img);

      progressStatus.value = 'Applying white background...';
      progressPercent.value = 85;

      // Mask at model size -> scaled up to the photo size and used to cut out the subject
      const [maskCanvas, maskCtx] = makeCanvas(MODEL_SIZE, MODEL_SIZE);
      maskCtx.putImageData(new ImageData(alphaToRgba(alpha) as Uint8ClampedArray<ArrayBuffer>, MODEL_SIZE, MODEL_SIZE), 0, 0);

      const [cutCanvas, cutCtx] = makeCanvas(width, height);
      cutCtx.drawImage(img, 0, 0, width, height);
      cutCtx.globalCompositeOperation = 'destination-in';
      cutCtx.imageSmoothingEnabled = true;
      cutCtx.imageSmoothingQuality = 'high';
      cutCtx.drawImage(maskCanvas, 0, 0, width, height);

      // 1. Fill solid white background, 2. draw the cut-out subject on top
      const [canvas, ctx] = makeCanvas(width, height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(cutCanvas, 0, 0);

      // 3. Export to JPEG Blob
      const jpegBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to encode canvas to JPEG'));
          },
          'image/jpeg',
          0.92
        );
      });

      const file = new File([jpegBlob], fileName, { type: 'image/jpeg' });
      const previewUrl = canvas.toDataURL('image/jpeg', 0.92);

      progressStatus.value = 'Complete!';
      progressPercent.value = 100;
      return { file, previewUrl };
    } catch (error) {
      console.error('❌ Error during background removal:', error);
      throw error;
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    isProcessing,
    progressPercent,
    progressStatus,
    preloadAIModel,
    removeAndAddWhiteBg,
  };
}
