'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';

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

  const banners = [
    {
      src: '/assets/background-library/banner1.png',
      alt: 'Banner 1',
      description: 'Banner 1',
      credit: 'Photographer 1',
    },
    {
      src: '/assets/background-library/banner2.png',
      alt: 'Banner 2',
      description: 'Banner 2',
      credit: 'Photographer 2',
    },
    {
      src: '/assets/background-library/banner3.png',
      alt: 'Banner 3',
      description: 'Banner 3',
      credit: 'Photographer 3',
    },
    {
      src: '/assets/background-library/banner4.png',
      alt: 'Banner 4',
      description: 'Banner 4',
      credit: 'Photographer 4',
    },
    {
      src: '/assets/background-library/banner5.png',
      alt: 'Banner 5',
      description: 'Banner 5',
      credit: 'Photographer 5',
    },
  ];

  return (
    <div className='background-library-container'>
      <h1>Background Library</h1>
      <h2>You can find many LinkedIn backgrounds online</h2>
      <ul>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=linkedin+banner+background'
            target='_blank'
            rel='noopener noreferrer'
          >
            LinkedIn Banner Background
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=linkedin+banner+background+empty'
            target='_blank'
            rel='noopener noreferrer'
          >
            Empty LinkedIn Banner Background
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+technology+digital+design'
            target='_blank'
            rel='noopener noreferrer'
          >
            Technology & Digital Design LinkedIn Banner
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+abstract+design'
            target='_blank'
            rel='noopener noreferrer'
          >
            Abstract Design LinkedIn Banner
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+creative+colorful'
            target='_blank'
            rel='noopener noreferrer'
          >
            Creative & Colorful LinkedIn Banner
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+abstract+professional+high+resolution'
            target='_blank'
            rel='noopener noreferrer'
          >
            High Resolution Abstract Professional LinkedIn Banner
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+building'
            target='_blank'
            rel='noopener noreferrer'
          >
            Building LinkedIn Banner
          </a>
        </li>
        <li>
          <a
            href='https://www.google.com/search?tbm=isch&q=LinkedIn+banner+background+landscape'
            target='_blank'
            rel='noopener noreferrer'
          >
            Landscape LinkedIn Banner
          </a>
        </li>
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
