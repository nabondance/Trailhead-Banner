const calculateCertificationsDesign = (logos, canvasWidth, canvasHeight, logoSpacing, alignment) => {
  let logoWidth = logos[0].width;
  let logoHeight = logos[0].height;
  let scale = 2.0;
  let numRows = 1;
  let maxLogosPerRow = 0;

  while (true) {
    // Step 1: Calculate the maximum number of logos per row at the current scale
    maxLogosPerRow = Math.floor((canvasWidth + logoSpacing) / (logoWidth * scale + logoSpacing));

    // Step 2: Calculate the number of rows needed to display all logos
    const numRowsNeeded = Math.ceil(logos.length / maxLogosPerRow);

    // Step 3: Check if the current scale allows all rows to fit within the canvas height
    if (numRowsNeeded * (logoHeight * scale + logoSpacing) - logoSpacing <= canvasHeight) {
      break;
    } else {
      scale *= 0.9;
    }
  }
  // Step 5: Compute the final number of rows
  numRows = Math.ceil(logos.length / maxLogosPerRow);

  // Step 6: Compute the final logo dimensions
  const finalLogoWidth = logoWidth * scale;
  const finalLogoHeight = logoHeight * scale;

  // Calculate the starting X position for each line
  const logoLineStartX = [];
  for (let row = 0; row < numRows; row++) {
    const logosInLine = row === numRows - 1 ? logos.length % maxLogosPerRow || maxLogosPerRow : maxLogosPerRow;
    const lineWidth = logosInLine * finalLogoWidth + (logosInLine - 1) * logoSpacing;

    let startX;
    if (alignment === 'left') {
      startX = 0;
    } else if (alignment === 'right') {
      startX = canvasWidth - lineWidth;
    } else {
      // center
      startX = (canvasWidth - lineWidth) / 2;
    }
    logoLineStartX.push(startX);
  }

  return {
    logoWidth: finalLogoWidth,
    logoHeight: finalLogoHeight,
    numLines: numRows,
    maxLogosPerLine: maxLogosPerRow,
    logoLineStartX,
  };
};

const normalizeDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map((part) => part.padStart(2, '0'));
  return `${year}-${month}-${day}`;
};

const categoryOrder = [
  'accredited-marketing',
  'accredited-commerce',
  'accredited-service',
  'accredited-sales',
  'accredited-industry',
  'accredited-platform',
  'associate',
  'sales',
  'mobile',
  'marketer',
  'tableau',
  'designer',
  'consultant',
  'ai',
  'admin',
  'developer',
  'architect',
];

const sortCertifications = (certifications, sortOption, sortOrder) => {
  if (sortOption === 'date') {
    certifications.sort((a, b) => new Date(normalizeDate(a.dateCompleted)) - new Date(normalizeDate(b.dateCompleted)));
  } else if (sortOption === 'category') {
    certifications.sort((a, b) => {
      const categoryA = a.category || '';
      const categoryB = b.category || '';
      return categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB);
    });
  } else if (sortOption === 'product') {
    certifications.sort((a, b) => {
      const productA = a.product || '';
      const productB = b.product || '';
      return productA.localeCompare(productB);
    });
  } else if (sortOption === 'difficulty') {
    certifications.sort((a, b) => a.difficulty - b.difficulty);
  }

  if (sortOrder === 'descendant') {
    certifications.reverse();
  }

  return certifications;
};

const getCountersConfig = (options) => {
  const counter = [
    options.displayBadgeCount,
    options.displaySuperbadgeCount,
    options.displayCertificationCount,
    options.displayTrailCount,
    options.displayPointCount,
    options.displayStampCount,
  ].filter(Boolean).length;

  let badgeCounterScale = 1;

  switch (counter) {
    case 6:
      badgeCounterScale = 0.5;
      break;
    case 5:
      badgeCounterScale = 0.6;
      break;
    case 4:
      badgeCounterScale = 0.8;
      break;
    default:
      badgeCounterScale = 1;
      break;
  }

  const badgeCounterYDelta = 35 * badgeCounterScale;

  return { counter, badgeCounterScale, badgeCounterYDelta };
};

const getCounterPointText = (points) => {
  if (points < 1000) return points.toString();
  if (points < 1_000_000) return `${Math.floor(points / 1000)}k`;
  if (points < 1_000_000_000) return `${Math.floor(points / 1_000_000)}M`;
  return `${Math.floor(points / 1_000_000_000)}B`;
};

module.exports = {
  calculateCertificationsDesign,
  sortCertifications,
  getCountersConfig,
  getCounterPointText,
};
