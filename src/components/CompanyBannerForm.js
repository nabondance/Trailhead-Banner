'use client';

import React, { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
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
import BackgroundPreview from './BackgroundPreview';
import { BANNER_SIZES } from '../banner/bannerSizes';
import { getCroppedImage, resizeImageForPayload } from '../utils/cropUtils';
import { extractUsernameFromUrl } from '../utils/usernameValidation';

// Excel only reads a CSV as UTF-8 (accents, non-Latin names) when it starts with a byte order mark
const UTF8_BOM = '\uFEFF';

// The compact company banner only renders the first N counters (see companyBanner.js),
// so the UI selection is capped to the same number to stay in sync.
const MAX_COMPANY_COUNTERS = 2;
// Usernames are fetched in chunks so Trailhead's rate limit is respected and
// progress can be shown. Must not exceed FETCH_CHUNK_SIZE in companyFetchUtils.js.
const FETCH_CHUNK_SIZE = 25;
// Keep in sync with MAX_COMPANY_USERS in companyFetchUtils.js
const MAX_COMPANY_USERS = 500;
// Users deferred by the server (rate limit or time budget) or in a failed
// chunk request are re-queued, up to this many attempts each
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 2000;
// The logo slot is small; raster uploads are downscaled before sending
const MAX_LOGO_UPLOAD_PX = 600;
const COMPANY_COUNTERS = COUNTERS_CONFIG.filter((c) => c.allowedIn?.includes('company'));
// Default pair: team size (Trailblazers) for context + certifications as the headline metric.
// Superbadges/certs are already shown as graphics, so counting Trailblazers adds non-redundant info.
const DEFAULT_COMPANY_COUNTER_IDS = ['people', 'certification'];
const DEFAULT_COMPANY_COUNTERS = DEFAULT_COMPANY_COUNTER_IDS.map((id) =>
  COMPANY_COUNTERS.find((c) => c.id === id)
).filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Split the textarea into usernames (profile URLs are reduced to their username),
 * dropping case-insensitive duplicates
 * (Trailhead usernames are case-insensitive, so "Jane" and "jane" are one person).
 */
function parseUsernameInput(raw) {
  const seen = new Set();
  return raw
    .split(/[\n,| ]+/)
    .map((u) => (u.trim() ? extractUsernameFromUrl(u) : ''))
    .filter((u) => {
      const key = u.toLowerCase();
      if (!u || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Downscale a raster logo data URL so its longest side is at most MAX_LOGO_UPLOAD_PX (PNG keeps transparency). */
function downscaleLogo(dataUrl) {
  return new Promise((resolve) => {
    if (dataUrl.startsWith('data:image/svg')) return resolve(dataUrl);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_LOGO_UPLOAD_PX / Math.max(image.naturalWidth, image.naturalHeight));
      if (scale === 1) return resolve(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

/**
 * Fetch Trailhead data for usernames chunk by chunk via /api/banner/company-fetch.
 * Sequential chunks keep the request rate under Trailhead's per-IP limit and
 * let the UI show real progress. The server keeps each chunk's data and returns
 * a token; only the tokens are sent to the render endpoint.
 *
 * Users the server deferred (rate limit or its time budget) and chunks whose
 * request failed outright (e.g. a gateway timeout) are re-queued, up to
 * MAX_FETCH_ATTEMPTS each. onProgress receives (usernames done, isRetrying).
 *
 * @returns {Promise<{tokens: string[], failed: Array, resolvedCount: number}>}
 *   failed only lists users the server never reported on (exhausted retries)
 */
async function fetchUsersInChunks(usernames, onProgress, fetchOptions = {}) {
  const tokens = [];
  const failed = [];
  const attempts = new Map();
  let queue = [...usernames];
  let done = 0;
  let resolvedCount = 0;

  while (queue.length > 0) {
    const chunk = queue.slice(0, FETCH_CHUNK_SIZE);
    queue = queue.slice(FETCH_CHUNK_SIZE);
    const isRetrying = chunk.some((u) => attempts.has(u));
    chunk.forEach((u) => attempts.set(u, (attempts.get(u) || 0) + 1));

    let retry;
    let retryStatus;
    try {
      const response = await fetch('/api/banner/company-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: chunk, options: fetchOptions }),
      });
      // A platform error (504/413) returns HTML, so .json() throws here too
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fetch failed');
      if (data.token) tokens.push(data.token);
      resolvedCount += data.resolvedCount || 0;
      retry = Array.isArray(data.deferred) ? data.deferred : [];
      retryStatus = 'rate_limited';
    } catch {
      retry = chunk;
      retryStatus = 'error';
    }

    const exhausted = retry.filter((u) => attempts.get(u) >= MAX_FETCH_ATTEMPTS);
    failed.push(...exhausted.map((username) => ({ username, status: retryStatus })));
    queue.push(...retry.filter((u) => attempts.get(u) < MAX_FETCH_ATTEMPTS));
    done += chunk.length - retry.length + exhausted.length;
    onProgress(done, isRetrying);

    // Give Trailhead's rate limit a moment before hammering it again
    if (retry.length > exhausted.length) await sleep(RETRY_PAUSE_MS);
  }

  return { tokens, failed, resolvedCount };
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
    // sfdx-hardis training badges
    displaySfdxHardisBadges: true,
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
    // Unique + top 12 keeps the row readable for big teams and avoids loading
    // every team member's superbadge images
    displayLastXSuperbadges: true,
    lastXSuperbadges: '12',
    superbadgeDeduplicate: true,
    superbadgeShowCount: true,
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
  const [resultMaintenanceCsvData, setResultMaintenanceCsvData] = useState(null);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);
  const [teamHash, setTeamHash] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [failedUsers, setFailedUsers] = useState([]);
  const [mainError, setMainError] = useState(null);
  const [usernamesError, setUsernamesError] = useState(null); // Client-side check of the usernames list
  const [csvDownloadError, setCsvDownloadError] = useState(null);
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
    reader.onload = async (ev) => {
      const logo = await downscaleLogo(ev.target.result);
      setUploadedLogoFile(file);
      setOptions((prev) => ({ ...prev, companyLogoUrl: logo }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoKindChange = (e) => {
    const kind = e.target.value;
    setOptions((prev) => ({ ...prev, companyLogoKind: kind, companyLogoUrl: '' }));
    setUploadedLogoFile(null);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Some browsers ignore clicks on links that aren't in the page
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking right away can cancel the download in some browsers (Safari, Firefox)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // All team CSVs in one zip: browsers often block or prompt for several downloads from one click
  const handleDownloadCsv = () => {
    if (!resultCsvData) return;
    setCsvDownloadError(null);
    const files = [
      [`company-banner-${teamHash}.csv`, resultCsvData],
      [`company-products-${teamHash}.csv`, resultProductCsvData],
      [`company-maintenance-${teamHash}.csv`, resultMaintenanceCsvData],
    ].filter(([, content]) => content);

    try {
      // level 0: store without compressing, a few KB of CSV aren't worth the CPU
      const zipped = zipSync(Object.fromEntries(files.map(([name, content]) => [name, strToU8(UTF8_BOM + content)])), {
        level: 0,
      });
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `company-csv-${teamHash}.zip`);
    } catch (err) {
      console.error('Failed to build CSV zip:', err);
      setCsvDownloadError('Failed to prepare the CSV download. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMainError(null);
    setUsernamesError(null);
    setCsvDownloadError(null);
    setResultImageUrl(null);
    setResultCsvData(null);
    setResultProductCsvData(null);
    setResultMaintenanceCsvData(null);
    setMaintenanceInfo(null);
    setWarnings([]);
    setFailedUsers([]);

    const usernames = parseUsernameInput(usernamesRaw);

    if (usernames.length === 0) {
      setUsernamesError('Please enter at least one username.');
      return;
    }
    if (usernames.length > MAX_COMPANY_USERS) {
      setUsernamesError(
        `A company banner supports up to ${MAX_COMPANY_USERS} Trailblazers (you entered ${usernames.length}). Please shorten the list.`
      );
      return;
    }

    setIsGenerating(true);
    setShowOptions(false);

    let backgroundImageUrl = getBackgroundPreviewSrc(options);

    if (options.backgroundKind === 'upload' && options.backgroundImageUrl) {
      try {
        if (!isCropSkipped && croppedAreaPixels) {
          backgroundImageUrl = await getCroppedImage(
            options.backgroundImageUrl,
            croppedAreaPixels,
            BANNER_SIZES.company
          );
        } else {
          backgroundImageUrl = await resizeImageForPayload(options.backgroundImageUrl, BANNER_SIZES.company);
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
        displaySfdxHardisBadges: bannerOptions.displaySfdxHardisBadges,
      };

      // Phase 1: fetch Trailhead data in chunks with progress (rate-limited
      // users are retried inside fetchUsersInChunks)
      const fetchStartTime = Date.now();
      setFetchProgress({ phase: 'fetch', done: 0, total: usernames.length });
      const { tokens, failed, resolvedCount } = await fetchUsersInChunks(
        usernames,
        (done, isRetrying) =>
          setFetchProgress({ phase: isRetrying ? 'retry' : 'fetch', done, total: usernames.length }),
        fetchOptions
      );
      const clientFetchMs = Date.now() - fetchStartTime;

      if (resolvedCount === 0 && tokens.length === 0) {
        setMainError(new Error('Could not reach Trailhead. Please try again in a moment.'));
        setFailedUsers(failed);
        return;
      }

      // Phase 2: aggregate and render the banner from the data kept server-side
      setFetchProgress({ phase: 'render' });
      const response = await fetch('/api/banner/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkTokens: tokens,
          failedUsers: failed,
          clientFetchMs,
          options: bannerOptions,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        // Platform errors (413 body too large, 504 timeout) are not JSON
        throw new Error(`The server could not generate the banner (HTTP ${response.status}). Please try again.`);
      }

      if (!response.ok) {
        setMainError(new Error(data.error || 'Failed to generate company banner.'));
        if (data.failedUsers) setFailedUsers(data.failedUsers);
        return;
      }

      setResultImageUrl(data.imageUrl);
      setResultCsvData(data.csvData || null);
      setResultProductCsvData(data.productCsvData || null);
      setResultMaintenanceCsvData(data.maintenanceCsvData || null);
      setMaintenanceInfo(data.maintenanceInfo || null);
      setTeamHash(data.teamHash || '');
      setWarnings(data.warnings || []);
      setFailedUsers(data.failedUsers || []);
    } catch (err) {
      setMainError(
        new Error(
          err?.message?.startsWith('The server') ? err.message : 'An unexpected error occurred. Please try again.'
        )
      );
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
            onChange={(e) => {
              setUsernamesRaw(e.target.value);
              // Editing the list resolves its own errors; server errors stay until the next submit
              if (usernamesError) setUsernamesError(null);
            }}
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
                  <p className='helper-text'>
                    Recommended image size: {BANNER_SIZES.company.width} x {BANNER_SIZES.company.height} pixels
                  </p>
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
                  size={BANNER_SIZES.company}
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
                  <p className='helper-text'>
                    Recommended image size: {BANNER_SIZES.company.width} x {BANNER_SIZES.company.height} pixels
                  </p>
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
              {options.backgroundKind !== 'upload' && (
                <BackgroundPreview options={options} size={BANNER_SIZES.company} />
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
                config={COMPANY_COUNTERS}
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
              <label>
                <input
                  type='checkbox'
                  checked={options.displaySfdxHardisBadges}
                  onChange={(e) => setOptions({ ...options, displaySfdxHardisBadges: e.target.checked })}
                />
                <span className='option-label-text'>Show sfdx-hardis Training Badges</span>
                <span
                  className='option-info'
                  data-tooltip-id='company-sfdx-hardis-tooltip'
                  tabIndex='0'
                  aria-label='More information'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='company-sfdx-hardis-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Shows the verified sfdx-hardis by Cloudity training badge levels with the number of team members at each
                level
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
                <span className='option-label-text'>Also export team data (CSV)</span>
                <span className='option-info' data-tooltip-id='csv-tooltip' tabIndex='0' aria-label='More information'>
                  <FontAwesomeIcon icon={faCircleInfo} className='icon-info' />
                </span>
              </label>
              <Tooltip id='csv-tooltip' place='top' delayShow={200} className='react-tooltip'>
                Downloads a zip with up to 3 spreadsheets: a skills matrix per teammate (with totals and coverage %),
                certifications per product, and upcoming certification maintenance
              </Tooltip>
            </fieldset>
          </div>
        )}

        {/* Error */}
        {usernamesError && <p className='error-message'>{usernamesError}</p>}
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
                Download CSVs (zip)
              </button>
            )}
          </div>
          {csvDownloadError && <p className='error-message'>{csvDownloadError}</p>}
        </div>
      )}

      {/* Certifications needing maintenance (grouped per teammate) — placed after the
          download buttons so a long list never pushes them out of view. */}
      {maintenanceInfo && (
        <div className='info-message'>
          <p>🔔 {maintenanceInfo.header}</p>
          <div className='maintenance-people'>
            {maintenanceInfo.people.map((person) => (
              <div key={person.username} className='maintenance-person'>
                <span className='maintenance-username'>{person.username}</span>
                <ul className='maintenance-cert-list'>
                  {person.certs.map((cert, index) => (
                    <li key={index}>
                      {cert.title} <span className='maintenance-due'>— by {cert.dueDate}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
