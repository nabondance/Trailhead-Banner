'use client';

import React from 'react';
import { BANNER_SIZES, drawImageWithFit } from '../banner/bannerSizes';
import { getBackgroundPreviewSrc } from '../utils/backgroundUtils';
import { getLibraryFocusY } from '../utils/libraryBackgrounds';

/**
 * Preview of a banner background, at the banner's real size and shape.
 *
 * @param {Object} props.options - Form options: backgroundKind, backgroundLibraryUrl, customBackgroundImageUrl,
 *   backgroundImageUrl, backgroundColor. Library backgrounds crop at their focusY from banners.json
 * @param {Object} [props.size=BANNER_SIZES.standard] - { width, height, fit } — use an entry of BANNER_SIZES
 * @param {string} [props.title='Background Preview'] - Heading shown above the preview (falsy to hide)
 */
const BackgroundPreview = ({ options = {}, size = BANNER_SIZES.standard, title = 'Background Preview' }) => {
  const canvasRef = React.useRef(null);
  const { width, height, fit = 'stretch' } = size;
  const src = getBackgroundPreviewSrc(options);
  const backgroundColor = options.backgroundColor || '#5badd6';
  const focusY = options.backgroundKind === 'library' ? getLibraryFocusY(options.backgroundLibraryUrl) : 0.5;

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
      // Same drawing as the server render (renderBackground in src/banner/components/background.js)
      drawImageWithFit(ctx, img, img.naturalWidth, img.naturalHeight, width, height, fit, focusY);
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
