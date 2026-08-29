// Un changement d'état tactique DÉLIBÉRÉ a-t-il été déclaré (posture / arme / vitesse) ?
//
// Utilisé par le pied de déclaration (CombatDeclareFooter, PLAN_RW_DECLARE_DESIGN module 5) : le
// bouton « Déclarer » s'active dès qu'il y a quelque chose à déclarer — une action OU un changement
// d'état volontaire. Cette fonction couvre le second cas.
//
// Axes comparés : position, weapon, vitesse — les trois seuls que le joueur change délibérément (via
// le satellite d'état / la section TACTIQUE). Exclusions volontaires (ne pas « corriger ») :
//   - `fire_mode` : change en EFFET DE BORD d'un changement d'arme (auto-reset si la nouvelle arme
//     ne supporte pas le mode courant, useEffect des fenêtres) — jamais un acte isolé.
//   - `cover` : aucun sélecteur de couverture nulle part dans l'UI (`[VÉRIFIÉ]` 2026-08-29).
//   - `combat_mode` : c'est un modificateur d'attaque (Offensif / Charge / Défensif / Retraite), pas
//     une action autonome — le déclarer seul n'a pas de sens.
//
// Bug pré-existant, corrigé au module 4 (pas ici) : sélectionner puis désélectionner une attaque
// laisse `decl.weapon = 'drawn'` (SELECT_ATTACK auto-dégaine, clearAttackState ne rerengaine pas) →
// compté ici comme un changement délibéré. Le module 4 (« l'arme EST l'action ») rerengaine à la
// désélection et supprime le cas. Module 5 ne touche pas la logique de tuiles.

const DELIBERATE_AXES = ['position', 'weapon', 'vitesse']

/**
 * @param {{position?:string, weapon?:string, vitesse?:string}} decl     état déclaré (`decl` du reducer)
 * @param {{position?:string, weapon?:string, vitesse?:string}} initial  référence début de tour (`snapFromRosterEntry`)
 * @returns {boolean}
 */
export function hasDeliberateStateChange(decl, initial) {
  if (!decl || !initial) return false
  return DELIBERATE_AXES.some(axis => decl[axis] !== initial[axis])
}
