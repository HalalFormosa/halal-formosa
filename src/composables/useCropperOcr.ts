// composables/useCropperOcr.ts
import { ref } from "vue"
import { useOcrService } from "@/composables/useOcrService"
import { useImageResizer } from "@/composables/useImageResizer"

export function useCropperOcr(options: any) {
    const { resizeImage } = useImageResizer()

    const cropperRef = ref<any>(null)
    const cropperSrc = ref<string | null>(null)
    const showCropper = ref(false)
    const croppedPreviewUrl = ref<string | null>(null)
    const ocrLoading = ref(false)

    const originalFile = ref<File | null>(null)
    const ocrRaw = ref("") // ✅ store raw OCR text

    // pipeline refs from OCR service
    const {
        processFile,
        recheckHighlightsSmart,
        ingredientHighlights,
        ingredientsText,
        ingredientsTextZh,
        autoStatus,
        productName,
        showOk,
        detectedLanguage,
        progress,
        progressLabel
    } = useOcrService(options)

    const pendingRoi = ref<any>(null)

    function openCropper(file: File, roi: any = null) {
        if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value)
        originalFile.value = file
        cropperSrc.value = URL.createObjectURL(file)
        showCropper.value = true
        pendingRoi.value = roi
        hasInitializedCoordinates.value = false // 🔄 Reset for new image
    }

    const stencilProps = ref({
        aspectRatio: null as number | null
    })

    const hasInitializedCoordinates = ref(false)

    function resetCoordinates(explicitRatio: number | null | undefined = undefined) {
        if (!cropperRef.value) return
        
        const roi = pendingRoi.value
        // Use provided ratio or fallback to current stencil state
        const ratio = explicitRatio !== undefined ? explicitRatio : stencilProps.value.aspectRatio

        // timeout is only needed on the very first load to wait for canvas initialization.
        // For ratio changes, we can be much faster or immediate.
        const delay = hasInitializedCoordinates.value ? 0 : 150;

        setTimeout(() => {
            if (!cropperRef.value) return;

            try {
                cropperRef.value.setCoordinates((coordinates: any, imageSize: any) => {
                    // 🛡️ Safety Guard: Ensure imageSize and coordinates provided by the library are accessible
                    if (!imageSize || typeof imageSize.width === 'undefined' || !coordinates) {
                        return coordinates; 
                    }
                    
                    console.log('📐 [Cropper] Resetting coordinates. Ratio:', ratio);
                    hasInitializedCoordinates.value = true;

                    if (roi) {
                        const width = (roi.width * imageSize.width) / 100;
                        const height = (roi.height * imageSize.height) / 100;
                        const left = (roi.left * imageSize.width) / 100;
                        const top = (roi.top * imageSize.height) / 100;
                        return { width, height, left, top };
                    } else {
                        // 🧠 [SMART DEFAULT] Center a large box based on the ratio
                        let sWidth = imageSize.width * 0.8;
                        let sHeight = imageSize.height * 0.45;

                        if (ratio && ratio > 0) {
                           // If we have a ratio, ensure sWidth/sHeight respect it
                           if (imageSize.width / imageSize.height > ratio) {
                              // Image is wider than ratio
                              sHeight = imageSize.height * 0.7;
                              sWidth = sHeight * ratio;
                           } else {
                              // Image is taller than ratio
                              sWidth = imageSize.width * 0.8;
                              sHeight = sWidth / ratio;
                           }
                        }

                        // 📐 Ensure coordinates are integers and within bounds
                        const finalWidth = Math.min(Math.floor(sWidth), imageSize.width);
                        const finalHeight = Math.min(Math.floor(sHeight), imageSize.height);
                        const sLeft = Math.max(0, Math.floor((imageSize.width - finalWidth) / 2));
                        const sTop = Math.max(0, Math.floor((imageSize.height - finalHeight) / 2));

                        return { width: finalWidth, height: finalHeight, left: sLeft, top: sTop };
                    }
                });
            } catch (err) {
                console.warn('⚠️ [Cropper] Failed to set coordinates safely:', err);
            }
            pendingRoi.value = null;
        }, delay); 
    }

    function onCropperReady() {
        // Only auto-initialize if we haven't yet, or if there's a pending ROI
        if (!hasInitializedCoordinates.value || pendingRoi.value) {
           resetCoordinates()
        }
    }

    function setAspectRatio(ratio: number | null) {
        // 1. Update the prop (Library will start its internal constraint transition)
        stencilProps.value = {
            aspectRatio: ratio
        }
        // 2. Immediately trigger a coordinate reset for the new ratio (Smooth expansion)
        resetCoordinates(ratio)
    }

    async function confirmCrop() {
        if (!cropperRef.value) return
        const result = cropperRef.value.getResult()
        if (!result?.canvas) return

        ocrLoading.value = true
        try {
            const blob = await new Promise<Blob | null>((resolve) =>
                result.canvas.toBlob((b: Blob | null) => resolve(b), "image/jpeg", 0.9)
            )
            if (!blob) return

            if (croppedPreviewUrl.value) URL.revokeObjectURL(croppedPreviewUrl.value)
            croppedPreviewUrl.value = URL.createObjectURL(blob)

            const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, {
                type: "image/jpeg",
            })

            // Compress cropped for OCR
            const resizedCropped = await resizeImage(croppedFile)

            // ✅ Run OCR once and store result
            const rawResult = await processFile(resizedCropped)
            if (rawResult?.ocrRaw) {
                ocrRaw.value = rawResult.ocrRaw
            }

            // --- 🔹 Also prepare compressed original for back image ---
            if (originalFile.value) {
                const resizedBack = await resizeImage(originalFile.value)
                options?.setBackFile?.(resizedBack)
            }
        } catch (err) {
            console.error('❌ OCR failed in confirmCrop:', err)
            throw err // 👈 rethrow to let handleConfirmCrop() know it failed
        } finally {
            ocrLoading.value = false
            showCropper.value = false
        }
    }

    function reset() {
        cropperSrc.value = null
        showCropper.value = false
        if (croppedPreviewUrl.value) {
            URL.revokeObjectURL(croppedPreviewUrl.value)
            croppedPreviewUrl.value = null
        }
        ingredientHighlights.value = []
        ingredientsText.value = ""
        ingredientsTextZh.value = ""
        productName.value = ""
        autoStatus.value = ""
        ocrRaw.value = "" // ✅ reset too
        originalFile.value = null
    }

    function closeCropper() {
        if (cropperSrc.value) {
            URL.revokeObjectURL(cropperSrc.value)
            cropperSrc.value = null
        }
        showCropper.value = false
    }

    function recrop() {
        if (!originalFile.value) return
        if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value)
        cropperSrc.value = URL.createObjectURL(originalFile.value)
        showCropper.value = true
    }

    async function autoProcess(file: File, roi: any = null) {
        originalFile.value = file
        ocrLoading.value = true

        try {
            console.log('🤖 [AutoScan] Starting autoProcess...', JSON.stringify({ hasRoi: !!roi, roi }))
            let fileToProcess = file

            if (roi) {
                console.log('📐 [AutoScan] Applying ROI:', roi)
                const img = new Image()
                img.src = URL.createObjectURL(file)
                await new Promise((resolve) => (img.onload = resolve))

                const canvas = document.createElement('canvas')
                const scaleX = img.width / 100
                const scaleY = img.height / 100

                canvas.width = (roi.width * scaleX)
                canvas.height = (roi.height * scaleY)

                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(
                        img,
                        roi.left * scaleX,
                        roi.top * scaleY,
                        roi.width * scaleX,
                        roi.height * scaleY,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    )

                    const blob = await new Promise<Blob | null>((resolve) =>
                        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
                    )
                    if (blob) {
                        fileToProcess = new File([blob], `auto-${file.name}`, { type: 'image/jpeg' })
                        if (croppedPreviewUrl.value) URL.revokeObjectURL(croppedPreviewUrl.value)
                        croppedPreviewUrl.value = URL.createObjectURL(blob)
                        console.log('✅ [AutoScan] Programmatic crop successful')
                    }
                }
                URL.revokeObjectURL(img.src)
            } else {
                console.warn('⚠️ [AutoScan] No ROI provided, using full image')
                if (croppedPreviewUrl.value) URL.revokeObjectURL(croppedPreviewUrl.value)
                croppedPreviewUrl.value = URL.createObjectURL(file)
            }

            // Run OCR pipeline
            const resized = await resizeImage(fileToProcess)
            const result = await processFile(resized)

            // Prepare compressed original for back image
            const resizedBack = await resizeImage(file)
            options?.setBackFile?.(resizedBack)

            return result
        } catch (err) {
            console.error('❌ [AutoScan] Auto OCR failed:', err)
            throw err
        } finally {
            ocrLoading.value = false
        }
    }

    return {
        cropperRef,
        cropperSrc,
        showCropper,
        croppedPreviewUrl,
        ocrLoading,
        stencilProps, // ✅ Exported
        openCropper,
        onCropperReady,
        autoProcess,
        confirmCrop,
        closeCropper,
        recrop,
        reset,
        setAspectRatio, // ✅ Exported
        showOk,
        ingredientHighlights,
        ingredientsText,
        ingredientsTextZh,
        autoStatus,
        productName,
        recheckHighlightsSmart,
        ocrRaw,
        detectedLanguage,
        progress,
        progressLabel
    }
}
