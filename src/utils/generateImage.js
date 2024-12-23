const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register the custom font
GlobalFonts.registerFromPath(path.join(__dirname, 'public/fonts/Arial.ttf'), 'Arial');

export const generateImage = async (rankData, certificationsData, badgesData) => {
  console.log('Generating banner with the following data:');
  console.log('Rank Data:', rankData);
  console.log('Certifications Data:', certificationsData);
  console.log('Badges Data:', badgesData);

  // Create canvas and context
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rank Data
  const rankLogoUrl = rankData.rank.imageUrl; // Assuming rankData contains imageUrl for the rank logo
  console.log('Loading rank logo from URL:', rankLogoUrl);
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * (1 / 3) * 0.8; // 80% of the top 1/3 height
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  ctx.drawImage(rankLogo, 20, 20, rankLogoWidth, rankLogoHeight);

  // Set font and text color
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 36px Arial'; // Use the registered custom font
  ctx.fillText(`${rankData.earnedBadgesCount} badges`, rankLogoWidth + 40, 20 + rankLogoHeight / 2);
  ctx.fillText(`${badgesData.trailheadStats.superbadgeCount} superbadges`, rankLogoWidth + 40, 60 + rankLogoHeight / 2);

  // Certifications Data
  const logoYPosition = canvas.height * (1 / 3) + 20; // Start just below the top 1/3
  const availableWidth = canvas.width - 40; // Leave some padding on the sides
  const logoSpacing = 10; // Space between logos
  const maxLogoHeight = canvas.height * (2 / 3) * 0.8; // 80% of the bottom 2/3 height

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

  console.log('Banner generation complete. Banner URL:', bannerUrl);

  return bannerUrl;
};