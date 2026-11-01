/* The ring where the glass meets the wood is the user's Trailhead rank, one
   distinct metal look per rank. The first ranks climb through single metals;
   from Double Star Ranger on the ring becomes a braid with one strand per
   star, ending with All Star Ranger braiding every metal together.
   The engraved username takes the ring's lead metal. */

const METALS = {
  copper: { color: '#c27a50', metalness: 0.9, roughness: 0.32, engrave: ['#f3b48c', '#c27a50', '#7d4529'] },
  bronze: { color: '#a8783e', metalness: 0.85, roughness: 0.4, engrave: ['#e0b77c', '#a8783e', '#6a4a22'] },
  brass: { color: '#d9b44a', metalness: 0.9, roughness: 0.3, engrave: ['#f5de8f', '#d9b44a', '#8c7024'] },
  steel: { color: '#9aa3ad', metalness: 0.9, roughness: 0.35, engrave: ['#dfe5ec', '#9aa3ad', '#5c636b'] },
  silver: { color: '#e4e7ec', metalness: 0.95, roughness: 0.18, engrave: ['#ffffff', '#cfd4db', '#868c95'] },
  gold: { color: '#e8c45c', metalness: 0.88, roughness: 0.22, engrave: ['#f6dd8b', '#d4af37', '#96751c'] },
  roseGold: { color: '#e5a48a', metalness: 0.9, roughness: 0.25, engrave: ['#ffd2c0', '#e5a48a', '#9c6350'] },
  platinum: { color: '#c9cdd4', metalness: 1, roughness: 0.08, engrave: ['#f4f6f8', '#bfc4cc', '#7a7f87'] },
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
