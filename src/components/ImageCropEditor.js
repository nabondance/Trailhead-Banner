'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { BANNER_SIZES } from '../banner/bannerSizes';

const ZOOM_HEADROOM = 3;

const ImageCropEditor = ({
  imageSrc,
  onCropComplete,
  isCropSkipped,
  onSkip,
  onReset,
  cropPosition,
  onCropPositionChange,
  cropZoom,
  onCropZoomChange,
  size = BANNER_SIZES.standard,
}) => {
  const aspectRatio = size.width / size.height;
  // Without a crop, the server draws the original image with the banner's fit (see BANNER_SIZES)
  const skipCover = size.fit === 'cover';
  const containerRef = useRef(null);
  const cropZoomRef = useRef(cropZoom);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);

  // Keep ref in sync so the image-load effect can read current zoom without re-running
  cropZoomRef.current = cropZoom;

  // Measure container to give react-easy-crop explicit pixel dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setContainerSize({ width: Math.round(w), height: Math.round(w / aspectRatio) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio]);

  // Compute min zoom so the image always covers the crop area (no grey bars).
  // Only overrides the current zoom if it is below the cover minimum (e.g. fresh upload).
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const imageAspect = img.naturalWidth / img.naturalHeight;
      const coverZoom = imageAspect < aspectRatio ? aspectRatio / imageAspect : 1;
      setMinZoom(coverZoom);
      setMaxZoom(coverZoom * ZOOM_HEADROOM);
      if (cropZoomRef.current < coverZoom) {
        onCropZoomChange(coverZoom);
      }
    };
    img.onerror = () => {
      if (cancelled) return;
      setMinZoom(1);
      setMaxZoom(ZOOM_HEADROOM);
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, onCropZoomChange, aspectRatio]);

  const handleCropComplete = useCallback(
    (_, croppedAreaPixels) => {
      onCropComplete(croppedAreaPixels);
    },
    [onCropComplete]
  );

  const handleReset = () => {
    onCropPositionChange({ x: 0, y: 0 });
    onCropZoomChange(minZoom);
    onReset();
  };

  return (
    <div className='crop-editor'>
      <h3>Crop Background</h3>
      <div className='crop-border'>
        <div ref={containerRef} className='crop-container' style={{ height: containerSize.height || undefined }}>
          {containerSize.width > 0 &&
            (isCropSkipped ? (
              <img
                src={imageSrc}
                alt={skipCover ? 'Preview (center-cropped)' : 'Preview (distorted)'}
                className='crop-skip-preview'
                style={{ objectFit: skipCover ? 'cover' : 'fill' }}
              />
            ) : (
              <Cropper
                image={imageSrc}
                crop={cropPosition}
                zoom={Math.max(cropZoom, minZoom)}
                aspect={aspectRatio}
                minZoom={minZoom}
                maxZoom={maxZoom}
                cropSize={containerSize}
                onCropChange={onCropPositionChange}
                onZoomChange={onCropZoomChange}
                onCropComplete={handleCropComplete}
              />
            ))}
        </div>
      </div>
      {isCropSkipped && (
        <p className='crop-skip-message'>
          {skipCover
            ? 'Crop disabled — original image will be center-cropped to fit'
            : 'Crop disabled — original image will be used (may be distorted)'}
        </p>
      )}
      <div className='crop-controls'>
        <div className='zoom-slider-row'>
          <span>−</span>
          <input
            type='range'
            min={minZoom}
            max={maxZoom}
            step={0.01}
            value={Math.max(cropZoom, minZoom)}
            onChange={(e) => onCropZoomChange(Number(e.target.value))}
            className='zoom-slider'
            aria-label='Zoom'
            disabled={isCropSkipped}
          />
          <span>+</span>
        </div>
        <div className='crop-buttons'>
          <button type='button' className='button' onClick={handleReset}>
            {isCropSkipped ? 'Reset & use crop' : 'Reset crop'}
          </button>
          {isCropSkipped ? (
            <button type='button' className='button' onClick={onReset}>
              Use crop
            </button>
          ) : (
            <button type='button' className='button' onClick={onSkip}>
              Skip crop
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCropEditor;
