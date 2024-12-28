'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import '../styles/globals.css';

const ExampleCard = ({ src, alt, description, onClick }) => (
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

const ExamplesPage = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const handleImageClick = (src) => {
    setFullscreenImage(src);
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
  };

  const examples = [
    { src: '/assets/examples/example1.png', alt: 'Example 1', description: 'Default Banner Generated' },
    { src: '/assets/examples/example2.png', alt: 'Example 2', description: 'Banner with custom background and text color' },
    { src: '/assets/examples/example3.png', alt: 'Example 3', description: 'Banner with custom background image from the library' },
    { src: '/assets/examples/example4.png', alt: 'Example 4', description: 'Banner with custom background image from the internet' },
    { src: '/assets/examples/example5.png', alt: 'Example 5', description: 'Banner without superbadges displayed' },
    { src: '/assets/examples/example6.png', alt: 'Example 6', description: 'Banner displaying expired certifications (grey) and retired certifications (faded)' },
    { src: '/assets/examples/example7.png', alt: 'Example 7', description: 'Banner of a 10x certified' },
    { src: '/assets/examples/example8.png', alt: 'Example 8', description: 'Banner of a 15x certified' },
    { src: '/assets/examples/example9.png', alt: 'Example 9', description: 'Banner with many superbadges' },
  ];

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
          <Image src={fullscreenImage} alt='Full Screen Example' layout='fill' objectFit='contain' />
        </div>
      )}
    </div>
  );
};

export default ExamplesPage;
