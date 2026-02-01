import { createCanvas } from '@napi-rs/canvas';
import crypto from 'crypto';
import {
  Background,
  RankLogo,
  Counters,
  Certifications,
  Superbadges,
  Agentblazer,
  MvpRibbon,
  Watermark,
} from '../components/index.js';

/**
 * Standard Banner Renderer
 * Generates the standard Trailhead banner (1584 × 396px)
 */

const CANVAS_WIDTH = 1584;
const CANVAS_HEIGHT = 396;
const TOP_PART_RATIO = 1 / 4;
const BOTTOM_PART_RATIO = 3 / 4;
const RIGHT_PART_RATIO = 7 / 10;

/**
 * Generate standard banner
 * @param {Object} data - All data needed for banner generation
 * @param {Object} data.rankData - Rank data from API
 * @param {Object} data.badgesData - Badges data from API
 * @param {Object} data.superbadgesData - Superbadges data from API
 * @param {Object} data.certificationsData - Certifications data from API
 * @param {Object} data.mvpData - MVP data from API
 * @param {Object} data.agentblazerData - Agentblazer data from API
 * @param {Object} data.stampsData - Stamps data from API
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Banner result { bannerUrl, warnings, hash, timings }
 */
async function generateStandardBanner(data, options) {
  const startTime = Date.now();
  const warnings = [];
  const timings = {};

  // Create canvas and context
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // ============================================================
  // PHASE 1: PREPARE ALL COMPONENTS IN PARALLEL
  // ============================================================
  let prepareStartTime = Date.now();

  const [backgroundPrep, rankLogoPrep, agentblazerPrep, mvpRibbonPrep, watermarkPrep] = await Promise.all([
    Background.prepareBackground(options),
    RankLogo.prepareRankLogo(data.rankData, options, CANVAS_HEIGHT),
    Agentblazer.prepareAgentblazer(data.agentblazerData, options),
    MvpRibbon.prepareMvpRibbon(data.mvpData),
    Watermark.prepareWatermark(),
  ]);

  timings.background_load_ms = Background.getBackgroundTimings(backgroundPrep).load_ms;
  timings.rank_logo_load_ms = RankLogo.getRankLogoTimings(rankLogoPrep).load_ms;
  timings.agentblazer_load_ms = Agentblazer.getAgentblazerTimings(agentblazerPrep).load_ms;

  // Prepare counters (needs rank logo dimensions)
  const countersPrep = await Counters.prepareCounters(data, options);
  timings.counters_prepare_ms = Counters.getCountersTimings(countersPrep).prepare_ms;

  // Prepare certifications (needs layout constraints)
  const certLayout = {
    availableWidth: CANVAS_WIDTH,
    availableHeight: CANVAS_HEIGHT * BOTTOM_PART_RATIO * 0.95,
    spacing: 5,
  };
  const certificationsPrep = await Certifications.prepareCertifications(data.certificationsData, options, certLayout);
  timings.certifications_download_ms = certificationsPrep.timings.download_ms;
  timings.certifications_prep_ms = certificationsPrep.timings.prep_ms;
  timings.certifications_count = certificationsPrep.counts.displayed;
  timings.certifications_detailed = certificationsPrep.timings.detailed;

  // Prepare superbadges (needs layout constraints)
  const superbadgeLayout = {
    availableWidth: CANVAS_WIDTH * RIGHT_PART_RATIO,
    logoHeight: CANVAS_HEIGHT * TOP_PART_RATIO * 0.9,
  };
  const superbadgesPrep = await Superbadges.prepareSuperbadges(data.superbadgesData, options, superbadgeLayout);
  timings.superbadges_download_ms = Superbadges.getSuperbadgesTimings(superbadgesPrep).download_ms;
  timings.superbadges_count = Superbadges.getSuperbadgesCounts(superbadgesPrep).displayed;

  timings.preparation_total_ms = Date.now() - prepareStartTime;

  // ============================================================
  // PHASE 2: RENDER ALL COMPONENTS SEQUENTIALLY
  // ============================================================

  // 1. Background (always first)
  await Background.renderBackground(ctx, backgroundPrep, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Rank Logo (top-left)
  await RankLogo.renderRankLogo(ctx, rankLogoPrep, 0, 0);
  const rankDimensions = RankLogo.getRankLogoDimensions(rankLogoPrep);

  // 3. Counters (to the right of rank logo)
  // Use scaled width and only offset if rank logo is actually rendered
  const counterStartX = rankLogoPrep.shouldRender ? rankDimensions.width + 40 : 40;
  const counterStartY = 5;
  const countersRenderTiming = await Counters.renderCounters(ctx, countersPrep, counterStartX, counterStartY, options.badgeLabelColor);
  timings.counters_draw_ms = countersRenderTiming.render_ms;

  // 4. Agentblazer (top area, fixed position)
  await Agentblazer.renderAgentblazer(ctx, agentblazerPrep, 370, 5);

  // 5. Certifications (bottom area)
  const certifYPosition = CANVAS_HEIGHT * TOP_PART_RATIO + 20;
  const certificationsRenderTiming = await Certifications.renderCertifications(ctx, certificationsPrep, 0, certifYPosition);
  timings.certifications_render_ms = certificationsRenderTiming.render_ms;

  // 6. Superbadges (top-right area)
  const superbadgeAbsoluteX = CANVAS_WIDTH - superbadgeLayout.availableWidth;
  const superbadgeY = 10;
  const superbadgesRenderTiming = await Superbadges.renderSuperbadges(ctx, superbadgesPrep, superbadgeAbsoluteX, superbadgeY);
  timings.superbadges_render_ms = superbadgesRenderTiming.render_ms;

  // 7. MVP Ribbon (top-right corner, rotated)
  await MvpRibbon.renderMvpRibbon(ctx, mvpRibbonPrep, CANVAS_WIDTH);

  // 8. Watermark (bottom-right corner)
  await Watermark.renderWatermark(ctx, watermarkPrep, CANVAS_WIDTH, CANVAS_HEIGHT);
  timings.mvp_watermark_ms = MvpRibbon.getMvpRibbonTimings(mvpRibbonPrep).load_ms + Watermark.getWatermarkTimings(watermarkPrep).load_ms;

  // ============================================================
  // PHASE 3: COLLECT WARNINGS AND ENCODE
  // ============================================================

  // Collect warnings from all components
  warnings.push(...Background.getBackgroundWarnings(backgroundPrep));
  warnings.push(...RankLogo.getRankLogoWarnings(rankLogoPrep));
  warnings.push(...Counters.getCountersWarnings(countersPrep));
  warnings.push(...Certifications.getCertificationsWarnings(certificationsPrep));
  warnings.push(...Superbadges.getSuperbadgesWarnings(superbadgesPrep));
  warnings.push(...Agentblazer.getAgentblazerWarnings(agentblazerPrep));
  warnings.push(...MvpRibbon.getMvpRibbonWarnings(mvpRibbonPrep));
  warnings.push(...Watermark.getWatermarkWarnings(watermarkPrep));

  // Convert canvas to banner
  const encodeStart = Date.now();
  const buffer = canvas.toBuffer('image/png');
  const bannerUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  timings.canvas_encoding_ms = Date.now() - encodeStart;

  // Hash the image
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  timings.total_ms = Date.now() - startTime;

  console.log('Standard banner generation complete.');
  console.log('Warnings:', warnings);
  console.log('Image hash:', hash);
  console.log('Timings:', JSON.stringify(timings, null, 2));

  return { bannerUrl, warnings, hash, timings };
}

export {
  generateStandardBanner,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
};
