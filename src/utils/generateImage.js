const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path  = require("path")

  // Register the custom fonts
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Bold.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Extralight.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Heavy.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Light.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Medium.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka.ttf'))
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Iosevka-Thin.ttf'))
  // Log the registered fonts
  console.log('Custom fonts registered:', JSON.stringify(GlobalFonts, null, 2));
  console.log('GlobalFonts families:', GlobalFonts.families);
  console.log('GlobalFonts faces:', GlobalFonts.faces);

export const generateImage = async (rankData, certificationsData, badgesData) => {
  console.log('Generating banner with the following data:');
//   console.log('Rank Data:', rankData);
//   console.log('Certifications Data:', certificationsData);
//   console.log('Badges Data:', badgesData);

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rank Data
  const rankLogoUrl = rankData.rank.imageUrl; // Assuming rankData contains imageUrl for the rank logo
  console.debug('Loading rank logo from URL:', rankLogoUrl);
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * (1 / 3) * 0.9; // 90% of the top 1/3 height
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  ctx.drawImage(rankLogo, 20, 20, rankLogoWidth, rankLogoHeight);

  // Set font and text color
  ctx.fillStyle = '#111827';
  ctx.font = '36px Iosevka';
  console.log('Font set to:', ctx.font);

  // Check if the font is available
  console.log('Available fonts:', GlobalFonts.families[0]);

  // Check if the font is available
  if (!GlobalFonts.families.some(family => family.family === 'Iosevka')) {
    console.error('Font "Iosevka" is not loaded');
  }

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

  // Adjust logo sizes if total width exceeds available width
  if (totalLogoWidth > availableWidth) {
    const scaleFactor = availableWidth / totalLogoWidth;
    console.log('Scaling logos by factor:', scaleFactor);
    logos.forEach(logo => {
      logo.logoWidth *= scaleFactor;
      logo.logoHeight *= scaleFactor;
    });
  }

  // Draw logos
  let logoXPosition = 20; // Starting X position
  logos.forEach(({ logo, logoWidth, logoHeight }) => {
    ctx.drawImage(logo, logoXPosition, logoYPosition, logoWidth, logoHeight);
    logoXPosition += logoWidth + logoSpacing;
  });

  // Convert canvas to banner
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  console.log('Banner generation complete.');

  return bannerUrl;
};