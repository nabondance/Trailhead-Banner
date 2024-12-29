'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';

const BannerCard = ({ src, alt, description, onClick, onCopy }) => (
  <div className='example-card'>
    <Image src={src} alt={alt} width={600} height={400} onClick={() => onClick(src)} />
    <p>{description}</p>
    <button className='copy-button' onClick={() => onCopy(src)}>Copy URL</button>
  </div>
);

const BackgroundLibraryPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [notification, setNotification] = useState('');

  const handleImageClick = (src) => {
    setFullscreenImage(src);
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
  };

  const handleCopyUrl = (src) => {
    const fullUrl = `${window.location.origin}${src}`;
    navigator.clipboard.writeText(fullUrl);
    setNotification('Image URL copied to clipboard!');
    setTimeout(() => {
      setNotification('');
    }, 1000);
  };

  const banners = [
    { src: '/assets/background-library/banner1.png', alt: 'Banner 1', description: 'Banner 1' },
    { src: '/assets/background-library/banner2.png', alt: 'Banner 2', description: 'Banner 2' },
    { src: '/assets/background-library/banner3.png', alt: 'Banner 3', description: 'Banner 3' },
    { src: '/assets/background-library/banner4.png', alt: 'Banner 4', description: 'Banner 4' },
    { src: '/assets/background-library/banner5.png', alt: 'Banner 5', description: 'Banner 5' },
  ];

  return (
    <div className='background-library-container'>
      <h1>Background Library</h1>
      <h2>Select a background for your banner</h2>
      {notification && <div className='notification'>{notification}</div>}
      <div className='library-grid'>
        {banners.map((example, index) => (
          <BannerCard
            key={index}
            src={example.src}
            alt={example.alt}
            description={example.description}
            onClick={handleImageClick}
            onCopy={handleCopyUrl}
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
