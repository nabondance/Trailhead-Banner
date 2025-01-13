'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { generateIssueTitle, generateIssueBody } from '../utils/issueUtils';
import LinkedInBannerTutorial from './LinkedInBannerTutorial';
import BannerForm from './BannerForm';
import '../styles/globals.css';

const MainPage = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainError, setMainError] = useState(null);
  const [formOptions, setFormOptions] = useState({});

  const handleImageSubmit = async (options) => {
    console.log('Generating image for:', options.username);
    console.log('Options:', options);
    setFormOptions(options);
    console.log('Form Options:', formOptions);

    setImageUrl(''); // Clear the previously generated banner
    setLoading(true);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }
      const data = await response.json();
      console.log('Rank Data:', data.rankData);
      console.log('Certifications Data:', data.certificationsData);
      console.log('Badge Data:', data.badgesData);
      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error('Error generating image:', error);
      setMainError(error);
      console.log('Main Error:', mainError);
    } finally {
      setLoading(false);
    }
  };

  const handleValidationError = (error, options) => {
    setMainError(error);
    setFormOptions(options);
  };

  return (
    <div className='container'>
      <BannerForm onSubmit={handleImageSubmit} setMainError={setMainError} onValidationError={handleValidationError} />
      {loading && (
        <div className='loading-container'>
          <p>Generating the banner...</p>
          <div className='loading-icon'></div>
        </div>
      )}
      {mainError && (
        <div className='error-message'>
          {mainError.message}
          <p>
            If the error persists, consider writing an{' '}
            <a
              href={`https://github.com/nabondance/Trailhead-Banner/issues/new?title=${encodeURIComponent(generateIssueTitle(mainError))}&body=${encodeURIComponent(generateIssueBody(mainError, formOptions))}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              issue
            </a>
          </p>
        </div>
      )}
      {imageUrl && !mainError && (
        <div className='image-container'>
          <Image src={imageUrl} alt='Generated' className='generated-image' width={1584} height={396} unoptimized />
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
