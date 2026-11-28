import { drawProceduralBannerBackground, getRankAccentColor } from '../../utils/drawUtils.js';
import { BANNER_SIZES } from '../bannerSizes.js';
import { certFamilies, setFrame } from './core.js';
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

// Certification rows are left out on purpose so the art fills the banner
const FADE_ZONES = {
  standard: [
    { x0: 0, y0: 0, x1: 470, y1: 112, w: 0.75 },
    { x0: 470, y0: 0, x1: 1584, y1: 102, w: 0.75 },
    { x0: 1425, y0: 368, x1: 1584, y1: 396, w: 0.6 },
  ],
  company: [
    { x0: 0, y0: 0, x1: 1128, y1: 54, w: 0.75 },
    { x0: 1030, y0: 172, x1: 1128, y1: 191, w: 0.6 },
  ],
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

// A company has no rank: the team's usernames seed the art and the chosen color replaces the rank color
export function buildCompanyProceduralData(aggregated = {}, accentColor) {
  const usernames = (aggregated.perUserData ?? []).map((u) => u.username).sort();
  return {
    username: usernames.join(',') || 'company',
    rank: null,
    rankColor: /^#[0-9a-f]{6}$/i.test(accentColor ?? '') ? accentColor : getRankAccentColor(null),
    badges: aggregated.counters?.badge ?? 0,
    superbadges: aggregated.counters?.superbadge ?? 0,
    // Mountains adds a row per 20 trails; for a team, one row per teammate reads better
    trails: usernames.length * 20,
    certs: certFamilies(aggregated.certificationsData?.certifications ?? []),
  };
}

export function drawProceduralBackground(ctx, width, height, style, art) {
  const draw = DRAWERS[style];
  if (!draw) {
    drawProceduralBannerBackground(ctx, width, height, art.username, art.rankColor);
    return;
  }
  const bannerType = Object.keys(BANNER_SIZES).find(
    (type) => BANNER_SIZES[type].width === width && BANNER_SIZES[type].height === height
  );
  setFrame(width, height, FADE_ZONES[bannerType] ?? []);
  draw(ctx, art);
}
