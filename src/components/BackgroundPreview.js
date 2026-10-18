'use client';

import React from 'react';
import { BANNER_SIZES } from '../banner/bannerSizes';
import { getBackgroundPreviewSrc } from '../utils/backgroundUtils';
import { getLibraryFocusY } from '../utils/libraryBackgrounds';

/**
 * Draw a background on a canvas the same way the server does (see renderBackground in
 * src/banner/components/background.js).
 */
function drawBackground(ctx, img, width, height, fit, focusY) {
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;
  if (fit === 'cover' && imgWidth > 0 && imgHeight > 0) {
    const scale = Math.max(width / imgWidth, height / imgHeight);
    const srcWidth = width / scale;
    const srcHeight = height / scale;
    const srcX = (imgWidth - srcWidth) / 2;
    const srcY = (imgHeight - srcHeight) * Math.min(Math.max(focusY, 0), 1);
    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
  } else {
    ctx.drawImage(img, 0, 0, width, height);
  }
}

/**
 * Preview of a banner background, at the banner's real size and shape.
 *
 * @param {Object} props.options - Form options: backgroundKind, backgroundLibraryUrl, customBackgroundImageUrl,
 *   backgroundImageUrl, backgroundColor, and optional focusY (overrides the library background's focusY)
 * @param {Object} [props.size=BANNER_SIZES.standard] - { width, height, fit } — use an entry of BANNER_SIZES
 * @param {string} [props.title='Background Preview'] - Heading shown above the preview (falsy to hide)
 */
const BackgroundPreview = ({ options = {}, size = BANNER_SIZES.standard, title = 'Background Preview' }) => {
  const canvasRef = React.useRef(null);
  const { width, height, fit = 'stretch' } = size;
  const src = getBackgroundPreviewSrc(options);
  const backgroundColor = options.backgroundColor || '#5badd6';
  const focusY =
    options.focusY ?? (options.backgroundKind === 'library' ? getLibraryFocusY(options.backgroundLibraryUrl) : 0.5);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const fillColor = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    };

    if (!src) {
      fillColor();
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx, img, width, height, fit, focusY);
    };
    img.onerror = () => {
      if (cancelled) return;
      console.error('Failed to load image:', src);
      fillColor();
    };
    // For library backgrounds, use the raw path without window.location.origin
    img.src = src.includes(window.location.origin) ? src.replace(window.location.origin, '') : src;
    return () => {
      cancelled = true;
    };
  }, [src, backgroundColor, width, height, fit, focusY]);

  return (
    <div className='background-preview'>
      {title && <h3>{title}</h3>}
      <div className='canvas-container' style={{ aspectRatio: `${width} / ${height}` }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default BackgroundPreview;
