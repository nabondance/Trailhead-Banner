import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTriangleExclamation, faCircleXmark, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
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
      // Load and draw image exactly like in generateImage.js
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

  const handleUsernameBlur = async () => {
    if (!options.username) {
      setValidationResult(null);
      setUsernameError('');
      return;
    }

    const formatResult = validateUsernameFormat(options.username.toLowerCase());
    if (!formatResult.valid) {
      setUsernameError(formatResult.message);
      setValidationResult(formatResult);
      return;
    }

    const apiResult = await validateUsernameWithApi(options.username.toLowerCase());
    setUsernameError(apiResult.valid ? '' : apiResult.message);
    setValidationResult(apiResult);
  };

  const handleUsernameChange = (e) => {
    const input = e.target.value.toLowerCase();
    const cleanUsername = extractUsernameFromUrl(input);
    setOptions({ ...options, username: cleanUsername });
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

  const handleSubmit = async (e) => {
    setMainError(null);
    e.preventDefault();
    setIsGenerating(true);
    setShowOptions(false);

    const usernameFormatResult = validateUsernameFormat(options.username.toLowerCase());
    if (!usernameFormatResult.valid) {
      setMainError(new Error(usernameFormatResult.message));
      onValidationError(new Error(usernameFormatResult.message), options);
      setIsGenerating(false);
      return;
    }

    const usernameApiResult = await validateUsernameWithApi(options.username.toLowerCase());
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
              <select value={options.backgroundKind} onChange={handleBackgroundChange}>
                <option value='library'>Background Library</option>
                <option value='upload'>Upload Image</option>
                <option value='customUrl'>Custom URL</option>
                <option value='monochromatic'>Monochromatic Background</option>
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
