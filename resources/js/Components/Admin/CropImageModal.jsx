import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import Icon from '@/Components/Admin/icons';
import { compressCanvasImage } from '@/Utils/imageCompression';
import { usePhraseTranslation } from '@/Utils/i18n';

const rotatedSize = (width, height, rotation) => {
    const radians = (rotation * Math.PI) / 180;

    return {
        width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
        height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
    };
};

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, outputType = 'image/webp', maxSizeBytes) {
    const image = await createImage(imageSrc);
    const rotatedCanvas = document.createElement('canvas');
    const rotatedContext = rotatedCanvas.getContext('2d');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!rotatedContext || !ctx) {
        throw new Error('Unable to prepare image crop.');
    }

    const rotationRadians = (rotation * Math.PI) / 180;
    const bounds = rotatedSize(image.width, image.height, rotation);
    rotatedCanvas.width = Math.round(bounds.width);
    rotatedCanvas.height = Math.round(bounds.height);

    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(rotationRadians);
    rotatedContext.translate(-image.width / 2, -image.height / 2);
    rotatedContext.drawImage(image, 0, 0);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(
        rotatedCanvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
    );

    return compressCanvasImage(canvas, {
        preferredType: outputType,
        ...(maxSizeBytes ? { maxSizeBytes } : {}),
    });
}

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

const defaultRatioLabel = (aspect) => {
    if (aspect === 1) return '1:1';
    if (Math.abs(aspect - 3 / 4) < 0.01) return '3:4';
    if (Math.abs(aspect - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(aspect - 2) < 0.01) return '2:1';
    return null;
};

export default function CropImageModal({
    open,
    image,
    onCropComplete,
    onCancel,
    aspect = 3 / 4,
    title = 'Crop image',
    ratioLabel = null,
    outputType = 'image/webp',
    allowRotation = false,
    maxSizeBytes,
}) {
    const t = usePhraseTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    const onCropAreaComplete = useCallback((_croppedArea, pixels) => {
        setCroppedAreaPixels(pixels);
    }, []);

    useEffect(() => {
        if (!open) return;

        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
        setError(null);
    }, [image, open]);

    const handleCrop = async () => {
        try {
            setProcessing(true);
            setError(null);
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation, outputType, maxSizeBytes);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
            setError(e.message || t('Unable to compress image.'));
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop crop-modal-backdrop" onClick={onCancel}>
            <div className="operation-modal compact glass crop-modal" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <div>
                        <p className="eyebrow">{t('Media')}</p>
                        <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                            {t(title)}{(ratioLabel || defaultRatioLabel(aspect)) ? ` (${ratioLabel || defaultRatioLabel(aspect)})` : ''}
                        </h2>
                    </div>
                    <button type="button" className="icon-btn small" onClick={onCancel} aria-label={t('Close')}>
                        <Icon name="close" size={14} />
                    </button>
                </div>
                <div className="crop-area">
                    {image && (
                        <Cropper
                            image={image}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={aspect}
                            onCropChange={setCrop}
                            onCropComplete={onCropAreaComplete}
                            onZoomChange={setZoom}
                        />
                    )}
                </div>
                <div className="crop-zoom">
                    <label className="form-field">
                        <span>{t('Zoom')}</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                        />
                    </label>
                    {allowRotation && (
                        <button
                            type="button"
                            className="btn secondary crop-rotate-btn"
                            onClick={() => {
                                setCrop({ x: 0, y: 0 });
                                setCroppedAreaPixels(null);
                                setRotation((current) => (current + 90) % 360);
                            }}
                            disabled={processing}
                        >
                            <Icon name="rotateClockwise" size={15} />
                            {t('Rotate 90°')}
                        </button>
                    )}
                </div>
                {error && <div className="flash error">{t(error)}</div>}
                <div className="modal-actions">
                    <button type="button" className="btn secondary" onClick={onCancel} disabled={processing}>
                        {t('Cancel')}
                    </button>
                    <button type="button" className="btn primary" onClick={handleCrop} disabled={processing || !croppedAreaPixels}>
                        {processing ? t('Compressing...') : t('Crop & save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
