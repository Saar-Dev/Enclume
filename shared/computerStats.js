// shared/computerStats.js — Statistiques dérivées d'un ordinateur exo-armure
//
// Fonction pure, aucun accès DB — même famille que exoStats.js/polarisUtils.js. Consommée côté
// serveur (applyExoTemplate, validation potentiel/niveau max d'un programme) et côté client
// (ExoComputerPanel.jsx, PLAN_EXOARMURE.md §13.4.1) sans dupliquer la formule.
//
// Formules RAW littérales (docs/REGLES/REGLE_ORDINATEUR.md p.280-281) :
//   - Niveau max. des programmes : Gén. + (2 x Niveau technologique)
//   - Gestion systèmes         : 10 + (Gén. x NT)
//   - Potentiel                : 10 + [(Gén. x NT) x 2]
//   - Coût                     : 500 x (Gén. x NT)
// Vérifiées contre l'exemple chiffré du RAW : Gén. V / NT III → coût 7500, niveau max 11,
// 25 systèmes gérés, 40 niveaux de programmes.
//
// Un ordinateur exo vit dans sa propre ligne `exo_computers`/`ref_exo_template_computers`
// (PLAN_EXOARMURE.md §13.4.1, révision 2026-08-21 — table dédiée plutôt que colonnes scalaires sur
// exo_sheet, une armure pouvant porter un ordinateur "principal" ET un "secours" distincts, chacun
// son propre Gén./NT) — cette fonction est donc appelée une fois par ligne, jamais une fois par
// armure.
//
// Relation principal/secours — précisée par Saar (2026-08-21) : ce n'est PAS une redondance active en
// parallèle (les deux ne fonctionnent jamais simultanément). Le "secours" reste inactif tant que le
// "principal" est fonctionnel ; il prend le relais uniquement quand le principal tombe HS (Intégrité
// courante ≤ 0 — même convention que le Générateur exo, exoStats.js). `resolveActiveComputer`
// ci-dessous dérive lequel est actif à un instant donné — jamais stocké (même doctrine que les stats
// effectives de l'armure, computeExoStats). N'affecte ni `computeOrdinateurStats` (Potentiel/Niveau
// max restent des propriétés du MATÉRIEL, pas de son état d'activation — un programme installé sur le
// secours occupe bien son budget propre, prêt à l'emploi, même hors service) ni le schéma déjà posé
// (migration 257/258) — l'activation est un état de combat/runtime (Lot 5, hors périmètre du Lot C
// actuel qui ne couvre que la fiche), pas une donnée d'instance.
//
// L'Intégrité de départ d'un ordinateur (2D6+3 Gén. I-II / 2D6+8 Gén. III-VIII / 3D6+7 Gén. IX-X,
// docs/REGLES/REGLE_ORDINATEUR.md:91-93) est un JET, pas une formule pure — `resolveOrdinateurIntegrityFormula`
// ci-dessous ne fait QUE résoudre la formule de dés correspondant à une génération (donnée RAW pure,
// aucun hasard) ; le jet lui-même reste à la charge de l'appelant, une seule fois, via
// server/src/lib/diceParser.js#parseDice (applyExoTemplate), jamais recalculé. Le coût du Blindage
// IEM ci-dessous est séparé pour une raison différente (un choix d'équipement acheté, pas dérivé de
// Gén./NT) — mais reste une formule pure, contrairement à l'Intégrité.

/**
 * Statistiques dérivées d'un ordinateur à partir de sa Génération et son Niveau technologique.
 *
 * @param {{gen: number, nt: number}} params
 * @returns {{niveauMaxProgrammes: number, gestionSystemes: number, potentiel: number, cout: number}|null}
 *   null si `gen`/`nt` absents — jamais un NaN silencieux (même doctrine que computeExoStats).
 */
export function computeOrdinateurStats({ gen, nt } = {}) {
  if (gen == null || nt == null) return null

  return {
    niveauMaxProgrammes: gen + 2 * nt,
    gestionSystemes: 10 + gen * nt,
    potentiel: 10 + (gen * nt) * 2,
    cout: 500 * (gen * nt),
  }
}

/**
 * Coût du Blindage IEM d'un ordinateur — `niv` est un choix (équipement acheté), jamais dérivé de
 * Gén./NT (docs/REGLES/REGLE_ORDINATEUR.md p.280 : "(niv. x niv.) x 200").
 *
 * @param {number} niv
 * @returns {number|null} null si `niv` absent.
 */
export function computeBlindageIemCost(niv) {
  if (niv == null) return null
  return (niv * niv) * 200
}

/**
 * Formule de dés pour l'Intégrité de départ d'un ordinateur, par génération
 * (docs/REGLES/REGLE_ORDINATEUR.md:91-93 — table RAW directe, pas une interprétation).
 *
 * @param {number} gen — Génération (I-X, représentée 1-10)
 * @returns {string} formule consommable par server/src/lib/diceParser.js#parseDice
 * @throws {Error} si `gen` est hors de la plage RAW (1-10) — jamais un repli silencieux sur une
 *   formule arbitraire (même doctrine que computeExoStats#EXO_RD_TABLE pour une catégorie inconnue).
 */
export function resolveOrdinateurIntegrityFormula(gen) {
  if (gen >= 1 && gen <= 2) return '2d6+3'
  if (gen >= 3 && gen <= 8) return '2d6+8'
  if (gen >= 9 && gen <= 10) return '3d6+7'
  throw new Error(`resolveOrdinateurIntegrityFormula: génération hors plage RAW (I-X) : ${gen}`)
}

/**
 * Ordinateur actuellement fonctionnel parmi les ordinateurs d'une exo-armure — le "secours" ne prend
 * le relais que lorsque le "principal" est HS (précision Saar 2026-08-21, jamais les deux à la fois).
 * Fonction pure, dérive l'état à partir de `integrite_current` — jamais stocké.
 *
 * @param {Array<{role: string, integrite_current: number|null}>} computers — lignes `exo_computers`
 *   d'un même personnage (0, 1 ou 2 lignes selon le modèle)
 * @returns {object|null} l'ordinateur actif, ou `null` si aucun n'est fonctionnel (aucun ordinateur,
 *   ou principal ET secours tous deux HS/absents)
 */
export function resolveActiveComputer(computers = []) {
  const isFonctionnel = (c) => c != null && (c.integrite_current ?? 0) > 0
  const principal = computers.find(c => c.role === 'principal')
  if (isFonctionnel(principal)) return principal
  const secours = computers.find(c => c.role === 'secours')
  if (isFonctionnel(secours)) return secours
  return null
}
