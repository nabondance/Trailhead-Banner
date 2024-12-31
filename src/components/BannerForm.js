import React, { useState } from 'react';

const BannerForm = ({ onSubmit, setError }) => { // Add setError to the props
  const [username, setUsername] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f3f4f6');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [displaySuperbadges, setDisplaySuperbadges] = useState(true);
  const [includeExpiredCertifications, setIncludeExpiredCertifications] = useState(false);
  const [includeRetiredCertifications, setIncludeRetiredCertifications] = useState(false);
  const [textColor, setTextColor] = useState('#111827'); // Default text color
  const [isGenerating, setIsGenerating] = useState(false);
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [displayBadgeCount, setDisplayBadgeCount] = useState(true); // New state
  const [displaySuperbadgeCount, setDisplaySuperbadgeCount] = useState(true); // New state
  const [displayRankLogo, setDisplayRankLogo] = useState(true); // New state
  const [displayCertificationCount, setDisplayCertificationCount] = useState(true); // New state

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
    if (!username) {
      setValidationResult(null); // Clear validation result if username is empty
      setUsernameError(''); // Clear username error
    } else {
      await validateUsername(username);
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setBackgroundImageUrl(url);
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
    e.preventDefault();
    setIsGenerating(true); // Hide the button when clicked
    const isValidUsername = await validateUsername(username);
    const isValidImageUrl = await validateImageUrl(backgroundImageUrl);
    if (isValidUsername && isValidImageUrl) {
      await onSubmit({
        username,
        backgroundColor,
        backgroundImageUrl,
        displaySuperbadges,
        textColor,
        includeExpiredCertifications,
        includeRetiredCertifications,
        displayBadgeCount,
        displaySuperbadgeCount,
        displayRankLogo,
        displayCertificationCount,
      });
    } else {
      setError('Validation failed. Please check the input fields.'); // Send the error about the failed validation
    }
    setIsGenerating(false); // Show the button again when the banner is generated
  };

  return (
    <form onSubmit={handleSubmit} className='form'>
      <div className='input-container'>
        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
              <span className='icon success'>&#x2714;</span> // Green checkmark
            ) : validationResult.state === 'private' ? (
              <span className='icon warning'>&#x26A0;</span> // Yellow warning
            ) : (
              <span className='icon error'>&#x2716;</span> // Red cross
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
              <input type='color' value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </label>
            <label>
              Custom Background Image (URL or Upload):
              <input
                type='text'
                value={backgroundImageUrl}
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
              <input type='color' value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </label>
            <label>
              Show Badge Count:
              <input
                type='checkbox'
                checked={displayBadgeCount}
                onChange={(e) => setDisplayBadgeCount(e.target.checked)}
              />
            </label>
            <label>
              Show Superbadge Count:
              <input
                type='checkbox'
                checked={displaySuperbadgeCount}
                onChange={(e) => setDisplaySuperbadgeCount(e.target.checked)}
              />
            </label>
            <label>
              Show Certification Count:
              <input
                type='checkbox'
                checked={displayCertificationCount}
                onChange={(e) => setDisplayCertificationCount(e.target.checked)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Display Options</legend>
            <label>
              Show Rank Logo:
              <input type='checkbox' checked={displayRankLogo} onChange={(e) => setDisplayRankLogo(e.target.checked)} />
            </label>
            <label>
              Show Superbadges:
              <input
                type='checkbox'
                checked={displaySuperbadges}
                onChange={(e) => setDisplaySuperbadges(e.target.checked)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Certification Options</legend>
            <label>
              Include Expired Certifications:
              <input
                type='checkbox'
                checked={includeExpiredCertifications}
                onChange={(e) => setIncludeExpiredCertifications(e.target.checked)}
              />
            </label>
            <label>
              Include Retired Certifications:
              <input
                type='checkbox'
                checked={includeRetiredCertifications}
                onChange={(e) => setIncludeRetiredCertifications(e.target.checked)}
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
