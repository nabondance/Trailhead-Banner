const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register the custom fonts
const fontPath = path.join(process.cwd(), 'public/assets/fonts', 'Roboto-Bold.ttf');
GlobalFonts.registerFromPath(fontPath, 'CustomFont');

export const generateImage = async (
  rankData,
  certificationsData,
  badgesData,
  backgroundColor,
  backgroundImageUrl,
  displaySuperbadges
) => {
  console.log('Generating banner with the following data:');
  console.log('Rank Data:', rankData);
  console.log('Certifications Data:', certificationsData);
  console.log('Badges Data:', badgesData);
  console.log('Background Color:', backgroundColor);
  console.log('Background Image:', backgroundImageUrl);
  console.log('Display Superbadges:', displaySuperbadges);

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
  const rankLogoUrl = rankData.rank.imageUrl; // Assuming rankData contains imageUrl for the rank logo
  console.debug('Loading rank logo from URL:', rankLogoUrl);
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * (1 / 3) * 0.9; // 90% of the top 1/3 height
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  ctx.drawImage(rankLogo, 20, 20, rankLogoWidth, rankLogoHeight);

  // Set font and text color
  ctx.fillStyle = '#111827';
  ctx.font = '36px CustomFont'; // Use the custom font
  console.log('Font set to:', ctx.font);

  // Check if the font is available
  console.log('Available fonts:', GlobalFonts.families[0]);

  // Draw text
  try {
    const text1 = `${rankData.earnedBadgesCount} badges`;
    const text2 = `${badgesData.trailheadStats.superbadgeCount} superbadges`;
    console.log('Drawing text:', text1, text2);

    // Verify text metrics
    const text1Metrics = ctx.measureText(text1);
    const text2Metrics = ctx.measureText(text2);
    console.log('Text1 metrics:', text1Metrics);
    console.log('Text2 metrics:', text2Metrics);

    // Draw the text
    ctx.fillText(text1, rankLogoWidth + 40, 20 + rankLogoHeight / 2);
    ctx.fillText(text2, rankLogoWidth + 40, 60 + rankLogoHeight / 2);
    console.log('Text drawn successfully');
  } catch (error) {
    console.error('Error drawing text:', error);
  }

  // Certifications Data
  const logoYPosition = canvas.height * (1 / 3) + 20; // Start just below the top 1/3
  const availableWidth = canvas.width - 40; // Leave some padding on the sides
  const logoSpacing = 10; // Space between logos
  const maxLogoHeight = canvas.height * (2 / 3) * 0.85; // 85% of the bottom 2/3 height

  let totalLogoWidth = 0;
  const logos = [];

  // Load logos and calculate total width
  for (const cert of certificationsData.certifications) {
    if (cert.logoUrl) {
      try {
        console.log('Loading certification logo from URL:', cert.logoUrl);
        const logo = await loadImage(cert.logoUrl);
        const logoHeight = maxLogoHeight;
        const logoWidth = (logo.width / logo.height) * logoHeight; // Maintain aspect ratio
        totalLogoWidth += logoWidth + logoSpacing;
        logos.push({ logo, logoWidth, logoHeight });
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
  for (const { logo, logoWidth, logoHeight } of logos) {
    ctx.drawImage(logo, startX, logoYPosition, logoWidth, logoHeight);
    startX += logoWidth + logoSpacing;
  }

  // Convert canvas to banner
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  console.log('Banner generation complete.');

  return bannerUrl;
};
