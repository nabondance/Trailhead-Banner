'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';

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
      <h2>Check out some examples of LinkedIn banners generated with Trailhead-Banner</h2>
      <div className='examples-grid'>
        <div className='example-card'>
          <Image
            src='/assets/examples/example1.png'
            alt='Example 1'
            width={600}
            height={400}
            onClick={() => handleImageClick('/assets/examples/example1.png')}
          />
          <p>Default Banner Generated</p>
        </div>
        <div className='example-card'>
          <Image
            src='/assets/examples/example2.png'
            alt='Example 2'
            width={600}
            height={400}
            onClick={() => handleImageClick('/assets/examples/example2.png')}
          />
          <p>Banner with custom background and text color</p>
        </div>
        <div className='example-card'>
          <Image
            src='/assets/examples/example3.png'
            alt='Example 3'
            width={600}
            height={400}
            onClick={() => handleImageClick('/assets/examples/example3.png')}
          />
          <p>Banner with custom background image from the library</p>
        </div>
        <div className='example-card'>
          <Image
            src='/assets/examples/example4.png'
            alt='Example 4'
            width={600}
            height={400}
            onClick={() => handleImageClick('/assets/examples/example4.png')}
          />
          <p>Banner with custom background image from the internet</p>
        </div>
        <div className='example-card'>
          <Image
            src='/assets/examples/example5.png'
            alt='Example 5'
            width={600}
            height={400}
            onClick={() => handleImageClick('/assets/examples/example5.png')}
          />
          <p>Banner without superbadges displayed</p>
        </div>
      </div>

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={handleOverlayClick}>
          <Image src={fullscreenImage} alt='Full Screen Example' layout='fill' objectFit='contain' />
        </div>
      )}
    </div>
  );
};

export default ExamplesPage;
