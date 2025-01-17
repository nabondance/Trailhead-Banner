const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const { applyGrayscale, cropImage, calculateCertificationsDesign, drawBadgeCounter } = require('./imageUtils');
require('./fonts');
const fs = require('fs');

const top_part = 1 / 4;
const bottom_part = 3 / 4;
let right_part = 7 / 10;

export const generateImage = async (options) => {
  console.log('Generating banner with the following data:');
  console.log('Rank Data:', options.rankData);
  console.log('Certifications Data:', options.certificationsData);
  console.log('Badges Data:', options.badgesData);
  console.log('Superbadges Data:', options.superbadgesData);
  console.log('Background Options:', {
    color: options.backgroundColor,
    imageUrl: options.backgroundImageUrl,
  });
  console.log('Display Options:', {
    rankLogo: options.displayRankLogo,
    superbadges: options.displaySuperbadges,
    badgeCount: options.displayBadgeCount,
    superbadgeCount: options.displaySuperbadgeCount,
    certificationCount: options.displayCertificationCount,
    counterDisplayType: options.counterDisplayType, // Log counter display type
  });
  console.log('Text Options:', {
    color: options.textColor,
  });
  console.log('Certification Options:', {
    includeExpired: options.includeExpiredCertifications,
    includeRetired: options.includeRetiredCertifications,
  });
  console.log('MVP Data:', options.mvpData);

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  if (options.backgroundImageUrl) {
    const bgImage = await loadImage(options.backgroundImageUrl);
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Rank Logo
  const rankLogoUrl = options.rankData.rank.imageUrl;
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * top_part * 1;
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  const rankLogoScalingFactor = 1.2;
  if (options.displayRankLogo) {
    ctx.drawImage(rankLogo, 0, 0, rankLogoWidth * rankLogoScalingFactor, rankLogoHeight * rankLogoScalingFactor);
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
        console.error('Error drawing text:', error);
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
      }
      break;
  }

  // Display Superbadges if enabled
  if (options.displaySuperbadges) {
    const superbadgeLogos = options.superbadgesData.earnedAwards.edges
      .filter((edge) => edge.node.award && edge.node.award.icon)
      .map((edge) => edge.node.award.icon);

    const superbadgeLogoHeight = canvas.height * top_part * 0.9;
    const superbadgeLogoWidth = superbadgeLogoHeight; // Assuming square logos
    let superbadgeSpacing = 10;
    const superbadgeAvailableWidth = canvas.width * right_part; // Available width for superbadges
    let superbadgeX = canvas.width - superbadgeAvailableWidth;
    let superbadgeY = 10;

    // Calculate total width required for superbadges
    const totalSuperbadgeWidth = superbadgeLogos.length * (superbadgeLogoWidth + superbadgeSpacing) - superbadgeSpacing;

    // Adjust spacing if total width exceeds available space
    if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
      superbadgeSpacing =
        (superbadgeAvailableWidth - superbadgeLogos.length * superbadgeLogoWidth) / (superbadgeLogos.length - 1);
    }

    for (const logoUrl of superbadgeLogos) {
      try {
        const logo = await loadImage(logoUrl);
        ctx.drawImage(logo, superbadgeX, superbadgeY, superbadgeLogoWidth, superbadgeLogoHeight);
        superbadgeX += superbadgeLogoWidth + superbadgeSpacing;
      } catch (error) {
        console.error(`Error loading superbadge logo from URL: ${logoUrl}`, error);
      }
    }
  }

  // Certifications Data
  const certifications = options.certificationsData.certifications.filter(
    (cert) =>
      (options.includeExpiredCertifications || cert.status.expired === false) &&
      (options.includeRetiredCertifications || cert.status.title !== 'Retired')
  );

  if (certifications.length !== 0) {
    const certifYPosition = canvas.height * top_part + 20; // Start just below the top 1/3
    const availableWidth = canvas.width - 40; // Leave some padding on the sides
    const availableHeight = canvas.height * bottom_part * 0.95; // 95% of the bottom 2/3 height
    const certifSpacing = 10; // Space between certif logos

    const certificationsLogos = [];

    // Load logos
    for (const cert of certifications) {
      if (cert.logoUrl) {
        try {
          console.log('Loading certification logo from URL:', cert.logoUrl);
          let logo = await loadImage(cert.logoUrl);
          logo = cropImage(logo); // Crop the logo to remove extra space
          certificationsLogos.push({
            logo,
            expired: cert.status.expired,
            retired: cert.status.title == 'Retired',
          });
        } catch (error) {
          console.error(`Error loading logo for ${cert.title}:`, error);
        }
      }
    }

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
      if (expired) {
        ctx.drawImage(logo, certifStartX, certifCurrentYPosition, certifDesign.logoWidth, certifDesign.logoHeight);
        applyGrayscale(ctx, certifStartX, certifCurrentYPosition, certifDesign.logoWidth, certifDesign.logoHeight); // Apply grayscale for expired certifications
      } else if (retired) {
        ctx.globalAlpha = 0.5; // Set transparency for retired certifications
        ctx.drawImage(logo, certifStartX, certifCurrentYPosition, certifDesign.logoWidth, certifDesign.logoHeight);
      } else {
        ctx.globalAlpha = 1.0; // Reset transparency
        ctx.drawImage(logo, certifStartX, certifCurrentYPosition, certifDesign.logoWidth, certifDesign.logoHeight);
      }
      certifStartX += certifDesign.logoWidth + certifSpacing;

      // Move to the next row if the current row is full
      if ((i + 1) % certifDesign.maxLogosPerLine === 0) {
        currentLine++;
        certifStartX = certifDesign.logoLineStartX[currentLine];
        certifCurrentYPosition += certifDesign.logoHeight + certifSpacing;
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
  const byNabondanceWidth = 150;
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

  console.log('Banner generation complete.');

  return bannerUrl;
};
