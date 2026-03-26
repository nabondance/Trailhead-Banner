import { createCanvas } from '@napi-rs/canvas';
import crypto from 'crypto';
import { Background, Counters, Certifications, Superbadges, Watermark } from '../components/index.js';
import * as CompanyLogo from '../components/companyLogo.js';
import * as CompanyAgentblazer from '../components/companyAgentblazer.js';

/**
 * Company Banner Renderer
 * Generates the company Trailhead banner (1584 × 396px)
 *
 * Top bar layout (left → right):
 *   [Company Logo] [Counters] [Agentblazer icons (dynamic)] [Superbadges]
 *
 * Bottom area: Certification grid with optional ×N count badges
 */

const CANVAS_WIDTH = 1584;
const CANVAS_HEIGHT = 396;
const TOP_PART_RATIO = 1 / 4; // 99px top bar
const BOTTOM_PART_RATIO = 3 / 4; // 297px cert area

const LOGO_SLOT_WIDTH = 160; // Same as rank logo slot in personal banner
const COUNTER_START_X = 160; // Fixed: logo slot width
const AGENTBLAZER_START_X = 370; // Fixed: same position as personal banner
const AGENTBLAZER_SUPERBADGE_GAP = 10;

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

  const certifYPosition = CANVAS_HEIGHT * TOP_PART_RATIO + 20; // where certs start = logo slot bottom
  const [backgroundPrep, companyLogoPrep, companyAgentblazerPrep, watermarkPrep] = await Promise.all([
    Background.prepareBackground(options),
    CompanyLogo.prepareCompanyLogo(options, certifYPosition, LOGO_SLOT_WIDTH),
    CompanyAgentblazer.prepareCompanyAgentblazer(aggregated.agentblazer, options),
    Watermark.prepareWatermark(),
  ]);

  timings.background_load_ms = backgroundPrep.timings?.load_ms;
  timings.company_logo_load_ms = companyLogoPrep.timings?.load_ms;
  timings.agentblazer_load_ms = companyAgentblazerPrep.timings?.load_ms;

  const countersPrep = await Counters.prepareCounters(countersData, options);
  timings.counters_prepare_ms = countersPrep.timings?.prepare_ms;

  const certLayout = {
    availableWidth: CANVAS_WIDTH,
    availableHeight: CANVAS_HEIGHT * BOTTOM_PART_RATIO * 0.95,
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
    logoHeight: CANVAS_HEIGHT * TOP_PART_RATIO * 0.9,
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
    5,
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
  await Watermark.renderWatermark(ctx, watermarkPrep, CANVAS_WIDTH, CANVAS_HEIGHT);
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
