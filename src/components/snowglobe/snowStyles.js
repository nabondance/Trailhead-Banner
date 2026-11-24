/* The kind of snow in a globe comes from the Agentblazer rank earned in the
   Rewind year: classic white for everyone, then blue crystals, iridescent
   flakes and gold glitter as the rank grows. Nothing to pick: it's the data.

   flakes / powder: props for the two SnowSystem pools (see physics.js)
   sparkles: the glints on the snow floor (see scenery.js) */
const SNOW_STYLES = {
  classic: {
    flakes: { color: '#dbe8fc' },
    powder: { color: '#eaf4ff' },
    sparkles: { color: '#fffaeb' },
  },
  // cool blue ice crystals that catch the light now and then
  Champion: {
    flakes: { color: '#bfe0ff', tint2: '#ffffff', tintMix: 0.35, twinkle: 0.55 },
    powder: { color: '#d4eaff', twinkle: 0.3 },
    sparkles: { color: '#d6ecff' },
  },
  // holographic flakes whose color shifts as they tumble
  Innovator: {
    flakes: { color: '#eef2ff', iridescence: 0.55, twinkle: 0.4 },
    powder: { color: '#f2f0ff', iridescence: 0.35 },
    sparkles: { color: '#f4ecff' },
  },
  // white snow shot through with gold glitter, glinting hard
  Legend: {
    flakes: { color: '#f4f7ff', tint2: '#ffcf5a', tintMix: 0.4, twinkle: 0.75 },
    powder: { color: '#fff4d6', tint2: '#ffd978', tintMix: 0.3, twinkle: 0.5 },
    sparkles: { color: '#ffd77a' },
  },
};

function getSnowStyle(agentblazerTitle) {
  return SNOW_STYLES[agentblazerTitle] || SNOW_STYLES.classic;
}

/* Floor glints: All Star Rangers (no rank left to reach, so their snow is at
   its deepest) also get more, faster, golden glints */
function getSparkles(style, topRank) {
  return topRank ? { color: '#ffe39a', count: 420, rate: 1.5 } : { ...style.sparkles };
}

export { SNOW_STYLES, getSnowStyle, getSparkles };

/* Falling snow: how many flakes swirl when the globe is shaken, from the
   all-time badge count (log scale, so beginners still get a flurry and big
   collectors a blizzard without overloading phones). 0 badges → 300 flakes,
   100 → ~570, 1,000 → ~840, 3,000+ → 1,000. Split between the two layers in
   the original 400 flakes / 280 powder proportion. */
const SNOWFALL_MIN = 300;
const SNOWFALL_MAX = 1000;
const SNOWFALL_FULL_AT = 3000; // badges

function getSnowfall(badges) {
  const b = Number.isFinite(badges) && badges > 0 ? badges : 0;
  const t = Math.min(Math.log10(1 + b) / Math.log10(1 + SNOWFALL_FULL_AT), 1);
  const total = Math.round(SNOWFALL_MIN + (SNOWFALL_MAX - SNOWFALL_MIN) * Math.pow(t, 1.75));
  const flakes = Math.round((total * 400) / 680);
  return {
    flakes,
    powder: total - flakes,
    label: total < 500 ? 'Light snowfall' : total < 800 ? 'Steady snowfall' : 'Heavy snowfall',
  };
}

export { getSnowfall };
