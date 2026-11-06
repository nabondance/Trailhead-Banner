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

// what lit the sky: only the kinds earned that year
function activityKinds(activity) {
  const has = (list) => (list || []).some((n) => n > 0);
  const kinds = [has(activity?.certifications) && 'certifications', has(activity?.stamps) && 'stamps'];
  return kinds.filter(Boolean).join(' and ');
}

function bigFlakeText(superbadges) {
  if (!Number.isFinite(superbadges) || superbadges < 1) return '';
  return ` · ${superbadges} superbadge${superbadges === 1 ? '' : 's'}`;
}

/* One short line per detail: what you see, and the data behind it */
function legendItems(data, year) {
  const items = [];

  if (!data.achievements?.length) {
    items.push({ icon: '🌲', title: 'Fir tree', text: `a quiet ${year}, no certification or stamp yet` });
  }

  // snow kind: only when the Agentblazer rank changed it (classic white snow
  // says nothing)
  if (data.agentblazerTitle) {
    items.push({
      icon: '❄️',
      title: SNOW_NAMES[data.agentblazerTitle] || 'Classic white snow',
      text: `Agentblazer ${data.agentblazerTitle} in ${year}`,
    });
  }

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

  // no line when there are no northern lights (no certification or stamp that year)
  const months = activeMonths(data.activity);
  if (months.length) {
    items.push({
      icon: '🌌',
      title: 'Northern lights',
      text: `${activityKinds(data.activity)} in ${months.join(', ')}`,
    });
  }

  // rings count the years since the first dated achievement (profiles show no join date)
  if (data.firstAchievementYear) {
    items.push({
      icon: '🪵',
      title: 'Wood rings',
      text: `years since your first certification or stamp, in ${data.firstAchievementYear}`,
    });
  }

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
              <strong>{item.title}</strong>
              {item.text && `: ${item.text}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
