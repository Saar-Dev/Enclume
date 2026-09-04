// Assemblage du payload `COMBAT_ACTION_DECLARE` — fonctions PURES, extraites de `handleDeclare`
// des fenêtres de déclaration (module 0, `docs/Old/PLAN_RW_DECLARE_DESIGN.md` §5.4).
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
//
// `buildAttackEntries` / `buildMeleeEntries` (bas de fichier, `docs/PLANS/PLAN_RW_DECLARE_DERIVATION.md`
// Étape A) portent le cœur commun des entrées `attack[]` / `melee[]` — avant, recopié verbatim entre
// `buildHumanDeclarePayload` et `buildGmDeclarePayload` (la branche zone d'effet en particulier). Les
// divergences légitimes PJ/PNJ passent par le contexte (`weaponInvId`, `offhandWeaponId`, `targets`,
// `emptyBonus`) — jamais une branche `if (profile)` dans le cœur.

// --- Humain (PJ) — miroir exact de CombatActionWindow.jsx#handleDeclare, branche non-drone --------
export function buildHumanDeclarePayload(sel) {
  // Charge (M0.4-g) : le déplacement gratuit + la cible vivent dans `sel.chargeSelection`
  // ({ move, targetTokenId }) — même forme que le MJ. Sinon `sel.moveSelection` (déplacement normal
  // / Retraite) + `sel.meleePendingTokenIds` (CaC classique).
  const moveSel = sel.chargeSelection?.move ?? sel.moveSelection
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
      move: moveSel
        ? {
            targetPosX: moveSel.targetPosX,
            targetPosY: moveSel.targetPosY,
            targetPosZ: moveSel.targetPosZ ?? 0,
            // Charge/Retraite : déplacement gratuit → ini_mod forcé à 0 côté client (confirmé serveur)
            ini_mod: (sel.decl.combatMode === 'charge' || sel.decl.combatMode === 'retraite')
              ? 0
              : moveSel.ini_mod,
            action_key: moveSel.action_key,
          }
        : null,
      // Tir Multi (docs/Old/PLAN_TIRMULTI.md) : array d'1 à 3 tirs, même arme pour toute la série (D9)
      // — seule la cible varie par élément. Zone d'effet fusil à pompe / lance-flammes : une seule
      // entrée sans cible avec `aoe.direction`. Les deux formes + la neutralisation dual-wield/Tir
      // visé en mode zone vivent dans `buildAttackEntries` (cœur commun PJ/MJ).
      // Divergences PJ : arme déjà résolue (`assaultWeaponId`) ; offhand par `id` (pas `inv_id`) ;
      // cibles dans `assaultPendingTokenIds` ; bonus par défaut `null` (pas `0`) sans variant.
      attack: sel.attackSelected
        ? buildAttackEntries({
            aoeDirection:          sel.aoeDirection,
            weaponInvId:           sel.assaultWeaponId,
            targets:              sel.assaultPendingTokenIds,
            effectiveAssaultCount: sel.effectiveAssaultCount,
            isDualWield:           sel.isDualWield,
            hasTwoWeapons:         sel.hasTwoWeapons,
            sameFirMode:           sel.sameFirMode,
            offhandWeaponId:       sel.weaponMg?.id,
            currentVariant:        sel.currentVariant,
            dualWieldBonusComp:    sel.dualWieldBonusComp,
            aimTranches:           sel.aimTranches,
            aimedLocation:         sel.aimedLocation,
            emptyBonus:            null,
          })
        : null,
      // Charge : 1 cible, jamais de dual-wield (miroir buildGmDeclarePayload). Défensif/Retraite :
      // pas de cible — mode passif, bonus appliqué via state_combat_mode. L'entrée Charge PJ porte
      // `offhandWeaponInvId`/`isDualWield` explicites (forme divergente du MJ, testée) → reste ici.
      melee: sel.chargeSelection?.targetTokenId
        ? [{
            targetTokenId: sel.chargeSelection.targetTokenId,
            weaponInvId:   sel.effectiveMeleeWeaponId,
            naturalWeaponCharMutationId: sel.effectiveMeleeNaturalWeaponId,
            offhandWeaponInvId: null,
            isDualWield:        false,
          }]
        : (sel.meleeSelected && !sel.meleeDefensif)
        ? buildMeleeEntries({
            targets:                 sel.meleePendingTokenIds,
            effectiveMeleeCount:     sel.effectiveMeleeCount,
            weaponInvId:             sel.effectiveMeleeWeaponId,
            naturalWeaponId:         sel.effectiveMeleeNaturalWeaponId,
            effectiveDualWieldMelee: sel.effectiveDualWieldMelee,
            offhandWeaponId:         sel.meleeOffhandWeapon?.id,
          })
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
// Différences légitimes vs l'humain PJ (préservées **verbatim** — ne pas « harmoniser » sans décision) :
//  - `weapon.inv_id` (équipement batch PNJ) vs `assaultWeaponId` déjà résolu (PJ) ;
//  - `attack[].fireModeBonusComp` / `fireModeBonusDmg` : défaut `0` (PNJ) vs `null` (PJ) → `emptyBonus` ;
//  - `move` = `chargeSelection?.move ?? pendingMove` brut (pas de forçage `ini_mod` à 0 — serveur recalcule) ;
//  - CaC via `weaponInvIdForMelee` / `naturalWeaponIdForMelee` (résolus par la fenêtre) ;
//  - entrée Charge PNJ à 3 clés (pas de `offhandWeaponInvId`/`isDualWield`) vs 5 clés PJ ;
//  - `mapActions.reload` : booléen nu (`sel.mapAction === 'reload'`) — PNJ n'envoie **ni arme ni
//    munition**, alors que le PJ envoie `{ weapon_inv_id, ammo_item_id }` ou `false`. Le rechargement
//    PNJ n'est pas configuré côté client (pas de `reloadValid` MJ — cf. PLAN §17.10 pt 5) ;
//  - `quick: { ...sel.decl.quick }` (PNJ, spread) vs 3 champs explicites (PJ) — un 4ᵉ champ `quick`
//    futur partirait côté PNJ, pas PJ.
export function buildGmDeclarePayload(sel) {
  const meleeCaC = sel.chargeSelection?.targetTokenId
    ? [{
        targetTokenId: sel.chargeSelection.targetTokenId,
        weaponInvId: sel.weaponInvIdForMelee,
        naturalWeaponCharMutationId: sel.naturalWeaponIdForMelee,
      }]
    : buildMeleeEntries({
        targets:                 sel.meleeTargets,
        effectiveMeleeCount:     sel.effectiveMeleeCount,
        weaponInvId:             sel.weaponInvIdForMelee,
        naturalWeaponId:         sel.naturalWeaponIdForMelee,
        effectiveDualWieldMelee: sel.effectiveDualWieldMelee,
        offhandWeaponId:         sel.meleeOffhandWeapon?.inv_id,
      })
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
      // D7 : « Recharger » remplace le Tir — jamais les deux dans le même payload (garde ci-dessous).
      // Zone d'effet + forme normale + neutralisation : `buildAttackEntries` (cœur commun PJ/MJ).
      // Divergences PNJ : `weapon.inv_id` ; offhand par `inv_id` ; cibles dans `assaultTargets` ;
      // bonus par défaut `0` (`emptyBonus`).
      attack: sel.weapon && (sel.assaultTargets.length > 0 || sel.aoeDirection != null) && sel.mapAction !== 'reload'
        ? buildAttackEntries({
            aoeDirection:          sel.aoeDirection,
            weaponInvId:           sel.weapon.inv_id,
            targets:              sel.assaultTargets,
            effectiveAssaultCount: sel.effectiveAssaultCount,
            isDualWield:           sel.isDualWield,
            hasTwoWeapons:         sel.hasTwoWeapons,
            sameFirMode:           sel.sameFirMode,
            offhandWeaponId:       sel.weaponMg?.inv_id,
            currentVariant:        sel.currentVariant,
            dualWieldBonusComp:    sel.dualWieldBonusComp,
            aimTranches:           sel.aimTranches,
            aimedLocation:         sel.aimedLocation,
            emptyBonus:            0,
          })
        : null,
      melee:  meleeCaC.length > 0 ? meleeCaC : null,
      reload: sel.mapAction === 'reload',
    },
    quick: { ...sel.decl.quick },
  }
}

// --- Cœur commun des entrées attack[] (PJ + MJ) --------------------------------------------------
// Extrait verbatim des branches `attack:` de buildHumanDeclarePayload / buildGmDeclarePayload
// (`docs/PLANS/PLAN_RW_DECLARE_DERIVATION.md` Étape A). Retourne toujours un array (jamais `null` —
// le wrapper porte le gate « y a-t-il une attaque ? »), potentiellement vide (`targets` vide + pas
// de zone → `[]`, iso-comportement du `.slice().map()` d'origine).
//
// @param {object}        p
// @param {number|null}   p.aoeDirection          direction de zone en degrés, ou null (cible unique)
// @param {string|null}   p.weaponInvId           arme de tir — `assaultWeaponId` (PJ) | `weapon.inv_id` (MJ)
// @param {string[]}      p.targets               `assaultPendingTokenIds` (PJ) | `assaultTargets` (MJ)
// @param {number}        p.effectiveAssaultCount nombre de tirs de la série (Tir Multi)
// @param {boolean}       p.isDualWield
// @param {boolean}       p.hasTwoWeapons
// @param {boolean}       p.sameFirMode
// @param {string|undefined} p.offhandWeaponId    id main non directrice — `weaponMg?.id` (PJ) | `weaponMg?.inv_id` (MJ)
// @param {object|null}   p.currentVariant        `{ bulletCount, bonusComp, bonusDmg }` | null
// @param {number}        p.dualWieldBonusComp
// @param {number}        p.aimTranches
// @param {string|null}   p.aimedLocation
// @param {null|0}        p.emptyBonus            valeur de bulletCount/fireModeBonus* sans variant — `null` (PJ) | `0` (MJ)
// @returns {object[]}
export function buildAttackEntries({
  aoeDirection, weaponInvId, targets, effectiveAssaultCount,
  isDualWield, hasTwoWeapons, sameFirMode, offhandWeaponId,
  currentVariant, dualWieldBonusComp, aimTranches, aimedLocation, emptyBonus,
}) {
  // Zone d'effet (docs/PLANS/PLAN_AOE.md §8 étape 9 ; PLAN_ARMES_SPECIALES.md §1.4) : une seule
  // entrée, sans cible, avec `aoe.direction`. Dual-wield / Tir visé neutralisés **explicitement**
  // (pas juste laissés à la valeur courante) : la reducer n'efface pas ces champs en entrant en
  // mode zone (seuls aoeDirection/targets le sont), et une action de zone n'a pas de cible unique
  // ni de deux armes ni de localisation visée (RAW) — les envoyer tels quels enverrait un payload
  // contradictoire au serveur.
  if (aoeDirection != null) {
    return [{
      weaponInvId,
      offhandWeaponInvId: null,
      targetTokenId:      null,
      aoe:                { direction: aoeDirection },
      bulletCount:        null,
      fireModeBonusComp:  emptyBonus,
      fireModeBonusDmg:   emptyBonus,
      isDualWield:        false,
      dualWieldBonusComp: 0,
      aimTranches:        0,
      aimedLocation:      null,
    }]
  }

  // Main non directrice (COM29) — seulement si le dual-wield est effectivement actif.
  const dualWieldActive = isDualWield && hasTwoWeapons && sameFirMode
  return targets.slice(0, effectiveAssaultCount).map(targetTokenId => ({
    weaponInvId,
    offhandWeaponInvId: dualWieldActive ? (offhandWeaponId ?? null) : null,
    targetTokenId,
    bulletCount:        currentVariant?.bulletCount ?? null,
    fireModeBonusComp:  currentVariant ? (currentVariant.bonusComp + dualWieldBonusComp) : emptyBonus,
    fireModeBonusDmg:   currentVariant?.bonusDmg ?? emptyBonus,
    isDualWield:        dualWieldActive,
    dualWieldBonusComp: dualWieldBonusComp,
    aimTranches:        aimTranches,
    aimedLocation:      aimedLocation,
  }))
}

// --- Cœur commun des entrées melee[] hors Charge (PJ + MJ) ---------------------------------------
// Extrait verbatim de la branche `.map()` non-Charge des deux fonctions. L'entrée Charge reste
// inline dans chaque wrapper (formes divergentes PJ 5 clés / MJ 3 clés, testées). Retourne toujours
// un array (le wrapper porte le gate).
//
// @param {object}           p
// @param {string[]}         p.targets                 `meleePendingTokenIds` (PJ) | `meleeTargets` (MJ)
// @param {number}           p.effectiveMeleeCount     nombre d'attaques (multi-CaC ; Charge force 1 en amont)
// @param {string|null}      p.weaponInvId             `effectiveMeleeWeaponId` (PJ) | `weaponInvIdForMelee` (MJ)
// @param {string|null}      p.naturalWeaponId         arme naturelle (mutation) — exclusive avec `weaponInvId`
// @param {boolean}          p.effectiveDualWieldMelee Combat à deux armes de contact (COM24)
// @param {string|undefined} p.offhandWeaponId         `meleeOffhandWeapon?.id` (PJ) | `?.inv_id` (MJ)
// @returns {object[]}
export function buildMeleeEntries({
  targets, effectiveMeleeCount, weaponInvId, naturalWeaponId,
  effectiveDualWieldMelee, offhandWeaponId,
}) {
  return targets.slice(0, effectiveMeleeCount).map(targetTokenId => ({
    targetTokenId,
    weaponInvId,
    naturalWeaponCharMutationId: naturalWeaponId,
    // Combat à deux armes (COM24) — même patron que offhandWeaponInvId/isDualWield du Tir.
    offhandWeaponInvId: effectiveDualWieldMelee ? (offhandWeaponId ?? null) : null,
    isDualWield:        effectiveDualWieldMelee,
  }))
}

// --- Drone — cœur pur de useDroneDeclare#buildMapActions ------------------------------------------
// Retourne { stateFireMode, mapActions } ; les fenêtres l'enveloppent dans state:{position:'standing',
// weapon:'holstered', fire_mode: stateFireMode, cover:'exposed', vitesse:'normal'}. Un drone est hors
// scope Tir Multi (D6) → attack toujours de longueur 1.
// CaC ⟺ `ref_category === 'Arme de contact'` — même autorité que l'exo (buildExoMapActions) et le
// serveur (resolveDroneAssaultAction). `fire_mode` NE classe PAS Tir/CaC : `CC`/`RC`/`RL` sont des
// modes de tir (shared/fireModes.js), une arme de contact n'a aucun fire_mode. Changement de règle
// assumé vs le littéral d'origine `handleDeclare` — ticket DRONE-CC-MELEE-MISCLASS, tests golden
// master mis à jour en conséquence.
export function buildDroneMapActions(sel) {
  const hasAttack = !!sel.selectedDroneWeaponId && !!sel.assaultTargetId
  const weapon    = hasAttack ? sel.droneWeapons.find(w => w.id === sel.selectedDroneWeaponId) : null
  const isCaC         = weapon?.ref_category === 'Arme de contact'
  const explicitFm    = weapon?.fire_mode
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
