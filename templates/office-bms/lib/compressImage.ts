export type CompressedImage = {
    dataUrl: string;
    widthPx: number;
    heightPx: number;
};

// Group.metadata has a 64KB total budget shared with devicePlacements, so
// the floor plan image itself is capped well below that.
const DEFAULT_MAX_BYTES = 45 * 1024;
const DEFAULT_MAX_DIMENSION = 1200;

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image file'));
        };
        img.src = url;
    });
}

function dataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] ?? '';
    return Math.ceil((base64.length * 3) / 4);
}

export async function compressImageToDataUrl(
    file: File,
    opts: {maxBytes?: number; maxDimension?: number} = {}
): Promise<CompressedImage> {
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;

    const img = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const widthPx = Math.max(1, Math.round(img.width * scale));
    const heightPx = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrlBytes(dataUrl) > maxBytes && quality > 0.15) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrlBytes(dataUrl) > maxBytes) {
        throw new Error(
            `Image is too large even at minimum quality (${Math.round(dataUrlBytes(dataUrl) / 1024)}KB > ${Math.round(maxBytes / 1024)}KB). Try a smaller or simpler image.`
        );
    }

    return {dataUrl, widthPx, heightPx};
}
