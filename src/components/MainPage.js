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
  const [error, setError] = useState(null);

  const handleImageSubmit = async (options) => {
    console.log('Generating image for:', options.username);
    console.log('Options:', options);

    setImageUrl(''); // Clear the previously generated banner
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      const data = await response.json();
      console.log('Rank Data:', data.rankData);
      console.log('Certifications Data:', data.certificationsData);
      console.log('Badge Data:', data.badgesData);
      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error('Error generating image:', error);
      setError(`Error generating image: ${error.message}`); // Set error message with more wording
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='container'>
      <BannerForm onSubmit={handleImageSubmit} setError={setError} /> {/* Pass setError as a prop */}
      {loading && (
        <div className='loading-container'>
          <p>Generating the banner...</p>
          <div className='loading-icon'></div>
        </div>
      )}
      {error && <div className='error-message'>{error}</div>}
      {imageUrl && !error && (
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
