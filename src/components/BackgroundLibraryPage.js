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
      src: '/assets/background-library/hero-block__variation-1.png',
      alt: 'hero block variation 1',
      description: 'Hero Block Variation 1',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/hero-block__variation-2.png',
      alt: 'hero block variation 2',
      description: 'Hero Block Variation 2',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/hero-block__variation-3.png',
      alt: 'hero block variation 3',
      description: 'Hero Block Variation 3',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/hero-block__variation-4.png',
      alt: 'hero block variation 4',
      description: 'Hero Block Variation 4',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/highland-waterfalls.png',
      alt: 'Highland Waterfalls',
      description: 'Highland Waterfalls',
      credit: 'Trailblazer.me',
    },
    {
      src: '/assets/background-library/service_background-1.png',
      alt: 'Service Background 1',
      description: 'Service Background 1',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/salescloud_faq-1.png',
      alt: 'Sales Cloud Background 1',
      description: 'Sales Cloud Background 1',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/trailhead-mfe-background.png',
      alt: 'Trailhead MFE Background',
      description: 'Trailhead MFE Background',
      credit: 'Trailblazer.me',
    },
    {
      src: '/assets/background-library/energy-central-background.png',
      alt: 'Energy Central Background',
      description: 'Energy Central Background',
      credit: 'energycentral.com',
    },
    {
      src: '/assets/background-library/tropical-beach.png',
      alt: 'Tropical Beach',
      description: 'Tropical Beach',
      credit: 'Trailblazer.me',
    },
    {
      src: '/assets/background-library/marquee-our-story-bg.png',
      alt: 'Our Story Background 1',
      description: 'Our Story Background 1',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/our-story-marquee.png',
      alt: 'Our Story Background 2',
      description: 'Our Story Background 2',
      credit: 'Salesforce.com',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
    {
      src: '/assets/background-library/TODO',
      alt: 'TODO',
      description: 'TODO',
      credit: 'TODO',
    },
  ];

  const searchQueries = [
    { query: 'linkedin+banner+background', label: 'LinkedIn Banner Background' },
    { query: 'linkedin+banner+background+empty', label: 'Empty LinkedIn Banner Background' },
    {
      query: 'LinkedIn+banner+background+technology+digital+design',
      label: 'Technology & Digital Design LinkedIn Banner',
    },
    { query: 'LinkedIn+banner+background+abstract+design', label: 'Abstract Design LinkedIn Banner' },
    { query: 'LinkedIn+banner+background+creative+colorful', label: 'Creative & Colorful LinkedIn Banner' },
    {
      query: 'LinkedIn+banner+background+abstract+professional+high+resolution',
      label: 'Abstract Professional LinkedIn Banner',
    },
    { query: 'LinkedIn+banner+background+building', label: 'Building LinkedIn Banner' },
    { query: 'LinkedIn+banner+background+landscape', label: 'Landscape LinkedIn Banner' },
  ];

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
