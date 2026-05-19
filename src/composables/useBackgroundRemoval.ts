import { ref } from 'vue';
import { removeBackground, preload, Config } from '@imgly/background-removal';
import { useImageResizer } from '@/composables/useImageResizer';

// Global flag to ensure we only preload once per session
let isModelPreloaded = false;

export function useBackgroundRemoval() {
  const isProcessing = ref(false);
  const progressPercent = ref(0);
  const progressStatus = ref('');
  const { resizeImage } = useImageResizer();

  const aiConfig: Config = {
    debug: false,
    model: 'isnet_quint8', // 8-bit quantized model: ~1/4 size, drastically faster inference
    output: {
      format: 'image/png',
      quality: 0.85,
    },
    progress: (key: string, current: number, total: number) => {
      if (total > 0) {
        const base = key.startsWith('fetch') ? 10 : 40;
        const max = key.startsWith('fetch') ? 40 : 85;
        const pct = Math.round((current / total) * (max - base)) + base;
        progressPercent.value = Math.min(pct, 100);
        if (key.startsWith('fetch')) {
          progressStatus.value = `Downloading AI models (${Math.round((current / total) * 100)}%)...`;
        } else {
          progressStatus.value = `Processing AI (${progressPercent.value}%)...`;
        }
      } else {
        progressStatus.value = 'Analyzing image...';
        progressPercent.value = Math.min(progressPercent.value + 4, 80);
      }
    },
  };

  /**
   * Preloads the AI model into browser memory in the background.
   * Call this on component mount so background removal is instant when clicked.
   */
  async function preloadAIModel() {
    if (isModelPreloaded) return;
    try {
      await preload(aiConfig);
      isModelPreloaded = true;
      console.log('⚡ AI Background Removal model (isnet_quint8) preloaded successfully!');
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

    let simTimer: any = null;

    try {
      const inputBlob = await getOptimizedSource(source);

      progressStatus.value = 'Removing background via AI...';
      progressPercent.value = 20;

      simTimer = setInterval(() => {
        if (progressPercent.value < 85) {
          progressPercent.value = Math.min(progressPercent.value + 2, 85);
        }
      }, 80);

      // Yield to browser event loop before WASM locks main thread
      await new Promise(r => setTimeout(r, 50));
      const transparentBlob = await removeBackground(inputBlob, aiConfig);

      if (simTimer) clearInterval(simTimer);
      if (!transparentBlob) throw new Error('Background removal returned empty result');

      progressStatus.value = 'Applying white background...';
      progressPercent.value = 90;
      const img = await createImageBitmap(transparentBlob);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2d canvas context');

      // 1. Fill solid white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw the transparent product image on top
      ctx.drawImage(img, 0, 0);

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
      if (simTimer) clearInterval(simTimer);
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
