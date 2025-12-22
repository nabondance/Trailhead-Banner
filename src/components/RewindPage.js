'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { extractUsernameFromUrl, validateUsernameFormat, validateUsernameWithApi } from '../utils/usernameValidation';
import { generateIssueTitle, generateIssueBody } from '../utils/issueUtils';
import '../styles/globals.css';
import packageJson from '../../package.json';

const RewindPage = () => {
  const [username, setUsername] = useState('');
  const [flippedLetters, setFlippedLetters] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  useEffect(() => {
    const interval = setInterval(
      () => {
        const titleText = 'Trailhead Rewind';
        const randomIndex = Math.floor(Math.random() * titleText.length);

        // Skip spaces
        if (titleText[randomIndex] === ' ') return;

        setFlippedLetters((prev) => {
          const newSet = new Set(prev);
          if (!newSet.has(randomIndex)) {
            newSet.add(randomIndex);
          }
          return newSet;
        });
      },
      400 + Math.random() * 600
    ); // Random interval

    return () => clearInterval(interval);
  }, []);

  const handleUsernameChange = (e) => {
    const input = e.target.value.toLowerCase();
    const cleanUsername = extractUsernameFromUrl(input);
    setUsername(cleanUsername);
  };

  const handleUsernameBlur = async () => {
    if (!username) {
      setValidationResult(null);
      setError('');
      return;
    }

    const formatResult = validateUsernameFormat(username.toLowerCase());
    if (!formatResult.valid) {
      setError(formatResult.message);
      setValidationResult(formatResult);
      return;
    }

    const apiResult = await validateUsernameWithApi(username.toLowerCase());
    setError(apiResult.valid ? '' : apiResult.message);
    setValidationResult(apiResult);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setImageUrl(''); // Clear previous image
    setWarnings([]); // Clear previous warnings

    const usernameFormatResult = validateUsernameFormat(username.toLowerCase());
    if (!usernameFormatResult.valid) {
      setError(usernameFormatResult.message);
      setLoading(false);
      return;
    }

    const usernameApiResult = await validateUsernameWithApi(username.toLowerCase());
    if (!usernameApiResult.valid) {
      setError(usernameApiResult.message);
      setLoading(false);
      return;
    }

    try {
      console.log('Generating Trailhead Rewind for:', username);

      const response = await fetch('/api/generate-rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, year: 2025 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate rewind');
      }

      const data = await response.json();
      console.log('Rewind data:', data);

      setImageUrl(data.imageUrl);
      setWarnings(data.warnings || []);
    } catch (error) {
      console.error('Error generating rewind:', error);
      setError(error.message || 'Failed to generate rewind');
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (src) => {
    setFullscreenImage(src);
  };

  const handleOverlayClick = () => {
    setFullscreenImage(null);
  };

  const renderAnimatedTitle = () => {
    const titleText = 'Trailhead Rewind';
    return titleText.split('').map((char, index) => {
      if (char === ' ') {
        return <span key={index}> </span>;
      }
      return (
        <span key={index} className={`animated-letter ${flippedLetters.has(index) ? 'flipped-text' : ''}`}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className='container'>
      <div className='rewind-header'>
        <h1>{renderAnimatedTitle()}</h1>
        <h2>It was an amazing learning year, let's rewind it !</h2>
      </div>

      <form onSubmit={handleSubmit} className='form'>
        <div className='input-container'>
          <input
            type='text'
            value={username}
            onChange={handleUsernameChange}
            onBlur={handleUsernameBlur}
            placeholder='Enter Trailhead username'
            required
            className={`input ${validationResult?.state === 'invalid' ? 'input-error' : ''} ${validationResult?.state === 'private' ? 'input-warning' : ''} ${validationResult?.state === 'ok' ? 'input-success' : ''}`}
            name='trailhead-username'
            autoComplete='off'
            data-lpignore='true'
            data-form-type='other'
          />
          {validationResult && (
            <div className='validation-icon' data-tooltip={validationResult.message}>
              {validationResult.state === 'ok' ? (
                <FontAwesomeIcon icon={faCheck} className='fa-fw icon-valid' />
              ) : validationResult.state === 'private' ? (
                <FontAwesomeIcon icon={faTriangleExclamation} className='fa-fw icon-warning' />
              ) : (
                <FontAwesomeIcon icon={faCircleXmark} className='fa-fw icon-error' />
              )}
            </div>
          )}
          {!validationResult && (
            <div
              className='validation-icon clickable'
              data-tooltip='Need help? Click for guidance.'
              style={{ cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faQuestionCircle} className='fa-fw icon-help' />
            </div>
          )}
        </div>

        {error && (
          <div className='error-message'>
            {error}
            <p>
              If the error persists, consider writing an{' '}
              <a
                href={`https://github.com/nabondance/Trailhead-Banner/issues/new?title=${encodeURIComponent(
                  generateIssueTitle({ message: error })
                )}&body=${encodeURIComponent(
                  generateIssueBody({ message: error }, warnings || [], { username }, packageJson.version)
                )}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                issue
              </a>
            </p>
          </div>
        )}

        {!loading && (
          <button type='submit' className='button submit-button'>
            Generate Rewind
          </button>
        )}
      </form>

      {loading && (
        <div className='loading-container'>
          <p>Generating your Trailhead Rewind...</p>
          <div className='loading-icon'></div>
        </div>
      )}

      {imageUrl && !error && (
        <div className='image-container'>
          <Image
            src={imageUrl}
            alt='Generated Rewind'
            className='generated-image'
            width={2160}
            height={2700}
            unoptimized
            onClick={() => handleImageClick(imageUrl)}
          />
          <a href={imageUrl} download={`trailhead-rewind-${username}-2025.png`} className='download-link'>
            Download Rewind
          </a>
          {warnings.length > 0 && (
            <div className='warning-message'>
              <p>Rewind generated, with warnings:</p>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <p>
                If the error persists, consider writing an{' '}
                <a
                  href={`https://github.com/nabondance/Trailhead-Banner/issues/new?title=${encodeURIComponent(
                    'Warning: Rewind generated with warnings'
                  )}&body=${encodeURIComponent(generateIssueBody(null, warnings, { username }, packageJson.version))}`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  issue
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={handleOverlayClick}>
          <Image src={fullscreenImage} alt='Full Screen Rewind' layout='fill' objectFit='contain' unoptimized />
        </div>
      )}
    </div>
  );
};

export default RewindPage;
