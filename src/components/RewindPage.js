'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { extractUsernameFromUrl, validateUsernameFormat, validateUsernameWithApi } from '../utils/usernameValidation';
import '../styles/globals.css';

const RewindPage = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

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
      // TODO: Replace with actual Rewind API call
      console.log('Generating Trailhead Rewind for:', username);
      // Placeholder for Rewind-specific API call
      // const response = await fetch('/api/generate-rewind', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username }),
      // });

      // For now, just show a placeholder message
      alert(`Rewind generation for ${username} would be implemented here!`);
    } catch (error) {
      console.error('Error generating rewind:', error);
      setError(error.message || 'Failed to generate rewind');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='container'>
      <h1>Trailhead Rewind</h1>
      <h2>Generate your Trailhead rewind.</h2>

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

        {error && <div className='error-message'>{error}</div>}

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
    </div>
  );
};

export default RewindPage;
