'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import LinkedInBannerTutorial from './LinkedInBannerTutorial';
import BannerForm from './BannerForm';
import '../styles/globals.css';

const MainPage = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageSubmit = async (options) => {
    console.log('Generating image for:', options.username);
    console.log('Options:', options);

    setImageUrl(''); // Clear the previously generated banner
    setLoading(true);
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    const data = await response.json();
    console.log('Rank Data:', data.rankData);
    console.log('Certifications Data:', data.certificationsData);
    console.log('Badge Data:', data.badgesData);
    setImageUrl(data.imageUrl);
    setLoading(false);
  };

  return (
    <div className='container'>
      <BannerForm onSubmit={handleImageSubmit} />
      {loading && (
        <div className='loading-container'>
          <p>Generating the banner...</p>
          <div className='loading-icon'></div>
        </div>
      )}
      {imageUrl && (
        <div className='image-container'>
          <Image src={imageUrl} alt='Generated' className='generated-image' width={1584} height={396} />
          <a href={imageUrl} download='trailhead-banner.png' className='download-link'>
            Download Banner
          </a>
          <LinkedInBannerTutorial />
        </div>
      )}
      <SpeedInsights />
      <Analytics />
    </div>
  );
};

export default MainPage;
