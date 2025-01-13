'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';
import examples from '../data/examples.json';

const ExampleCard = ({ src, alt, description, onClick }) => (
  <div className='example-card'>
    <Image src={src} alt={alt} width={600} height={400} onClick={() => onClick(src)} unoptimized />
    <p>{description}</p>
  </div>
);

const ExamplesPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const handleImageClick = (src) => {
    setFullscreenImage(src);
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
  };

  return (
    <div className='examples-container'>
      <h1>Examples</h1>
      <h2>Check out some examples of LinkedIn banners generated with Trailhead-Banner.</h2>
      <h3>Click on image to see in fullscreen.</h3>
      <div className='examples-grid'>
        {examples.map((example, index) => (
          <ExampleCard
            key={index}
            src={example.src}
            alt={example.alt}
            description={example.description}
            onClick={handleImageClick}
          />
        ))}
      </div>

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={handleOverlayClick}>
          <Image src={fullscreenImage} alt='Full Screen Example' layout='fill' objectFit='contain' unoptimized />
        </div>
      )}
    </div>
  );
};

export default ExamplesPage;
