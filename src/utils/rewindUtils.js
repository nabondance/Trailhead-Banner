// Utility functions for processing rewind data

// Filter data to only include items from the specified year
export function filterDataByYear(data, year) {
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  // Filter stamps by earnedAt
  const yearlyStamps =
    data.stampsData.edges?.filter((edge) => {
      const earnedDate = new Date(edge.node.eventDate);
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
export function generateRewindSummary({ rankData, certificationsData, yearlyData, year, username }) {
  const summary = {
    username,
    year,
    yearlyStamps: yearlyData.stamps.length,
    yearlyCertifications: yearlyData.certifications.length,
    totalStamps: rankData.earnedStampsCount || 0,
    totalCertifications: certificationsData.certifications.length || 0,
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

  // Add timeline data for monthly activities
  summary.timelineData = getTimelineData(yearlyData);

  return summary;
}

// Get monthly breakdown of activities
export function getMonthlyBreakdown(items, dateField) {
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
export function getCertificationProducts(certifications) {
  const products = {};

  certifications.forEach((cert) => {
    const product = cert.product || 'Other';
    products[product] = (products[product] || 0) + 1;
  });

  return products;
}

// Get Agentblazer rank achieved in the specified year
export function getAgentblazerRankForYear(learnerStatusLevels, year) {
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
export function getMostActiveMonth(certifications) {
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

// Get timeline data grouped by month with activities sorted properly
export function getTimelineData(yearlyData) {
  const activitiesByMonth = {};

  // Add certifications to monthly data
  yearlyData.certifications.forEach((cert) => {
    const date = new Date(cert.dateCompleted);
    const monthIndex = date.getMonth();

    if (!activitiesByMonth[monthIndex]) {
      activitiesByMonth[monthIndex] = { certifications: [], stamps: [] };
    }
    activitiesByMonth[monthIndex].certifications.push(cert);
  });

  // Add stamps to monthly data
  yearlyData.stamps.forEach((stamp) => {
    const date = new Date(stamp.node.eventDate);
    const monthIndex = date.getMonth();

    if (!activitiesByMonth[monthIndex]) {
      activitiesByMonth[monthIndex] = { certifications: [], stamps: [] };
    }
    activitiesByMonth[monthIndex].stamps.push(stamp.node);
  });

  // Process each month to create sorted activity arrays
  Object.keys(activitiesByMonth).forEach((monthIndex) => {
    const monthData = activitiesByMonth[monthIndex];
    const monthActivities = [];

    // Add certifications with type and date
    monthData.certifications.forEach((cert) => {
      monthActivities.push({
        type: 'certification',
        data: cert,
        date: new Date(cert.dateCompleted),
        logoUrl: cert.logoUrl,
        folder: 'certifications',
      });
    });

    // Add stamps with type and date
    monthData.stamps.forEach((stamp) => {
      monthActivities.push({
        type: 'stamp',
        data: stamp,
        date: new Date(stamp.eventDate),
        logoUrl: stamp.iconUrl,
        folder: 'stamps',
      });
    });

    // Sort by date (earliest first), but prioritize certifications
    monthActivities.sort((a, b) => {
      if (a.type === 'certification' && b.type === 'stamp') return -1;
      if (a.type === 'stamp' && b.type === 'certification') return 1;
      return a.date - b.date;
    });

    // Store the sorted activities for this month
    activitiesByMonth[monthIndex].sortedActivities = monthActivities;
  });

  return activitiesByMonth;
}
