'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';

const BannerCard = ({ src, alt, description, onClick }) => (
    <div className='example-card'>
      <Image
        src={src}
        alt={alt}
        width={600}
        height={400}
        onClick={() => onClick(src)}
      />
      <p>{description}</p>
    </div>
  );

const BackgroundLibraryPage = () => {
    const [fullscreenImage, setFullscreenImage] = useState(null);

    const handleImageClick = (src) => {
        setFullscreenImage(src);
      };

      const handleOverlayClick = () => {
        setFullscreenImage(null);
      };

    const banners = [
        { src: '/assets/banner-library/banner1.png', alt: 'Banner 1', description: 'Banner 1' },
      ];

  return (
    <div className='background-library-container'>
      <h1>Background Library</h1>
      <h2>WIP</h2>
      <div className='library-grid'>
        {banners.map((example, index) => (
          <BannerCard
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
          <Image src={fullscreenImage} alt='Full Screen Example' layout='fill' objectFit='contain' />
        </div>
      )}
    </div>
  );
};

export default BackgroundLibraryPage;
