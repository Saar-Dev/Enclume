// Assemblage du payload `COMBAT_ACTION_DECLARE` — fonctions PURES, extraites de `handleDeclare`
// des fenêtres de déclaration (module 0, `docs/PLANS/PLAN_RW_DECLARE_DESIGN.md` §5.4).
//
// Aucun hook, aucun React, aucun accès store : la fenêtre rassemble ses sélections dans un objet
// plat (`sel`) et appelle la fonction ; le résultat part tel quel dans `socket.emit`.
//
// But : figer l'assemblage du payload en fonction testable AVANT la refonte visuelle des fenêtres
// (modules 2-5). Le golden master `buildDeclarePayload.test.mjs` casse au moindre changement de
// forme du payload — filet de sécurité pour un code combat sans test composant (INFRA-4).
//
// ⚠ Iso-comportement strict : le corps de chaque fonction est le littéral de `handleDeclare` déplacé
// verbatim, les variables locales devenant `sel.xxx`. Toute évolution de règle passe par un test
// mis à jour explicitement, jamais un changement silencieux ici.

// --- Humain (PJ) — miroir exact de CombatActionWindow.jsx#handleDeclare, branche non-drone --------
export function buildHumanDeclarePayload(sel) {
  return {
    tokenId: sel.tokenId,
    state: {
      position:    sel.decl.position,
      weapon:      sel.decl.weapon,
      fire_mode:   sel.decl.fire_mode,
      vitesse:     sel.decl.vitesse,
      combat_mode: sel.decl.combatMode,
    },
    mapActions: {
      move: sel.moveSelection
        ? {
            targetPosX: sel.moveSelection.targetPosX,
            targetPosY: sel.moveSelection.targetPosY,
            targetPosZ: sel.moveSelection.targetPosZ ?? 0,
            // Charge/Retraite : déplacement gratuit → ini_mod forcé à 0 côté client (confirmé serveur)
            ini_mod: (sel.decl.combatMode === 'charge' || sel.decl.combatMode === 'retraite')
              ? 0
              : sel.moveSelection.ini_mod,
            action_key: sel.moveSelection.action_key,
          }
        : null,
      // Tir Multi (docs/Old/PLAN_TIRMULTI.md) : array d'1 à 3 tirs, même arme pour toute la série (D9)
      // — seule la cible varie par élément.
      attack: sel.attackSelected
        ? sel.assaultPendingTokenIds.slice(0, sel.effectiveAssaultCount).map(targetTokenId => ({
            weaponInvId:        sel.assaultWeaponId,
            // Main non directrice (COM29) — seulement si le dual-wield est effectivement actif.
            offhandWeaponInvId: (sel.isDualWield && sel.hasTwoWeapons && sel.sameFirMode)
              ? (sel.weaponMg?.id ?? null)
              : null,
            targetTokenId,
            bulletCount:        sel.currentVariant?.bulletCount ?? null,
            fireModeBonusComp:  sel.currentVariant ? (sel.currentVariant.bonusComp + sel.dualWieldBonusComp) : null,
            fireModeBonusDmg:   sel.currentVariant?.bonusDmg ?? null,
            isDualWield:        sel.isDualWield && sel.hasTwoWeapons && sel.sameFirMode,
            dualWieldBonusComp: sel.dualWieldBonusComp,
            aimTranches:        sel.aimTranches,
            aimedLocation:      sel.aimedLocation,
          }))
        : null,
      // Défensif/Retraite : pas de cible — mode passif, bonus appliqué via state_combat_mode.
      melee: (sel.meleeSelected && !sel.meleeDefensif)
        ? sel.meleePendingTokenIds.slice(0, sel.effectiveMeleeCount).map(id => ({
            targetTokenId: id,
            weaponInvId:   sel.effectiveMeleeWeaponId,
            naturalWeaponCharMutationId: sel.effectiveMeleeNaturalWeaponId,
            // Combat à deux armes (COM24) — même patron que offhandWeaponInvId/isDualWield du Tir.
            offhandWeaponInvId: sel.effectiveDualWieldMelee ? (sel.meleeOffhandWeapon?.id ?? null) : null,
            isDualWield:        sel.effectiveDualWieldMelee,
          }))
        : null,
      reload: sel.reloadSelected
        ? { weapon_inv_id: sel.selectedWeapon?.id ?? null, ammo_item_id: sel.selectedAmmoId }
        : false,
    },
    quick: {
      observer: sel.decl.quick.observer,
      reperer:  sel.decl.quick.reperer,
      phrase:   sel.decl.quick.phrase,
    },
  }
}

// --- MJ / PNJ — miroir exact de CombatGmDeclareWindow.jsx#handleDeclare, branche non-drone ---------
// Différences légitimes vs l'humain PJ (préservées) : `weapon.inv_id` (équipement batch PNJ vs
// `assaultWeaponId` déjà résolu) ; `fireModeBonusComp`/`fireModeBonusDmg` par défaut à `0` (pas
// `null`) ; `move` = `chargeSelection?.move ?? pendingMove` passé brut (pas de forçage `ini_mod` à 0
// côté payload — le serveur recalcule) ; CaC via `weaponInvIdForMelee` / `naturalWeaponIdForMelee`
// (résolus par la fenêtre).
export function buildGmDeclarePayload(sel) {
  const meleeOffhandInvIdForMelee = sel.effectiveDualWieldMelee
    ? (sel.meleeOffhandWeapon?.inv_id ?? null)
    : null
  const meleeCaC = sel.chargeSelection?.targetTokenId
    ? [{
        targetTokenId: sel.chargeSelection.targetTokenId,
        weaponInvId: sel.weaponInvIdForMelee,
        naturalWeaponCharMutationId: sel.naturalWeaponIdForMelee,
      }]
    : sel.meleeTargets.slice(0, sel.effectiveMeleeCount).map(id => ({
        targetTokenId: id,
        weaponInvId: sel.weaponInvIdForMelee,
        naturalWeaponCharMutationId: sel.naturalWeaponIdForMelee,
        offhandWeaponInvId: meleeOffhandInvIdForMelee,
        isDualWield: sel.effectiveDualWieldMelee,
      }))
  const movePayload = sel.chargeSelection?.move ?? sel.pendingMove ?? null

  return {
    tokenId: sel.activeTokenId,
    state: {
      position:    sel.decl.position,
      weapon:      sel.decl.weapon,
      fire_mode:   sel.decl.fire_mode,
      vitesse:     sel.decl.vitesse,
      combat_mode: sel.decl.combatMode,
    },
    mapActions: {
      move: movePayload,
      // Tir Multi : array d'1 à 3 tirs, même arme pour toute la série (D9).
      attack: sel.weapon && sel.assaultTargets.length > 0
        ? sel.assaultTargets.slice(0, sel.effectiveAssaultCount).map(targetTokenId => ({
            weaponInvId:        sel.weapon.inv_id,
            offhandWeaponInvId: (sel.isDualWield && sel.hasTwoWeapons && sel.sameFirMode)
              ? (sel.weaponMg?.inv_id ?? null)
              : null,
            targetTokenId,
            bulletCount:        sel.currentVariant?.bulletCount ?? null,
            fireModeBonusComp:  sel.currentVariant ? (sel.currentVariant.bonusComp + sel.dualWieldBonusComp) : 0,
            fireModeBonusDmg:   sel.currentVariant?.bonusDmg ?? 0,
            isDualWield:        sel.isDualWield && sel.hasTwoWeapons && sel.sameFirMode,
            dualWieldBonusComp: sel.dualWieldBonusComp,
            aimTranches:        sel.aimTranches,
            aimedLocation:      sel.aimedLocation,
          }))
        : null,
      melee:  meleeCaC.length > 0 ? meleeCaC : null,
      reload: sel.mapAction === 'reload',
    },
    quick: { ...sel.decl.quick },
  }
}

// --- Drone — cœur pur de useDroneDeclare#buildMapActions ------------------------------------------
// Retourne { stateFireMode, mapActions } ; les fenêtres l'enveloppent dans state:{position:'standing',
// weapon:'holstered', fire_mode: stateFireMode, cover:'exposed', vitesse:'normal'}. Un drone est hors
// scope Tir Multi (D6) → attack toujours de longueur 1.
export function buildDroneMapActions(sel) {
  const hasAttack = !!sel.selectedDroneWeaponId && !!sel.assaultTargetId
  const weapon    = hasAttack ? sel.droneWeapons.find(w => w.id === sel.selectedDroneWeaponId) : null
  const explicitFm    = weapon?.fire_mode
  const isCaC         = explicitFm ? explicitFm === 'cc' : !weapon?.ref_fire_mode
  const stateFireMode = hasAttack ? (isCaC ? 'cc' : (explicitFm ?? 'rc').toLowerCase()) : 'cc'
  const attackPayload = hasAttack
    ? (isCaC
        ? { melee: [{ droneWeaponInvId: sel.selectedDroneWeaponId, targetTokenId: sel.assaultTargetId }] }
        : { attack: [{ droneWeaponInvId: sel.selectedDroneWeaponId, targetTokenId: sel.assaultTargetId }] })
    : {}
  return {
    stateFireMode,
    mapActions: {
      move: sel.pendingMove
        ? {
            targetPosX: sel.pendingMove.targetPosX,
            targetPosY: sel.pendingMove.targetPosY,
            targetPosZ: sel.pendingMove.targetPosZ ?? 0,
            ini_mod:    sel.pendingMove.ini_mod ?? 0,
            action_key: sel.pendingMove.action_key,
          }
        : null,
      ...attackPayload,
    },
  }
}

// --- Exo — cœur pur de useExoDeclare#buildMapActions ---------------------------------------------
// Une exo-armure : une seule attaque par Tour (RAW), pas de Tir Multi ni de deux armes → array de
// longueur 1. `ref_category === 'Arme de contact'` = autorité serveur pour CaC (jamais fire_mode nul).
export function buildExoMapActions(sel) {
  if (!sel.selectedExoWeaponId || !sel.assaultTargetId) return {}
  const weapon = sel.exoWeapons.find(w => w.id === sel.selectedExoWeaponId)
  const isCaC = weapon?.ref_category === 'Arme de contact'
  return isCaC
    ? { melee: [{ exoWeaponInvId: sel.selectedExoWeaponId, targetTokenId: sel.assaultTargetId }] }
    : { attack: [{ exoWeaponInvId: sel.selectedExoWeaponId, targetTokenId: sel.assaultTargetId }] }
}
