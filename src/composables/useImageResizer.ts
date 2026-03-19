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

        const img = await createImageBitmap(blob);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const ratio = img.width / img.height;
        canvas.width = Math.min(img.width, maxWidth);
        canvas.height = canvas.width / ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
