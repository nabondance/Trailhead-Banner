const calculateCertificationsDesign = (logos, canvasWidth, canvasHeight, logoSpacing) => {
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
      break; // The current scale fits, so stop adjusting
    } else {
      // Step 4: Reduce the scale proportionally to fit more rows
      scale *= 0.9; // Gradually reduce scale (adjust decrement factor if necessary)
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
    logoLineStartX.push((canvasWidth - lineWidth) / 2);
  }

  // Return the results
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
  } else if (sortOption === 'difficulty') {
    certifications.sort((a, b) => a.difficulty - b.difficulty);
  }

  if (sortOrder === 'descendant') {
    certifications.reverse();
  }

  return certifications;
};

module.exports = {
  calculateCertificationsDesign,
  sortCertifications,
};
