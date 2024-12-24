'use client';

import React, { useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import LinkedInBannerTutorial from './LinkedInBannerTutorial';

const Page = () => {
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setImageUrl('');
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
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
      <form onSubmit={handleImageSubmit} className='form'>
        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='Enter Trailhead username'
          required
          className='input'
        />
        {!loading && (
          <button type='submit' className='button'>
            Generate Banner
          </button>
        )}
      </form>
      {loading && (
        <div className='loading-container'>
          <p>Generating the banner...</p>
          <div className='loading-icon'></div>
        </div>
      )}
      {imageUrl && (
        <div className='image-container'>
          <h2>Generated Banner</h2>
          <img src={imageUrl} alt='Generated' className='generated-image' />
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

export default Page;
