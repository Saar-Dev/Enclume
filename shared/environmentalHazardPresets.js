// shared/environmentalHazardPresets.js — présets RAW pour l'UI d'exposition (docs/REGLES/
// FATIGUE&DOMMAGES.md:4-13,40-48,108-119, vérifiés contre Polaris 3ème édition p.242-243). Pré-remplit
// le formulaire MJ (`TokenStatusPanel.jsx`) — un préset reste modifiable, jamais imposé (Acide : RAW
// "dépend de la puissance", pas de préset chiffré, MJ saisit une formule libre). Même patron
// d'extraction que `shared/fallDamageConstants.js` (WOUND_HEALING/WOUND_INFECTION).
export const BURNING_PRESETS = [
  { key: 'small',   formula: '1d6',  locations: 1 },
  { key: 'medium',  formula: '1d10', locations: 1 },
  { key: 'large',   formula: '2d10', locations: '1d3' },
  { key: 'inferno', formula: '3d10', locations: 1 }, // RAW ne précise aucune localisation pour le Brasier (silence RAW, comme l'intensité de l'Acide) — 1 par défaut, modifiable
]

export const DECOMPRESSION_PRESETS = [
  { key: 'normal', formula: '1d10' },
  { key: 'severe', formula: '2d10' }, // paliers multiples manqués
]
