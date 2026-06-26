// composables/useImageResizer.ts
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

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const tempImg = new Image();
            const url = URL.createObjectURL(blob);
            tempImg.onload = () => resolve(tempImg);
            tempImg.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(new Error("❌ Failed to load image element"));
            };
            tempImg.src = url;
        });

        const objectUrl = img.src;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const ratio = w / h;
        canvas.width = Math.min(w, maxWidth);
        canvas.height = canvas.width / ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(objectUrl);

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
