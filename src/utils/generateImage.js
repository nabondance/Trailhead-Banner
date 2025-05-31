const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const crypto = require('crypto');
const { getLocalCertificationData, logOptions } = require('./dataUtils');
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
} = require('./drawUtils');
import { getImage } from './cacheUtils';
require('./fonts');

const top_part = 1 / 4;
const bottom_part = 3 / 4;
const right_part = 7 / 10;
let rankLogoWidth = 120;
let rankLogoHeight = 40;

const isValidImageType = async (url) => {
  try {
    // First try to fetch the image
    const response = await fetch(url);
    if (!response.ok) {
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
  // logOptions(options);

  // Warning
  const warnings = [];

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  try {
    switch (options.backgroundKind) {
      case 'library':
        if (options.backgroundLibraryUrl) {
          if (!(await isValidImageType(options.backgroundLibraryUrl))) {
            throw new Error('Unsupported image type');
          }
          const bgImage = await loadImage(options.backgroundLibraryUrl);
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
          const bgImage = await loadImage(options.backgroundImageUrl);
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        }
        break;
      case 'monochromatic':
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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

  // Rank Logo
  let rankLogoBuffer = null;
  if (!options.isCompanyBanner && options.companyLogoUrl) {
    rankLogoBuffer = await getImage(options.rankData.rank.imageUrl, 'ranks');
  } else if (options.displayCompanyLogo && options.companyLogoUrl) {
    if (!(await isValidImageType(options.companyLogoUrl))) {
      throw new Error('Unsupported image type for company logo');
    }
    rankLogoBuffer = await loadImage(options.companyLogoUrl);
  }
  if (rankLogoBuffer !== null) {
    try {
      const rankLogo = await loadImage(rankLogoBuffer);
      rankLogoHeight = canvas.height * top_part * 1;
      rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
      const rankLogoScalingFactor = 1.2;
      if (options.displayRankLogo) {
        ctx.drawImage(rankLogo, 0, 0, rankLogoWidth * rankLogoScalingFactor, rankLogoHeight * rankLogoScalingFactor);
      }
    } catch (error) {
      console.error(`Error loading rank logo ${options.rankData.rank.imageUrl}:`, error);
      warnings.push(`Error loading rank logo ${options.rankData.rank.imageUrl}: ${error.message}`);
    }
  }

  // Counters
  const badgeCount = options.badgesData.trailheadStats.earnedBadgesCount || 0;
  const superbadgeCount = options.superbadgesData.trailheadStats.superbadgeCount || 0;
  const certificationCount = options.certificationsData.certifications.filter(
    (cert) =>
      (options.includeExpiredCertifications || cert.status.expired === false) &&
      (options.includeRetiredCertifications || cert.status.title !== 'Retired')
  ).length;
  const trailCount = options.rankData.completedTrailCount || 0;
  const pointCount = getCounterPointText(options.rankData.earnedPointsSum || 0);

  // Draw badge counter
  try {
    const counterConfig = getCountersConfig(options);
    const badgeScale = counterConfig.badgeCounterScale;
    let badgeCounterYPosition = 5;
    const badgeCounterYDelta = counterConfig.badgeCounterYDelta;
    const badgeCounterX = rankLogoWidth + 40;

    if (options.displayBadgeCount && badgeCount > 0) {
      await drawBadgeCounter(
        ctx,
        'Badge',
        badgeCount,
        badgeCounterX,
        badgeCounterYPosition,
        badgeScale,
        options.badgeLabelColor,
        '#1f80c0'
      );
      badgeCounterYPosition += badgeCounterYDelta;
    }
    if (options.displaySuperbadgeCount && superbadgeCount > 0) {
      await drawBadgeCounter(
        ctx,
        'Superbadge',
        superbadgeCount,
        badgeCounterX,
        badgeCounterYPosition,
        badgeScale,
        options.badgeLabelColor,
        '#f9a825'
      );
      badgeCounterYPosition += badgeCounterYDelta;
    }
    if (options.displayCertificationCount && certificationCount > 0) {
      await drawBadgeCounter(
        ctx,
        'Certification',
        certificationCount,
        badgeCounterX,
        badgeCounterYPosition,
        badgeScale,
        options.badgeLabelColor,
        '#8a00c4'
      );
      badgeCounterYPosition += badgeCounterYDelta;
    }
    if (options.displayTrailCount && trailCount > 0) {
      await drawBadgeCounter(
        ctx,
        'Trail',
        trailCount,
        badgeCounterX,
        badgeCounterYPosition,
        badgeScale,
        options.badgeLabelColor,
        '#06482A'
      );
      badgeCounterYPosition += badgeCounterYDelta;
    }
    if (options.displayPointCount && pointCount != 0) {
      await drawBadgeCounter(
        ctx,
        'Point',
        pointCount,
        badgeCounterX,
        badgeCounterYPosition,
        badgeScale,
        options.badgeLabelColor,
        '#18477D'
      );
      badgeCounterYPosition += badgeCounterYDelta;
    }
  } catch (error) {
    console.error('Error drawing counter as badges:', error);
    warnings.push(`Error drawing counter as badges: ${error.message}`);
  }

  // learnerStatusLevels
  if (options.rankData.learnerStatusLevels) {
    options.rankData.learnerStatusLevels.forEach(async (learnerStatusLevel) => {
      // Agentblazer Rank
      if (learnerStatusLevel.statusName === 'Agentblazer' && options.displayAgentblazerRank) {
        const agentBlazerPath = path.join(
          process.cwd(),
          'src',
          'assets',
          'logos',
          learnerStatusLevel.statusName,
          `${learnerStatusLevel.title}.png`
        );
        const agentBlazerImage = await loadImage(agentBlazerPath);
        const agentBlazerLogoHeight = 100;
        const agentBlazerLogoWidth = (agentBlazerImage.width / agentBlazerImage.height) * agentBlazerLogoHeight;
        ctx.drawImage(agentBlazerImage, 370, 5, agentBlazerLogoWidth, agentBlazerLogoHeight);
      }
    });
  }

  // Certifications Data
  // Filter certifications based on options
  let certifications = options.certificationsData.certifications.filter(
    (cert) =>
      (options.includeExpiredCertifications || cert.status.expired === false) &&
      (options.includeRetiredCertifications || cert.status.title !== 'Retired') &&
      (options.displaySalesforceCertifications || cert.product !== 'Salesforce') &&
      (options.displayAccreditedProfessionalCertifications || cert.product !== 'Accredited Professional')
  );
  const totalCertifications = certifications.length;

  // Sort certifications
  certifications = sortCertifications(certifications, options.certificationSort, options.certificationSortOrder);

  if (options.displayLastXCertifications && options.lastXCertifications) {
    certifications = certifications.slice(-options.lastXCertifications);
  }

  const displayedCertifications = certifications.length;
  const hiddenCertifications = totalCertifications - displayedCertifications;

  let certificationsLogos = [];

  // Download all certification logos in parallel
  const logoPromises = certifications.map(async (cert) => {
    if (cert.logoUrl) {
      try {
        console.log('Loading certification logo from URL:', cert.logoUrl);
        const certificationLogoBuffer = await getImage(cert.logoUrl, 'certifications');
        let logo = await loadImage(certificationLogoBuffer);
        logo = cropImage(logo); // Crop the logo to remove extra space
        if (cert.status.expired) {
          const tempCanvas = createCanvas(logo.width, logo.height);
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(logo, 0, 0);
          applyGrayscale(tempCtx, 0, 0, logo.width, logo.height); // Apply grayscale for expired certifications
          logo = tempCanvas;
        }
        const certificationLocalData = getLocalCertificationData(cert);
        certificationsLogos.push({
          logo,
          expired: cert.status.expired,
          retired: cert.status.title == 'Retired',
          dateCompleted: cert.dateCompleted,
          title: cert.title,
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
  await Promise.all(logoPromises);

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

  // Display Superbadges if enabled
  if (options.displaySuperbadges) {
    const totalSuperbadges = options.superbadgesData.earnedAwards.edges.filter(
      (edge) => edge.node.award && edge.node.award.icon
    ).length;

    let superbadgeLogos = options.superbadgesData.earnedAwards.edges
      .filter((edge) => edge.node.award && edge.node.award.icon)
      .map((edge) => edge.node.award.icon);

    if (options.displayLastXSuperbadges && options.lastXSuperbadges) {
      superbadgeLogos = superbadgeLogos.slice(-options.lastXSuperbadges);
    }

    const displayedSuperbadges = superbadgeLogos.length;
    const hiddenSuperbadges = totalSuperbadges - displayedSuperbadges;

    // Download all superbadge logos in parallel
    const superbadgeLogoPromises = superbadgeLogos.map(async (logoUrl) => {
      try {
        const logoBuffer = await getImage(logoUrl, 'superbadges');
        const logo = await loadImage(logoBuffer);
        return logo;
      } catch (error) {
        console.error(`Error loading superbadge logo from URL: ${logoUrl}`, error);
        warnings.push(`Error loading superbadge logo from URL: ${logoUrl}: ${error.message}`);
        return null;
      }
    });

    // Wait for all superbadge logos to be downloaded
    const superbadgeLogosImages = await Promise.all(superbadgeLogoPromises);

    if (hiddenSuperbadges > 0) {
      const plusXBadgeSvg = generatePlusXSuperbadgesSvg(hiddenSuperbadges);
      const plusXBadgeImage = await loadImage(
        `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
      );
      superbadgeLogosImages.push(plusXBadgeImage);
    }

    const superbadgeLogoHeight = canvas.height * top_part * 0.9;
    const superbadgeLogoWidth = superbadgeLogoHeight; // Assuming square logos
    let superbadgeSpacing = 10;
    const superbadgeAvailableWidth = canvas.width * right_part; // Available width for superbadges
    let superbadgeX = canvas.width - superbadgeAvailableWidth;
    let superbadgeY = 10;

    // Calculate total width required for superbadges
    const totalSuperbadgeWidth =
      superbadgeLogosImages.length * (superbadgeLogoWidth + superbadgeSpacing) - superbadgeSpacing;

    // Adjust spacing if total width exceeds available space
    if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
      superbadgeSpacing =
        (superbadgeAvailableWidth - superbadgeLogosImages.length * superbadgeLogoWidth) /
        (superbadgeLogosImages.length - 1);
    }

    for (const logo of superbadgeLogosImages) {
      if (logo) {
        ctx.drawImage(logo, superbadgeX, superbadgeY, superbadgeLogoWidth, superbadgeLogoHeight);
        superbadgeX += superbadgeLogoWidth + superbadgeSpacing;
      }
    }
  }

  // Load and draw the MVP SVG in diagonal from the top right corner if the user is an MVP
  if (options.mvpData?.isMvp) {
    ctx.globalAlpha = 1.0; // Reset transparency
    const mvpSvgPath = path.join(process.cwd(), 'public', 'assets', 'logos', 'mvp.svg');
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
  const byNabondanceSvgPath = path.join(process.cwd(), 'public', 'bynabondance.svg');
  const byNabondanceSvg = await loadImage(byNabondanceSvgPath);
  const byNabondanceWidth = 160;
  const byNabondanceHeight = 20;
  ctx.globalAlpha = 1.0; // Reset transparency
  ctx.drawImage(
    byNabondanceSvg,
    canvas.width - byNabondanceWidth,
    canvas.height - byNabondanceHeight - 2,
    byNabondanceWidth,
    byNabondanceHeight
  );

  // Convert canvas to banner
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  // Hash the image
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  console.log('Banner generation complete.');
  console.log('Warnings:', warnings);
  console.log('Image hash:', hash);

  return { bannerUrl, warnings, hash };
};
