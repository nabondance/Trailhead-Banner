'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';
import banners from '../data/banners.json';
import searchQueries from '../data/searchQueries.json';

const BannerCard = ({ src, alt, description, credit, onClick, onCopy }) => (
  <div className='example-card'>
    <Image src={src} alt={alt} width={600} height={400} onClick={() => onClick(src)} />
    <p>{description}</p>
    {credit && <p className='credit'>Credit: {credit}</p>}
    <button className='copy-button' onClick={() => onCopy(src)}>
      Copy URL
    </button>
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
      {notification && <div className='notification'>{notification}</div>}
      <div className='library-grid'>
        {banners.map((example, index) => (
          <BannerCard
            key={index}
            src={example.src}
            alt={example.alt}
            description={example.description}
            credit={example.credit}
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
