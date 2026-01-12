'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faTriangleExclamation,
  faCircleXmark,
  faQuestionCircle,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip';
import bannerBackground from '../data/banners.json';
import { extractUsernameFromUrl, validateUsernameFormat, validateUsernameWithApi } from '../utils/usernameValidation';
import { validateImageUrl } from '../utils/imageValidation';
import {
  handleFileChange,
  handleBackgroundKindChange,
  handleBackgroundColorChange,
  handleCustomUrlChange,
  handlePredefinedImageChange,
  getBackgroundPreviewSrc,
} from '../utils/backgroundUtils';

const BackgroundPreview = ({ src, backgroundColor }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas dimensions based on LinkedIn banner aspect ratio
    canvas.width = 1584;
    canvas.height = 396;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (src) {
      // Load and draw image background exactly like in generateImage.js
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onerror = () => {
        console.error('Failed to load image:', src);
        // On error, show background color
        ctx.fillStyle = backgroundColor || '#5badd6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      // For library backgrounds, use the raw path without window.location.origin
      const imagePath = src.includes(window.location.origin) ? src.replace(window.location.origin, '') : src;
      img.src = imagePath;
    } else {
      // Draw solid background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [src, backgroundColor]);

  return (
    <div className='background-preview'>
      <h3>Background Preview</h3>
      <div className='canvas-container'>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

const BannerForm = ({ onSubmit, setMainError, onValidationError }) => {
  const router = useRouter();

  const [options, setOptions] = useState({
    username: '',
    backgroundColor: '#5badd6',
    backgroundImageUrl: '',
    displayBadgeCount: true,
    displaySuperbadgeCount: true,
    displayCertificationCount: true,
    displayTrailCount: false,
    displayPointCount: false,
    displayStampCount: false,
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
    superbadgeAlignment: 'left',
    displaySalesforceCertifications: true,
    displayAccreditedProfessionalCertifications: true,
    displayAgentblazerRank: true,
    agentblazerRankDisplay: 'current',
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [lastValidatedUsername, setLastValidatedUsername] = useState(null);

  const handleUsernameBlur = async () => {
    if (!options.username) {
      setValidationResult(null);
      setUsernameError('');
      setLastValidatedUsername(null);
      return;
    }

    const formatResult = validateUsernameFormat(options.username.toLowerCase());
    if (!formatResult.valid) {
      setUsernameError(formatResult.message);
      setValidationResult(formatResult);
      setLastValidatedUsername(null);
      return;
    }

    const apiResult = await validateUsernameWithApi(options.username.toLowerCase());
    setUsernameError(apiResult.valid ? '' : apiResult.message);
    setValidationResult(apiResult);
    // Store the validated username if validation was successful
    if (apiResult.valid) {
      setLastValidatedUsername(options.username.toLowerCase());
    } else {
      setLastValidatedUsername(null);
    }
  };

  const handleUsernameChange = (e) => {
    const input = e.target.value.toLowerCase();
    const cleanUsername = extractUsernameFromUrl(input);
    setOptions({ ...options, username: cleanUsername });
    // Reset validation cache and clear visual feedback when username changes
    if (cleanUsername !== lastValidatedUsername) {
      setLastValidatedUsername(null);
      setValidationResult(null);
      setUsernameError('');
    }
  };

  const handleBackgroundChange = (e) => {
    handleBackgroundKindChange(e.target.value, setOptions);
  };

  const handleColorChange = (e) => {
    handleBackgroundColorChange(e.target.value, setOptions);
  };

  const handleUrlChange = (e) => {
    handleCustomUrlChange(e.target.value, setOptions, setBackgroundImageUrlError);
  };

  const handleImageChange = async (e) => {
    await handleFileChange(e.target.files[0], setBackgroundImageUrlError, setOptions, setUploadedFile);
  };

  const handlePredefinedImage = (src) => {
    handlePredefinedImageChange(src, setOptions);
  };

  const handleHelpClick = () => {
    router.push('/how-to');
  };

  const handleSubmit = async (e) => {
    setMainError(null);
    e.preventDefault();
    setIsGenerating(true);
    setShowOptions(false);

    // Basic format validation on client side for immediate feedback
    const usernameFormatResult = validateUsernameFormat(options.username.toLowerCase());
    if (!usernameFormatResult.valid) {
      setMainError(new Error(usernameFormatResult.message));
      onValidationError(new Error(usernameFormatResult.message), options);
      setIsGenerating(false);
      return;
    }

    // Reuse cached validation result if username hasn't changed
    let usernameApiResult;
    if (lastValidatedUsername === options.username.toLowerCase() && validationResult?.valid) {
      usernameApiResult = validationResult;
    } else {
      usernameApiResult = await validateUsernameWithApi(options.username.toLowerCase());
    }

    const imageUrlValidation =
      options.backgroundKind === 'customUrl'
        ? await validateImageUrl(options.customBackgroundImageUrl)
        : { valid: true };

    if (!usernameApiResult.valid || !imageUrlValidation.valid) {
      const errorMessages = [];
      if (!usernameApiResult.valid) errorMessages.push(usernameApiResult.message);
      if (!imageUrlValidation.valid) errorMessages.push(imageUrlValidation.message);

      const validationError = new Error(`Validation failed: ${errorMessages.join('. And ')}`);
      setMainError(validationError);
      onValidationError(validationError, options);
      setIsGenerating(false);
      return;
    }

    const backgroundImageUrl = getBackgroundPreviewSrc(options);

    await onSubmit({
      ...options,
      backgroundImageUrl,
      lastValidatedUsername, // Pass to backend for validation caching
      lastXCertifications: options.lastXCertifications ? parseInt(options.lastXCertifications) : undefined,
      lastXSuperbadges: options.lastXSuperbadges ? parseInt(options.lastXSuperbadges) : undefined,
    });

    setIsGenerating(false);
  };

  // Form itself
  return (
    <form onSubmit={handleSubmit} className='form'>
      <div className='input-container'>
        <input
          type='text'
          value={options.username}
          onChange={handleUsernameChange}
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
          <div
            className='validation-icon'
            data-tooltip-id='validation-result-tooltip'
            data-tooltip-content={validationResult.message}
          >
            {validationResult.state === 'ok' ? (
              <FontAwesomeIcon icon={faCheck} className='fa-fw icon-valid' /> // Check mark
            ) : validationResult.state === 'private' ? (
              <FontAwesomeIcon icon={faTriangleExclamation} className='fa-fw icon-warning' /> // Yellow warning
            ) : (
              <FontAwesomeIcon icon={faCircleXmark} className='fa-fw icon-error' /> // Red cross
            )}
          </div>
        )}
        <Tooltip id='validation-result-tooltip' place='top' delayShow={200} className='react-tooltip' />
        {!validationResult && (
          <div
            className='validation-icon clickable'
            data-tooltip-id='help-tooltip'
            onClick={handleHelpClick}
            style={{ cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faQuestionCircle} className='fa-fw icon-help' />
          </div>
        )}
        <Tooltip id='help-tooltip' place='top' delayShow={200} className='react-tooltip'>
          Need help? Click for guidance.
        </Tooltip>
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
              <select value={options.backgroundKind} onChange={handleBackgroundChange}>
                <option value='library'>Background Library</option>
                <option value='upload'>Upload Image</option>
                <option value='customUrl'>Custom URL</option>
                <option value='monochromatic'>Solid Color</option>
              </select>
            </label>
            {options.backgroundKind === 'monochromatic' && (
              <label>
                Background Color:
                <input type='color' value={options.backgroundColor} onChange={handleColorChange} />
              </label>
            )}
            {options.backgroundKind === 'upload' && (
              <label>
                Upload Background Image:
                <input type='file' accept='image/*' onChange={handleImageChange} className='input-file' />
                <p className='helper-text'>Recommended image size: 1584 x 396 pixels</p>
                {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
                {uploadedFile && <p className='file-info'>Selected file: {uploadedFile.name}</p>}
              </label>
            )}
            {options.backgroundKind === 'customUrl' && (
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
                <p className='helper-text'>Recommended image size: 1584 x 396 pixels</p>
                {backgroundImageUrlError && <p className='error-message'>{backgroundImageUrlError}</p>}
              </label>
            )}
            {options.backgroundKind === 'library' && (
              <div className='predefined-background'>
                {bannerBackground.map((image) => (
                  <img
                    key={image.src}
                    src={image.src}
                    alt={image.description}
                    width={200}
                    height={50}
                    className={`thumbnail ${options.backgroundLibraryUrl === `${window.location.origin}${image.src}` ? 'selected' : ''}`}
                    onClick={() => handlePredefinedImage(image.src)}
                  />
                ))}
              </div>
            )}
            <BackgroundPreview src={getBackgroundPreviewSrc(options)} backgroundColor={options.backgroundColor} />
          </fieldset>
          <fieldset>
            <legend>Counter Options</legend>
            <label>
              <input
                type='checkbox'
                checked={options.displayBadgeCount}
                onChange={(e) => setOptions({ ...options, displayBadgeCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Badge Count</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displaySuperbadgeCount}
                onChange={(e) => setOptions({ ...options, displaySuperbadgeCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Superbadge Count</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayCertificationCount}
                onChange={(e) => setOptions({ ...options, displayCertificationCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Certification Count</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayTrailCount}
                onChange={(e) => setOptions({ ...options, displayTrailCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Trail Count</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayPointCount}
                onChange={(e) => setOptions({ ...options, displayPointCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Point Count</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayStampCount}
                onChange={(e) => setOptions({ ...options, displayStampCount: e.target.checked })}
              />
              <span className='option-label-text'>Show Stamp Count</span>
            </label>
          </fieldset>
          <fieldset>
            <legend>Display Options</legend>
            <label>
              <input
                type='checkbox'
                checked={options.displayRankLogo}
                onChange={(e) => setOptions({ ...options, displayRankLogo: e.target.checked })}
              />
              <span className='option-label-text'>Show Rank Logo</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayAgentblazerRank}
                onChange={(e) => setOptions({ ...options, displayAgentblazerRank: e.target.checked })}
              />
              <span className='option-label-text'>Show Agentblazer Rank</span>
              <span
                className='option-info'
                data-tooltip-id='agentblazer-tooltip'
                tabIndex='0'
                aria-label='More information'
              >
                <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
              </span>
            </label>
            <Tooltip id='agentblazer-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Agentblazer is the AI-focused ranking system on Trailhead
            </Tooltip>
            {options.displayAgentblazerRank && (
              <label className='picklist'>
                Agentblazer Display Mode:
                <select
                  value={options.agentblazerRankDisplay}
                  onChange={(e) => setOptions({ ...options, agentblazerRankDisplay: e.target.value })}
                >
                  <option value='current'>Current</option>
                  <option value='allTimeHigh'>All Time High</option>
                </select>
                <span
                  className='option-info'
                  data-tooltip-id='agentblazer-mode-tooltip'
                  tabIndex='0'
                  aria-label='More information'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
            )}
            <Tooltip id='agentblazer-mode-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Current: Shows your active Agentblazer rank for the current year. All Time High: Shows your highest
              Agentblazer level achieved across all years
            </Tooltip>
          </fieldset>
          <fieldset>
            <legend>Superbadge Options</legend>
            <label>
              <input
                type='checkbox'
                checked={options.displaySuperbadges}
                onChange={(e) => setOptions({ ...options, displaySuperbadges: e.target.checked })}
              />
              <span className='option-label-text'>Display Superbadges</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayLastXSuperbadges}
                onChange={(e) => setOptions({ ...options, displayLastXSuperbadges: e.target.checked })}
              />
              <span className='option-label-text'>Limit Number of Superbadges</span>
              <span
                className='option-info'
                data-tooltip-id='limit-superbadges-tooltip'
                tabIndex='0'
                aria-label='More information'
              >
                <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
              </span>
            </label>
            <Tooltip id='limit-superbadges-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Cap how many superbadge images appear on your banner
            </Tooltip>
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
            <label className='picklist'>
              Superbadges Alignment:
              <select
                value={options.superbadgeAlignment}
                onChange={(e) => setOptions({ ...options, superbadgeAlignment: e.target.value })}
              >
                <option value='center'>Center</option>
                <option value='left'>Left</option>
                <option value='right'>Right</option>
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Certification Options</legend>
            <label>
              <input
                type='checkbox'
                checked={options.displaySalesforceCertifications}
                onChange={(e) => setOptions({ ...options, displaySalesforceCertifications: e.target.checked })}
              />
              <span className='option-label-text'>Display Salesforce Certifications</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.displayAccreditedProfessionalCertifications}
                onChange={(e) =>
                  setOptions({ ...options, displayAccreditedProfessionalCertifications: e.target.checked })
                }
              />
              <span className='option-label-text'>Display Accredited Professional Certifications</span>
            </label>
            <label>
              <input
                type='checkbox'
                checked={options.includeExpiredCertifications}
                onChange={(e) => setOptions({ ...options, includeExpiredCertifications: e.target.checked })}
              />
              <span className='option-label-text'>Include Expired Certifications</span>
              <span
                className='option-info'
                data-tooltip-id='expired-certs-tooltip'
                tabIndex='0'
                aria-label='More information'
              >
                <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
              </span>
            </label>
            <Tooltip id='expired-certs-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Expired certifications appear in grayscale to differentiate from active ones
            </Tooltip>
            <label>
              <input
                type='checkbox'
                checked={options.includeRetiredCertifications}
                onChange={(e) => setOptions({ ...options, includeRetiredCertifications: e.target.checked })}
              />
              <span className='option-label-text'>Include Retired Certifications</span>
              <span
                className='option-info'
                data-tooltip-id='retired-certs-tooltip'
                tabIndex='0'
                aria-label='More information'
              >
                <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
              </span>
            </label>
            <Tooltip id='retired-certs-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Retired certifications will be displayed with their retired ribbon
            </Tooltip>
            <label>
              <input
                type='checkbox'
                checked={options.displayLastXCertifications}
                onChange={(e) => setOptions({ ...options, displayLastXCertifications: e.target.checked })}
              />
              <span className='option-label-text'>Limit Number of Certifications</span>
              <span
                className='option-info'
                data-tooltip-id='limit-certs-tooltip'
                tabIndex='0'
                aria-label='More information'
              >
                <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
              </span>
            </label>
            <Tooltip id='limit-certs-tooltip' place='top' delayShow={200} className='react-tooltip'>
              Cap how many certification badges appear on your banner
            </Tooltip>
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
                <option value='product'>Product</option>
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
