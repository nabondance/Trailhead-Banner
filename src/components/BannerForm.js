import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
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
    displayTrailCount: false,
    displayPointCount: false,
    displayRankLogo: true,
    displaySuperbadges: true,
    includeExpiredCertifications: false,
    includeRetiredCertifications: false,
    textColor: '#000000',
    badgeLabelColor: '#555555',
    badgeMessageColor: '#1F80C0',
    backgroundKind: 'library', // Default to library
    backgroundLibraryUrl: `${window.location.origin}${bannerBackground[5].src}`, // Set default background library URL
    customBackgroundImageUrl: '',
    displayLastXCertifications: false,
    lastXCertifications: '',
    displayLastXSuperbadges: false,
    lastXSuperbadges: '',
    certificationSort: 'date',
    certificationSortOrder: 'descendant',
    certificationAlignment: 'center',
    displaySalesforceCertifications: true,
    displayAccreditedProfessionalCertifications: true,
    displayAgentblazerRank: true,
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const validateUsername = async (username, api_check) => {
    username = username.toLowerCase();
    setUsernameError(''); // Clear username error
    setValidationResult(null); // Clear validation result
    if (!username) {
      setUsernameError('Enter an username');
      setValidationResult({ valid: false, state: 'invalid', message: 'Enter an username' });
      return { valid: false, state: 'invalid', message: 'Enter an username' };
    }

    if (username.startsWith('http://') || username.startsWith('https://')) {
      setUsernameError("username shouldn't be an URL");
      setValidationResult({ valid: false, state: 'invalid', message: "username shouldn't be an URL" });
      return { valid: false, state: 'invalid', message: "username shouldn't be an URL" };
    }

    if (username.includes('@')) {
      setUsernameError("username shouldn't be an email address");
      setValidationResult({ valid: false, state: 'invalid', message: "username shouldn't be an email address" });
      return { valid: false, state: 'invalid', message: "username shouldn't be an email address" };
    }

    if (username.includes(' ')) {
      setUsernameError("username shouldn't contain spaces");
      setValidationResult({ valid: false, state: 'invalid', message: "username shouldn't contain spaces" });
      return { valid: false, state: 'invalid', message: "username shouldn't contain spaces" };
    }

    if (api_check) {
      try {
        const response = await fetch(`/api/validate-username?username=${username}`);
        const data = await response.json();
        setValidationResult(data);
        if (data.valid) {
          setUsernameError('');
          return data;
        } else {
          setUsernameError(data.message); // Display the message from the API
          return data;
        }
      } catch (error) {
        console.error('Error validating username:', error);
        setUsernameError('Failed to validate username');
        setValidationResult({ valid: false, state: 'invalid', message: 'Failed to validate username' });
        return { valid: false, state: 'invalid', message: 'Failed to validate username' };
      }
    }

    return { valid: true, state: 'ok', message: 'looks ok' };
  };

  const handleUsernameBlur = async () => {
    if (!options.username) {
      setValidationResult(null); // Clear validation result if username is empty
      setUsernameError(''); // Clear username error
    } else {
      await validateUsername(options.username.toLowerCase(), false);
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setOptions({ ...options, customBackgroundImageUrl: url });
    if (!url) {
      setBackgroundImageUrlError(''); // Clear error message if input is emptied
    }
  };

  const validateImageUrl = async (url) => {
    setBackgroundImageUrlError(''); // Clear image URL error
    if (!url) {
      setBackgroundImageUrlError('');
      return { valid: true };
    }

    try {
      console.debug('Validating image URL:', url);
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors', redirect: 'follow' });
      if (response.ok || response.type === 'opaque') {
        setBackgroundImageUrlError('');
        return { valid: true };
      } else {
        setBackgroundImageUrlError('Invalid image URL');
        return { valid: false, message: 'Invalid image URL' };
      }
    } catch (error) {
      console.error('Error validating image URL:', error);
      setBackgroundImageUrlError('Failed to fetch the image URL');
      return { valid: false, message: 'Failed to fetch the image URL' };
    }
  };

  const handlePredefinedImageChange = (src) => {
    const baseUrl = window.location.origin;
    const newUrl = `${baseUrl}${src}`;
    setOptions({ ...options, backgroundLibraryUrl: newUrl });
  };

  const handleBackgroundKindChange = (e) => {
    setOptions({ ...options, backgroundKind: e.target.value });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setBackgroundImageUrlError('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setOptions({
          ...options,
          backgroundImageUrl: reader.result,
          customBackgroundImageUrl: '', // Clear custom URL when uploading
        });
        setUploadedFile(file);
        setBackgroundImageUrlError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    setMainError(null); // Clear previous errors
    e.preventDefault();
    setIsGenerating(true); // Hide the button when clicked
    setShowOptions(false); // Hide the options when generating

    const usernameValidation = await validateUsername(options.username, true);
    const imageUrlValidation =
      options.backgroundKind === 'custom' ? await validateImageUrl(options.customBackgroundImageUrl) : { valid: true };

    if (!usernameValidation.valid || !imageUrlValidation.valid) {
      const errorMessages = [];
      if (!usernameValidation.valid) errorMessages.push(usernameValidation.message);
      if (!imageUrlValidation.valid) errorMessages.push(imageUrlValidation.message);

      const validationError = new Error(`Validation failed: ${errorMessages.join('. And ')}`);
      setMainError(validationError);
      setIsGenerating(false);
      return;
    }

    // Determine which URL to use based on background kind
    let backgroundImageUrl = '';
    if (options.backgroundKind === 'library') {
      backgroundImageUrl = options.backgroundLibraryUrl;
    } else if (options.backgroundKind === 'custom') {
      backgroundImageUrl = options.customBackgroundImageUrl;
    } else if (options.backgroundKind === 'upload') {
      backgroundImageUrl = options.backgroundImageUrl;
    }

    await onSubmit({
      ...options,
      backgroundImageUrl,
      lastXCertifications: options.lastXCertifications ? parseInt(options.lastXCertifications) : undefined,
      lastXSuperbadges: options.lastXSuperbadges ? parseInt(options.lastXSuperbadges) : undefined,
    });

    setIsGenerating(false);
  };

  return (
    <form onSubmit={handleSubmit} className='form'>
      <div className='input-container'>
        <input
          type='text'
          value={options.username}
          onChange={(e) => setOptions({ ...options, username: e.target.value.toLowerCase() })}
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
        {!validationResult && (
          <div className='validation-icon' data-tooltip='Check the How-To page to get guidance.'>
            <FontAwesomeIcon icon={faQuestionCircle} className='fa-fw icon-help' />
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
            <label className='picklist'>
              Background Kind:
              <select value={options.backgroundKind} onChange={handleBackgroundKindChange}>
                <option value='library'>Background Library</option>
                <option value='custom'>Custom URL</option>
                <option value='upload'>Upload Image</option>
                <option value='monochromatic'>Monochromatic Background</option>
              </select>
            </label>
            {options.backgroundKind === 'monochromatic' && (
              <label>
                Background Color:
                <input
                  type='color'
                  value={options.backgroundColor}
                  onChange={(e) => setOptions({ ...options, backgroundColor: e.target.value })}
                />
              </label>
            )}
            {options.backgroundKind === 'custom' && (
              <label>
                Custom Background Url:
                <input
                  type='text'
                  value={options.customBackgroundImageUrl}
                  onChange={handleUrlChange}
                  placeholder='Enter image URL'
                  className='input-url'
                  autoComplete='off'
                  data-lpignore='true'
                  data-form-type='other'
                />
                {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
              </label>
            )}
            {options.backgroundKind === 'upload' && (
              <label>
                Upload Background Image:
                <input type='file' accept='image/*' onChange={handleFileChange} className='input-file' />
                {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
                {uploadedFile && <p className='file-info'>Selected file: {uploadedFile.name}</p>}
              </label>
            )}
            {options.backgroundKind === 'library' && (
              <div className='predefined-background'>
                {bannerBackground.map((image) => (
                  <Image
                    key={image.src}
                    src={image.src}
                    alt={image.description}
                    width={200}
                    height={50}
                    className={`thumbnail ${options.backgroundLibraryUrl === `${window.location.origin}${image.src}` ? 'selected' : ''}`}
                    onClick={() => handlePredefinedImageChange(image.src)}
                  />
                ))}
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Counter Options</legend>
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
            <label>
              Show Trail Count:
              <input
                type='checkbox'
                checked={options.displayTrailCount}
                onChange={(e) => setOptions({ ...options, displayTrailCount: e.target.checked })}
              />
            </label>
            <label>
              Show Point Count:
              <input
                type='checkbox'
                checked={options.displayPointCount}
                onChange={(e) => setOptions({ ...options, displayPointCount: e.target.checked })}
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
              Show Agentblazer Rank:
              <input
                type='checkbox'
                checked={options.displayAgentblazerRank}
                onChange={(e) => setOptions({ ...options, displayAgentblazerRank: e.target.checked })}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Superbadge Options</legend>
            <label>
              Show Superbadges:
              <input
                type='checkbox'
                checked={options.displaySuperbadges}
                onChange={(e) => setOptions({ ...options, displaySuperbadges: e.target.checked })}
              />
            </label>
            <label>
              Limit Number of Superbadges:
              <input
                type='checkbox'
                checked={options.displayLastXSuperbadges}
                onChange={(e) => setOptions({ ...options, displayLastXSuperbadges: e.target.checked })}
              />
            </label>
            {options.displayLastXSuperbadges && (
              <label>
                Number of Superbadges:
                <input
                  type='number'
                  value={options.lastXSuperbadges}
                  onChange={(e) => setOptions({ ...options, lastXSuperbadges: e.target.value })}
                  min='1'
                  placeholder='Enter number'
                  className='input-number'
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>Certification Options</legend>
            <label>
              Display Salesforce Certifications:
              <input
                type='checkbox'
                checked={options.displaySalesforceCertifications}
                onChange={(e) => setOptions({ ...options, displaySalesforceCertifications: e.target.checked })}
              />
            </label>
            <label>
              Display Accredited Professional Certifications:
              <input
                type='checkbox'
                checked={options.displayAccreditedProfessionalCertifications}
                onChange={(e) =>
                  setOptions({ ...options, displayAccreditedProfessionalCertifications: e.target.checked })
                }
              />
            </label>
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
            <label>
              Limit Number of Certifications:
              <input
                type='checkbox'
                checked={options.displayLastXCertifications}
                onChange={(e) => setOptions({ ...options, displayLastXCertifications: e.target.checked })}
              />
            </label>
            {options.displayLastXCertifications && (
              <label>
                Number of Certifications:
                <input
                  type='number'
                  value={options.lastXCertifications}
                  onChange={(e) => setOptions({ ...options, lastXCertifications: e.target.value })}
                  min='1'
                  placeholder='Enter number'
                  className='input-number'
                />
              </label>
            )}
            <label className='picklist'>
              Sort By:
              <select
                value={options.certificationSort}
                onChange={(e) => setOptions({ ...options, certificationSort: e.target.value })}
              >
                <option value='date'>Date</option>
                <option value='category'>Category</option>
                <option value='difficulty'>Difficulty</option>
              </select>
            </label>
            <label className='picklist'>
              Sort Order:
              <select
                value={options.certificationSortOrder}
                onChange={(e) => setOptions({ ...options, certificationSortOrder: e.target.value })}
              >
                <option value='ascendant'>Ascendant</option>
                <option value='descendant'>Descendant</option>
              </select>
            </label>
            <label className='picklist'>
              Certification Alignment:
              <select
                value={options.certificationAlignment}
                onChange={(e) => setOptions({ ...options, certificationAlignment: e.target.value })}
              >
                <option value='center'>Center</option>
                <option value='left'>Left</option>
                <option value='right'>Right</option>
              </select>
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
