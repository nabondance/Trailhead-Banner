const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const crypto = require('crypto');
const { filterDataByYear, generateRewindSummary } = require('./rewindUtils');
const { getRankAccentColor, getAgentblazerStyle, drawGeometricElements, drawStylizedText } = require('./drawUtils');
const FontUtils = require('./fontUtils');
import { getImage } from './cacheUtils';

export const generateRewind = async (options) => {
  const { username, year, rankData, certificationsData, stampsData } = options;

  // Load all fonts before generating the image
  await FontUtils.loadFonts();

  // Filter data for the specified year
  const yearlyData = filterDataByYear({ certificationsData, stampsData }, year);

  // Generate rewind summary
  const rewindSummary = generateRewindSummary({
    rankData,
    certificationsData,
    yearlyData,
    year,
    username,
  });

  // Generate the rewind image
  const imageResult = await generateRewindImage({
    username,
    year,
    rankData,
    rewindSummary,
    yearlyData,
  });

  return {
    imageUrl: imageResult.imageUrl,
    warnings: imageResult.warnings,
    rewindSummary,
    yearlyData,
  };
};

// Generate the actual rewind image
async function generateRewindImage(options) {
  const { username, year, rankData, rewindSummary, yearlyData } = options;
  const warnings = [];

  try {
    // Canvas dimensions: 2160x2700px (4:5 ratio)
    const canvas = createCanvas(2160, 2700);
    const ctx = canvas.getContext('2d');

    // Draw background
    await drawBackground(ctx, rewindSummary);

    // Header section
    await drawHeader(ctx, year, username);

    // Year section
    await drawYearSection(ctx, year);

    // Current rank section
    await drawRankSection(ctx, rankData);

    // Stats section
    await drawStatsSection(ctx, rewindSummary);

    // Agentblazer section (if achieved this year)
    if (rewindSummary.agentblazerRank) {
      await drawAgentblazerSection(ctx, rewindSummary.agentblazerRank);
      // Current Agentblazer rank section
      await drawAgentblazerRankSection(ctx, rewindSummary.agentblazerRank);
    } else {
      await drawMotivationSection(ctx, rewindSummary);
    }

    // Certification & Stamps section
    if (rewindSummary.yearlyCertifications + rewindSummary.yearlyStamps > 1) {
      await drawTimelineSection(ctx, rewindSummary, yearlyData);
    } else if (rewindSummary.yearlyCertifications + rewindSummary.yearlyStamps == 1) {
      await drawLimitedCertificationStampSection(ctx, rewindSummary, yearlyData);
    } else {
      await drawNoCertificationSection(ctx, rewindSummary, yearlyData);
    }

    // Top products section
    await drawTopProducts(ctx, rewindSummary.certificationProducts);

    // Watermark
    await drawWatermark(ctx);

    // Generate image URL and hash
    const buffer = canvas.toBuffer('image/png');
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;

    return {
      imageUrl,
      warnings,
      hash,
    };
  } catch (error) {
    console.error('Error generating rewind image:', error);
    warnings.push('Failed to generate rewind image');
    return {
      imageUrl: null,
      warnings,
      hash: null,
    };
  }
}

async function drawBackground(ctx, rewindSummary) {
  // Dark background base
  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, 2160, 2700);

  // Get rank-based colors for geometric elements
  const rankColor = getRankAccentColor(rewindSummary.currentRank);
  // Draw rank-specific geometric elements
  drawGeometricElements(ctx, rewindSummary, rankColor);
}

// Draw header with title and username
async function drawHeader(ctx, year, username) {
  const yPosition = 450;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';

  // Main title
  ctx.font = FontUtils.getFontString('bold', 120, FontUtils.getFontFamily('salesforce-sans'));
  ctx.fillText(`Trailhead Rewind`, 1080, yPosition);

  // Username
  ctx.font = FontUtils.getFontString('normal', 60, FontUtils.getFontFamily('salesforce-sans'));
  ctx.fillStyle = '#FFD21F'; // Trailhead yellow
  ctx.fillText(`@${username}`, 1080, yPosition + 100);
}

async function drawYearSection(ctx, year) {
  const canvasWidth = 2160;

  // Push further outside for more "hint than label"
  const rightMargin = -100;
  const topMargin = 30;

  const xPosition = canvasWidth - rightMargin;
  const yPosition = topMargin;

  ctx.save();

  ctx.translate(xPosition, yPosition);

  // Softer, more confident tilt
  ctx.rotate((20 * Math.PI) / 180);

  // Slightly softened white
  ctx.fillStyle = '#EDEDED';

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '-68px'; // Negative value brings letters closer together

  // IMPORTANT: very large font
  ctx.font = FontUtils.getFontString('200', 400, FontUtils.getFontFamily('dela-gothic-one'));

  ctx.fillText(year.toString(), 0, 0);

  ctx.restore();
}

// Draw current rank section with rank logo
async function drawRankSection(ctx, rankData) {
  // Define the center point where the logo should be positioned
  const rightX = 650;
  const centerY = 900;

  // Load and draw rank logo if available
  try {
    const rankLogoBuffer = await getImage(rankData.rank.imageUrl, 'ranks');
    const rankLogo = await loadImage(rankLogoBuffer);
    const rankLogoHeight = 400;
    const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight; // Maintain aspect ratio

    // Calculate position: right edge horizontally, center vertically
    const logoX = rightX - rankLogoWidth; // Right edge at centerX
    const logoY = centerY - rankLogoHeight / 2; // Center vertically

    // Add glow effect
    ctx.save();
    ctx.shadowColor = getRankAccentColor(rankData.rank.title);
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.drawImage(rankLogo, logoX, logoY, rankLogoWidth, rankLogoHeight);

    // Reset shadow for other elements
    ctx.restore();
  } catch (error) {
    console.error('Failed to load rank image:', error);
  }
}

async function drawAgentblazerRankSection(ctx, agentblazerRank) {
  // Load and draw Agentblazer image below the text
  if (agentblazerRank?.statusName === 'Agentblazer') {
    const centerY = 900;
    const xPosition = 1550;
    const logoHeight = 400;
    try {
      const agentBlazerPath = path.join(
        process.cwd(),
        'src',
        'assets',
        'logos',
        agentblazerRank.statusName,
        `${agentblazerRank.title}-big.png`
      );
      const agentblazerImage = await loadImage(agentBlazerPath);
      const logoWidth = (agentblazerImage.width / agentblazerImage.height) * logoHeight;
      // Center the logo below the text
      const logoX = xPosition;
      const logoY = centerY - logoHeight / 2; // Center vertically

      // Add glow effect
      ctx.save();
      ctx.shadowColor = getAgentblazerStyle(agentblazerRank.title).color;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.drawImage(agentblazerImage, logoX, logoY, logoWidth, logoHeight);

      // Reset shadow for other elements
      ctx.restore();
    } catch (error) {
      console.error('Failed to load Agentblazer image:', error);
    }
  }
}

async function drawStatsSection(ctx, rewindSummary) {
  // Draw stats for the year
  const yPositionInit = 750;
  const centerX = 1080;
  const lineHeight = 70;

  // Draw section title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = FontUtils.getFontString('bold', 60, FontUtils.getFontFamily('salesforce-sans'));
  ctx.fillText('Current Trailhead Stats', centerX, yPositionInit);

  // Define current total stats to display
  const stats = [
    {
      number: rewindSummary.totalCertifications || 0,
      label: rewindSummary.totalCertifications === 1 ? 'Certification earned' : 'Certifications earned',
      color: '#54A265', // Green
    },
    {
      number: rewindSummary.currentBadges || 0,
      label: rewindSummary.currentBadges === 1 ? 'Badge collected' : 'Badges collected',
      color: '#1BA5F8', // Trailhead blue
    },
    {
      number: rewindSummary.currentPoints?.toLocaleString('fr') || '0',
      label: 'Points accumulated',
      color: '#FFD21F', // Trailhead yellow
    },
  ];

  // Draw each stat as a line (skip if number is 0)
  let lineIndex = 0;
  stats.forEach((stat) => {
    // Skip if the number is 0
    if (stat.number === 0 || stat.number === '0') return;

    const yPosition = yPositionInit + 100 + lineIndex * lineHeight;
    lineIndex++;

    // Draw stat in format "Number Label"
    ctx.textAlign = 'center';

    // Draw number in bold and colored
    ctx.font = FontUtils.getFontString('bold', 50, FontUtils.getFontFamily('salesforce-sans'));
    ctx.fillStyle = stat.color;
    const numberText = `${stat.number} `;
    const numberWidth = ctx.measureText(numberText).width;

    // Draw label in normal white
    ctx.font = FontUtils.getFontString('normal', 50, FontUtils.getFontFamily('salesforce-sans'));
    ctx.fillStyle = '#FFFFFF';
    const labelWidth = ctx.measureText(stat.label).width;

    // Calculate positions to center the entire text
    const totalWidth = numberWidth + labelWidth;
    const startX = centerX - totalWidth / 2;

    // Draw number in bold and colored
    ctx.font = FontUtils.getFontString('bold', 50, FontUtils.getFontFamily('salesforce-sans'));
    ctx.fillStyle = stat.color;
    ctx.textAlign = 'left';
    ctx.fillText(stat.number, startX, yPosition);

    // Draw label in normal white
    ctx.font = FontUtils.getFontString('normal', 50, FontUtils.getFontFamily('salesforce-sans'));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(stat.label, startX + numberWidth, yPosition);
  });
}

// Draw Agentblazer achievement section
async function drawAgentblazerSection(ctx, agentblazerRank) {
  const yPosition = 1300;
  const fontSize = 100;

  // Draw the achievement text with colored level word
  ctx.font = FontUtils.getFontString('bold', fontSize, FontUtils.getFontFamily('salesforce-sans'));
  ctx.textAlign = 'center';

  // Split text to identify the level word for coloring
  let beforeText, levelText, afterText;
  if (agentblazerRank.title === 'Champion') {
    beforeText = "This year I'm a ";
    levelText = 'Champion';
    afterText = ' !';
  } else if (agentblazerRank.title === 'Innovator') {
    beforeText = "This year I've been ";
    levelText = 'Innovating';
    afterText = ' !';
  } else if (agentblazerRank.title === 'Legend') {
    beforeText = 'This year was ';
    levelText = 'Legendary';
    afterText = ' !';
  } else {
    beforeText = "This year I've became a ";
    levelText = agentblazerRank.title;
    afterText = '!';
  }

  const beforeWidth = ctx.measureText(beforeText).width;
  const levelWidth = ctx.measureText(levelText).width;
  const afterWidth = ctx.measureText(afterText).width;
  const totalWidth = beforeWidth + levelWidth + afterWidth;

  // Calculate starting position to center the entire text
  const startX = 1080 - totalWidth / 2;

  // Draw "This year I've became a " in white
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(beforeText, startX, yPosition);

  // Draw the level with metallic effects using the generic function
  const style = getAgentblazerStyle(agentblazerRank.title).metalType;
  drawStylizedText(ctx, levelText, fontSize, startX + beforeWidth, yPosition, style);

  // Draw " !" in white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(afterText, startX + beforeWidth + levelWidth, yPosition);
}

async function drawMotivationSection(ctx, rewindSummary) {
  const yPosition = 1300;
  const fontSize = 100;

  // Draw the achievement text with colored level word
  ctx.font = FontUtils.getFontString('bold', fontSize, FontUtils.getFontFamily('salesforce-sans'));
  ctx.textAlign = 'center';

  // Split text to identify the level word for coloring
  let beforeText, levelText, afterText, style;
  if (rewindSummary.yearlyCertifications > 1) {
    beforeText = "This year I've been ";
    levelText = 'Learning';
    afterText = ' !';
    style = 'learn';
  } else if (rewindSummary.yearlyStamps > 1) {
    beforeText = "This year I've been ";
    levelText = 'Stamping';
    afterText = ' !';
    style = 'stamp';
  } else if (rewindSummary.yearlyCertifications > 0 || rewindSummary.yearlyStamps > 0) {
    beforeText = "This year I've been ";
    levelText = 'Exploring';
    afterText = ' !';
    style = 'explore';
  } else {
    beforeText = '';
    levelText = '';
    afterText = '';
    style = 'default';
  }

  const beforeWidth = ctx.measureText(beforeText).width;
  const levelWidth = ctx.measureText(levelText).width;
  const afterWidth = ctx.measureText(afterText).width;
  const totalWidth = beforeWidth + levelWidth + afterWidth;

  // Calculate starting position to center the entire text
  const startX = 1080 - totalWidth / 2;

  // Draw "This year I've became a " in white
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(beforeText, startX, yPosition);

  // Draw the level with metallic effects using the generic function
  drawStylizedText(ctx, levelText, fontSize, startX + beforeWidth, yPosition, style);

  // Draw " !" in white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(afterText, startX + beforeWidth + levelWidth, yPosition);
}

// Draw certification section when no certifications earned
async function drawNoCertificationSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1300;
}

// Draw certification section for single certification
async function drawLimitedCertificationStampSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1750;
  const logoSize = 500;
  const spacing = 40;
  const centerX = 1080;

  // Use the pre-computed yearly achievements from rewind summary
  const items = rewindSummary.yearlyAchievements || [];

  if (items.length === 0) return;

  // Calculate total width needed for all logos
  const totalWidth = items.length * logoSize + (items.length - 1) * spacing;
  const startX = centerX - totalWidth / 2;

  // Draw section title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = FontUtils.getFontString('bold', 80, FontUtils.getFontFamily('salesforce-sans'));

  // Draw each logo centered and aligned
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const logoX = startX + i * (logoSize + spacing);
    const logoY = yPosition - logoSize / 2;

    try {
      const logoBuffer = await getImage(item.logoUrl, item.folder);
      const logo = await loadImage(logoBuffer);

      // Fixed width, calculate height to respect aspect ratio
      const drawWidth = logoSize;
      const drawHeight = (drawWidth * logo.height) / logo.width;

      // Center horizontally in the allocated space, use calculated height
      const centeredX = logoX;
      const centeredY = logoY;

      ctx.drawImage(logo, centeredX, centeredY, drawWidth, drawHeight);
    } catch (error) {
      console.error(`Failed to load ${item.type} logo:`, error);
    }
  }
}

// Draw timeline section for certifications and stamps
async function drawTimelineSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1800;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Use pre-computed timeline data from rewind summary
  const activitiesByMonth = rewindSummary.timelineData;

  // Timeline setup
  const timelineY = yPosition + 150;
  const timelineStartX = 150;
  const timelineEndX = 2010;
  const monthWidth = (timelineEndX - timelineStartX) / 11; // 12 months, 11 gaps

  // Draw timeline line
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(timelineStartX, timelineY);
  ctx.lineTo(timelineEndX, timelineY);
  ctx.stroke();

  // Draw months and activities
  const logoWidth = 165;
  const spacing = 10;
  const maxLogosPerMonth = 3;

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthX = timelineStartX + monthIndex * monthWidth;

    // Draw month label
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = FontUtils.getFontString('normal', 40, FontUtils.getFontFamily('salesforce-sans'));
    ctx.fillText(monthNames[monthIndex], monthX, timelineY + 50);

    // Draw month marker
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(monthX, timelineY, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Draw activities for this month
    const monthData = activitiesByMonth[monthIndex];
    if (monthData && monthData.sortedActivities) {
      let currentLogo = 0;
      let currentVerticalOffset = 0;

      // Use pre-computed sorted activities
      const monthActivities = monthData.sortedActivities;

      // Draw activities up to the limit
      for (let i = 0; i < Math.min(monthActivities.length, maxLogosPerMonth); i++) {
        const activity = monthActivities[i];
        if (activity.logoUrl) {
          try {
            const logoBuffer = await getImage(activity.logoUrl, activity.folder);
            const logo = await loadImage(logoBuffer);

            // Calculate dimensions using actual image aspect ratio
            const drawWidth = logoWidth;
            const drawHeight = (drawWidth * logo.height) / logo.width; // Maintain original aspect ratio

            const logoX = monthX - drawWidth / 2;
            const logoY = timelineY - 30 - currentVerticalOffset - drawHeight;

            ctx.drawImage(logo, logoX, logoY, drawWidth, drawHeight);

            // Add this logo's height plus spacing for next logo
            currentVerticalOffset += drawHeight + spacing;
            currentLogo++;
          } catch (error) {
            console.error(`Failed to load ${activity.type} logo:`, error);
          }
        }
      }

      // Show extra count if more activities than displayed
      const totalActivities = monthActivities.length;
      const extraCount = totalActivities - currentLogo;

      if (extraCount > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = FontUtils.getFontString('bold', 40, FontUtils.getFontFamily('salesforce-sans'));
        ctx.textAlign = 'center';
        // Position above the actual logos drawn for this month
        ctx.fillText(`+${extraCount}`, monthX, timelineY - 30 - currentVerticalOffset - 20);
      }
    }
  }
}

// Draw favorite product section with logos
async function drawTopProducts(ctx, certificationProducts) {
  const yPosition = 2250;

  // Find products with the highest count
  const products = Object.entries(certificationProducts);
  if (products.length === 0) return;

  const maxCount = Math.max(...products.map(([, count]) => count));
  const topProducts = products.filter(([, count]) => count === maxCount);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = FontUtils.getFontString('bold', 80, FontUtils.getFontFamily('salesforce-sans'));

  // Draw the title
  ctx.fillText('My favorite topic to learn about:', 1080, yPosition);

  if (topProducts.length === 1) {
    // Single product - draw logo and text
    const product = topProducts[0][0];
    await drawProductWithLogo(ctx, product, 1080, yPosition + 120);
  } else {
    // Multiple products - draw each with its logo
    const productNames = topProducts.map(([product]) => product);

    if (productNames.length === 2) {
      // Two products side by side
      const spacing = 400;
      await drawProductWithLogo(ctx, productNames[0], 1080 - spacing / 2, yPosition + 120);

      // Draw "&" between products
      ctx.fillStyle = '#FFFFFF';
      ctx.font = FontUtils.getFontString('bold', 80, FontUtils.getFontFamily('salesforce-sans'));
      ctx.textAlign = 'center';
      ctx.fillText('&', 1080, yPosition + 140);

      await drawProductWithLogo(ctx, productNames[1], 1080 + spacing / 2, yPosition + 120);
    } else {
      // Three or more products - stack vertically or show as list
      let currentY = yPosition + 120;
      for (let i = 0; i < productNames.length; i++) {
        await drawProductWithLogo(ctx, productNames[i], 1080, currentY);
        currentY += 120;

        // Add "&" before last product, comma before others
        if (i < productNames.length - 1) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = FontUtils.getFontString('bold', 60, FontUtils.getFontFamily('salesforce-sans'));
          ctx.textAlign = 'center';
          const separator = i === productNames.length - 2 ? '&' : ',';
          ctx.fillText(separator, 1080, currentY - 60);
        }
      }
    }
  }
}

// Helper function to draw a product with its logo
async function drawProductWithLogo(ctx, productName, centerX, centerY) {
  const logoSize = 120;

  try {
    // Load product logo from local assets
    const logoFileName = getProductLogoFileName(productName);
    const logoPath = path.join(process.cwd(), 'src', 'assets', 'logos', 'products', logoFileName);
    const logo = await loadImage(logoPath);

    // Calculate dimensions
    const logoWidth = (logo.width / logo.height) * logoSize;

    // Measure text width to calculate positioning
    ctx.font = FontUtils.getFontString('bold', 100, FontUtils.getFontFamily('salesforce-sans'));
    const textMetrics = ctx.measureText(productName);
    const textWidth = textMetrics.width;

    // Calculate positions for logo and text (logo on left, text on right)
    const totalWidth = logoWidth + 20 + textWidth; // 20px spacing
    const startX = centerX - totalWidth / 2;

    const logoX = startX;
    const logoY = centerY - logoSize / 2;
    const textX = startX + logoWidth + 20;

    // Draw logo
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoSize);

    // Draw product name
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(productName, textX, centerY + 30); // Adjust Y for vertical centering
  } catch (error) {
    console.error(`Failed to load logo for product ${productName}:`, error);
    // Fallback to text only
    ctx.fillStyle = '#FFFFFF';
    ctx.font = FontUtils.getFontString('bold', 100, FontUtils.getFontFamily('salesforce-sans'));
    ctx.textAlign = 'center';
    ctx.fillText(productName, centerX, centerY + 30);
  }
}

// Helper function to convert product name to logo filename
function getProductLogoFileName(productName) {
  // Convert product name to filename format
  // Example: "Sales Cloud" -> "sales-cloud.png"
  return productName.toLowerCase().replace(/\s+/g, '-') + '.png';
}

async function drawWatermark(ctx) {
  const byNabondanceSvgPath = path.join(process.cwd(), 'public', 'thb-rewind.svg');
  const byNabondanceSvg = await loadImage(byNabondanceSvgPath);
  const byNabondanceHeight = 40;
  const byNabondanceWidth = (byNabondanceSvg.width / byNabondanceSvg.height) * byNabondanceHeight;
  ctx.globalAlpha = 1.0; // Reset transparency
  ctx.drawImage(
    byNabondanceSvg,
    2160 - byNabondanceWidth - 10,
    2700 - byNabondanceHeight - 10,
    byNabondanceWidth,
    byNabondanceHeight
  );
}
