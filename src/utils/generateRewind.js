const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const crypto = require('crypto');
const { filterDataByYear, generateRewindSummary } = require('./rewindUtils');
const { getRankAccentColor, getAgentblazerColor, drawGeometricElements } = require('./drawUtils');
import { getImage } from './cacheUtils';
require('./fonts');

export const generateRewind = async (options) => {
  const { username, year, rankData, certificationsData, stampsData } = options;

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
    }

    // Certification section
    if (rewindSummary.yearlyCertifications > 1 || rewindSummary.yearlyStamps > 1) {
      await drawTimelineSection(ctx, rewindSummary, yearlyData);
    }
    if (rewindSummary.yearlyCertifications === 1) {
      await drawCertificationSection(ctx, rewindSummary, yearlyData);
    }
    if (rewindSummary.yearlyCertifications === 0) {
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
  const yPosition = 350;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';

  // Main title
  ctx.font = 'bold 120px "Salesforce Sans"';
  ctx.fillText(`Trailhead Rewind`, 1080, yPosition);

  // Username
  ctx.font = '60px "Salesforce Sans"';
  ctx.fillStyle = '#FFD21F'; // Trailhead yellow
  ctx.fillText(`@${username}`, 1080, yPosition + 100);
}

async function drawYearSection(ctx, year) {
  const rightMargin = 200;
  const topMargin = 350;
  const xPosition = 2160 - rightMargin;
  const yPosition = topMargin;

  // Save context state
  ctx.save();

  // Move to the position where we want to draw the text
  ctx.translate(xPosition, yPosition);

  // Rotate the text -15 degrees (clockwise tilt)
  ctx.rotate((20 * Math.PI) / 180);

  // Draw year tilted
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  ctx.font = 'bold 160px "Salesforce Sans"';
  ctx.fillText(year.toString(), 0, 0);

  // Restore context state
  ctx.restore();
}

// Draw current rank section with rank logo
async function drawRankSection(ctx, rankData) {
  // Define the center point where the logo should be positioned
  const rightX = 650;
  const centerY = 750;

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
    const centerY = 750;
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
      ctx.shadowColor = getAgentblazerColor(agentblazerRank.title);
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
  const yPositionInit = 650;
  const centerX = 1080;
  const lineHeight = 60;

  // Draw section title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 60px "Salesforce Sans"';
  ctx.fillText('Current Trailhead Stats', centerX, yPositionInit);

  // Define current total stats to display
  const stats = [
    {
      label: 'Total Points',
      value: rewindSummary.currentPoints?.toLocaleString('fr') || '0',
      color: '#FFD21F', // Trailhead yellow
    },
    {
      label: 'Total Badges',
      value: rewindSummary.currentBadges || 0,
      color: '#1BA5F8', // Trailhead blue
    },
    {
      label: 'Total Certifications',
      value: rewindSummary.totalCertifications || 0,
      color: '#54A265', // Green
    },
  ];

  // Draw each stat as a line
  stats.forEach((stat, index) => {
    const yPosition = yPositionInit + 80 + index * lineHeight;

    // Draw stat in format "Label: Value"
    ctx.font = '50px "Salesforce Sans"';
    ctx.textAlign = 'center';

    // Draw label in white
    ctx.fillStyle = '#FFFFFF';
    const labelText = `${stat.label}: `;
    const labelWidth = ctx.measureText(labelText).width;

    // Calculate positions to center the entire text
    const totalText = `${stat.label}: ${stat.value}`;
    const totalWidth = ctx.measureText(totalText).width;
    const startX = centerX - totalWidth / 2;

    // Draw label
    ctx.textAlign = 'left';
    ctx.fillText(labelText, startX, yPosition);

    // Draw value in color
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, startX + labelWidth, yPosition);
  });
}

// Draw Agentblazer achievement section
async function drawAgentblazerSection(ctx, agentblazerRank) {
  const yPosition = 1150;

  // Get color for the rank
  const rankColor = AGENTBLAZER_COLORS[agentblazerRank.title] || '#FFFFFF';

  // Draw the achievement text with colored level word
  ctx.font = 'bold 100px "Salesforce Sans"';
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

  // Draw the level with special metallic effects
  if (agentblazerRank.title === 'Champion') {
    // Create silver gradient for Champion
    const gradient = ctx.createLinearGradient(
      startX + beforeWidth,
      yPosition - 40,
      startX + beforeWidth + levelWidth,
      yPosition + 10
    );

    // Silver gradient with metallic shine
    gradient.addColorStop(0, '#E8E8E8'); // Light silver
    gradient.addColorStop(0.3, '#C0C0C0'); // Silver
    gradient.addColorStop(0.5, '#F8F8F8'); // White highlight
    gradient.addColorStop(0.7, '#C0C0C0'); // Silver
    gradient.addColorStop(1, '#A8A8A8'); // Dark silver

    ctx.fillStyle = gradient;

    // Add silver glow
    ctx.shadowColor = '#C0C0C0';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillText(levelText, startX + beforeWidth, yPosition);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else if (agentblazerRank.title === 'Innovator') {
    // Create golden gradient for Innovator
    const gradient = ctx.createLinearGradient(
      startX + beforeWidth,
      yPosition - 40,
      startX + beforeWidth + levelWidth,
      yPosition + 10
    );

    // Golden gradient with metallic shine
    gradient.addColorStop(0, '#FFE135'); // Light gold
    gradient.addColorStop(0.3, '#FFD700'); // Gold
    gradient.addColorStop(0.5, '#FFFF99'); // Yellow highlight
    gradient.addColorStop(0.7, '#FFD700'); // Gold
    gradient.addColorStop(1, '#DAA520'); // Dark gold

    ctx.fillStyle = gradient;

    // Add golden glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillText(levelText, startX + beforeWidth, yPosition);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else if (agentblazerRank.title === 'Legend') {
    // Create subtle metallic gradient for Legend
    const gradient = ctx.createLinearGradient(
      startX + beforeWidth,
      yPosition - 40,
      startX + beforeWidth + levelWidth,
      yPosition + 10
    );

    // Elegant platinum gradient with subtle shimmer
    gradient.addColorStop(0, '#F0F0F0'); // Light silver
    gradient.addColorStop(0.3, '#E8E8E8'); // Platinum
    gradient.addColorStop(0.5, '#FFFFFF'); // White highlight
    gradient.addColorStop(0.7, '#E8E8E8'); // Platinum
    gradient.addColorStop(1, '#D3D3D3'); // Light gray

    ctx.fillStyle = gradient;

    // Add subtle glow
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillText(levelText, startX + beforeWidth, yPosition);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else {
    // Fallback for unknown levels
    ctx.fillStyle = rankColor;
    ctx.fillText(levelText, startX + beforeWidth, yPosition);
  }

  // Draw " !" in white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(afterText, startX + beforeWidth + levelWidth, yPosition);
}

// Draw certification section when no certifications earned
async function drawNoCertificationSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1250;
}

// Draw certification section for single certification
async function drawCertificationSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1250;
  // To be implemented if needed
}

// Draw timeline section for certifications and stamps
async function drawTimelineSection(ctx, rewindSummary, yearlyData) {
  const yPosition = 1650;
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
    ctx.font = '40px "Salesforce Sans"';
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
        ctx.font = 'bold 40px "Salesforce Sans"';
        ctx.textAlign = 'center';
        // Position above the actual logos drawn for this month
        ctx.fillText(`+${extraCount}`, monthX, timelineY - 30 - currentVerticalOffset - 20);
      }
    }
  }
}

// Draw favorite product section with logos
async function drawTopProducts(ctx, certificationProducts) {
  const yPosition = 2100;

  // Find products with the highest count
  const products = Object.entries(certificationProducts);
  if (products.length === 0) return;

  const maxCount = Math.max(...products.map(([, count]) => count));
  const topProducts = products.filter(([, count]) => count === maxCount);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 80px "Salesforce Sans"';

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
      ctx.font = 'bold 80px "Salesforce Sans"';
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
          ctx.font = 'bold 60px "Salesforce Sans"';
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
    ctx.font = 'bold 100px "Salesforce Sans"';
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
    ctx.font = 'bold 100px "Salesforce Sans"';
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

// Agentblazer rank colors
const AGENTBLAZER_COLORS = {
  Champion: '#C0C0C0', // Silver
  Innovator: '#FFD700', // Gold
  Legend: '#E5E4E2', // Platinum
};

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
