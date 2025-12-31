'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';
import examples from '../data/examples.json';

const ExampleCard = ({ number, description, onClick, isUnoptimized }) => {
  const src = `/assets/examples/example${number}.png`;
  const alt = `Example ${number}`;
  return (
    <div className='example-card'>
      <Image
        src={src}
        alt={alt}
        width={600}
        height={400}
        onClick={() => onClick(src)}
        unoptimized={isUnoptimized} // Toggle optimization for individual images
      />
      <p>{description}</p>
    </div>
  );
};

const ExamplesPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [unoptimizedImages, setUnoptimizedImages] = useState({}); // Track which images are unoptimized

  const handleImageClick = (src) => {
    setFullscreenImage(src);
    setUnoptimizedImages((prev) => ({ ...prev, [src]: true })); // Mark only the clicked image as unoptimized
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
    setUnoptimizedImages((prev) => {
      const updated = { ...prev };
      delete updated[fullscreenImage]; // Reset optimization for the fullscreen image
      return updated;
    });
  };

  return (
    <div className='page-container'>
      <h1>Examples</h1>
      <h2>Check out some examples of LinkedIn banners generated with Trailhead-Banner</h2>
      <h3>Click on an image to see it fullscreen.</h3>
      <div className='page-grid'>
        {examples.map((example, index) => (
          <ExampleCard
            key={index}
            number={example.number}
            description={example.description}
            onClick={handleImageClick}
            isUnoptimized={unoptimizedImages[`/assets/examples/example${example.number}.png`] || false} // Individual unoptimized state
          />
        ))}
      </div>

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={handleOverlayClick}>
          <Image
            src={fullscreenImage}
            alt='Full Screen Example'
            layout='fill'
            objectFit='contain'
            unoptimized // Always unoptimized in fullscreen
          />
        </div>
      )}
    </div>
  );
};

export default ExamplesPage;
