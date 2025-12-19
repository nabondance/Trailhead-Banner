const certificationsDataJson = require('../data/certifications.json');
import SupabaseUtils from './supabaseUtils';

export const getLocalCertificationData = (certification) => {
  const certificationData = certificationsDataJson[certification.title];
  if (!certificationData) {
    console.error(`No data found for certification: ${certification.title}:`, certification);
    SupabaseUtils.updateErrors({
      type: 'certification',
      error: `No data found for certification: ${certification.title}`,
      error_data: certification,
    });
  }
  return certificationData;
};

export const logOptions = (options) => {
  console.log('Generating banner with the following data:');
  console.log('Username:', options.username);
  console.log('Rank Data:', options.rankData);
  console.log('Certifications Data:', options.certificationsData);
  console.log('Badges Data:', options.badgesData);
  console.log('Superbadges Data:', options.superbadgesData);
  console.log('Stamps Data:', options.stampsData);
  console.log('Background Options:', {
    kind: options.backgroundKind,
    libraryUrl: options.backgroundLibraryUrl,
    backgroundImageUrl: options.backgroundImageUrl,
    customBackgroundImageUrl: options.customBackgroundImageUrl,
    backgroundColor: options.backgroundColor,
  });
  console.log('Display Options:', {
    rankLogo: options.displayRankLogo,
  });
  console.log('Counter Options:', {
    textColor: options.textColor,
    badgeCount: options.displayBadgeCount,
    superbadgeCount: options.displaySuperbadgeCount,
    certificationCount: options.displayCertificationCount,
    trailCount: options.displayTrailCount,
    pointCount: options.displayPointCount,
    stampCount: options.displayStampCount,
  });
  console.log('Badge Options:', {
    labelColor: options.badgeLabelColor,
    messageColor: options.badgeMessageColor,
  });
  console.log('Superbadge Options:', {
    superbadges: options.displaySuperbadges,
    displayLastXSuperbadges: options.lastXSuperbadges,
    lastXSuperbadges: options.lastXSuperbadges,
    superbadgeAlignment: options.superbadgeAlignment,
  });
  console.log('Certification Options:', {
    includeExpired: options.includeExpiredCertifications,
    includeRetired: options.includeRetiredCertifications,
    displayLastXCertifications: options.lastXCertifications,
    lastXCertifications: options.lastXCertifications,
    certificationAlignment: options.certificationAlignment,
  });
  console.log('MVP Data:', options.mvpData);
};
