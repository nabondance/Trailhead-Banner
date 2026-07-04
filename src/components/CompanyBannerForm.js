'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip';
import bannerBackground from '../data/banners.json';
import COUNTERS_CONFIG from '../data/counters.json';
import {
  handleFileChange,
  handleBackgroundKindChange,
  handleBackgroundColorChange,
  handleCustomUrlChange,
  handlePredefinedImageChange,
  getBackgroundPreviewSrc,
} from '../utils/backgroundUtils';
import DragAndDropCounterSelector from './DragAndDropCounterSelector';
import ImageCropEditor from './ImageCropEditor';
import { getCroppedImage, resizeImageForPayload } from '../utils/cropUtils';

// The compact company banner only renders the first N counters (see companyBanner.js),
// so the UI selection is capped to the same number to stay in sync.
const MAX_COMPANY_COUNTERS = 2;
// Usernames are fetched in chunks so Trailhead's rate limit is respected and
// progress can be shown. Must not exceed FETCH_CHUNK_SIZE in companyFetchUtils.js.
const FETCH_CHUNK_SIZE = 25;
const COMPANY_COUNTERS = COUNTERS_CONFIG.filter((c) => c.allowedIn?.includes('company'));
// Default pair: team size (Trailblazers) for context + certifications as the headline metric.
// Superbadges/certs are already shown as graphics, so counting Trailblazers adds non-redundant info.
const DEFAULT_COMPANY_COUNTER_IDS = ['people', 'certification'];
const DEFAULT_COMPANY_COUNTERS = DEFAULT_COMPANY_COUNTER_IDS.map((id) =>
  COMPANY_COUNTERS.find((c) => c.id === id)
).filter(Boolean);

/**
 * Fetch Trailhead data for usernames chunk by chunk via /api/banner/company-fetch.
 * Sequential chunks keep the request rate under Trailhead's per-IP limit and
 * let the UI show real progress. onProgress receives the number of usernames done.
 */
async function fetchUsersInChunks(usernames, onProgress, fetchOptions = {}) {
  const resolved = [];
  const failed = [];
  let done = 0;

  for (let i = 0; i < usernames.length; i += FETCH_CHUNK_SIZE) {
    const chunk = usernames.slice(i, i + FETCH_CHUNK_SIZE);
    try {
      const response = await fetch('/api/banner/company-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: chunk, options: fetchOptions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fetch failed');
      resolved.push(...(data.resolved || []));
      failed.push(...(data.failed || []));
    } catch {
      failed.push(...chunk.map((username) => ({ username, status: 'error' })));
    }
    done += chunk.length;
    onProgress(done);
  }

  return { resolved, failed };
}

const CompanyBannerForm = () => {
  const [usernamesRaw, setUsernamesRaw] = useState('');
  const [options, setOptions] = useState({
    backgroundColor: '#5badd6',
    backgroundImageUrl: '',
    backgroundKind: 'library',
    backgroundLibraryUrl:
      typeof window !== 'undefined' ? `${window.location.origin}${bannerBackground[5].src}` : bannerBackground[5].src,
    customBackgroundImageUrl: '',
    // Company logo
    companyLogoKind: 'none',
    companyLogoUrl: '',
    // Counters
    selectedCounters: DEFAULT_COMPANY_COUNTERS,
    badgeLabelColor: '#555555',
    // Agentblazer
    displayAgentblazerIcons: true,
    agentblazerRankDisplay: 'current',
    // Certifications
    displaySalesforceCertifications: true,
    displayAccreditedProfessionalCertifications: true,
    includeExpiredCertifications: true,
    certificationSort: 'count',
    certificationSortOrder: 'descendant',
    certificationAlignment: 'center',
    displayLastXCertifications: false,
    lastXCertifications: '',
    // Superbadges
    displaySuperbadges: true,
    displayLastXSuperbadges: false,
    lastXSuperbadges: '',
    superbadgeDeduplicate: false,
    superbadgeShowCount: false,
    superbadgeAlignment: 'left',
    // CSV
    generateCsv: false,
  });

  const [uploadedBgFile, setUploadedBgFile] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropSkipped, setIsCropSkipped] = useState(false);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [uploadedLogoFile, setUploadedLogoFile] = useState(null);
  const [backgroundImageUrlError, setBackgroundImageUrlError] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(null); // { phase: 'fetch'|'retry'|'render', done, total }
  const [resultImageUrl, setResultImageUrl] = useState(null);
  const [resultCsvData, setResultCsvData] = useState(null);
  const [resultProductCsvData, setResultProductCsvData] = useState(null);
  const [teamHash, setTeamHash] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [failedUsers, setFailedUsers] = useState([]);
  const [mainError, setMainError] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const handleBackgroundChange = (e) => handleBackgroundKindChange(e.target.value, setOptions);
  const handleColorChange = (e) => handleBackgroundColorChange(e.target.value, setOptions);
  const handleUrlChange = (e) => handleCustomUrlChange(e.target.value, setOptions, setBackgroundImageUrlError);
  const handleImageChange = async (e) => {
    if (!e.target.files[0]) return;
    await handleFileChange(e.target.files[0], setBackgroundImageUrlError, setOptions, setUploadedBgFile);
    setCroppedAreaPixels(null);
    setIsCropSkipped(false);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
  };
  const handlePredefinedImage = (src) => handlePredefinedImageChange(src, setOptions);

  const handleLogoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedLogoFile(file);
      setOptions((prev) => ({ ...prev, companyLogoUrl: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoKindChange = (e) => {
    const kind = e.target.value;
    setOptions((prev) => ({ ...prev, companyLogoKind: kind, companyLogoUrl: '' }));
    setUploadedLogoFile(null);
  };

  const downloadCsvFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!resultCsvData) return;
    downloadCsvFile(resultCsvData, `company-banner-${teamHash}.csv`);
    if (resultProductCsvData) {
      downloadCsvFile(resultProductCsvData, `company-products-${teamHash}.csv`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMainError(null);
    setResultImageUrl(null);
    setResultCsvData(null);
    setResultProductCsvData(null);
    setWarnings([]);
    setFailedUsers([]);

    const usernames = usernamesRaw
      .split(/[\n,| ]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (usernames.length === 0) {
      setMainError(new Error('Please enter at least one username.'));
      return;
    }

    setIsGenerating(true);
    setShowOptions(false);

    let backgroundImageUrl = getBackgroundPreviewSrc(options);

    if (options.backgroundKind === 'upload' && options.backgroundImageUrl) {
      try {
        if (!isCropSkipped && croppedAreaPixels) {
          backgroundImageUrl = await getCroppedImage(options.backgroundImageUrl, croppedAreaPixels);
        } else {
          backgroundImageUrl = await resizeImageForPayload(options.backgroundImageUrl);
        }
      } catch (err) {
        setMainError(new Error('Failed to process image. Please try again.'));
        setIsGenerating(false);
        return;
      }
    }

    const counterOrder = options.selectedCounters.map((c) => c.id);

    const bannerOptions = {
      ...options,
      counterOrder,
      backgroundImageUrl,
      lastXCertifications: options.lastXCertifications ? parseInt(options.lastXCertifications) : undefined,
      lastXSuperbadges: options.lastXSuperbadges ? parseInt(options.lastXSuperbadges) : undefined,
    };

    try {
      // Only the fields that decide which queries each user needs — not the
      // full options (backgroundImageUrl can be a large base64 payload)
      const fetchOptions = {
        generateCsv: bannerOptions.generateCsv,
        counterOrder,
      };

      // Phase 1: fetch Trailhead data in chunks with progress
      const fetchStartTime = Date.now();
      setFetchProgress({ phase: 'fetch', done: 0, total: usernames.length });
      const { resolved, failed } = await fetchUsersInChunks(
        usernames,
        (done) => setFetchProgress({ phase: 'fetch', done, total: usernames.length }),
        fetchOptions
      );

      // Retry rate-limited users once — Trailhead's limit usually clears quickly
      let finalFailed = failed.filter((f) => f.status !== 'rate_limited');
      const toRetry = failed.filter((f) => f.status === 'rate_limited').map((f) => f.username);
      if (toRetry.length > 0) {
        setFetchProgress({ phase: 'retry', done: 0, total: toRetry.length });
        const retryResult = await fetchUsersInChunks(
          toRetry,
          (done) => setFetchProgress({ phase: 'retry', done, total: toRetry.length }),
          fetchOptions
        );
        resolved.push(...retryResult.resolved);
        finalFailed = [...finalFailed, ...retryResult.failed];
      }
      const clientFetchMs = Date.now() - fetchStartTime;

      if (resolved.length === 0) {
        setMainError(new Error('None of the provided usernames could be resolved. Check usernames and try again.'));
        setFailedUsers(finalFailed);
        return;
      }

      // Phase 2: aggregate and render the banner from the fetched data
      setFetchProgress({ phase: 'render' });
      const response = await fetch('/api/banner/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedData: resolved,
          failedUsers: finalFailed,
          clientFetchMs,
          options: bannerOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMainError(new Error(data.error || 'Failed to generate company banner.'));
        if (data.failedUsers) setFailedUsers(data.failedUsers);
        return;
      }

      setResultImageUrl(data.imageUrl);
      setResultCsvData(data.csvData || null);
      setResultProductCsvData(data.productCsvData || null);
      setTeamHash(data.teamHash || '');
      setWarnings(data.warnings || []);
      setFailedUsers(data.failedUsers || []);
    } catch (err) {
      setMainError(new Error('An unexpected error occurred. Please try again.'));
    } finally {
      setIsGenerating(false);
      setFetchProgress(null);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className='form' noValidate>
        {/* Team usernames */}
        <div className='input-container'>
          <textarea
            rows={4}
            value={usernamesRaw}
            onChange={(e) => setUsernamesRaw(e.target.value)}
            placeholder={'Enter Trailhead usernames (one per line, comma, pipe or space separated)'}
            required
            className='input'
            name='trailhead-usernames'
            autoComplete='off'
            data-lpignore='true'
            data-form-type='other'
          />
        </div>

        {!isGenerating && (
          <button type='button' className='button more-options-button' onClick={() => setShowOptions(!showOptions)}>
            {showOptions ? 'Hide Options' : 'More Options'}
          </button>
        )}

        {showOptions && (
          <div className='options'>
            {/* Background Options */}
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
                </label>
              )}
              {options.backgroundKind === 'upload' && uploadedBgFile && (
                <ImageCropEditor
                  imageSrc={options.backgroundImageUrl}
                  onCropComplete={setCroppedAreaPixels}
                  isCropSkipped={isCropSkipped}
                  onSkip={() => setIsCropSkipped(true)}
                  onReset={() => setIsCropSkipped(false)}
                  cropPosition={cropPosition}
                  onCropPositionChange={setCropPosition}
                  cropZoom={cropZoom}
                  onCropZoomChange={setCropZoom}
                />
              )}
              {options.backgroundKind === 'customUrl' && (
                <label>
                  Custom Background URL:
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
                      className={`thumbnail ${options.backgroundLibraryUrl === `${typeof window !== 'undefined' ? window.location.origin : ''}${image.src}` ? 'selected' : ''}`}
                      onClick={() => handlePredefinedImage(image.src)}
                    />
                  ))}
                </div>
              )}
            </fieldset>

            {/* Company Logo */}
            <fieldset>
              <legend>Company Logo Options</legend>
              <label className='picklist'>
                Logo Source:
                <select value={options.companyLogoKind} onChange={handleLogoKindChange}>
                  <option value='none'>No Logo</option>
                  <option value='url'>Custom URL</option>
                  <option value='upload'>Upload Image</option>
                </select>
              </label>
              {options.companyLogoKind === 'url' && (
                <label>
                  Logo URL:
                  <input
                    type='text'
                    value={options.companyLogoUrl?.startsWith('data:') ? '' : options.companyLogoUrl || ''}
                    onChange={(e) => setOptions((prev) => ({ ...prev, companyLogoUrl: e.target.value }))}
                    placeholder='Enter logo URL'
                    className='input-url'
                    autoComplete='off'
                    data-lpignore='true'
                    data-form-type='other'
                  />
                </label>
              )}
              {options.companyLogoKind === 'upload' && (
                <label>
                  Upload Logo Image:
                  <input type='file' accept='image/*' onChange={handleLogoFileChange} className='input-file' />
                  {uploadedLogoFile && <p className='file-info'>Selected file: {uploadedLogoFile.name}</p>}
                </label>
              )}
            </fieldset>

            {/* Counter Options */}
            <fieldset>
              <legend>Counter Options</legend>
              <DragAndDropCounterSelector
                selectedCounters={options.selectedCounters}
                onCountersChange={(newCounters) => setOptions({ ...options, selectedCounters: newCounters })}
                maxCounters={MAX_COMPANY_COUNTERS}
                countersConfig={COMPANY_COUNTERS}
              />
            </fieldset>

            {/* Display Options */}
            <fieldset>
              <legend>Display Options</legend>
              <label>
                <input
                  type='checkbox'
                  checked={options.displayAgentblazerIcons}
                  onChange={(e) => setOptions({ ...options, displayAgentblazerIcons: e.target.checked })}
                />
                <span className='option-label-text'>Show Agentblazer Icons</span>
                <span
                  className='option-info'
                  data-tooltip-id='company-agentblazer-tooltip'
                  tabIndex='0'
                  aria-label='More information'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='company-agentblazer-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Shows Innovator, Champion, and Legend icons with the number of team members at each level
              </Tooltip>
              {options.displayAgentblazerIcons && (
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
                    data-tooltip-id='company-agentblazer-mode-tooltip'
                    tabIndex='0'
                    aria-label='More information'
                  >
                    <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                  </span>
                </label>
              )}
              <Tooltip id='company-agentblazer-mode-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Current: Active rank for this year. All Time High: Highest level ever reached across all years.
              </Tooltip>
            </fieldset>

            {/* Superbadge Options */}
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
              {options.displaySuperbadges && (
                <>
                  <label>
                    <input
                      type='checkbox'
                      checked={options.superbadgeDeduplicate}
                      onChange={(e) => setOptions({ ...options, superbadgeDeduplicate: e.target.checked })}
                    />
                    <span className='option-label-text'>Show Unique Superbadges Only</span>
                    <span
                      className='option-info'
                      data-tooltip-id='sb-dedup-tooltip'
                      tabIndex='0'
                      aria-label='More information'
                    >
                      <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                    </span>
                  </label>
                  <Tooltip id='sb-dedup-tooltip' place='top' delayShow={200} className='react-tooltip'>
                    When enabled, each superbadge appears once even if multiple team members have earned it
                  </Tooltip>
                  {options.superbadgeDeduplicate && (
                    <>
                      <label>
                        <input
                          type='checkbox'
                          checked={options.superbadgeShowCount}
                          onChange={(e) => setOptions({ ...options, superbadgeShowCount: e.target.checked })}
                        />
                        <span className='option-label-text'>Show Count Badge (×N)</span>
                        <span
                          className='option-info'
                          data-tooltip-id='sb-count-tooltip'
                          tabIndex='0'
                          aria-label='More information'
                        >
                          <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                        </span>
                      </label>
                      <Tooltip id='sb-count-tooltip' place='top' delayShow={200} className='react-tooltip'>
                        Adds a ×N badge on each superbadge showing how many team members earned it
                      </Tooltip>
                    </>
                  )}
                  <label>
                    <input
                      type='checkbox'
                      checked={options.displayLastXSuperbadges}
                      onChange={(e) => setOptions({ ...options, displayLastXSuperbadges: e.target.checked })}
                    />
                    <span className='option-label-text'>Limit Number of Superbadges</span>
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
                  <label className='picklist'>
                    Superbadges Alignment:
                    <select
                      value={options.superbadgeAlignment}
                      onChange={(e) => setOptions({ ...options, superbadgeAlignment: e.target.value })}
                    >
                      <option value='left'>Left</option>
                      <option value='center'>Center</option>
                      <option value='right'>Right</option>
                    </select>
                  </label>
                </>
              )}
            </fieldset>

            {/* Certification Options */}
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
                  data-tooltip-id='company-expired-certs-tooltip'
                  tabIndex='0'
                  aria-label='More information'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='company-expired-certs-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Count certifications even after their expiry date. Expired certs appear in greyscale.
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
                  data-tooltip-id='company-limit-certs-tooltip'
                  tabIndex='0'
                  aria-label='More information'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='company-limit-certs-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Cap how many certification badges appear on the banner
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
                  <option value='count'>Count (most held first)</option>
                  <option value='first-won'>First Time Won</option>
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
                  <option value='descendant'>Descendant</option>
                  <option value='ascendant'>Ascendant</option>
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

            {/* Export Options */}
            <fieldset>
              <legend>Export Options</legend>
              <label>
                <input
                  type='checkbox'
                  checked={options.generateCsv}
                  onChange={(e) => setOptions({ ...options, generateCsv: e.target.checked })}
                />
                <span className='option-label-text'>Also Generate CSV Skills Matrix</span>
                <span className='option-info' data-tooltip-id='csv-tooltip' tabIndex='0' aria-label='More information'>
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='csv-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Exports a spreadsheet with per-user certification details, totals, and coverage percentages
              </Tooltip>
            </fieldset>
          </div>
        )}

        {/* Error */}
        {mainError && <p className='error-message'>{mainError.message}</p>}

        {/* Failed users */}
        {failedUsers.length > 0 && (
          <div className='warnings-container'>
            <p>The following usernames could not be resolved:</p>
            <ul>
              {failedUsers.map((u) => (
                <li key={u.username}>
                  <strong>{u.username}</strong>:{' '}
                  {u.status === 'private'
                    ? 'Profile is private — make it public in Trailhead settings'
                    : u.status === 'timeout'
                      ? 'Request timed out — try again later'
                      : u.status === 'rate_limited'
                        ? 'Trailhead rate limit reached — try again in a minute'
                        : u.status === 'error'
                          ? 'Unexpected error — try again later'
                          : 'Username not found — check the spelling'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isGenerating && (
          <button type='submit' className='button submit-button'>
            Generate Company Banner
          </button>
        )}
      </form>

      {/* Progress */}
      {isGenerating && (
        <div className='loading-container'>
          {fetchProgress?.phase === 'fetch' || fetchProgress?.phase === 'retry' ? (
            <>
              <p>
                {fetchProgress.phase === 'retry' ? 'Retrying rate-limited Trailblazers…' : 'Fetching Trailblazer data…'}{' '}
                {Math.min(fetchProgress.done, fetchProgress.total)}/{fetchProgress.total}
              </p>
              <div className='progress-bar'>
                <div
                  className='progress-bar-fill'
                  style={{ width: `${Math.min(100, (fetchProgress.done / fetchProgress.total) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p>Generating the banner...</p>
          )}
          <div className='loading-icon'></div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className='warnings-container'>
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* Result */}
      {resultImageUrl && (
        <div className='image-container'>
          <img
            src={resultImageUrl}
            alt='Company Banner'
            className='generated-image'
            onClick={() => setFullscreenImage(resultImageUrl)}
            style={{ cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
            <a
              href={resultImageUrl}
              download={`company-banner-${teamHash}.png`}
              className='download-link'
              style={{ marginTop: 0 }}
            >
              Download Banner
            </a>
            {resultCsvData && (
              <button
                type='button'
                className='download-link'
                style={{ marginTop: 0, cursor: 'pointer' }}
                onClick={handleDownloadCsv}
              >
                {resultProductCsvData ? 'Download CSVs' : 'Download CSV'}
              </button>
            )}
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div className='fullscreen-overlay visible' onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt='Company Banner Full Screen' />
        </div>
      )}
    </>
  );
};

export default CompanyBannerForm;
