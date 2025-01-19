'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { generateIssueTitle, generateIssueBody } from '../utils/issueUtils';
import LinkedInBannerTutorial from './LinkedInBannerTutorial';
import BannerForm from './BannerForm';
import '../styles/globals.css';
import packageJson from '../../package.json';

const MainPage = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainError, setMainError] = useState(null);
  const [mainWarning, setMainWarning] = useState(null);
  const [formOptions, setFormOptions] = useState({});
  const [fullscreenImage, setFullscreenImage] = useState(null);

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
      console.log('Data:', data);
      setImageUrl(data.imageUrl);
      setMainWarning(data.warnings);
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

  const handleImageClick = (src) => {
    setFullscreenImage(src);
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
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
              href={`https://github.com/nabondance/Trailhead-Banner/issues/new?title=${encodeURIComponent(generateIssueTitle(mainError))}&body=${encodeURIComponent(generateIssueBody(mainError, mainWarning, formOptions, packageJson.version))}`}
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
          <Image
            src={imageUrl}
            alt='Generated'
            className='generated-image'
            width={1584}
            height={396}
            unoptimized
            onClick={() => handleImageClick(imageUrl)}
          />
          <a href={imageUrl} download={`trailhead-banner-${formOptions.username}.png`} className='download-link'>
            Download Banner
          </a>
          {mainWarning.length > 0 && (
            <div className='warning-message'>
              <p>Banner generated, with warnings:</p>
              <ul>
                {mainWarning.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <p>
                If the error persists, consider writing an{' '}
                <a
                  href={`https://github.com/nabondance/Trailhead-Banner/issues/new?title=${encodeURIComponent('Warning happened')}&body=${encodeURIComponent(generateIssueBody(mainError, mainWarning, formOptions, packageJson.version))}`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  issue
                </a>
              </p>
            </div>
          )}
          <LinkedInBannerTutorial />
        </div>
      )}
      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={handleOverlayClick}>
          <Image src={fullscreenImage} alt='Full Screen Example' layout='fill' objectFit='contain' unoptimized />
        </div>
      )}
    </div>
  );
};

export default MainPage;
