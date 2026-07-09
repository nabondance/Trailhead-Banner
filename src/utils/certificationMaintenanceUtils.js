/**
 * Utility functions for certification maintenance tracking
 */

/**
 * Get certifications that require maintenance
 * @param {Array} certifications - Array of certification objects from Trailhead API
 * @returns {Array} Array of certifications needing maintenance, sorted by due date (earliest first)
 */
export const getCertificationsNeedingMaintenance = (certifications) => {
  if (!certifications || !Array.isArray(certifications)) {
    return [];
  }

  const certificationsNeedingMaintenance = certifications.filter((cert) => {
    // Check if certification status is "Maintenance Due"
    return cert.status?.title === 'Maintenance Due';
  });

  // Sort by maintenance due date (earliest first)
  certificationsNeedingMaintenance.sort((a, b) => {
    return new Date(a.maintenanceDueDate) - new Date(b.maintenanceDueDate);
  });

  return certificationsNeedingMaintenance;
};

/**
 * Generate info message objects for certifications requiring maintenance
 * @param {Array} certifications - Array of certification objects from Trailhead API
 * @returns {Array} Array of info message objects with header and items
 */
export const getMaintenanceInfoMessages = (certifications) => {
  const certificationsNeedingMaintenance = getCertificationsNeedingMaintenance(certifications);

  if (certificationsNeedingMaintenance.length === 0) {
    return [];
  }

  const items = certificationsNeedingMaintenance.map((cert) => {
    const dueDate = new Date(cert.maintenanceDueDate);
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `${cert.title} by ${formattedDate}`;
  });

  return [
    {
      header:
        '🔔 While generating your banner, we noticed that some of your Certifications will soon require maintenance:',
      items: items,
    },
  ];
};

/**
 * Format a maintenance due date as "Month Day, Year", or a graceful fallback
 * when the date is missing or unparseable.
 * @param {string} value - Raw maintenanceDueDate
 * @returns {string}
 */
const formatMaintenanceDate = (value) => {
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return 'date unknown';
  return dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Shorten a certification title for compact display by dropping the ubiquitous
 * "Salesforce Certified" / "Salesforce" prefix (e.g. "Salesforce Certified
 * Platform App Builder" -> "Platform App Builder").
 * @param {string} title
 * @returns {string}
 */
const shortenCertTitle = (title) =>
  String(title || '')
    .replace(/^Salesforce Certified\s+/i, '')
    .replace(/^Salesforce\s+/i, '')
    .trim();

/**
 * Build a per-person team maintenance summary from aggregated company data.
 * Mirrors the classic banner's maintenance notice, grouped by teammate so each
 * person's due certifications render as their own list (one cert per line).
 *
 * @param {Array} perUserData - aggregated.perUserData, each entry { username, certs }
 * @returns {Object|null} { header, people: [{ username, certs: [{ title, dueDate }] }] }, or null if none due
 */
export const getTeamMaintenanceSummary = (perUserData) => {
  if (!perUserData || !Array.isArray(perUserData)) {
    return null;
  }

  const people = [];
  let totalCerts = 0;

  for (const user of perUserData) {
    const due = getCertificationsNeedingMaintenance(user.certs || []);
    if (due.length === 0) continue;
    totalCerts += due.length;
    people.push({
      username: user.username,
      certs: due.map((cert) => ({
        title: shortenCertTitle(cert.title),
        dueDate: formatMaintenanceDate(cert.maintenanceDueDate),
      })),
    });
  }

  if (people.length === 0) {
    return null;
  }

  return {
    header: `Maintenance due for ${people.length} teammate${people.length > 1 ? 's' : ''} (${totalCerts} certification${totalCerts > 1 ? 's' : ''})`,
    people,
  };
};
