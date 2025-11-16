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
