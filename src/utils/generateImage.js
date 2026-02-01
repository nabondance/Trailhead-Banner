const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getLocalCertificationData, logOptions, getHighestAgentblazerRankPerYear } = require('./dataUtils');
const {
  calculateCertificationsDesign,
  sortCertifications,
  getCountersConfig,
  getCounterPointText,
} = require('./imageUtils');
const {
  applyGrayscale,
  cropImage,
  drawBadgeCounter,
  generatePlusXSuperbadgesSvg,
  generatePlusXCertificationsSvg,
  drawProceduralBannerBackground,
} = require('./drawUtils');
import { getImage, getLocal, getCertificationFileName } from './cacheUtils';
import { uploadImage } from './blobUtils';
require('./fonts');

const top_part = 1 / 4;
const bottom_part = 3 / 4;
const right_part = 7 / 10;
let rankLogoWidth;
let rankLogoHeight;

const isValidImageType = async (url) => {
  try {
    // First try to fetch the image
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Non-OK response:', response.status);
      return false;
    }

    // Check the Content-Type header
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      return true;
    }

    // Fallback to checking URL patterns if content-type is not reliable
    const urlWithoutParams = url.split('?')[0];
    const extension = path.extname(urlWithoutParams).toLowerCase();

    if (extension) {
      switch (extension) {
        case '.jpg':
        case '.jpeg':
        case '.png':
        case '.webp':
        case '.gif':
          return true;
        default:
          break;
      }
    }

    // Check common image patterns in URL
    const imagePatterns = [
      '/image/', // Common in CDN URLs
      'profile-displaybackgroundimage', // LinkedIn specific
      '/img/', // Common pattern
      '/photo/', // Common pattern
      'media.licdn.com', // LinkedIn media domain
    ];

    return imagePatterns.some((pattern) => url.toLowerCase().includes(pattern));
  } catch (error) {
    console.error('Error validating image URL:', error);
    return false;
  }
};

export const generateImage = async (options) => {
  // Options logging
  logOptions(options);

  // Timing instrumentation
  const timings = {};
  const startTime = Date.now();
  let stepStartTime = Date.now();

  // Warning
  const warnings = [];

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  stepStartTime = Date.now();
  try {
    switch (options.backgroundKind) {
      case 'library':
        if (options.backgroundLibraryUrl) {
          // Extract filename from URL and read directly from local filesystem
          const filename = options.backgroundLibraryUrl.split('/').pop();
          const filePath = path.join(process.cwd(), 'public', 'assets', 'background-library', filename);
          const bgImageBuffer = await fs.promises.readFile(filePath);
          const bgImage = await loadImage(bgImageBuffer);
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        }
        break;
      case 'customUrl':
      case 'upload':
        if (options.backgroundImageUrl) {
          // For upload, backgroundImageUrl will be a data URL, which is already validated
          // For custom URLs, we still need to validate
          if (options.backgroundKind === 'customUrl' && !(await isValidImageType(options.backgroundImageUrl))) {
            throw new Error('Unsupported image type');
          }
          const bgImageResult = await getImage(options.backgroundImageUrl, 'background');
          const bgImageBuffer = bgImageResult.buffer || bgImageResult;
          const bgImage = await loadImage(bgImageBuffer);
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        }
        break;
      case 'monochromatic':
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
      case 'procedural':
        // Generate unique procedural background seeded by username
        // Username comes directly from options, rank from rankData query
        drawProceduralBannerBackground(
          ctx,
          canvas.width,
          canvas.height,
          options.username || 'default',
          options.rankData?.rank?.title || 'Scout'
        );
        break;
      default:
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
    }
  } catch (error) {
    console.error('Error loading background image:', error);
    throw new Error('Unsupported image type');
  }
  timings.background_load_ms = Date.now() - stepStartTime;

  // Rank Logo
  stepStartTime = Date.now();
  try {
    // Check if rank data exists before attempting to load
    if (!options.rankData.rank || !options.rankData.rank.imageUrl) {
      console.debug('Rank data not available, skipping rank logo');
      rankLogoWidth = 180;
      rankLogoHeight = 40;
    } else {
      let rankLogoBuffer;
      let rankLogo;

      // Try to load from local assets first, then fallback to remote URL
      try {
        // Extract filename from URL for local lookup
        const rankFileName = options.rankData.rank.imageUrl.split('/').pop();
        rankLogoBuffer = await getLocal(rankFileName, 'Rank');
        rankLogo = await loadImage(rankLogoBuffer);
        console.debug(`Loaded rank logo locally: ${rankFileName}`);
      } catch (localError) {
        console.debug(`Local rank logo not found, downloading from URL: ${options.rankData.rank.imageUrl}`);
        const rankLogoResult = await getImage(options.rankData.rank.imageUrl, 'ranks');
        rankLogoBuffer = rankLogoResult.buffer || rankLogoResult;
        rankLogo = await loadImage(rankLogoBuffer);
      }

      rankLogoHeight = canvas.height * top_part * 1;
      rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
      const rankLogoScalingFactor = 1.2;
      if (options.displayRankLogo) {
        ctx.drawImage(rankLogo, 0, 0, rankLogoWidth * rankLogoScalingFactor, rankLogoHeight * rankLogoScalingFactor);
      }
    }
  } catch (error) {
    rankLogoWidth = 180;
    rankLogoHeight = 40;
    const rankUrl = options.rankData.rank?.imageUrl || 'unknown';
    console.error(`Error loading rank logo ${rankUrl}:`, error);
    warnings.push(`Error loading rank logo ${rankUrl}: ${error.message}`);
  }
  timings.rank_logo_load_ms = Date.now() - stepStartTime;

  // Counters
  stepStartTime = Date.now();
  const badgeCount = options.badgesData.trailheadStats?.earnedBadgesCount || 0;
  const superbadgeCount = options.superbadgesData.trailheadStats?.superbadgeCount || 0;
  const certificationCount = (
    options.certificationsData.certifications?.filter(
      (cert) =>
        (options.includeExpiredCertifications || cert.status.expired === false) &&
        (options.includeRetiredCertifications || cert.status.title !== 'Retired')
    ) || []
  ).length;
  const trailCount = options.rankData.completedTrailCount || 0;
  const pointCount = getCounterPointText(options.rankData.earnedPointsSum || 0);
  const stampCount = options.stampsData.totalCount || 0;

  // Draw badge counter
  try {
    const counterConfig = getCountersConfig(options);
    const badgeScale = counterConfig.badgeCounterScale;
    let badgeCounterYPosition = 5;
    const badgeCounterYDelta = counterConfig.badgeCounterYDelta;
    const badgeCounterX = rankLogoWidth + 40;

    // Define counter mapping
    const COUNTER_MAP = {
      badge: { data: badgeCount, label: 'Badge', color: '#1f80c0' },
      superbadge: { data: superbadgeCount, label: 'Superbadge', color: '#f9a825' },
      certification: { data: certificationCount, label: 'Certification', color: '#8a00c4' },
      trail: { data: trailCount, label: 'Trail', color: '#06482A' },
      point: { data: pointCount, label: 'Point', color: '#18477D' },
      stamp: { data: stampCount, label: 'Stamp', color: '#00B3A4' },
    };

    // Loop over user-defined order
    const counterOrder = options.counterOrder || [];
    for (const counterId of counterOrder) {
      const counter = COUNTER_MAP[counterId];
      if (!counter) continue;

      const shouldShow = counterId === 'point' ? counter.data != 0 : counter.data > 0;
      if (shouldShow) {
        await drawBadgeCounter(
          ctx,
          counter.label,
          counter.data,
          badgeCounterX,
          badgeCounterYPosition,
          badgeScale,
          options.badgeLabelColor,
          counter.color
        );
        badgeCounterYPosition += badgeCounterYDelta;
      }
    }
  } catch (error) {
    console.error('Error drawing counter as badges:', error);
    warnings.push(`Error drawing counter as badges: ${error.message}`);
  }
  timings.counters_draw_ms = Date.now() - stepStartTime;

  // learnerStatusLevels (Agentblazer)
  stepStartTime = Date.now();
  if (options.displayAgentblazerRank && options.agentblazerData?.learnerStatusLevels) {
    // Get the highest rank per year using the utility function
    const highestRanksPerYear = getHighestAgentblazerRankPerYear(options.agentblazerData.learnerStatusLevels);

    let selectedRank = null;
    if (options.agentblazerRankDisplay === 'allTimeHigh') {
      // Find the highest level across all years
      selectedRank = highestRanksPerYear.reduce((highest, current) => {
        if (!highest || current.level > highest.level) {
          return current;
        }
        return highest;
      }, null);
    } else {
      // Default: show current active rank (the most recent year, or the one marked as active)
      selectedRank = highestRanksPerYear.find((rank) => rank.active === true) || highestRanksPerYear[0];
    }

    if (selectedRank) {
      try {
        const agentBlazerBuffer = await getLocal(`${selectedRank.title}.png`, 'Agentblazer');
        const agentBlazerImage = await loadImage(agentBlazerBuffer);
        const agentBlazerLogoHeight = 100;
        const agentBlazerLogoWidth = (agentBlazerImage.width / agentBlazerImage.height) * agentBlazerLogoHeight;
        ctx.drawImage(agentBlazerImage, 370, 5, agentBlazerLogoWidth, agentBlazerLogoHeight);
      } catch (error) {
        console.error(`Error loading Agentblazer logo ${selectedRank.title}:`, error);
        warnings.push(`Error loading Agentblazer logo ${selectedRank.title}: ${error.message}`);
      }
    }
  }
  timings.agentblazer_load_ms = Date.now() - stepStartTime;

  // Certifications Data
  stepStartTime = Date.now();

  // Filter certifications based on options
  let certifications =
    options.certificationsData.certifications?.filter(
      (cert) =>
        (options.includeExpiredCertifications || cert.status.expired === false) &&
        (options.includeRetiredCertifications || cert.status.title !== 'Retired') &&
        (options.displaySalesforceCertifications || cert.title.includes('Accredited Professional')) &&
        (options.displayAccreditedProfessionalCertifications || !cert.title.includes('Accredited Professional'))
    ) || [];
  const totalCertifications = certifications.length;

  // Sort certifications
  certifications = sortCertifications(certifications, options.certificationSort, options.certificationSortOrder);

  if (options.displayLastXCertifications && options.lastXCertifications) {
    certifications = certifications.slice(-options.lastXCertifications);
  }

  const displayedCertifications = certifications.length;
  const hiddenCertifications = totalCertifications - displayedCertifications;

  let certificationsLogos = [];

  // Track detailed timing for each certification processing step
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
    if (cert.logoUrl) {
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
          const tempCanvas = createCanvas(logo.width, logo.height);
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(logo, 0, 0);
          applyGrayscale(tempCtx, 0, 0, logo.width, logo.height); // Apply grayscale for expired certifications
          logo = tempCanvas;
          const grayscaleTime = Date.now() - grayscaleStart;
          certTimings.grayscale_times.push(grayscaleTime);
        }

        const certificationLocalData = getLocalCertificationData(cert);
        certificationsLogos.push({
          logo,
          expired: cert.status.expired,
          retired: cert.status.title == 'Retired',
          dateCompleted: cert.dateCompleted,
          title: cert.title,
          product: cert.product,
          category: certificationLocalData?.category || '',
          difficulty: certificationLocalData?.difficulty || '',
        });
      } catch (error) {
        console.error(`Error loading logo for ${cert.title}:`, error);
        warnings.push(`Error loading logo for ${cert.title}: ${error.message}`);
      }
    }
  });

  // Wait for all logos to be downloaded
  const certLogosStart = Date.now();
  await Promise.all(logoPromises);
  timings.certifications_download_ms = Date.now() - certLogosStart;
  timings.certifications_count = certifications.length;

  // Calculate statistics
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr) => (arr.length > 0 ? sum(arr) / arr.length : 0);

  const totalCerts = certTimings.getImage_times.length;
  const cacheHitRate = totalCerts > 0 ? certTimings.blob_cache_hits / totalCerts : 0;

  // Calculate cropped cache statistics
  const croppedCacheHitRate = totalCerts > 0 ? certTimings.cropped_cache_hits / totalCerts : 0;

  // Add detailed breakdown to timings
  timings.certifications_detailed = {
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

  console.log('Certification Processing Breakdown:', JSON.stringify(timings.certifications_detailed, null, 2));

  // Sort certification logos
  certificationsLogos = sortCertifications(
    certificationsLogos,
    options.certificationSort,
    options.certificationSortOrder
  );

  if (hiddenCertifications > 0) {
    const plusXBadgeSvg = generatePlusXCertificationsSvg(hiddenCertifications);
    const plusXBadgeImage = await loadImage(
      `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
    );
    certificationsLogos.push({ logo: plusXBadgeImage });
  }

  const certRenderStart = Date.now();
  if (certificationsLogos.length !== 0) {
    const certifYPosition = canvas.height * top_part + 20; // Start just below the top 1/3
    const availableWidth = canvas.width;
    const availableHeight = canvas.height * bottom_part * 0.95; // 95% of the bottom 2/3 height
    const certifSpacing = 5; // Space between certif logos

    // Calculate certifDesign for certifications
    const certifDesign = calculateCertificationsDesign(
      certificationsLogos.map(({ logo }) => logo),
      availableWidth,
      availableHeight,
      certifSpacing,
      options.certificationAlignment
    );

    // Draw logos centered with a small space between them
    let certifCurrentYPosition = certifYPosition;
    let currentLine = 0;
    let certifStartX = certifDesign.logoLineStartX[currentLine];

    for (let i = 0; i < certificationsLogos.length; i++) {
      const { logo, expired, retired } = certificationsLogos[i];
      if (retired) {
        ctx.globalAlpha = 0.5; // Set transparency for retired certifications
      } else {
        ctx.globalAlpha = 1.0; // Reset transparency
      }
      ctx.drawImage(logo, certifStartX, certifCurrentYPosition, certifDesign.logoWidth, certifDesign.logoHeight);
      certifStartX += certifDesign.logoWidth + certifSpacing;

      // Move to the next row if the current row is full
      if ((i + 1) % certifDesign.maxLogosPerLine === 0) {
        currentLine++;
        certifStartX = certifDesign.logoLineStartX[currentLine];
        certifCurrentYPosition += certifDesign.logoHeight + certifSpacing;
      }
    }
  }
  timings.certifications_render_ms = Date.now() - certRenderStart;
  timings.certifications_prep_ms =
    Date.now() - stepStartTime - timings.certifications_download_ms - timings.certifications_render_ms;

  // Display Superbadges if enabled
  stepStartTime = Date.now();
  if (options.displaySuperbadges) {
    const totalSuperbadges =
      options.superbadgesData.earnedAwards?.edges?.filter((edge) => edge.node.award && edge.node.award.icon).length ||
      0;

    let superbadgeLogos =
      options.superbadgesData.earnedAwards?.edges
        ?.filter((edge) => edge.node.award && edge.node.award.icon)
        .map((edge) => edge.node.award.icon) || [];

    if (options.displayLastXSuperbadges && options.lastXSuperbadges) {
      superbadgeLogos = superbadgeLogos.slice(-options.lastXSuperbadges);
    }

    const displayedSuperbadges = superbadgeLogos.length;
    const hiddenSuperbadges = totalSuperbadges - displayedSuperbadges;

    // Download all superbadge logos in parallel
    const superbadgeLogoPromises = superbadgeLogos.map(async (logoUrl) => {
      try {
        const logoResult = await getImage(logoUrl, 'superbadges');
        const logoBuffer = logoResult.buffer || logoResult;
        const logo = await loadImage(logoBuffer);
        return logo;
      } catch (error) {
        console.error(`Error loading superbadge logo from URL: ${logoUrl}`, error);
        warnings.push(`Error loading superbadge logo from URL: ${logoUrl}: ${error.message}`);
        return null;
      }
    });

    // Wait for all superbadge logos to be downloaded
    const superbadgesDownloadStart = Date.now();
    const superbadgeLogosImages = await Promise.all(superbadgeLogoPromises);
    timings.superbadges_download_ms = Date.now() - superbadgesDownloadStart;
    timings.superbadges_count = superbadgeLogos.length;

    if (hiddenSuperbadges > 0) {
      const plusXBadgeSvg = generatePlusXSuperbadgesSvg(hiddenSuperbadges);
      const plusXBadgeImage = await loadImage(
        `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
      );
      superbadgeLogosImages.push(plusXBadgeImage);
    }

    // Calculate superbadge positioning with alignment
    const superbadgeLogoHeight = canvas.height * top_part * 0.9;
    const superbadgeLogoWidth = superbadgeLogoHeight; // Assuming square logos
    let superbadgeSpacing = 10;
    const superbadgeAvailableWidth = canvas.width * right_part; // Available width for superbadges
    const superbadgeY = 10;

    // Calculate total width required for superbadges
    const totalSuperbadgeWidth =
      superbadgeLogosImages.length * superbadgeLogoWidth + (superbadgeLogosImages.length - 1) * superbadgeSpacing;

    // Adjust spacing if total width exceeds available space
    if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
      superbadgeSpacing =
        (superbadgeAvailableWidth - superbadgeLogosImages.length * superbadgeLogoWidth) /
        (superbadgeLogosImages.length - 1);
    }

    let superbadgeStartX;

    if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
      // When compressed, always start from left edge of available area
      superbadgeStartX = canvas.width - superbadgeAvailableWidth;
    } else {
      // When there's enough space, apply alignment
      if (options.superbadgeAlignment === 'left') {
        superbadgeStartX = canvas.width - superbadgeAvailableWidth;
      } else if (options.superbadgeAlignment === 'right') {
        superbadgeStartX = canvas.width - totalSuperbadgeWidth;
      } else {
        // center
        superbadgeStartX =
          canvas.width - superbadgeAvailableWidth + (superbadgeAvailableWidth - totalSuperbadgeWidth) / 2;
      }
    }

    let superbadgeX = superbadgeStartX;

    for (const logo of superbadgeLogosImages) {
      if (logo) {
        ctx.drawImage(logo, superbadgeX, superbadgeY, superbadgeLogoWidth, superbadgeLogoHeight);
        superbadgeX += superbadgeLogoWidth + superbadgeSpacing;
      }
    }
  }
  timings.superbadges_render_ms = Date.now() - stepStartTime - (timings.superbadges_download_ms || 0);

  // Load and draw the MVP SVG in diagonal from the top right corner if the user is an MVP
  stepStartTime = Date.now();
  if (options.mvpData?.isMvp) {
    ctx.globalAlpha = 1.0; // Reset transparency
    const mvpSvgPath = path.join(process.cwd(), 'src', 'assets', 'ribbons', 'mvp.svg');
    const mvpSvg = await loadImage(mvpSvgPath);
    const mvpWidth = 200;
    const mvpHeight = 40;
    ctx.save();
    ctx.translate(canvas.width - mvpWidth / 2, mvpHeight / 2);
    ctx.rotate(Math.PI / 4); // Rotate 45 degrees clockwise
    ctx.drawImage(mvpSvg, -45, -45, mvpWidth, mvpHeight);
    ctx.restore();
  }

  // Load and draw the "By nabondance.me" SVG
  const thbSvgPath = path.join(process.cwd(), 'src', 'assets', 'watermarks', 'thb-small.svg');
  const thbSvg = await loadImage(thbSvgPath);
  const thbSvgWidth = 160;
  const thbSvgHeight = 20;
  ctx.globalAlpha = 1.0; // Reset transparency
  ctx.drawImage(thbSvg, canvas.width - thbSvgWidth, canvas.height - thbSvgHeight - 2, thbSvgWidth, thbSvgHeight);
  timings.mvp_watermark_ms = Date.now() - stepStartTime;

  // Convert canvas to banner
  stepStartTime = Date.now();
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  timings.canvas_encoding_ms = Date.now() - stepStartTime;

  // Hash the image
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  timings.total_ms = Date.now() - startTime;

  console.log('Banner generation complete.');
  console.log('Warnings:', warnings);
  console.log('Image hash:', hash);
  console.log('Timings:', JSON.stringify(timings, null, 2));

  return { bannerUrl, warnings, hash, timings };
};
