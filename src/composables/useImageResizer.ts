// composables/useImageResizer.ts

// Some Android WebView builds can't decode HEIC/HEIF via the <img> element
// (common on phones that save camera photos in a "high efficiency" format),
// even though the file itself is valid. createImageBitmap() goes through the
// platform's native image codecs instead of Blink's <img> decode path and
// succeeds on more devices, so it's used as a fallback rather than the
// primary path (it's not universally supported either, e.g. older Safari).
async function loadDrawableImage(blob: Blob): Promise<HTMLImageElement | ImageBitmap> {
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            const url = URL.createObjectURL(blob);
            tempImg.onload = () => {
                URL.revokeObjectURL(url);
                resolve(tempImg);
            };
            tempImg.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image element"));
            };
            tempImg.src = url;
        });
    } catch (err) {
        if (typeof createImageBitmap === "function") {
            return await createImageBitmap(blob);
        }
        throw err;
    }
}

export function useImageResizer() {
    async function resizeImage(
        webPath: string | File,
        maxWidth = 1000,
        quality = 0.7
    ): Promise<File> {
        let blob: Blob;

        if (typeof webPath === "string") {
            const response = await fetch(webPath);
            blob = await response.blob();
        } else {
            blob = webPath;
        }

        const source = await loadDrawableImage(blob);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const w = "naturalWidth" in source ? (source.naturalWidth || source.width) : source.width;
        const h = "naturalHeight" in source ? (source.naturalHeight || source.height) : source.height;
        const ratio = w / h;
        canvas.width = Math.min(w, maxWidth);
        canvas.height = canvas.width / ratio;

        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

        if ("close" in source) source.close();

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (compressedBlob) => {
                    if (compressedBlob) {
                        resolve(new File([compressedBlob], "image.jpg", { type: "image/jpeg" }));
                    } else {
                        reject(new Error("❌ Failed to compress image"));
                    }
                },
                "image/jpeg",
                quality
            );
        });
    }

    return { resizeImage };
}
