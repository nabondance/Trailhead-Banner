/**
 * Company Banner CSV Export Utility
 * Generates a skills-matrix CSV from aggregated company data.
 */

const CTA_CERT_TITLE = 'Salesforce Certified Technical Architect';

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
 *   certifications_total, certifications_active, certifications_expired,
 *   mvp, agentblazer_current, agentblazer_alltime_high, cta,
 *   [one column per unique cert with [SF]/[AP] prefix]
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
    mvp: 0,
  };
  // Per cert: count of non-"none" and count of "active"
  const certTotalCounts = new Array(allCertTitles.length).fill(0);
  const certActiveCounts = new Array(allCertTitles.length).fill(0);

  // --- Per-user rows ---
  for (const user of perUserData) {
    const agentblazerCurrent = currentLevelMap.get(user.username) || 'none';
    const agentblazerAllTime = allTimeLevelMap.get(user.username) || 'none';

    // Build cert status map for this user
    const userCertMap = new Map();
    for (const cert of user.certs || []) {
      const isExpired = cert.status?.expired === true;
      userCertMap.set(cert.title, isExpired ? 'expired' : 'active');
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
      user.mvp ? 'true' : 'false',
      agentblazerCurrent,
      agentblazerAllTime,
      hasCta ? 'true' : 'false',
    ];

    rows.push(buildRow([...fixedValues, ...certValues]));
  }

  // --- Failed user rows ---
  for (const failed of failedUsers) {
    const fixedValues = [failed.username, failed.status || 'not_found', '', '', '', '', '', '', '', '', '', ''];
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
    totalNumeric.mvp,
    '',
    '',
    '',
  ];
  rows.push(buildRow([...totalFixed, ...certTotalCounts]));

  // --- ACTIVE_TOTAL row ---
  const activeTotalFixed = ['ACTIVE_TOTAL', '', '', '', '', '', totalNumeric.certifications_active, '', '', '', '', ''];
  rows.push(buildRow([...activeTotalFixed, ...certActiveCounts]));

  // --- COVERAGE_% row (% of team with cert, any status) ---
  const coveragePct = certTotalCounts.map((n) => (totalUsers > 0 ? `${Math.round((n / totalUsers) * 100)}%` : '0%'));
  const coverageFixed = ['COVERAGE_%', '', '', '', '', '', '', '', '', '', '', ''];
  rows.push(buildRow([...coverageFixed, ...coveragePct]));

  // --- ACTIVE_COVERAGE_% row ---
  const activeCoveragePct = certActiveCounts.map((n) =>
    totalUsers > 0 ? `${Math.round((n / totalUsers) * 100)}%` : '0%'
  );
  const activeCoverageFixed = ['ACTIVE_COVERAGE_%', '', '', '', '', '', '', '', '', '', '', ''];
  rows.push(buildRow([...activeCoverageFixed, ...activeCoveragePct]));

  return rows.join('\n');
}
