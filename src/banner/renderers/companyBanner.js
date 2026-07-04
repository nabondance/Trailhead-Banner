import { createCanvas } from '@napi-rs/canvas';
import crypto from 'crypto';
import { Background, Counters, Certifications, Superbadges, Watermark } from '../components/index.js';
import * as CompanyLogo from '../components/companyLogo.js';
import * as CompanyAgentblazer from '../components/companyAgentblazer.js';

/**
 * Company Banner Renderer
 * Generates the company Trailhead banner (1128 × 191px — LinkedIn company page header size)
 *
 * Top bar layout (left → right):
 *   [Company Logo] [Counters] [Agentblazer icons (dynamic)] [Superbadges]
 *
 * Bottom area: Certification grid with optional ×N count badges
 */

const CANVAS_WIDTH = 1128; // LinkedIn company page header width
const CANVAS_HEIGHT = 191; // LinkedIn company page header height
const TOP_PART_RATIO = 1 / 4; // top bar used for agentblazer/superbadge sizing
const BOTTOM_PART_RATIO = 3 / 4; // cert area

// The banner is very wide and short (≈5.9:1), so the top-bar elements are
// compressed compared to the personal banner. Positions/sizes below are tuned
// for the 1128×191 LinkedIn company header.
const SUPERBADGE_LOGO_HEIGHT = CANVAS_HEIGHT * TOP_PART_RATIO * 0.9; // ~43px

const LOGO_SLOT_WIDTH = 92; // Logo slot (logo is height-constrained by the short canvas)
const COUNTER_START_X = 100; // After the logo slot
const AGENTBLAZER_START_X = 265; // After the (wider) counter column
const AGENTBLAZER_SUPERBADGE_GAP = 8;
const AGENTBLAZER_LOGO_HEIGHT = SUPERBADGE_LOGO_HEIGHT + 4; // Match superbadge size (slightly larger)
const CERT_TOP_Y = 56; // Where the certification grid begins (kept high so certs get more space)
const COUNTER_TOP_Y = 6; // Where the counter stack begins
const MAX_COUNTERS = 2; // Show at most 2 counters on this compact banner
const MAX_COUNTER_SCALE = 0.7; // Upper bound for the compact counter badges
const WATERMARK_SCALE = 0.65; // Smaller watermark for this compact banner

/**
 * Build superbadge data in the format expected by the Superbadges component.
 * Respects the superbadgeDeduplicate option.
 *
 * @param {Object} companySuperbadges - { all, unique } from companyDataUtils
 * @param {Object} options
 * @returns {Object} superbadgesData shaped for Superbadges component
 */
function buildSuperbadgeData(companySuperbadges, options) {
  const deduplicate = options.superbadgeDeduplicate ?? false;
  const source = deduplicate ? companySuperbadges?.unique || [] : companySuperbadges?.all || [];

  return {
    earnedAwards: {
      edges: source.map((award) => ({ node: { award } })),
    },
  };
}

/**
 * Generate company banner.
 *
 * @param {Object} aggregated - Output from companyDataUtils.aggregateCompanyData()
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} { bannerUrl, warnings, hash, timings }
 */
async function generateCompanyBanner(aggregated, options = {}) {
  const startTime = Date.now();
  const warnings = [];
  const timings = {};

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // ============================================================
  // PHASE 1: PREPARE ALL COMPONENTS IN PARALLEL
  // ============================================================
  const prepareStartTime = Date.now();

  // Build data object for counters component (merges standard paths + companyCounters)
  const countersData = {
    companyCounters: aggregated.counters,
    // Standard paths (used for badge/superbadge/certification when companyCounters provides overrides)
    badgesData: null,
    superbadgesData: null,
    certificationsData: aggregated.certificationsData,
    rankData: null,
    stampsData: null,
    communityData: null,
  };

  const superbadgesData = buildSuperbadgeData(aggregated.superbadgesData, options);

  const certifYPosition = CERT_TOP_Y; // where the cert grid starts (= logo slot bottom)
  const [backgroundPrep, companyLogoPrep, companyAgentblazerPrep, watermarkPrep] = await Promise.all([
    Background.prepareBackground(options),
    CompanyLogo.prepareCompanyLogo(options, certifYPosition, LOGO_SLOT_WIDTH),
    CompanyAgentblazer.prepareCompanyAgentblazer(aggregated.agentblazer, options, AGENTBLAZER_LOGO_HEIGHT),
    Watermark.prepareWatermark(),
  ]);

  timings.background_load_ms = backgroundPrep.timings?.load_ms;
  timings.company_logo_load_ms = companyLogoPrep.timings?.load_ms;
  timings.agentblazer_load_ms = companyAgentblazerPrep.timings?.load_ms;

  // Counters stack vertically; cap at MAX_COUNTERS and size the stack so it spans the
  // same vertical extent as the superbadge row (opt-in override, standard banner unaffected).
  const limitedCounterOrder = (options.counterOrder || []).slice(0, MAX_COUNTERS);
  const counterCount = limitedCounterOrder.length;
  const counterScale =
    counterCount > 0 ? Math.min(MAX_COUNTER_SCALE, SUPERBADGE_LOGO_HEIGHT / (counterCount * 35)) : MAX_COUNTER_SCALE;
  const countersOptions = { ...options, counterOrder: limitedCounterOrder, badgeCounterScaleOverride: counterScale };

  const countersPrep = await Counters.prepareCounters(countersData, countersOptions);
  timings.counters_prepare_ms = countersPrep.timings?.prepare_ms;

  const certLayout = {
    availableWidth: CANVAS_WIDTH,
    availableHeight: CANVAS_HEIGHT - certifYPosition - 6,
    spacing: 5,
  };
  const certOptions = {
    ...options,
    showCertCount: true,
    certificationSort: options.certificationSort ?? 'count',
  };
  const certificationsPrep = await Certifications.prepareCertifications(
    aggregated.certificationsData,
    certOptions,
    certLayout
  );
  timings.certifications_download_ms = certificationsPrep.timings?.download_ms;
  timings.certifications_prep_ms = certificationsPrep.timings?.prep_ms;
  timings.certifications_count = certificationsPrep.counts.displayed;

  // Superbadge layout: width is from agentblazer end to canvas right edge
  const agentblazerWidth = CompanyAgentblazer.getCompanyAgentblazerWidth(companyAgentblazerPrep);
  const superbadgeStartX = AGENTBLAZER_START_X + agentblazerWidth + AGENTBLAZER_SUPERBADGE_GAP;
  const superbadgeAvailableWidth = CANVAS_WIDTH - superbadgeStartX;

  const superbadgeLayout = {
    availableWidth: superbadgeAvailableWidth,
    logoHeight: SUPERBADGE_LOGO_HEIGHT,
  };
  const superbadgesPrep = await Superbadges.prepareSuperbadges(superbadgesData, options, superbadgeLayout);
  timings.superbadges_download_ms = superbadgesPrep.timings?.download_ms;

  timings.preparation_total_ms = Date.now() - prepareStartTime;

  // ============================================================
  // PHASE 2: RENDER ALL COMPONENTS SEQUENTIALLY
  // ============================================================

  // 1. Background
  await Background.renderBackground(ctx, backgroundPrep, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Company Logo (top-left, same slot as rank logo)
  await CompanyLogo.renderCompanyLogo(ctx, companyLogoPrep, 0, 0);

  // 3. Counters (fixed position, after logo slot)
  const countersRenderTiming = await Counters.renderCounters(
    ctx,
    countersPrep,
    COUNTER_START_X,
    COUNTER_TOP_Y,
    options.badgeLabelColor
  );
  timings.counters_draw_ms = countersRenderTiming?.render_ms;

  // 4. Agentblazer icons (after counters zone)
  await CompanyAgentblazer.renderCompanyAgentblazer(ctx, companyAgentblazerPrep, AGENTBLAZER_START_X, 5);

  // 5. Certifications (bottom area)
  const certificationsRenderTiming = await Certifications.renderCertifications(
    ctx,
    certificationsPrep,
    0,
    certifYPosition
  );
  timings.certifications_render_ms = certificationsRenderTiming?.render_ms;

  // 6. Superbadges (top-right, after agentblazer zone)
  const superbadgesRenderTiming = await Superbadges.renderSuperbadges(ctx, superbadgesPrep, superbadgeStartX, 10);
  timings.superbadges_render_ms = superbadgesRenderTiming?.render_ms;

  // 7. Watermark (bottom-right)
  await Watermark.renderWatermark(ctx, watermarkPrep, CANVAS_WIDTH, CANVAS_HEIGHT, WATERMARK_SCALE);
  timings.watermark_load_ms = watermarkPrep.timings?.load_ms;

  // ============================================================
  // PHASE 3: COLLECT WARNINGS AND ENCODE
  // ============================================================

  warnings.push(...Background.getBackgroundWarnings(backgroundPrep));
  warnings.push(...CompanyLogo.getCompanyLogoWarnings(companyLogoPrep));
  warnings.push(...Counters.getCountersWarnings(countersPrep));
  warnings.push(...Certifications.getCertificationsWarnings(certificationsPrep));
  warnings.push(...Superbadges.getSuperbadgesWarnings(superbadgesPrep));
  warnings.push(...CompanyAgentblazer.getCompanyAgentblazerWarnings(companyAgentblazerPrep));
  warnings.push(...Watermark.getWatermarkWarnings(watermarkPrep));

  const encodeStart = Date.now();
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  timings.canvas_encoding_ms = Date.now() - encodeStart;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  timings.total_ms = Date.now() - startTime;

  console.log('Company banner generation complete.');
  console.log('Warnings:', warnings);
  console.log('Timings:', JSON.stringify(timings, null, 2));

  return { bannerUrl, warnings, hash, timings };
}

export { generateCompanyBanner, CANVAS_WIDTH, CANVAS_HEIGHT };
