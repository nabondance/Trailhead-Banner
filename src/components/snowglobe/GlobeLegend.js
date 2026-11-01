'use client';

import { getRankMetals } from './rankMetals';
import { woodRingCount } from './textures';

/* "Your globe, decoded": every personal detail of the globe and the data it
   comes from, in plain words, so the user can read their own globe. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const METAL_NAMES = { roseGold: 'rose gold' };
const SNOW_NAMES = {
  Champion: 'Icy blue crystal snow',
  Innovator: 'Iridescent snow',
  Legend: 'Gold glitter snow',
};

const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const listWords = (words) =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

function monthsSummary(activity) {
  const totals = Array.from(
    { length: 12 },
    (_, i) => (activity?.certifications?.[i] || 0) + (activity?.stamps?.[i] || 0)
  );
  const max = Math.max(...totals);
  if (!max) return null;
  const active = totals.map((t, i) => (t ? MONTHS[i] : null)).filter(Boolean);
  const peaks = totals.map((t, i) => (t === max ? MONTHS[i] : null)).filter(Boolean);
  // every active month equal: just say when it lit up
  if (peaks.length === active.length) return `It lit up in ${listWords(active)}.`;
  return `Brightest in ${listWords(peaks)}.`;
}

function legendItems(data, year) {
  const items = [];
  const rank = data.rank?.title;

  // what's inside
  const inside = [];
  if (data.totals?.certifications) inside.push(plural(data.totals.certifications, 'certification'));
  if (data.totals?.stamps) inside.push(plural(data.totals.stamps, 'stamp'));
  if (data.agentblazerTitle) inside.push(`your Agentblazer ${data.agentblazerTitle} badge`);
  items.push({
    icon: '🎖️',
    title: 'Inside the glass',
    text: inside.length
      ? `Your ${year}: ${listWords(inside)}, with your ${rank || 'Trailhead'} emblem.`
      : `A calm ${year} on the trail: your ${rank || 'Trailhead'} emblem rests in the snow.`,
  });

  // snow kind
  items.push({
    icon: '❄️',
    title: SNOW_NAMES[data.agentblazerTitle] || 'Classic white snow',
    text: data.agentblazerTitle
      ? `You reached Agentblazer ${data.agentblazerTitle} in ${year}.`
      : `No Agentblazer rank in ${year} yet. Champion, Innovator and Legend each bring their own snow.`,
  });

  // snow depth
  if (data.topRank) {
    items.push({
      icon: '🏔️',
      title: 'The deepest snow, with golden glints',
      text: `${rank}: there is no rank left to reach.`,
    });
  } else if (Number.isFinite(data.rankProgress) && data.nextRankTitle) {
    const pct = Math.round(data.rankProgress * 100);
    items.push({
      icon: '🏔️',
      title: `Snow ${pct}% deep`,
      text: `You are ${pct}% of the way to ${data.nextRankTitle}. The globe fills up as you get closer.`,
    });
  }

  // ring
  if (rank) {
    const metals = getRankMetals(rank).map((m) => METAL_NAMES[m.name] || m.name);
    items.push({
      icon: '💍',
      title: metals.length > 1 ? `A braid of ${metals.length} metals (${listWords(metals)})` : `A ${metals[0]} ring`,
      text: `Your rank: ${rank}. ${metals.length > 1 ? 'One strand per star.' : 'Each rank has its own metal.'}`,
    });
  }

  // northern lights
  const months = monthsSummary(data.activity);
  items.push({
    icon: '🌌',
    title: months ? 'Northern lights' : 'No northern lights yet',
    text: months
      ? `Your ${year}, January to December from left to right. ${months}`
      : `They light up month by month with your ${year} certifications and stamps.`,
  });

  // wood
  const years = data.firstAchievementYear ? year - data.firstAchievementYear + 1 : 1;
  items.push({
    icon: '🪵',
    title: `${woodRingCount(years)} growth rings`,
    text: `${
      data.firstAchievementYear && years > 1
        ? `${plural(years, 'year')} on Trailhead (since ${data.firstAchievementYear})`
        : 'Your first year on Trailhead'
    }. The grain and knots are unique to @${data.username}.`,
  });

  // plaque
  if (data.stats && Number.isFinite(data.stats.badges)) {
    items.push({
      icon: '🏆',
      title: 'Engraved plaque',
      text: 'Your all-time badges, points and trails.',
    });
  }

  if (data.isMvp) {
    items.push({ icon: '🏅', title: 'MVP rosette', text: 'You are a Trailblazer MVP.' });
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
              <br />
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
