const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register the custom fonts
const fontPathRobotoBold = path.join(process.cwd(), 'public/assets/fonts', 'Roboto-Bold.ttf');
GlobalFonts.registerFromPath(fontPathRobotoBold, 'Roboto-Bold');
const fontPathAnta = path.join(process.cwd(), 'public/assets/fonts', 'Anta.woff2');
GlobalFonts.registerFromPath(fontPathAnta, 'Anta');

const applyGrayscale = (ctx, x, y, width, height) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg; // Red
    data[i + 1] = avg; // Green
    data[i + 2] = avg; // Blue
  }
  ctx.putImageData(imageData, x, y);
};

export const generateImage = async (
  rankData,
  certificationsData,
  badgesData,
  superbadgesData,
  backgroundColor,
  backgroundImageUrl,
  displaySuperbadges,
  textColor,
  includeExpiredCertifications, // Existing parameter
  includeRetiredCertifications // New parameter
) => {
  console.log('Generating banner with the following data:');
  console.log('Rank Data:', rankData);
  console.log('Certifications Data:', certificationsData);
  console.log('Badges Data:', badgesData);
  console.log('Superbadges Data:', superbadgesData);
  console.log('Background Color:', backgroundColor);
  console.log('Background Image Url:', backgroundImageUrl);
  console.log('Display Superbadges:', displaySuperbadges);
  console.log('Text Color:', textColor);

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  if (backgroundImageUrl) {
    const bgImage = await loadImage(backgroundImageUrl);
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = backgroundColor || '#f3f4f6'; // Use the selected background color or default to #f3f4f6
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Rank Data
  const rankLogoUrl = rankData.rank.imageUrl;
  console.debug('Loading rank logo from URL:', rankLogoUrl);
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * (1 / 3) * 0.9; // 90% of the top 1/3 height
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  ctx.drawImage(rankLogo, 20, 20, rankLogoWidth, rankLogoHeight);

  // Set font and text color
  ctx.fillStyle = textColor || '#111827'; // Use the custom text color or default one
  ctx.font = '36px Roboto-Bold'; // Use the custom font
  console.log('Font set to:', ctx.font);

  // Draw text
  try {
    const badgeCount = rankData.earnedBadgesCount;
    const superbadgeCount = badgesData.trailheadStats.superbadgeCount;

    const text1 = `${badgeCount} badge${badgeCount !== 1 ? 's' : ''}`;
    const text2 = superbadgeCount > 0 ? `${superbadgeCount} superbadge${superbadgeCount !== 1 ? 's' : ''}` : '';

    // Draw the text
    ctx.fillText(text1, rankLogoWidth + 40, 20 + rankLogoHeight / 2);
    if (text2) {
      ctx.fillText(text2, rankLogoWidth + 40, 60 + rankLogoHeight / 2);
    }
  } catch (error) {
    console.error('Error drawing text:', error);
  }

  // Display Superbadges if enabled
  if (displaySuperbadges) {
    const superbadgeLogos = superbadgesData.earnedAwards.edges
      .filter((edge) => edge.node.award && edge.node.award.icon)
      .map((edge) => edge.node.award.icon);

    const superbadgeLogoHeight = canvas.height * (1 / 3) * 0.8; // 80% of the top 1/3 height
    const superbadgeLogoWidth = superbadgeLogoHeight; // Assuming square logos
    let superbadgeSpacing = 10;
    const availableWidth = canvas.width * (2 / 3); // Available width for superbadges
    let superbadgeX = canvas.width - availableWidth;
    let superbadgeY = 20;

    // Calculate total width required for superbadges
    const totalSuperbadgeWidth = superbadgeLogos.length * (superbadgeLogoWidth + superbadgeSpacing) - superbadgeSpacing;

    // Adjust spacing if total width exceeds available space
    if (totalSuperbadgeWidth > availableWidth) {
      superbadgeSpacing =
        (availableWidth - superbadgeLogos.length * superbadgeLogoWidth) / (superbadgeLogos.length - 1);
    }

    for (const logoUrl of superbadgeLogos) {
      try {
        const logo = await loadImage(logoUrl);
        ctx.drawImage(logo, superbadgeX, superbadgeY, superbadgeLogoWidth, superbadgeLogoHeight);
        superbadgeX += superbadgeLogoWidth + superbadgeSpacing;
        if (superbadgeX + superbadgeLogoWidth > canvas.width) {
          superbadgeX = canvas.width - availableWidth;
          superbadgeY += superbadgeLogoHeight + superbadgeSpacing;
        }
      } catch (error) {
        console.error(`Error loading superbadge logo from URL: ${logoUrl}`, error);
      }
    }
  }

  // Certifications Data
  const logoYPosition = canvas.height * (1 / 3) + 20; // Start just below the top 1/3
  const availableWidth = canvas.width - 40; // Leave some padding on the sides
  const logoSpacing = 10; // Space between logos
  const maxLogoHeight = canvas.height * (2 / 3) * 0.8; // 80% of the bottom 2/3 height

  let totalLogoWidth = 0;
  const certificationsLogos = [];

  // Filter certifications based on the includeExpiredCertifications and includeRetiredCertifications flags
  const certifications = certificationsData.certifications.filter(
    (cert) =>
      (includeExpiredCertifications || cert.status.expired === false) &&
      (includeRetiredCertifications || cert.status.title !== 'Retired')
  );

  // Load logos and calculate total width
  for (const cert of certifications) {
    if (cert.logoUrl) {
      try {
        console.log('Loading certification logo from URL:', cert.logoUrl);
        const logo = await loadImage(cert.logoUrl);
        const logoHeight = maxLogoHeight;
        const logoWidth = (logo.width / logo.height) * logoHeight; // Maintain aspect ratio
        totalLogoWidth += logoWidth + logoSpacing;
        certificationsLogos.push({
          logo,
          logoWidth,
          logoHeight,
          expired: cert.status.expired,
          retired: cert.status.title == 'Retired',
        });
      } catch (error) {
        console.error(`Error loading logo for ${cert.title}:`, error);
      }
    }
  }

  // Remove the last spacing
  totalLogoWidth -= logoSpacing;

  // Calculate starting X position to center the logos
  let startX = (canvas.width - totalLogoWidth) / 2;

  // Draw logos centered
  for (const { logo, logoWidth, logoHeight, expired, retired } of certificationsLogos) {
    if (expired) {
      ctx.drawImage(logo, startX, logoYPosition, logoWidth, logoHeight);
      applyGrayscale(ctx, startX, logoYPosition, logoWidth, logoHeight); // Apply grayscale for expired certifications
    } else if (retired) {
      ctx.globalAlpha = 0.5; // Set transparency for retired certifications
      ctx.drawImage(logo, startX, logoYPosition, logoWidth, logoHeight);
    } else {
      ctx.globalAlpha = 1.0; // Reset transparency
      ctx.drawImage(logo, startX, logoYPosition, logoWidth, logoHeight);
    }
    startX += logoWidth + logoSpacing;
  }

  // Load and draw the "By /nabondance" SVG
  const byNabondanceSvgPath = path.join(process.cwd(), 'public', 'bynabondance.svg');
  const byNabondanceSvg = await loadImage(byNabondanceSvgPath);
  const byNabondanceWidth = 300;
  const byNabondanceHeight = 50;
  ctx.globalAlpha = 1.0; // Reset transparency
  ctx.drawImage(
    byNabondanceSvg,
    canvas.width - byNabondanceWidth,
    canvas.height - byNabondanceHeight,
    byNabondanceWidth,
    byNabondanceHeight
  );

  // Convert canvas to banner
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  console.log('Banner generation complete.');

  return bannerUrl;
};
