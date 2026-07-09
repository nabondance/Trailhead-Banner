/**
 * Company Banner CSV Export Utility
 * Generates a skills-matrix CSV from aggregated company data.
 */

import { getCertificationsNeedingMaintenance } from './certificationMaintenanceUtils.js';

const CTA_CERT_TITLE = 'Salesforce Certified Technical Architect';

/**
 * Normalise a maintenance due date to zero-padded YYYY-MM-DD for spreadsheet use.
 *
 * Trailhead returns non-padded dates (e.g. "2026-12-4"), so we parse the parts
 * and pad them rather than slicing — this yields a clean format AND makes plain
 * string comparison sort chronologically. Parsing is done from the string parts
 * (not `new Date`) to stay timezone-independent and deterministic.
 * @param {string} value
 * @returns {string}
 */
function toDateOnly(value) {
  if (!value) return '';
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Fallback for any other format (e.g. full ISO timestamp)
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
}

/**
 * Strip common Salesforce certification prefixes and add a type tag.
 * @param {string} title
 * @returns {string}
 */
function formatCertColumnHeader(title) {
  const isAP = title.includes('Accredited Professional');

  let short = title;
  // Strip common prefixes
  short = short.replace(/^Salesforce Certified\s+/i, '');
  short = short.replace(/^Salesforce\s+/i, '');
  short = short.replace(/^Accredited Professional\s*[-–]\s*/i, '');
  short = short.replace(/^Accredited Professional:\s*/i, '');

  const prefix = isAP ? '[AP]' : '[SF]';
  return `${prefix} ${short.trim()}`;
}

/**
 * Escape a CSV cell value (wrap in quotes if it contains comma, quote, or newline).
 * @param {*} value
 * @returns {string}
 */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV row from an array of values.
 * @param {Array} values
 * @returns {string}
 */
function buildRow(values) {
  return values.map(escapeCell).join(',');
}

/**
 * Generate a CSV string from aggregated company data.
 *
 * Columns:
 *   username, status, rank, badges, superbadges,
 *   certifications_total, certifications_active, certifications_expired, certifications_retired,
 *   mvp, agentblazer_current, agentblazer_alltime_high, cta,
 *   [one column per unique cert with [SF]/[AP] prefix; cells: active|expired|retired|none]
 *
 * The CSV always exports the full truth: banner display options (e.g.
 * includeExpiredCertifications) do not filter what is exported. "Active"
 * means not expired AND not retired, matching the banner's active counter.
 *
 * Trailing rows: TOTAL, ACTIVE_TOTAL, COVERAGE_%, ACTIVE_COVERAGE_%
 * Failed users: included with status column indicating failure reason.
 *
 * @param {Object} aggregated - Output from companyDataUtils.aggregateCompanyData()
 * @param {Array} failedUsers - Array of { username, status }
 * @returns {string} CSV content
 */
export function generateCompanyCsv(aggregated, failedUsers = []) {
  const { perUserData, allCertTitles, agentblazerCurrentLevels, agentblazerAllTimeLevels } = aggregated;

  // Build cert column headers (one per unique cert)
  const certHeaders = allCertTitles.map(formatCertColumnHeader);

  // Build agentblazer lookup maps for CSV columns
  const currentLevelMap = new Map(agentblazerCurrentLevels.map(({ username, level }) => [username, level || 'none']));
  const allTimeLevelMap = new Map(agentblazerAllTimeLevels.map(({ username, level }) => [username, level || 'none']));

  // --- Header row ---
  const fixedHeaders = [
    'username',
    'status',
    'rank',
    'badges',
    'superbadges',
    'certifications_total',
    'certifications_active',
    'certifications_expired',
    'certifications_retired',
    'mvp',
    'agentblazer_current',
    'agentblazer_alltime_high',
    'cta',
  ];
  const allHeaders = [...fixedHeaders, ...certHeaders];
  const rows = [buildRow(allHeaders)];

  // --- Accumulator for summary rows ---
  const totalNumeric = {
    badges: 0,
    superbadges: 0,
    certifications_total: 0,
    certifications_active: 0,
    certifications_expired: 0,
    certifications_retired: 0,
    mvp: 0,
  };
  // Per cert: count of non-"none" and count of "active"
  const certTotalCounts = new Array(allCertTitles.length).fill(0);
  const certActiveCounts = new Array(allCertTitles.length).fill(0);

  // --- Per-user rows ---
  for (const user of perUserData) {
    const agentblazerCurrent = currentLevelMap.get(user.username) || 'none';
    const agentblazerAllTime = allTimeLevelMap.get(user.username) || 'none';

    // Build cert status map for this user (expired wins over retired)
    const userCertMap = new Map();
    for (const cert of user.certs || []) {
      const isExpired = cert.status?.expired === true;
      const isRetired = cert.status?.title === 'Retired';
      userCertMap.set(cert.title, isExpired ? 'expired' : isRetired ? 'retired' : 'active');
    }

    const hasCta = userCertMap.has(CTA_CERT_TITLE) && userCertMap.get(CTA_CERT_TITLE) === 'active';

    const certValues = allCertTitles.map((title, idx) => {
      const status = userCertMap.get(title) || 'none';
      if (status !== 'none') certTotalCounts[idx]++;
      if (status === 'active') certActiveCounts[idx]++;
      return status;
    });

    totalNumeric.badges += user.badges;
    totalNumeric.superbadges += user.superbadges;
    totalNumeric.certifications_total += user.certifications_total;
    totalNumeric.certifications_active += user.certifications_active;
    totalNumeric.certifications_expired += user.certifications_expired;
    totalNumeric.certifications_retired += user.certifications_retired || 0;
    if (user.mvp) totalNumeric.mvp++;

    const fixedValues = [
      user.username,
      'ok',
      user.rank,
      user.badges,
      user.superbadges,
      user.certifications_total,
      user.certifications_active,
      user.certifications_expired,
      user.certifications_retired || 0,
      user.mvp ? 'true' : 'false',
      agentblazerCurrent,
      agentblazerAllTime,
      hasCta ? 'true' : 'false',
    ];

    rows.push(buildRow([...fixedValues, ...certValues]));
  }

  // --- Failed user rows ---
  for (const failed of failedUsers) {
    const fixedValues = [failed.username, failed.status || 'not_found', ...new Array(fixedHeaders.length - 2).fill('')];
    const certValues = new Array(allCertTitles.length).fill('');
    rows.push(buildRow([...fixedValues, ...certValues]));
  }

  const totalUsers = perUserData.length;

  // --- TOTAL row ---
  const totalFixed = [
    'TOTAL',
    '',
    '',
    totalNumeric.badges,
    totalNumeric.superbadges,
    totalNumeric.certifications_total,
    totalNumeric.certifications_active,
    totalNumeric.certifications_expired,
    totalNumeric.certifications_retired,
    totalNumeric.mvp,
    '',
    '',
    '',
  ];
  rows.push(buildRow([...totalFixed, ...certTotalCounts]));

  // --- ACTIVE_TOTAL row (certifications_active column position) ---
  const activeTotalFixed = new Array(fixedHeaders.length).fill('');
  activeTotalFixed[0] = 'ACTIVE_TOTAL';
  activeTotalFixed[fixedHeaders.indexOf('certifications_active')] = totalNumeric.certifications_active;
  rows.push(buildRow([...activeTotalFixed, ...certActiveCounts]));

  // --- COVERAGE_% row (% of team with cert, any status) ---
  const coveragePct = certTotalCounts.map((n) => (totalUsers > 0 ? `${Math.round((n / totalUsers) * 100)}%` : '0%'));
  const coverageFixed = ['COVERAGE_%', ...new Array(fixedHeaders.length - 1).fill('')];
  rows.push(buildRow([...coverageFixed, ...coveragePct]));

  // --- ACTIVE_COVERAGE_% row ---
  const activeCoveragePct = certActiveCounts.map((n) =>
    totalUsers > 0 ? `${Math.round((n / totalUsers) * 100)}%` : '0%'
  );
  const activeCoverageFixed = ['ACTIVE_COVERAGE_%', ...new Array(fixedHeaders.length - 1).fill('')];
  rows.push(buildRow([...activeCoverageFixed, ...activeCoveragePct]));

  return rows.join('\n');
}

/**
 * Generate a per-product certification breakdown CSV.
 *
 * Columns: product, total_certifications, active_certifications, certified_people
 *   - total_certifications: all certs of that product held across the team (incl. expired/retired)
 *   - active_certifications: certs that are neither expired nor retired
 *   - certified_people: distinct team members holding at least one cert of that product
 *
 * Rows are sorted by total_certifications descending, then alphabetically.
 * Certs without a product are grouped under "Other".
 *
 * @param {Object} aggregated - Output from companyDataUtils.aggregateCompanyData()
 * @returns {string} CSV content
 */
export function generateProductCsv(aggregated) {
  const { perUserData } = aggregated;

  // product → { total, active, people: Set<username> }
  const productStats = new Map();

  for (const user of perUserData) {
    for (const cert of user.certs || []) {
      const product = cert.product || 'Other';
      if (!productStats.has(product)) {
        productStats.set(product, { total: 0, active: 0, people: new Set() });
      }
      const stats = productStats.get(product);
      stats.total++;
      if (cert.status?.expired !== true && cert.status?.title !== 'Retired') stats.active++;
      stats.people.add(user.username);
    }
  }

  const sorted = [...productStats.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));

  const rows = [buildRow(['product', 'total_certifications', 'active_certifications', 'certified_people'])];
  for (const [product, stats] of sorted) {
    rows.push(buildRow([product, stats.total, stats.active, stats.people.size]));
  }

  return rows.join('\n');
}

/**
 * Generate a per-person certification-maintenance CSV.
 *
 * One row per (teammate, certification) where the certification is flagged
 * "Maintenance Due" by Trailhead — the same definition the standard banner uses.
 * Rows are sorted by username, then by soonest due date.
 *
 * Columns: username, certification, product, maintenance_due_date
 *
 * @param {Object} aggregated - Output from companyDataUtils.aggregateCompanyData()
 * @returns {string|null} CSV content, or null when no certifications need maintenance
 */
export function generateMaintenanceCsv(aggregated) {
  const { perUserData } = aggregated;

  const records = [];
  for (const user of perUserData) {
    for (const cert of getCertificationsNeedingMaintenance(user.certs || [])) {
      records.push({
        username: user.username,
        certification: cert.title,
        product: cert.product || '',
        maintenance_due_date: toDateOnly(cert.maintenanceDueDate),
      });
    }
  }

  if (records.length === 0) return null;

  records.sort(
    (a, b) =>
      a.username.localeCompare(b.username) ||
      a.maintenance_due_date.localeCompare(b.maintenance_due_date) ||
      a.certification.localeCompare(b.certification)
  );

  const rows = [buildRow(['username', 'certification', 'product', 'maintenance_due_date'])];
  for (const r of records) {
    rows.push(buildRow([r.username, r.certification, r.product, r.maintenance_due_date]));
  }

  return rows.join('\n');
}
