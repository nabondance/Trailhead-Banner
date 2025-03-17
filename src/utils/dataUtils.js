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
