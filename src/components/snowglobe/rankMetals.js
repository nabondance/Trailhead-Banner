/* The ring where the glass meets the wood is the user's Trailhead rank, one
   distinct metal look per rank. The first ranks climb through single metals;
   from Double Star Ranger on the ring becomes a braid with one strand per
   star, ending with All Star Ranger braiding every metal together.
   (The engraved username always stays gold.) */

// metalness kept below a mirror finish: the scene has no environment to
// reflect, so a pure mirror metal renders near-black instead of its color
const METALS = {
  copper: { color: '#d08458', metalness: 0.75, roughness: 0.3 },
  bronze: { color: '#b8853f', metalness: 0.72, roughness: 0.36 },
  brass: { color: '#e2bd52', metalness: 0.75, roughness: 0.28 },
  steel: { color: '#aeb6c0', metalness: 0.7, roughness: 0.32 },
  silver: { color: '#d3d8df', metalness: 0.72, roughness: 0.24 },
  gold: { color: '#f0cb5e', metalness: 0.75, roughness: 0.24 },
  roseGold: { color: '#efb096', metalness: 0.75, roughness: 0.26 },
  // cool blue-white with a soft glow so it stands out from the snow: Ranger
  // is a big milestone, its ring should shine
  platinum: {
    color: '#c8d6ea',
    metalness: 0.6,
    roughness: 0.18,
    emissive: '#5f7fae',
    emissiveIntensity: 0.35,
  },
};

const RANK_METALS = {
  Scout: ['copper'],
  Hiker: ['bronze'],
  Explorer: ['brass'],
  Adventurer: ['steel'],
  Mountaineer: ['silver'],
  Expeditioner: ['gold'],
  Ranger: ['platinum'],
  'Double Star Ranger': ['gold', 'silver'],
  'Triple Star Ranger': ['gold', 'silver', 'roseGold'],
  'Four Star Ranger': ['gold', 'silver', 'roseGold', 'platinum'],
  'Five Star Ranger': ['gold', 'silver', 'roseGold', 'platinum', 'copper'],
  'All Star Ranger': ['gold', 'silver', 'roseGold', 'platinum', 'copper', 'bronze'],
};

/* Metals of the ring for a rank title (unknown rank: plain gold) */
function getRankMetals(rankTitle) {
  return (RANK_METALS[rankTitle] || ['gold']).map((name) => ({ name, ...METALS[name] }));
}

export { METALS, RANK_METALS, getRankMetals };
