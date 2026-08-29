const DEFAULT_MAX_SIZE_BYTES = 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_MIN_DIMENSION = 360;

const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });

const resizeCanvas = (sourceCanvas, maxDimension) => {
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (width === sourceWidth && height === sourceHeight) {
        return sourceCanvas;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to prepare image compression.');
    }

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    return canvas;
};

const supportsCanvasType = async (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await canvasToBlob(canvas, type, 0.8);

    return blob?.type === type;
};

export const imageExtensionFromType = (type) => {
    if (type === 'image/webp') return 'webp';
    if (type === 'image/png') return 'png';
    return 'jpg';
};

export async function compressCanvasImage(sourceCanvas, options = {}) {
    const {
        maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
        maxDimension = DEFAULT_MAX_DIMENSION,
        minDimension = DEFAULT_MIN_DIMENSION,
        preferredType = 'image/webp',
        fallbackType = 'image/jpeg',
        qualityStart = 0.85,
        qualityMin = 0.6,
        qualityStep = 0.05,
    } = options;

    const outputType = await supportsCanvasType(preferredType) ? preferredType : fallbackType;
    let dimension = maxDimension;
    let smallestBlob = null;

    while (dimension >= minDimension) {
        const canvas = resizeCanvas(sourceCanvas, dimension);

        for (let quality = qualityStart; quality >= qualityMin; quality -= qualityStep) {
            const blob = await canvasToBlob(canvas, outputType, Number(quality.toFixed(2)));
            if (!blob) continue;

            if (!smallestBlob || blob.size < smallestBlob.size) {
                smallestBlob = blob;
            }

            if (blob.size <= maxSizeBytes) {
                return blob;
            }
        }

        dimension = Math.floor(dimension * 0.82);
    }

    if (smallestBlob && smallestBlob.size <= maxSizeBytes) {
        return smallestBlob;
    }

    const maxSizeKilobytes = Math.round(maxSizeBytes / 1024);
    throw new Error(`Image could not be compressed below ${maxSizeKilobytes} KB. Try cropping a smaller area.`);
}
