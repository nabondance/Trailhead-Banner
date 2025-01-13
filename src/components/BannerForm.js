import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark } from '@fortawesome/free-solid-svg-icons';

const BannerForm = ({ onSubmit, setMainError, onValidationError }) => {
  const [options, setOptions] = useState({
    username: '',
    backgroundColor: '#0088CC',
    backgroundImageUrl: '',
    textColor: '#111827',
    displayBadgeCount: true,
    displaySuperbadgeCount: true,
    displayCertificationCount: true,
    displayRankLogo: true,
    displaySuperbadges: true,
    includeExpiredCertifications: false,
    includeRetiredCertifications: false,
  });
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

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
      console.log('Response:', response);
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

  const handleSubmit = async (e) => {
    setMainError(null); // Clear previous errors
    e.preventDefault();
    setIsGenerating(true); // Hide the button when clicked
    const isValidUsername = await validateUsername(options.username);
    const isValidImageUrl = await validateImageUrl(options.backgroundImageUrl);
    if (isValidUsername && isValidImageUrl) {
      await onSubmit(options);
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
          placeholder='Enter Trailhead username'
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
      <button type='button' className='button more-options-button' onClick={() => setShowOptions(!showOptions)}>
        {showOptions ? 'Hide Options' : 'More Options'}
      </button>
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
            <label>
              Custom Background Image (URL or Upload):
              <input
                type='text'
                value={options.backgroundImageUrl}
                onChange={handleUrlChange}
                placeholder='Enter image URL'
                className='input-url'
                autoComplete='off'
                data-lpignore='true' // LastPass specific attribute to ignore
                data-form-type='other'
              />
              {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
            </label>
          </fieldset>
          <fieldset>
            <legend>Text Options</legend>
            <label>
              Text Color:
              <input
                type='color'
                value={options.textColor}
                onChange={(e) => setOptions({ ...options, textColor: e.target.value })}
              />
            </label>
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
