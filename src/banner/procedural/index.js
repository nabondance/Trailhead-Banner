import { drawProceduralBannerBackground, getRankAccentColor } from '../../utils/drawUtils.js';
import { certFamilies, W, H } from './core.js';
import { drawMountains } from './mountains.js';
import { drawTopo } from './topographic.js';
import { drawBauhaus } from './bauhaus.js';
import { drawCurrents } from './currents.js';
import { drawCells } from './cells.js';
import { drawSky } from './sky.js';

const DRAWERS = {
  mountains: drawMountains,
  topographic: drawTopo,
  bauhaus: drawBauhaus,
  currents: drawCurrents,
  cells: drawCells,
  sky: drawSky,
};

export function buildProceduralData(username, data = {}) {
  const { rankData, badgesData, superbadgesData, certificationsData } = data;
  const rank = rankData?.rank?.title || 'Scout';
  return {
    username: username || 'default',
    rank,
    rankColor: getRankAccentColor(rank),
    badges: rankData?.earnedBadgesCount ?? badgesData?.trailheadStats?.earnedBadgesCount ?? 0,
    superbadges: badgesData?.trailheadStats?.superbadgeCount ?? superbadgesData?.trailheadStats?.superbadgeCount ?? 0,
    trails: rankData?.completedTrailCount ?? 0,
    certs: certFamilies(certificationsData?.certifications ?? []),
  };
}

export function drawProceduralBackground(ctx, width, height, style, art) {
  const draw = DRAWERS[style];
  if (!draw) {
    drawProceduralBannerBackground(ctx, width, height, art.username, art.rank);
    return;
  }
  // The styles are laid out for the standard banner; scale for any other canvas size
  ctx.save();
  ctx.scale(width / W, height / H);
  draw(ctx, art);
  ctx.restore();
}
