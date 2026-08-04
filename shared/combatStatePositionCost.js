// shared/combatStatePositionCost.js — coût d'Initiative des transitions de position déclarée
// (REGLESYSCOMBAT.md:929-941, « POSITION DU PERSONNAGE »). Autorité unique client
// (combatSections.js — STATE_DEFS.position.cost, aperçu avant validation) + serveur
// (socketCombatAnnouncement.js — STATE_COSTS.position, calcul réel du coût) — jamais deux tables
// recopiées à la main (docs/PLANS/PLAN_KNEELING_POSITION.md Lot 1, même geste que
// PLAN_RW_SYSCOMBAT.md §2.1.a pour les mods de situation).
export const POSITION_TRANSITION_COST = {
  standing:  { crouching: -3, prone:      -5 },
  crouching: { standing:  -3, prone:      -5 },
  prone:     { standing: -10, crouching: -10 },
}
