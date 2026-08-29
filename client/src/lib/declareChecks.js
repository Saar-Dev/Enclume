// Validité d'une déclaration de combat, par type d'action — **source unique** du booléen ET du
// message d'erreur (PLAN_RW_DECLARE_DESIGN module 5 / futur M0.4).
//
// Avant : chaque fenêtre calculait `assaultValid` / `meleeValid` / `reloadValid` en booléen inline,
// et le pied aurait ré-encodé les mêmes conditions pour produire un texte → deux dérivations de la
// même règle, risque de dérive silencieuse (« Déclarer » grisé sans explication). Ici : une
// évaluation, `{ valid, reason }` en sort ensemble.
//
// Entrées **normalisées** : chaque fenêtre calcule les faits (`started`, `hasWeapon`, `targetsFilled`…)
// depuis son propre modèle (PJ : `attackSelected` / `mapSelected` ; MJ : dérivé des cibles /
// `meleePendingMode` / `chargeSelection`) — une ligne triviale et visible par fenêtre. Le cœur
// (quelles conditions, dans quel ordre, valid + reason) est ici, testé, partagé.
//
// Texte FR direct : domaine Combat hors périmètre i18n (`.claude/rules/react.md`), cohérent avec
// `getAimIneligibilityReasons` (shared) et les messages `COMBAT_DECLARE_ERROR` du serveur.
//
// M0.4 enveloppera ces fonctions dans `useAssaultDeclaration` / `useMeleeDeclaration` — elles ne
// bougeront pas, seule la source des entrées se simplifiera.

const OK = { valid: true, reason: null }
const fail = (reason) => ({ valid: false, reason })

/**
 * Validité du **Tir**.
 * PJ  : `started` = attaque sélectionnée (`attackSelected`) ; `hasWeapon` = `assaultWeaponId != null`.
 * MJ  : `started` = au moins une cible posée ; `hasWeapon` = `!!weapon`.
 *       (Le MJ gagne ici un contrôle d'arme côté client qu'il n'avait pas — le serveur le refusait
 *        déjà ; jamais un blocage à tort puisqu'une arme est requise de toute façon.)
 *
 * @param {object}   p
 * @param {boolean}  p.started
 * @param {boolean}  p.hasWeapon
 * @param {number}   p.targetsFilled   cibles non nulles dans les N premiers slots
 * @param {number}   p.targetsNeeded   `effectiveAssaultCount`
 * @param {boolean}  p.hasVariant      mode de tir configuré (`currentVariant != null`)
 * @param {boolean}  p.aimActive       Tir visé demandé (`aimTranches > 0`)
 * @param {string[]} p.aimReasons      `getAimIneligibilityReasons(...)` — `[]` si éligible
 * @returns {{ valid: boolean, reason: string | null }}
 */
export function assaultCheck({
  started, hasWeapon, targetsFilled = 0, targetsNeeded = 1, hasVariant, aimActive, aimReasons = [],
} = {}) {
  if (!started) return OK
  if (!hasWeapon) return fail('Sélectionner une arme de tir')
  const missing = targetsNeeded - targetsFilled
  if (missing > 0) return fail(missing === 1 ? 'Choisir une cible' : `Choisir ${missing} cibles`)
  if (!hasVariant) return fail('Configurer le mode de tir')
  if (aimActive && (aimReasons?.length ?? 0) > 0) {
    return fail(`Tir visé impossible : ${aimReasons.join(', ')}`)
  }
  return OK
}

/**
 * Validité du **Corps à corps**.
 * `defensif` (Défensif / Retraite) : mode passif, aucune cible requise.
 * `isCharge` : la Charge exige un déplacement ET une cible (PJ : la cible est dans
 *   `meleePendingTokenIds`, le move dans `moveSelection` ; MJ : les deux dans `chargeSelection`).
 *   Le MJ gagne un contrôle `chargeHasMove` côté client — jamais un blocage à tort (son flux pose
 *   move + cible ensemble).
 *
 * @param {object}  p
 * @param {boolean} p.started
 * @param {boolean} p.defensif
 * @param {boolean} p.isCharge
 * @param {boolean} p.chargeHasMove
 * @param {boolean} p.chargeHasTarget
 * @param {number}  p.targetsFilled
 * @param {number}  p.targetsNeeded   `effectiveMeleeCount`
 * @returns {{ valid: boolean, reason: string | null }}
 */
export function meleeCheck({
  started, defensif, isCharge, chargeHasMove, chargeHasTarget, targetsFilled = 0, targetsNeeded = 1,
} = {}) {
  if (!started || defensif) return OK
  if (isCharge) {
    if (!chargeHasMove) return fail('Définir le déplacement de la Charge')
    if (!chargeHasTarget) return fail('Choisir une cible')
    return OK
  }
  const missing = targetsNeeded - targetsFilled
  if (missing > 0) return fail(missing === 1 ? 'Choisir une cible' : `Choisir ${missing} cibles`)
  return OK
}

/**
 * Validité du **Rechargement** (PJ seulement — le MJ ne configure pas le rechargement, il passe
 * `started: false`). OK si une attaque est aussi déclarée : elle porte l'arme.
 *
 * @param {object}  p
 * @param {boolean} p.started
 * @param {boolean} p.coveredByAttack  une attaque est aussi sélectionnée (`attackSelected`)
 * @param {boolean} p.hasWeapon
 * @param {boolean} p.hasAmmo
 * @returns {{ valid: boolean, reason: string | null }}
 */
export function reloadCheck({ started, coveredByAttack, hasWeapon, hasAmmo } = {}) {
  if (!started || coveredByAttack) return OK
  if (!hasWeapon) return fail("Sélectionner l'arme à recharger")
  if (!hasAmmo) return fail('Choisir des munitions')
  return OK
}

/**
 * Raison unique du grisage de « Déclarer » : premier `.reason` non nul, précédence Tir → CaC →
 * Rechargement. `null` si tout est valide.
 *
 * @param {{ assault?: {reason?: string|null}, melee?: {reason?: string|null}, reload?: {reason?: string|null} }} checks
 * @returns {string | null}
 */
export function buildBlockReason({ assault, melee, reload } = {}) {
  return assault?.reason ?? melee?.reason ?? reload?.reason ?? null
}

/**
 * Y a-t-il **quelque chose à déclarer** ? (gate d'activation de « Déclarer », lève le mis-clic de B5).
 * OU des 6 sources — **liste canonique**, identique PJ / MJ, à ne pas dupliquer dans les fenêtres.
 * Chaque drapeau est calculé par la fenêtre depuis son modèle (voir `declareChecks` pour la
 * normalisation ; `hasStateChange` = `hasDeliberateStateChange(decl, initial)`).
 *
 * @param {object}  p
 * @param {boolean} p.attackStarted
 * @param {boolean} p.meleeStarted
 * @param {boolean} p.reloadStarted
 * @param {boolean} p.hasMove
 * @param {boolean} p.hasStateChange
 * @param {boolean} p.hasQuick
 * @returns {boolean}
 */
export function hasSomethingToDeclare({
  attackStarted, meleeStarted, reloadStarted, hasMove, hasStateChange, hasQuick,
} = {}) {
  return !!(attackStarted || meleeStarted || reloadStarted || hasMove || hasStateChange || hasQuick)
}
