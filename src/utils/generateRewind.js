export const generateRewind = async (options) => {
  const { username, year, rankData, certificationsData, stampsData } = options;

  // Filter data for the specified year
  const yearlyData = filterDataByYear({ certificationsData, stampsData }, year);

  // Generate rewind summary
  const rewindSummary = generateRewindSummary({
    rankData,
    yearlyData,
    year,
    username,
  });

  // TODO: Implement rewind image generation
  // This function will generate a yearly rewind image based on the processed data

  return {
    imageUrl: null,
    warnings: [],
    rewindSummary,
    yearlyData,
  };
};

// Filter data to only include items from the specified year
function filterDataByYear(data, year) {
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  // Filter stamps by earnedAt
  const yearlyStamps =
    data.stampsData.edges?.filter((edge) => {
      const earnedDate = new Date(edge.node.earnedAt);
      return earnedDate >= yearStart && earnedDate < yearEnd;
    }) || [];

  // Filter certifications by dateCompleted
  const yearlyCertifications =
    data.certificationsData.certifications?.filter((cert) => {
      if (!cert.dateCompleted) return false;
      const completedDate = new Date(cert.dateCompleted);
      return completedDate >= yearStart && completedDate < yearEnd;
    }) || [];

  return {
    stamps: yearlyStamps,
    certifications: yearlyCertifications,
  };
}

// Generate a summary of the user's year in review
function generateRewindSummary({ rankData, yearlyData, year, username }) {
  const summary = {
    username,
    year,
    totalStamps: yearlyData.stamps.length,
    totalCertifications: yearlyData.certifications.length,
    currentRank: rankData.rank?.title || 'Unknown',
    currentPoints: rankData.earnedPointsSum || 0,
    currentBadges: rankData.earnedBadgesCount || 0,
    currentTrails: rankData.completedTrailCount || 0,
    agentblazerRank: getAgentblazerRankForYear(rankData.learnerStatusLevels, year),
  };

  // Add monthly breakdown for certifications
  summary.monthlyCertifications = getMonthlyBreakdown(yearlyData.certifications, 'dateCompleted');

  // Add certification products breakdown
  summary.certificationProducts = getCertificationProducts(yearlyData.certifications);

  // Most active month (certifications only)
  summary.mostActiveMonth = getMostActiveMonth(yearlyData.certifications);

  return summary;
}

// Get monthly breakdown of activities
function getMonthlyBreakdown(items, dateField) {
  const monthly = Array(12).fill(0);

  items.forEach((item) => {
    let date;
    if (dateField === 'earnedAt' && item.node) {
      date = new Date(item.node[dateField]);
    } else {
      date = new Date(item[dateField]);
    }

    if (!isNaN(date.getTime())) {
      monthly[date.getMonth()]++;
    }
  });

  return monthly;
}

// Get certification products breakdown
function getCertificationProducts(certifications) {
  const products = {};

  certifications.forEach((cert) => {
    const product = cert.product || 'Other';
    products[product] = (products[product] || 0) + 1;
  });

  return products;
}

// Get Agentblazer rank achieved in the specified year
function getAgentblazerRankForYear(learnerStatusLevels, year) {
  if (!learnerStatusLevels || learnerStatusLevels.length === 0) {
    return null;
  }

  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  // Find the highest level Agentblazer rank achieved in the specified year
  const yearlyAgentblazerRanks = learnerStatusLevels.filter((level) => {
    if (!level.completedAt) return false;
    const completedDate = new Date(level.completedAt);
    return completedDate >= yearStart && completedDate < yearEnd;
  });

  if (yearlyAgentblazerRanks.length === 0) {
    return null;
  }

  // Return the highest level achieved (assuming higher level numbers are better)
  const highestRank = yearlyAgentblazerRanks.reduce((max, current) => (current.level > max.level ? current : max));

  return {
    statusName: highestRank.statusName,
    title: highestRank.title,
    level: highestRank.level,
    imageUrl: highestRank.imageUrl,
    completedAt: highestRank.completedAt,
  };
}

// Find the most active month (certifications only)
function getMostActiveMonth(certifications) {
  const monthly = Array(12).fill(0);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  certifications.forEach((cert) => {
    const date = new Date(cert.dateCompleted);
    if (!isNaN(date.getTime())) {
      monthly[date.getMonth()]++;
    }
  });

  const maxActivity = Math.max(...monthly);
  const mostActiveMonthIndex = monthly.indexOf(maxActivity);

  return {
    month: monthNames[mostActiveMonthIndex],
    count: maxActivity,
  };
}
