// Raison unique et lisible pour laquelle « Déclarer » est grisé alors qu'une action est commencée
// mais incomplète (pied de déclaration, CombatDeclareFooter — PLAN_RW_DECLARE_DESIGN module 5).
// Retourne `null` si rien ne bloque (action complète, ou rien de commencé).
//
// Texte FR direct : le domaine Combat est hors périmètre i18n (`.claude/rules/react.md`), cohérent
// avec `getAimIneligibilityReasons` (shared) et les messages `COMBAT_DECLARE_ERROR` du serveur.
//
// UNE fonction partagée par les 3 fenêtres : chacune remplit le même `bag` depuis son état (l'exo
// passe des valeurs vides pour aim / la mêlée qu'il n'a pas). M0.4 fournira plus tard des sélecteurs
// `{ valid, reason }` qui simplifieront le REMPLISSAGE du bag, pas cette fonction.
//
// Précédence : du plus spécifique / actionnable au plus général, dans l'ordre où la fenêtre valide
// (`assaultValid` : arme → cibles → variant → Tir visé).

/**
 * @param {object}   bag
 * @param {boolean}  bag.attackSelected       une attaque de tir est en cours de configuration
 * @param {boolean}  bag.attackHasWeapon      arme de tir choisie (`assaultWeaponId != null`)
 * @param {number}   bag.attackTargetsFilled  cibles renseignées dans les N premiers slots
 * @param {number}   bag.attackTargetsNeeded  cibles attendues (`effectiveAssaultCount`)
 * @param {boolean}  bag.attackHasVariant     mode de tir (variant) configuré (`currentVariant != null`)
 * @param {boolean}  bag.aimActive            Tir visé demandé (`aimTranches > 0`)
 * @param {string[]} bag.aimReasons           `getAimIneligibilityReasons(...)` — `[]` si éligible
 * @param {boolean}  bag.meleeSelected        un corps à corps est en cours de configuration
 * @param {boolean}  bag.meleeDefensif        mode passif (Défensif / Retraite) — pas de cible requise
 * @param {number}   bag.meleeTargetsFilled
 * @param {number}   bag.meleeTargetsNeeded   (`effectiveMeleeCount`)
 * @param {boolean}  bag.isCharge             `combat_mode === 'charge'`
 * @param {boolean}  bag.chargeHasMove        déplacement de Charge défini
 * @param {boolean}  bag.reloadSelected
 * @param {boolean}  bag.reloadHasWeapon
 * @param {boolean}  bag.reloadHasAmmo
 * @returns {string | null}
 */
export function buildBlockReason(bag = {}) {
  const b = bag ?? {}

  // --- Tir ---
  if (b.attackSelected) {
    if (!b.attackHasWeapon) return 'Sélectionner une arme de tir'
    const missing = (b.attackTargetsNeeded ?? 0) - (b.attackTargetsFilled ?? 0)
    if (missing > 0) {
      return missing === 1 ? 'Choisir une cible' : `Choisir ${b.attackTargetsNeeded} cibles`
    }
    if (!b.attackHasVariant) return 'Configurer le mode de tir'
    if (b.aimActive && (b.aimReasons?.length ?? 0) > 0) {
      return `Tir visé impossible : ${b.aimReasons.join(', ')}`
    }
  }

  // --- Corps à corps (mode passif Défensif/Retraite : aucune cible requise) ---
  if (b.meleeSelected && !b.meleeDefensif) {
    if (b.isCharge && !b.chargeHasMove) return 'Définir le déplacement de la Charge'
    const missing = (b.meleeTargetsNeeded ?? 0) - (b.meleeTargetsFilled ?? 0)
    if (missing > 0) {
      return missing === 1 ? 'Choisir une cible' : `Choisir ${b.meleeTargetsNeeded} cibles`
    }
  }

  // --- Rechargement (PJ seulement ; OK si une attaque est aussi déclarée : elle porte l'arme) ---
  if (b.reloadSelected && !b.attackSelected) {
    if (!b.reloadHasWeapon) return "Sélectionner l'arme à recharger"
    if (!b.reloadHasAmmo)   return 'Choisir des munitions'
  }

  return null
}
