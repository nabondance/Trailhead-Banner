import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';
import bannerBackground from '../data/banners.json';

const BannerForm = ({ onSubmit, setMainError, onValidationError }) => {
  const [options, setOptions] = useState({
    username: '',
    backgroundColor: '#5badd6',
    backgroundImageUrl: '',
    displayBadgeCount: true,
    displaySuperbadgeCount: true,
    displayCertificationCount: true,
    displayRankLogo: true,
    displaySuperbadges: true,
    includeExpiredCertifications: false,
    includeRetiredCertifications: false,
    counterDisplayType: 'badge',
    textColor: '#000000',
    badgeLabelColor: '#555',
    badgeMessageColor: '#1F80C0',
  });
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [showPredefinedImages, setShowPredefinedImages] = useState(false);
  const [predefinedBackgroundImageUrl, setPredefinedBackgroundImageUrl] = useState('');

  const validateUsername = async (username) => {
    if (!username) {
      setUsernameError('Enter an username');
      setValidationResult({ valid: false, state: 'invalid', message: 'Enter an username' });
      return false;
    }

    try {
      const response = await fetch(`/api/validate-username?username=${username}`);
      const data = await response.json();
      setValidationResult(data);
      if (data.valid) {
        setUsernameError('');
        return true;
      } else {
        setUsernameError(data.message); // Display the message from the API
        return false;
      }
    } catch (error) {
      console.error('Error validating username:', error);
      setUsernameError('Failed to validate username');
      setValidationResult({ valid: false, state: 'invalid', message: 'Failed to validate username' });
      return false;
    }
  };

  const handleUsernameBlur = async () => {
    if (!options.username) {
      setValidationResult(null); // Clear validation result if username is empty
      setUsernameError(''); // Clear username error
    } else {
      await validateUsername(options.username);
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setOptions({ ...options, backgroundImageUrl: url });
    if (!url) {
      setBackgroundImageUrlError(''); // Clear error message if input is emptied
    }
  };

  const validateImageUrl = async (url) => {
    if (!url) {
      setBackgroundImageUrlError('');
      return true;
    }

    try {
      console.log('Validating image URL:', url);
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (response.ok && response.headers.get('content-type').startsWith('image/')) {
        setBackgroundImageUrlError('');
        return true;
      } else {
        setBackgroundImageUrlError('Invalid image URL');
        return false;
      }
    } catch (error) {
      console.error('Error validating image URL:', error);
      setBackgroundImageUrlError('Failed to fetch the image URL');
      return false;
    }
  };

  const handlePredefinedImageChange = (src) => {
    const baseUrl = window.location.origin;
    const newUrl = `${baseUrl}${src}`;
    setPredefinedBackgroundImageUrl((prevUrl) => (prevUrl === newUrl ? '' : newUrl));
  };

  const handleSubmit = async (e) => {
    setMainError(null); // Clear previous errors
    e.preventDefault();
    setIsGenerating(true); // Hide the button when clicked
    setShowOptions(false); // Hide the options when generating
    const isValidUsername = await validateUsername(options.username);
    const isValidImageUrl = await validateImageUrl(options.backgroundImageUrl || predefinedBackgroundImageUrl);
    if (isValidUsername && isValidImageUrl) {
      await onSubmit({ ...options, backgroundImageUrl: options.backgroundImageUrl || predefinedBackgroundImageUrl });
    } else {
      const validationError = new Error('Validation failed. Please check the input fields.');
      onValidationError(validationError, options);
    }
    setIsGenerating(false); // Show the button again when the banner is generated
  };

  return (
    <form onSubmit={handleSubmit} className='form'>
      <div className='input-container'>
        <input
          type='text'
          value={options.username}
          onChange={(e) => setOptions({ ...options, username: e.target.value })}
          onBlur={handleUsernameBlur} // Add onBlur event to validate username
          placeholder='Enter Trailhead username' // Add placeholder
          required
          className={`input ${validationResult?.state === 'invalid' ? 'input-error' : ''} ${validationResult?.state === 'private' ? 'input-warning' : ''} ${validationResult?.state === 'ok' ? 'input-success' : ''}`}
          name='trailhead-username'
          autoComplete='off'
          data-lpignore='true' // LastPass specific attribute to ignore
          data-form-type='other'
        />
        {validationResult && (
          <div className='validation-icon' data-tooltip={validationResult.message}>
            {validationResult.state === 'ok' ? (
              <FontAwesomeIcon icon={faCheck} className='fa-fw icon-valid' /> // Checkmark
            ) : validationResult.state === 'private' ? (
              <FontAwesomeIcon icon={faTriangleExclamation} className='fa-fw icon-warning' /> // Yellow warning
            ) : (
              <FontAwesomeIcon icon={faCircleXmark} className='fa-fw icon-error' /> // Red cross
            )}
          </div>
        )}
      </div>
      {!isGenerating && (
        <button type='button' className='button more-options-button' onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? 'Hide Options' : 'More Options'}
        </button>
      )}
      {showOptions && (
        <div className='options'>
          <fieldset>
            <legend>Background Options</legend>
            <label>
              Background Color:
              <input
                type='color'
                value={options.backgroundColor}
                onChange={(e) => setOptions({ ...options, backgroundColor: e.target.value })}
              />
            </label>
            <label
              onClick={() => setShowPredefinedImages(!showPredefinedImages)}
              style={{ cursor: 'pointer', color: 'var(--primary)' }}
            >
              {showPredefinedImages ? 'Hide Predefined Backgrounds' : 'Select Predefined Background'}
            </label>
            {showPredefinedImages && (
              <div className='predefined-background'>
                {bannerBackground.map((image) => (
                  <Image
                    key={image.src}
                    src={image.src}
                    alt={image.description}
                    width={200}
                    height={50}
                    className={`thumbnail ${predefinedBackgroundImageUrl === `${window.location.origin}${image.src}` ? 'selected' : ''}`}
                    onClick={() => handlePredefinedImageChange(image.src)}
                  />
                ))}
              </div>
            )}
            <label>
              Custom Background Image:
              <input
                type='text'
                value={options.backgroundImageUrl}
                onChange={handleUrlChange}
                placeholder='Enter image URL' // Add placeholder
                className='input-url'
                autoComplete='off'
                data-lpignore='true' // LastPass specific attribute to ignore
                data-form-type='other'
              />
              {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
            </label>
          </fieldset>
          <fieldset>
            <legend>Counter Options</legend>
            <div className='counter-options'>
              <div className='right-options'>
                <label>
                  Show Badge Count:
                  <input
                    type='checkbox'
                    checked={options.displayBadgeCount}
                    onChange={(e) => setOptions({ ...options, displayBadgeCount: e.target.checked })}
                  />
                </label>
                <label>
                  Show Superbadge Count:
                  <input
                    type='checkbox'
                    checked={options.displaySuperbadgeCount}
                    onChange={(e) => setOptions({ ...options, displaySuperbadgeCount: e.target.checked })}
                  />
                </label>
                <label>
                  Show Certification Count:
                  <input
                    type='checkbox'
                    checked={options.displayCertificationCount}
                    onChange={(e) => setOptions({ ...options, displayCertificationCount: e.target.checked })}
                  />
                </label>
              </div>
              <div className='left-options'>
                <label className='counter-display'>
                  Display Type:
                  <select
                    value={options.counterDisplayType}
                    onChange={(e) => setOptions({ ...options, counterDisplayType: e.target.value })}
                  >
                    <option value='text'>Text</option>
                    <option value='badge'>Badge</option>
                  </select>
                </label>
                {options.counterDisplayType === 'text' && (
                  <label>
                    Text Color:
                    <input
                      type='color'
                      value={options.textColor}
                      onChange={(e) => setOptions({ ...options, textColor: e.target.value })}
                    />
                  </label>
                )}
                {options.counterDisplayType === 'badge' && (
                  <>
                    <label>
                      Counter Badge Label Color:
                      <input
                        type='color'
                        value={options.badgeLabelColor}
                        onChange={(e) => setOptions({ ...options, badgeLabelColor: e.target.value })}
                      />
                    </label>
                    <label>
                      Counter Badge Message Color:
                      <input
                        type='color'
                        value={options.badgeMessageColor}
                        onChange={(e) => setOptions({ ...options, badgeMessageColor: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Display Options</legend>
            <label>
              Show Rank Logo:
              <input
                type='checkbox'
                checked={options.displayRankLogo}
                onChange={(e) => setOptions({ ...options, displayRankLogo: e.target.checked })}
              />
            </label>
            <label>
              Show Superbadges:
              <input
                type='checkbox'
                checked={options.displaySuperbadges}
                onChange={(e) => setOptions({ ...options, displaySuperbadges: e.target.checked })}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Certification Options</legend>
            <label>
              Include Expired Certifications:
              <input
                type='checkbox'
                checked={options.includeExpiredCertifications}
                onChange={(e) => setOptions({ ...options, includeExpiredCertifications: e.target.checked })}
              />
            </label>
            <label>
              Include Retired Certifications:
              <input
                type='checkbox'
                checked={options.includeRetiredCertifications}
                onChange={(e) => setOptions({ ...options, includeRetiredCertifications: e.target.checked })}
              />
            </label>
          </fieldset>
        </div>
      )}
      {!isGenerating && (
        <button type='submit' className='button submit-button'>
          Generate Banner
        </button>
      )}
    </form>
  );
};

export default BannerForm;
