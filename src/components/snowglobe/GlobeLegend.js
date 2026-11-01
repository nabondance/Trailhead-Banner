'use client';

import { getRankMetals } from './rankMetals';
import { getSnowfall } from './snowStyles';

/* "Your globe, decoded": every personal detail of the globe and the data it
   comes from, in plain words, so the user can read their own globe. */

const METAL_NAMES = { roseGold: 'rose gold' };
const SNOW_NAMES = {
  Champion: 'Icy blue snow',
  Innovator: 'Iridescent snow',
  Legend: 'Gold glitter snow',
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function activeMonths(activity) {
  return SHORT_MONTHS.filter((_, i) => (activity?.certifications?.[i] || 0) + (activity?.stamps?.[i] || 0) > 0);
}

function bigFlakeText(superbadges) {
  if (!Number.isFinite(superbadges) || superbadges < 1) return '';
  return superbadges === 1 ? ' · 1 big flake, your superbadge' : ` · ${superbadges} big flakes, one per superbadge`;
}

/* One short line per detail: what you see, and the data behind it */
function legendItems(data, year) {
  const items = [];

  items.push({
    icon: '❄️',
    title: SNOW_NAMES[data.agentblazerTitle] || 'Classic white snow',
    text: data.agentblazerTitle ? `Agentblazer ${data.agentblazerTitle} in ${year}` : `no Agentblazer rank in ${year}`,
  });

  if (Number.isFinite(data.stats?.badges)) {
    const badges = data.stats.badges;
    items.push({
      icon: '🌨️',
      title: getSnowfall(badges).label,
      text: `${badges.toLocaleString('en-US')} badge${badges === 1 ? '' : 's'}${bigFlakeText(data.stats.superbadges)}`,
    });
  }

  if (data.topRank) {
    items.push({ icon: '🏔️', title: 'Full snow', text: `top rank reached` });
  } else if (Number.isFinite(data.rankProgress) && data.nextRankTitle) {
    const pct = Math.round(data.rankProgress * 100);
    items.push({ icon: '🏔️', title: `${pct}% snow`, text: `${pct}% of the way to ${data.nextRankTitle}` });
  }

  if (data.rank?.title) {
    const metals = getRankMetals(data.rank.title);
    const name = METAL_NAMES[metals[0].name] || metals[0].name;
    items.push({
      icon: '💍',
      title: metals.length > 1 ? `${metals.length}-metal braid` : `${name[0].toUpperCase()}${name.slice(1)} ring`,
      text: data.rank.title,
    });
  }

  const months = activeMonths(data.activity);
  items.push({
    icon: '🌌',
    title: 'Northern lights',
    text: months.length ? `your active months: ${months.join(', ')}` : `none, no ${year} activity yet`,
  });

  items.push({
    icon: '🪵',
    title: 'Wood rings',
    text: data.firstAchievementYear
      ? `on Trailhead since ${data.firstAchievementYear}`
      : 'no certification or stamp yet',
  });

  return items;
}

export default function GlobeLegend({ data, year }) {
  const items = legendItems(data, year);
  return (
    <section className='globe-legend' aria-label='Your globe, decoded'>
      <h2>Your globe, decoded</h2>
      <ul>
        {items.map((item) => (
          <li key={item.title}>
            <span className='globe-legend-icon' aria-hidden='true'>
              {item.icon}
            </span>
            <span>
              <strong>{item.title}</strong>: {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
