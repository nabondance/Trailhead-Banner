const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const crypto = require('crypto');
const {
  applyGrayscale,
  cropImage,
  calculateCertificationsDesign,
  drawBadgeCounter,
  generatePlusXSuperbadgesSvg,
  generatePlusXCertificationsSvg,
} = require('./imageUtils');
import { getImage } from './cacheUtils';
require('./fonts');

const top_part = 1 / 4;
const bottom_part = 3 / 4;
const right_part = 7 / 10;
let rankLogoWidth;
let rankLogoHeight;

export const generateImage = async (options) => {
  // Options logging
  console.log('Generating banner with the following data:');
  console.log('Username:', options.username);
  console.log('Rank Data:', options.rankData);
  console.log('Certifications Data:', options.certificationsData);
  console.log('Badges Data:', options.badgesData);
  console.log('Superbadges Data:', options.superbadgesData);
  console.log('Background Options:', {
    kind: options.backgroundKind,
    libraryUrl: options.backgroundLibraryUrl,
    customImageUrl: options.customBackgroundImageUrl,
    backgroundColor: options.backgroundColor,
  });
  console.log('Display Options:', {
    rankLogo: options.displayRankLogo,
  });
  console.log('Counter Options:', {
    counterDisplayType: options.counterDisplayType,
    textColor: options.textColor,
    badgeCount: options.displayBadgeCount,
    superbadgeCount: options.displaySuperbadgeCount,
    certificationCount: options.displayCertificationCount,
  });
  console.log('Badge Options:', {
    labelColor: options.badgeLabelColor,
    messageColor: options.badgeMessageColor,
  });
  console.log('Superbadge Options:', {
    superbadges: options.displaySuperbadges,
    displayLastXSuperbadges: options.lastXSuperbadges,
    lastXSuperbadges: options.lastXSuperbadges,
  });
  console.log('Certification Options:', {
    includeExpired: options.includeExpiredCertifications,
    includeRetired: options.includeRetiredCertifications,
    displayLastXCertifications: options.lastXCertifications,
    lastXCertifications: options.lastXCertifications,
  });
  console.log('MVP Data:', options.mvpData);

  // Warning
  const warnings = [];

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  switch (options.backgroundKind) {
    case 'library':
      if (options.backgroundLibraryUrl) {
        const bgImage = await loadImage(options.backgroundLibraryUrl);
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      }
      break;
    case 'custom':
      if (options.backgroundImageUrl) {
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

  // Rank Logo
  try {
    const rankLogoBuffer = await getImage(options.rankData.rank.imageUrl, 'ranks');
    const rankLogo = await loadImage(rankLogoBuffer);
    rankLogoHeight = canvas.height * top_part * 1;
    rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
    const rankLogoScalingFactor = 1.2;
    if (options.displayRankLogo) {
      ctx.drawImage(rankLogo, 0, 0, rankLogoWidth * rankLogoScalingFactor, rankLogoHeight * rankLogoScalingFactor);
    }
  } catch (error) {
    rankLogoWidth = 180;
    rankLogoHeight = 40;
    console.error(`Error loading rank logo ${options.rankData.rank.imageUrl}:`, error);
    warnings.push(`Error loading rank logo ${options.rankData.rank.imageUrl}: ${error.message}`);
  }

  // Counters
  const badgeCount = options.badgesData.trailheadStats.earnedBadgesCount || 0;
  const superbadgeCount = options.superbadgesData.trailheadStats.superbadgeCount || 0;
  const certificationCount = options.certificationsData.certifications.filter(
    (cert) =>
      (options.includeExpiredCertifications || cert.status.expired === false) &&
      (options.includeRetiredCertifications || cert.status.title !== 'Retired')
  ).length;
  let numberOfLines = 3;

  // Draw text if counterDisplayType is 'text'
  switch (options.counterDisplayType) {
    case 'text':
      try {
        // Set font and text color
        ctx.fillStyle = options.textColor || '#111827'; // Use the custom text color or default one
        ctx.font = '34px Roboto-Bold';

        const badgeText = options.displayBadgeCount ? `${badgeCount} badge${badgeCount !== 1 ? 's' : ''}` : '';
        const superbadgeText =
          options.displaySuperbadgeCount && superbadgeCount > 0
            ? `${superbadgeCount} superbadge${superbadgeCount !== 1 ? 's' : ''}`
            : '';
        const certificationText =
          options.displayCertificationCount && certificationCount > 0
            ? `${certificationCount} certification${certificationCount > 1 ? 's' : ''}`
            : '';

        // Draw the text
        let textCounterYPosition = 30;

        if (badgeText) {
          ctx.fillText(badgeText, rankLogoWidth + 40, textCounterYPosition);
          textCounterYPosition += rankLogoHeight / numberOfLines;
        }
        if (superbadgeText) {
          ctx.fillText(superbadgeText, rankLogoWidth + 40, textCounterYPosition);
          textCounterYPosition += rankLogoHeight / numberOfLines;
        }
        if (certificationText) {
          ctx.fillText(certificationText, rankLogoWidth + 40, textCounterYPosition);
        }
      } catch (error) {
        console.error('Error drawing counter as text:', error);
        warnings.push(`Error drawing counter as text: ${error.message}`);
      }
      break;
    case 'badge':
      // Draw badge counter
      try {
        const badgeScale = 1;
        let badgeCounterYPosition = 5;
        const badgeCounterYDelta = 35;
        if (options.displayBadgeCount && badgeCount > 0) {
          await drawBadgeCounter(
            ctx,
            'Badge',
            badgeCount,
            rankLogoWidth + 40,
            badgeCounterYPosition,
            badgeScale,
            options.badgeLabelColor,
            options.badgeMessageColor
          );
          badgeCounterYPosition += badgeCounterYDelta;
        }
        if (options.displaySuperbadgeCount && superbadgeCount > 0) {
          await drawBadgeCounter(
            ctx,
            'Superbadge',
            superbadgeCount,
            rankLogoWidth + 40,
            badgeCounterYPosition,
            badgeScale,
            options.badgeLabelColor,
            options.badgeMessageColor
          );
          badgeCounterYPosition += badgeCounterYDelta;
        }
        if (options.displayCertificationCount && certificationCount > 0) {
          await drawBadgeCounter(
            ctx,
            'Certification',
            certificationCount,
            rankLogoWidth + 40,
            badgeCounterYPosition,
            badgeScale,
            options.badgeLabelColor,
            options.badgeMessageColor
          );
        }
      } catch (error) {
        console.error('Error drawing counter as badges:', error);
        warnings.push(`Error drawing counter as badges: ${error.message}`);
      }
      break;
  }

  // Certifications Data
  let certifications = options.certificationsData.certifications.filter(
    (cert) =>
      (options.includeExpiredCertifications || cert.status.expired === false) &&
      (options.includeRetiredCertifications || cert.status.title !== 'Retired')
  );
  const totalCertifications = certifications.length;

  // Order certifications by dateCompleted
  certifications.sort((a, b) => new Date(a.dateCompleted) - new Date(b.dateCompleted));

  if (options.displayLastXCertifications && options.lastXCertifications) {
    certifications = certifications.slice(-options.lastXCertifications);
  }

  const displayedCertifications = certifications.length;
  const hiddenCertifications = totalCertifications - displayedCertifications;

  const certificationsLogos = [];

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
        certificationsLogos.push({
          logo,
          expired: cert.status.expired,
          retired: cert.status.title == 'Retired',
        });
      } catch (error) {
        console.error(`Error loading logo for ${cert.title}:`, error);
        warnings.push(`Error loading logo for ${cert.title}: ${error.message}`);
      }
    }
  });

  // Wait for all logos to be downloaded
  await Promise.all(logoPromises);

  if (hiddenCertifications > 0) {
    const plusXBadgeSvg = generatePlusXCertificationsSvg(hiddenCertifications);
    const plusXBadgeImage = await loadImage(
      `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
    );
    certificationsLogos.push({ logo: plusXBadgeImage });
  }

  if (certificationsLogos.length !== 0) {
    const certifYPosition = canvas.height * top_part + 20; // Start just below the top 1/3
    const availableWidth = canvas.width - 40; // Leave some padding on the sides
    const availableHeight = canvas.height * bottom_part * 0.95; // 95% of the bottom 2/3 height
    const certifSpacing = 10; // Space between certif logos

    // Calculate certifDesign for certifications
    const certifDesign = calculateCertificationsDesign(
      certificationsLogos.map(({ logo }) => logo),
      availableWidth,
      availableHeight,
      certifSpacing
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
