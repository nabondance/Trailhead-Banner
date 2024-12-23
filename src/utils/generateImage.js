import { createCanvas, loadImage } from 'canvas';

export const generateImage = async (rankData, certificationsData) => {
  const canvas = createCanvas(1584, 396);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rank Data
  const rankLogoUrl = rankData.imageUrl; // Assuming rankData contains imageUrl for the rank logo
  const rankLogo = await loadImage(rankLogoUrl);
  const rankLogoHeight = canvas.height * (1 / 3) * 0.8; // 80% of the top 1/3 height
  const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio
  ctx.drawImage(rankLogo, 20, 20, rankLogoWidth, rankLogoHeight);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`${rankData.requiredBadgesCount} badges`, rankLogoWidth + 40, 20 + rankLogoHeight / 2);

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

  // Convert canvas to image
  const buffer = canvas.toBuffer('image/png');
  const imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  return imageUrl;
};