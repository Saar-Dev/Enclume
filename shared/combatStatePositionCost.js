// shared/combatStatePositionCost.js — coût d'Initiative des transitions de position déclarée
// (REGLESYSCOMBAT.md:929-941, « POSITION DU PERSONNAGE »). Autorité unique client
// (combatSections.js — STATE_DEFS.position.cost, aperçu avant validation) + serveur
// (socketCombatAnnouncement.js — STATE_COSTS.position, calcul réel du coût) — jamais deux tables
// recopiées à la main (docs/PLANS/PLAN_KNEELING_POSITION.md Lot 1, même geste que
// PLAN_RW_SYSCOMBAT.md §2.1.a pour les mods de situation).
//
// kneeling (« à genou ») : le LdB liste la position mais ne nomme aucun coût pour elle (§0.2 du plan).
// Décision explicite Saar (2026-08-04) : coût identique à crouching vers/depuis standing et prone ;
// transition directe crouching↔kneeling gratuite (0) — postures mécaniquement équivalentes partout
// ailleurs dans le système, aucun avantage caché à passer de l'une à l'autre.
export const POSITION_TRANSITION_COST = {
  standing:  { crouching: -3, kneeling:  -3, prone:      -5 },
  crouching: { standing:  -3, kneeling:   0, prone:      -5 },
  kneeling:  { standing:  -3, crouching:  0, prone:      -5 },
  prone:     { standing: -10, crouching: -10, kneeling: -10 },
}
