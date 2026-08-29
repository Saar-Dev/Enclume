// client/src/lib/meleeDeclaration.js
//
// Sous-état de sélection **Corps à corps** des fenêtres de déclaration de combat
// (PLAN_RW_DECLARE_DESIGN M0.4). Reducer pur + dérivé pur, testables `node --test` — recopié à ~90 %
// entre CombatActionWindow (PJ, `meleePendingTokenIds`/`meleeCount`/`selectedMeleeWeaponId`…) et
// CombatGmDeclareWindow (MJ, `meleeTargets`/`meleeAttackCount`/`selectedGmMeleeWeaponId`…).
//
// PÉRIMÈTRE : le cœur partagé — arme, arme naturelle, cibles, nombre d'attaques, deux armes.
// RESTENT à la fenêtre (formes divergentes, unification = M0.4-g / reportée) : le mode de combat
// (`decl.combatMode` : normal/defensif/retraite/charge, déjà dans le reducer `decl`), le flag « CaC
// en cours » (MJ `meleePendingMode`), la sélection de Charge (MJ `chargeSelection`), le mode ciblage
// carte (`inMeleeTargetMode` / `isSelectingOnMap`).
//
// `weaponId` : undefined = auto-dériver (1re arme de contact équipée), null = mains nues explicite,
// id = choix explicite. Exclusif avec `naturalWeaponId` (choisir l'un met l'autre à null).

export const MELEE_DECLARATION_INITIAL = {
  weaponId:        undefined,
  naturalWeaponId: null,
  targets:         [],     // [tokenId, tokenId?, tokenId?] — 1 par attaque (multi-CaC)
  count:           1,      // 1|2|3
  isDualWield:     false,  // Combat à deux armes de contact (COM24)
  // Charge (déplacement court GRATUIT → 1 cible CaC) — un tout atomique, distinct d'un déplacement
  // + d'une attaque CaC séparés (M0.4-g : le PJ utilisait `moveSelection` + `targets`, le MJ avait
  // un `chargeSelection` dédié — unifié ici). `move` = sélection spatiale (targetPosX/Y/Z, action_key,
  // ini_mod forcé à 0). `decl.combatMode === 'charge'` reste porté par le reducer `decl`.
  charge:          null,   // { move, targetTokenId } | null
}

// Cibles renseignées (le mode Charge force 1 attaque — calculé par la fenêtre avec decl.combatMode).
export function meleeTargetsFilled(state) {
  return state.targets.filter(Boolean).length
}

/**
 * @param {typeof MELEE_DECLARATION_INITIAL} state
 * @param {{ type: string, [k: string]: any }} action
 */
export function meleeDeclarationReducer(state, action) {
  switch (action.type) {
    // Choisir une arme de contact — n'efface pas la config (nombre d'attaques, deux armes) : miroir
    // de l'ancien onWeaponChange PJ/MJ. Exclusif avec l'arme naturelle.
    case 'SELECT_WEAPON':
      return { ...state, weaponId: action.weaponId, naturalWeaponId: null }

    // Choisir une arme naturelle (mutation) — exclusif avec l'arme d'inventaire.
    case 'SELECT_NATURAL':
      return { ...state, naturalWeaponId: action.id, weaponId: null }

    case 'SET_COUNT':
      // Miroir de l'ancien onMeleeCountChange : troncature seule (pas de remplissage — le CaC
      // multi-cible vise par défaut des cibles distinctes, contrairement au Tir Multi).
      return { ...state, count: action.count, targets: state.targets.slice(0, action.count) }

    case 'SET_TARGET': {
      const next = [...state.targets]
      next[action.index] = action.tokenId
      return { ...state, targets: next }
    }

    // Cible unique imposée (Charge, clic direct sur un token) — miroir de `setMelee*Targets([tid])`.
    case 'SET_SOLE_TARGET':
      return { ...state, targets: [action.tokenId] }

    // Repart d'aucune cible (MJ : début d'une nouvelle série multi-cible, `selectNext` startIdx 0).
    case 'RESET_TARGETS':
      return { ...state, targets: [] }

    case 'SET_DUAL_WIELD':
      return { ...state, isDualWield: action.value }

    // Charge posée (déplacement + cible ensemble) ou effacée (`null`). La fenêtre orchestre le
    // double geste carte (déplacement puis cible) ; ici on ne stocke que le résultat.
    case 'SET_CHARGE':
      return { ...state, charge: action.charge ?? null }

    case 'CLEAR':
      return { ...MELEE_DECLARATION_INITIAL }

    default:
      return state
  }
}
