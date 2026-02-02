'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { extractUsernameFromUrl, validateUsernameFormat, validateUsernameWithApi } from '../utils/usernameValidation';
import { generateIssueTitle, generateIssueBody } from '../utils/issueUtils';
import RewindCount from './RewindCount';
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
  const rewindCountRef = useRef(null);
  const YEAR = 2025;

  useEffect(() => {
    const interval = setInterval(
      () => {
        const titleText = 'Trailhead Rewind';

        setFlippedLetters((prev) => {
          // Get all non-space indices that haven't been flipped yet
          const availableIndices = [];
          for (let i = 0; i < titleText.length; i++) {
            if (titleText[i] !== ' ' && !prev.has(i)) {
              availableIndices.push(i);
            }
          }

          // If no more letters to flip, return unchanged
          if (availableIndices.length === 0) {
            return prev;
          }

          // Pick a random available index and flip it
          const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
          const newSet = new Set(prev);
          newSet.add(randomIndex);
          return newSet;
        });
      },
      400 + Math.random() * 600
    ); // Random interval

    return () => clearInterval(interval);
  }, []);

  const handleUsernameChange = (e) => {
    const input = e.target.value;
    const cleanUsername = extractUsernameFromUrl(input);

    // Clear previous errors when user starts typing
    if (error) {
      setError('');
    }
    if (validationResult?.state === 'invalid') {
      setValidationResult(null);
    }

    // Apply additional client-side sanitization
    const sanitizedUsername = cleanUsername
      .toLowerCase()
      .replace(/[^a-zA-Z0-9._-]/g, '') // Remove invalid characters
      .substring(0, 64); // Limit length

    setUsername(sanitizedUsername);
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

  // Client-side validation helper
  const validateClientInput = (username) => {
    const errors = [];

    if (!username || username.trim().length === 0) {
      errors.push('Username is required');
    } else if (username.length < 4) {
      errors.push('Username must be at least 4 characters long');
    } else if (username.length > 64) {
      errors.push('Username is too long (max 64 characters)');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, dots, hyphens, and underscores');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setImageUrl(''); // Clear previous image
    setWarnings([]); // Clear previous warnings

    // Client-side validation
    const clientErrors = validateClientInput(username);
    if (clientErrors.length > 0) {
      setError(clientErrors[0]); // Show first error
      setLoading(false);
      return;
    }

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
      console.debug('Generating Trailhead Rewind for:', username);
      const response = await fetch('/api/banner/rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, year: YEAR }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle different error types with user-friendly messages
        let userMessage = 'Failed to generate rewind';

        switch (response.status) {
          case 400:
            userMessage = errorData.details
              ? `Input error: ${errorData.details.join(', ')}`
              : 'Please check your username and try again';
            break;
          case 404:
            userMessage = 'Trailhead profile not found. Please verify your username is correct';
            break;
          case 422:
            userMessage =
              'Not enough Trailhead data found to create a meaningful rewind. Try earning some badges or certifications first!';
            break;
          case 429:
            userMessage = 'Too many requests. Please wait a moment and try again';
            break;
          case 503:
            userMessage = 'Trailhead services are temporarily unavailable. Please try again in a few minutes';
            break;
          default:
            userMessage = errorData.message || errorData.error || 'An unexpected error occurred';
        }

        throw new Error(userMessage);
      }

      const data = await response.json();
      console.debug('Rewind data:', data);

      setImageUrl(data.imageUrl);
      setWarnings(data.warnings || []);
      rewindCountRef.current.fetchCount(); // Refresh the rewind count
    } catch (error) {
      console.error('Error generating rewind:', error);

      // Handle network errors with user-friendly messages
      let userMessage = error.message;

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userMessage = 'Unable to connect to the server. Please check your internet connection and try again';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. The server might be busy, please try again in a moment';
      }

      setError(userMessage);
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
        <h2>Ready to showcase your {YEAR} achievements?</h2>
        <p>One image. One year. Your Trailhead story.</p>
      </div>

      <RewindCount ref={rewindCountRef} />
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
          <a href={imageUrl} download={`trailhead-rewind-${username}-${YEAR}.png`} className='download-link'>
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

      <p className='disclaimer'>
        Some yearly details (badges, points, rank changes) aren't available yet via Trailhead APIs, but I'm tracking API
        updates. 🫶
      </p>
    </div>
  );
};

export default RewindPage;
