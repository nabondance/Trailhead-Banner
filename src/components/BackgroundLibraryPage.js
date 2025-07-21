'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';
import banners from '../data/banners.json';
import searchQueries from '../data/searchQueries.json';

const BannerCard = ({ src, alt, description, credit, onClick, isUnoptimized }) => (
  <div className='example-card'>
    <Image
      src={src}
      alt={alt}
      width={600}
      height={400}
      onClick={() => onClick(src)}
      unoptimized={isUnoptimized} // Dynamic optimization toggle
    />
    <p>{description}</p>
    {credit && <p className='credit'>Credit: {credit}</p>}
  </div>
);

const BackgroundLibraryPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [unoptimizedImages, setUnoptimizedImages] = useState({}); // Track unoptimized state for each image

  const handleImageClick = (src) => {
    setFullscreenImage(src);
    setUnoptimizedImages((prev) => ({ ...prev, [src]: true })); // Mark the clicked image as unoptimized
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
    <div className='background-library-container'>
      <h1>Background Library</h1>
      <h2>You can find many LinkedIn backgrounds online</h2>
      <ul>
        {searchQueries.map((item, index) => (
          <li key={index}>
            <a
              href={`https://www.google.com/search?tbm=isch&q=${item.query}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <h2>You can also select an example background for your banner</h2>
      <div className='library-grid'>
        {banners.map((example, index) => (
          <BannerCard
            key={index}
            src={example.src}
            alt={example.alt}
            description={example.alt}
            credit={example.credit}
            onClick={handleImageClick}
            isUnoptimized={unoptimizedImages[example.src] || false} // Individual unoptimized state
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

export default BackgroundLibraryPage;
