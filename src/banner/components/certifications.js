import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getLocalCertificationData } from '../../utils/dataUtils.js';
import { calculateCertificationsDesign, sortCertifications } from '../../utils/imageUtils.js';
import { applyGrayscaleToCanvas, cropImage, generatePlusXCertificationsSvg } from '../../utils/drawUtils.js';
import { getImage, getCertificationFileName } from '../../utils/cacheUtils.js';
import { uploadImage } from '../../utils/blobUtils.js';

/**
 * Certifications Grid Component
 * Handles certification filtering, loading, cropping, grayscale, layout, and rendering
 */

/**
 * Filter certifications based on options
 * @param {Array} certifications - All certifications from API
 * @param {Object} options - Filtering options
 * @returns {Array} Filtered certifications
 */
function filterCertifications(certifications, options) {
  if (!certifications || !Array.isArray(certifications)) {
    return [];
  }

  // Default all display flags to true when undefined
  const includeExpired = options.includeExpiredCertifications ?? false;
  const includeRetired = options.includeRetiredCertifications ?? false;
  const displaySalesforce = options.displaySalesforceCertifications ?? true;
  const displayAccredited = options.displayAccreditedProfessionalCertifications ?? true;

  return certifications.filter(
    (cert) =>
      (includeExpired || cert.status.expired === false) &&
      (includeRetired || cert.status.title !== 'Retired') &&
      (displaySalesforce || cert.title.includes('Accredited Professional')) &&
      (displayAccredited || !cert.title.includes('Accredited Professional'))
  );
}

/**
 * Prepare certifications for rendering
 * @param {Object} certificationsData - Certifications data from API
 * @param {Object} options - Component options
 * @param {Object} layout - Layout constraints { availableWidth, availableHeight, spacing }
 * @returns {Promise<Object>} Prepared certification data
 */
async function prepareCertifications(certificationsData, options, layout) {
  const startTime = Date.now();
  const warnings = [];

  // Filter certifications
  let certifications = filterCertifications(certificationsData?.certifications, options);
  const totalCertifications = certifications.length;

  // Sort certifications
  certifications = sortCertifications(certifications, options.certificationSort, options.certificationSortOrder);

  // Limit to last X if requested
  if (options.displayLastXCertifications && options.lastXCertifications) {
    certifications = certifications.slice(-options.lastXCertifications);
  }

  const displayedCertifications = certifications.length;
  const hiddenCertifications = totalCertifications - displayedCertifications;

  // Track detailed timing
  const certTimings = {
    getImage_times: [],
    loadImage_times: [],
    cropImage_times: [],
    grayscale_times: [],
    blob_cache_hits: 0,
    blob_cache_misses: 0,
    cropped_cache_hits: 0,
    cropped_cache_misses: 0,
  };

  // Download all certification logos in parallel
  const logoPromises = certifications.map(async (cert) => {
    if (!cert.logoUrl) {
      return null;
    }

    try {
      console.debug('Loading certification logo from URL:', cert.logoUrl);

      let logo;
      let getImageTime = 0;
      let loadImageTime = 0;
      let cropTime = 0;

      // Try to get pre-cropped version first
      const getImageStart = Date.now();
      try {
        const croppedLogoResult = await getImage(cert.logoUrl, 'certifications_cropped');
        getImageTime = Date.now() - getImageStart;
        certTimings.getImage_times.push(getImageTime);
        certTimings.cropped_cache_hits++;

        // Track original blob cache status
        if (croppedLogoResult.cacheHit) {
          certTimings.blob_cache_hits++;
        } else {
          certTimings.blob_cache_misses++;
        }

        const croppedLogoBuffer = croppedLogoResult.buffer || croppedLogoResult;

        // Load the already-cropped image
        const loadImageStart = Date.now();
        logo = await loadImage(croppedLogoBuffer);
        loadImageTime = Date.now() - loadImageStart;
        certTimings.loadImage_times.push(loadImageTime);

        // No cropping needed!
        cropTime = 0;
        certTimings.cropImage_times.push(cropTime);
      } catch (error) {
        // Cropped version not cached - do full processing
        console.debug(`Cropped cache miss for ${cert.title}, processing now...`);
        certTimings.cropped_cache_misses++;

        const certificationLogoResult = await getImage(cert.logoUrl, 'certifications');
        getImageTime = Date.now() - getImageStart;
        certTimings.getImage_times.push(getImageTime);

        // Track cache hits/misses
        if (certificationLogoResult.cacheHit) {
          certTimings.blob_cache_hits++;
        } else {
          certTimings.blob_cache_misses++;
        }

        const certificationLogoBuffer = certificationLogoResult.buffer || certificationLogoResult;

        // Time loadImage
        const loadImageStart = Date.now();
        logo = await loadImage(certificationLogoBuffer);
        loadImageTime = Date.now() - loadImageStart;
        certTimings.loadImage_times.push(loadImageTime);

        // Time cropImage
        const cropStart = Date.now();
        logo = cropImage(logo); // Crop the logo to remove extra space
        cropTime = Date.now() - cropStart;
        certTimings.cropImage_times.push(cropTime);

        // Cache the cropped version for next time (non-blocking)
        try {
          const croppedBuffer = logo.toBuffer('image/png');
          const croppedFileName = getCertificationFileName(cert.logoUrl);

          // Upload cropped version (don't await - let it happen in background)
          uploadImage(croppedBuffer, croppedFileName, 'certifications_cropped').catch((err) =>
            console.error(`Failed to cache cropped image for ${cert.title}:`, err)
          );
        } catch (cacheError) {
          console.error(`Error caching cropped image for ${cert.title}:`, cacheError);
          // Continue - caching failure shouldn't break generation
        }
      }

      // Grayscale if needed
      if (cert.status.expired) {
        const grayscaleStart = Date.now();
        console.debug(`[GRAYSCALE] Before: logo is ${logo.constructor.name}, size ${logo.width}x${logo.height}`);

        // Convert logo to canvas if it's an Image
        let sourceCanvas;
        if (logo.constructor.name === 'Image') {
          sourceCanvas = createCanvas(logo.width, logo.height);
          const sourceCtx = sourceCanvas.getContext('2d');
          sourceCtx.drawImage(logo, 0, 0);
        } else {
          sourceCanvas = logo;
        }

        // Apply grayscale filter
        logo = applyGrayscaleToCanvas(sourceCanvas);

        // Verify grayscale was applied with safe coordinates
        const verifyCtx = logo.getContext('2d');
        const sampleX = Math.min(logo.width - 1, Math.max(0, Math.floor(logo.width / 2)));
        const sampleY = Math.min(logo.height - 1, Math.max(0, Math.floor(logo.height / 2)));
        const verifyData = verifyCtx.getImageData(sampleX, sampleY, 1, 1).data;
        console.debug(
          `[GRAYSCALE] After applyGrayscaleToCanvas, pixel at (${sampleX},${sampleY}): R:${verifyData[0]} G:${verifyData[1]} B:${verifyData[2]}`
        );
        console.debug(`[GRAYSCALE] After: logo is now ${logo.constructor.name}, size ${logo.width}x${logo.height}`);

        const grayscaleTime = Date.now() - grayscaleStart;
        certTimings.grayscale_times.push(grayscaleTime);
      }

      const certificationLocalData = getLocalCertificationData(cert);
      return {
        logo,
        expired: cert.status.expired,
        retired: cert.status.title == 'Retired',
        dateCompleted: cert.dateCompleted,
        title: cert.title,
        product: cert.product,
        category: certificationLocalData?.category || '',
        difficulty: certificationLocalData?.difficulty || '',
      };
    } catch (error) {
      console.error(`Error loading logo for ${cert.title}:`, error);
      warnings.push(`Error loading logo for ${cert.title}: ${error.message}`);
      return null;
    }
  });

  // Wait for all logos to be downloaded and preserve order
  const certLogosStart = Date.now();
  const logoResults = await Promise.all(logoPromises);
  let certificationsLogos = logoResults.filter(Boolean);
  const downloadMs = Date.now() - certLogosStart;

  // Calculate statistics
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr) => (arr.length > 0 ? sum(arr) / arr.length : 0);

  const totalCerts = certTimings.getImage_times.length;
  const cacheHitRate = totalCerts > 0 ? certTimings.blob_cache_hits / totalCerts : 0;
  const croppedCacheHitRate = totalCerts > 0 ? certTimings.cropped_cache_hits / totalCerts : 0;

  const detailedTimings = {
    count: totalCerts,
    avg_getImage_ms: Math.round(avg(certTimings.getImage_times)),
    avg_loadImage_ms: Math.round(avg(certTimings.loadImage_times)),
    avg_cropImage_ms: Math.round(avg(certTimings.cropImage_times)),
    avg_grayscale_ms: Math.round(avg(certTimings.grayscale_times)),
    total_getImage_ms: Math.round(sum(certTimings.getImage_times)),
    total_loadImage_ms: Math.round(sum(certTimings.loadImage_times)),
    total_cropImage_ms: Math.round(sum(certTimings.cropImage_times)),
    total_grayscale_ms: Math.round(sum(certTimings.grayscale_times)),
    blob_cache_hits: certTimings.blob_cache_hits,
    blob_cache_misses: certTimings.blob_cache_misses,
    blob_cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
    cropped_cache_hits: certTimings.cropped_cache_hits,
    cropped_cache_misses: certTimings.cropped_cache_misses,
    cropped_cache_hit_rate: Math.round(croppedCacheHitRate * 100) / 100,
  };

  console.log('Certification Processing Breakdown:', JSON.stringify(detailedTimings, null, 2));

  // Sort certification logos
  certificationsLogos = sortCertifications(
    certificationsLogos,
    options.certificationSort,
    options.certificationSortOrder
  );

  // Add "+X" badge if certifications are hidden
  if (hiddenCertifications > 0) {
    const plusXBadgeSvg = generatePlusXCertificationsSvg(hiddenCertifications);
    const plusXBadgeImage = await loadImage(
      `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
    );
    certificationsLogos.push({ logo: plusXBadgeImage });
  }

  // Calculate layout
  let certifDesign = null;
  if (certificationsLogos.length > 0) {
    certifDesign = calculateCertificationsDesign(
      certificationsLogos.map(({ logo }) => logo),
      layout.availableWidth,
      layout.availableHeight,
      layout.spacing || 5,
      options.certificationAlignment
    );
  }

  const prepMs = Date.now() - startTime - downloadMs;

  return {
    logos: certificationsLogos,
    layout: certifDesign,
    counts: {
      total: totalCertifications,
      displayed: displayedCertifications,
      hidden: hiddenCertifications,
    },
    warnings,
    timings: {
      download_ms: downloadMs,
      prep_ms: prepMs,
      detailed: detailedTimings,
    },
  };
}

/**
 * Render certifications to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared certification data from prepareCertifications()
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 */
async function renderCertifications(ctx, prepared, startX, startY) {
  const renderStart = Date.now();

  if (!prepared.logos || prepared.logos.length === 0) {
    console.debug('No certifications to render');
    return {
      render_ms: 0,
    };
  }

  const { logos, layout } = prepared;
  const certifSpacing = layout.spacing || 5;

  let currentY = startY;
  let currentLine = 0;
  let currentX = startX + (layout.logoLineStartX[currentLine] ?? 0);

  for (let i = 0; i < logos.length; i++) {
    const { logo, retired, expired, title } = logos[i];

    // Set transparency for retired certifications
    if (retired) {
      console.debug(`Applying 50% transparency to retired cert: ${title}`);
      ctx.globalAlpha = 0.5;
    } else {
      ctx.globalAlpha = 1.0;
    }

    if (expired) {
      console.debug(
        `[RENDER] Expired cert: ${title}, logo is ${logo.constructor.name}, size ${logo.width}x${logo.height}`
      );
      // Try to verify the logo still has grayscale
      if (logo.getContext) {
        const testCtx = logo.getContext('2d');
        const sampleX = Math.min(logo.width - 1, Math.max(0, Math.floor(logo.width / 2)));
        const sampleY = Math.min(logo.height - 1, Math.max(0, Math.floor(logo.height / 2)));
        const testPixel = testCtx.getImageData(sampleX, sampleY, 1, 1).data;
        console.debug(
          `[RENDER] Canvas pixel at (${sampleX},${sampleY}): R:${testPixel[0]} G:${testPixel[1]} B:${testPixel[2]}`
        );
      }
    }

    ctx.drawImage(logo, currentX, currentY, layout.logoWidth, layout.logoHeight);
    currentX += layout.logoWidth + certifSpacing;

    // Move to the next row if the current row is full
    if ((i + 1) % layout.maxLogosPerLine === 0) {
      currentLine++;
      currentX = startX + (layout.logoLineStartX[currentLine] ?? 0);
      currentY += layout.logoHeight + certifSpacing;
    }
  }

  // Reset transparency
  ctx.globalAlpha = 1.0;

  return {
    render_ms: Date.now() - renderStart,
  };
}

/**
 * Get warnings from certification preparation
 * @param {Object} prepared - Prepared certification data
 * @returns {Array<string>} Warnings
 */
function getCertificationsWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from certification preparation/rendering
 * @param {Object} prepared - Prepared certification data
 * @returns {Object} Timings
 */
function getCertificationsTimings(prepared) {
  return prepared?.timings || {};
}

/**
 * Get certification counts
 * @param {Object} prepared - Prepared certification data
 * @returns {Object} Counts
 */
function getCertificationsCounts(prepared) {
  return prepared?.counts || { total: 0, displayed: 0, hidden: 0 };
}

export {
  prepareCertifications,
  renderCertifications,
  getCertificationsWarnings,
  getCertificationsTimings,
  getCertificationsCounts,
  filterCertifications, // Export for reuse
};
