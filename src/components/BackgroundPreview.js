'use client';

import React from 'react';

/**
 * Canvas preview of the banner background, drawn the same way the server renders it.
 * fit='stretch' (standard banner) or 'cover' (company banner: keep aspect ratio, crop at focusY).
 */
const BackgroundPreview = ({ src, backgroundColor, width = 1584, height = 396, fit = 'stretch', focusY = 0.5 }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (src) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;
        if (fit === 'cover' && imgWidth > 0 && imgHeight > 0) {
          // Same math as renderBackground in src/banner/components/background.js
          const scale = Math.max(width / imgWidth, height / imgHeight);
          const srcWidth = width / scale;
          const srcHeight = height / scale;
          const clampedFocusY = Math.min(Math.max(focusY, 0), 1);
          const srcX = (imgWidth - srcWidth) / 2;
          const srcY = (imgHeight - srcHeight) * clampedFocusY;
          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image:', src);
        ctx.fillStyle = backgroundColor || '#5badd6';
        ctx.fillRect(0, 0, width, height);
      };
      // For library backgrounds, use the raw path without window.location.origin
      img.src = src.includes(window.location.origin) ? src.replace(window.location.origin, '') : src;
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  }, [src, backgroundColor, width, height, fit, focusY]);

  return (
    <div className='background-preview'>
      <h3>Background Preview</h3>
      <div className='canvas-container'>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default BackgroundPreview;
