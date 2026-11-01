/* The ring where the glass meets the wood is the user's Trailhead rank, one
   distinct metal look per rank. The first ranks climb through single metals;
   from Double Star Ranger on the ring becomes a braid with one strand per
   star, ending with All Star Ranger braiding every metal together.
   (The engraved username always stays gold.) */

// Real metal values: the ring has its own reflection map (scenery.js
// useRingEnvMap), so full metalness reads as polished metal, not black
const METALS = {
  copper: { color: '#d4895c', metalness: 1, roughness: 0.28 },
  bronze: { color: '#c08a46', metalness: 1, roughness: 0.34 },
  brass: { color: '#e6c25a', metalness: 1, roughness: 0.24 },
  steel: { color: '#b4bcc6', metalness: 1, roughness: 0.3 },
  silver: { color: '#e3e7ec', metalness: 1, roughness: 0.18 },
  gold: { color: '#f2cd62', metalness: 1, roughness: 0.2 },
  roseGold: { color: '#f0b39a', metalness: 1, roughness: 0.22 },
  // cool blue-white with a soft glow so it stands out from the snow: Ranger
  // is a big milestone, its ring should shine
  platinum: {
    color: '#d6e2f2',
    metalness: 1,
    roughness: 0.12,
    emissive: '#5f7fae',
    emissiveIntensity: 0.18,
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
