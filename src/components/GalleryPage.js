'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import examplesData from '../data/examples.json';
import backgrounds from '../data/banners.json';
import { BANNER_SIZES } from '../banner/bannerSizes';

// Cards above the fold load right away; the rest load as the visitor scrolls
const EAGER_CARDS = 4;
// Displayed image widths: page padding, card padding and the 90% image width included,
// so phones don't download images twice as wide as they are shown
const BANNER_CARD_SIZES = '(max-width: 1000px) calc(90vw - 92px), calc(45vw - 83px)';
const BACKGROUND_CARD_SIZES =
  '(max-width: 768px) calc(90vw - 92px), (max-width: 1300px) calc(45vw - 83px), calc(30vw - 75px)';

const GalleryCard = ({ src, alt, caption, credit, sizes, eager, onOpen }) => (
  <div className='example-card'>
    <button type='button' className='gallery-card-button' onClick={() => onOpen({ src, alt })}>
      <Image
        src={src}
        alt={alt}
        width={BANNER_SIZES.standard.width}
        height={BANNER_SIZES.standard.height}
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
      />
    </button>
    <p>{caption}</p>
    {credit && <p className='credit'>Credit: {credit}</p>}
  </div>
);

const GalleryPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);

  useEffect(() => {
    if (!fullscreenImage) return;
    const closeOnEscape = (event) => event.key === 'Escape' && setFullscreenImage(null);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [fullscreenImage]);

  return (
    <div className='page-container'>
      <h1>Gallery</h1>
      <h2>Example banners and backgrounds. Click an image to see it fullscreen.</h2>

      <section id='banners' className='gallery-section'>
        <h2>Banners</h2>
        <div className='page-grid gallery-grid-wide'>
          {examplesData.examples.map((example, index) => (
            <GalleryCard
              key={example.id}
              src={`/assets/examples/${example.id}.webp`}
              alt={`Example banner: ${example.description}`}
              caption={example.description}
              sizes={BANNER_CARD_SIZES}
              eager={index < EAGER_CARDS}
              onOpen={setFullscreenImage}
            />
          ))}
        </div>
      </section>

      <section id='backgrounds' className='gallery-section'>
        <h2>Backgrounds</h2>
        <div className='page-grid'>
          {backgrounds.map((background) => (
            <GalleryCard
              key={background.src}
              src={background.src}
              alt={background.alt}
              caption={background.alt}
              credit={background.credit}
              sizes={BACKGROUND_CARD_SIZES}
              onOpen={setFullscreenImage}
            />
          ))}
        </div>
      </section>

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={() => setFullscreenImage(null)}>
          <Image src={fullscreenImage.src} alt={fullscreenImage.alt} fill sizes='100vw' unoptimized />
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
