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

  const today = new Date();
  const certificationsNeedingMaintenance = certifications.filter((cert) => {
    // Check if cert has a maintenance due date
    if (!cert.maintenanceDueDate) return false;

    // Check if cert is active (not expired)
    if (cert.status?.expired === true) return false;

    // Check if maintenance date is in the future
    const maintenanceDate = new Date(cert.maintenanceDueDate);
    return maintenanceDate > today;
  });

  // Sort by maintenance due date (earliest first)
  certificationsNeedingMaintenance.sort((a, b) => {
    return new Date(a.maintenanceDueDate) - new Date(b.maintenanceDueDate);
  });

  return certificationsNeedingMaintenance;
};

/**
 * Generate warning messages for certifications requiring maintenance
 * @param {Array} certifications - Array of certification objects from Trailhead API
 * @returns {Array} Array of formatted warning messages
 */
export const getMaintenanceWarnings = (certifications) => {
  const certificationsNeedingMaintenance = getCertificationsNeedingMaintenance(certifications);

  return certificationsNeedingMaintenance.map((cert) => {
    const dueDate = new Date(cert.maintenanceDueDate);
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `${cert.title} by ${formattedDate}`;
  });
};
