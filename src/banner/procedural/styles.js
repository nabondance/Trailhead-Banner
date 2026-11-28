// Procedural background styles. No canvas imports here: the banner form imports this list.
export const PROCEDURAL_STYLES = [
  {
    id: 'classic',
    name: 'Trailhead Banner Classic',
    description: 'Waves and shapes in your rank color.',
  },
  {
    id: 'mountains',
    name: 'Mountains',
    description:
      'Mountain ranges at sunrise: more trails, more mountain rows; each certification family is a hiking path in its color.',
  },
  {
    id: 'topographic',
    name: 'Topographic Map',
    description:
      'Contour lines of your own terrain: more badges, more contours; certification families are trails, superbadges are summits.',
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus Blocks',
    description: 'A poster of bold geometric shapes in your rank and certification colors.',
  },
  {
    id: 'currents',
    name: 'Trail Currents',
    description:
      'Every badge is a particle in a flowing current; certification families are swirls, superbadges are bright streams.',
  },
  {
    id: 'cells',
    name: 'Certified Cells',
    description: 'A mosaic of cells drifting toward hexagons; certification families light up clusters of cells.',
  },
  {
    id: 'sky',
    name: 'Badge Sky',
    description:
      'One star per badge; each certification family is a constellation, superbadges are the brightest stars.',
  },
];

export const DEFAULT_PROCEDURAL_STYLE = 'classic';

// Every style but Classic draws from badge, superbadge, trail and certification data
export function proceduralUsesTrailheadStats(style) {
  return style !== 'classic' && PROCEDURAL_STYLES.some((s) => s.id === style);
}
