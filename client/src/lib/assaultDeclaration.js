// client/src/lib/assaultDeclaration.js
//
// Sous-état de sélection **Tir** des fenêtres de déclaration de combat (PLAN_RW_DECLARE_DESIGN M0.4).
// Reducer pur + dérivés purs, testables `node --test` — ce sous-état était recopié à ~90 % entre
// CombatActionWindow (PJ) et CombatGmDeclareWindow (MJ) : mêmes champs, mêmes transitions, mêmes
// calculs. Extraction en point unique (option C du plan : pas de paramètre `mode`).
//
// Le hook `useAssaultDeclaration` enveloppe ce reducer (useReducer + `setTarget` self-terminant).
// Les sélecteurs métier lourds restent où ils sont, composés par la fenêtre avec un bag de contexte :
//   - shared/combatSections.js         → computeFireVariant
//   - shared/combatExclusiveActions.js → getAimIneligibilityReasons / getMultiShotIneligibilityReasons
//   - client/src/lib/declareChecks.js  → assaultCheck (validité + raison de blocage)

export const ASSAULT_DECLARATION_INITIAL = {
  weaponId:      null,   // arme de tir choisie dans la liste (D5) ; null = arme primaire résolue par slots
  targets:       [],     // [tokenId, tokenId?, tokenId?] — 1 entrée par tir de la série (Tir Multi)
  count:         1,      // 1|2|3 — nombre de tirs de la série (Tir Multi, Coup par Coup seulement)
  bulletCount:   null,   // number|null — balles par tir (répétition / rafale)
  variantAB:     'A',    // 'A'|'B' — variante de rafale
  isDualWield:   false,  // Tir à deux armes (COM24)
  aimTranches:   0,      // tranches de Tir visé
  aimedLocation: null,   // localisation précise visée (silhouette) | null
}

// Nombre de tirs effectifs : la série multiple n'existe qu'en Coup par Coup (RC/RL forcent 1).
export function effectiveAssaultCount(state, currentFireMode) {
  return currentFireMode === 'CC' ? state.count : 1
}

// Cibles renseignées dans la série effective.
export function assaultTargetsFilled(state, currentFireMode) {
  return state.targets.slice(0, effectiveAssaultCount(state, currentFireMode)).filter(Boolean).length
}

// Série de cibles complète ?
export function assaultTargetsComplete(state, currentFireMode) {
  const n = effectiveAssaultCount(state, currentFireMode)
  return n > 0 && state.targets.slice(0, n).filter(Boolean).length >= n
}

// Redimensionne le tableau de cibles à N en remplissant les nouveaux slots avec la 1re cible posée
// (défaut « toute la série sur la même cible » — miroir de l'ancien onAssaultCountChange PJ/MJ).
function resizeTargets(targets, n) {
  const truncated = targets.slice(0, n)
  if (truncated.length >= n) return truncated
  const fill = truncated.find(Boolean) ?? null
  return Array.from({ length: n }, (_, i) => truncated[i] ?? fill)
}

// Pose une cible : tant qu'aucune cible n'est posée, le 1er choix remplit toute la série
// (`seriesLength`) ; sinon seul `index` est touché. Miroir de l'ancien callback onEnterTargetMode.
// Exporté pour que le hook puisse recalculer le résultat sans re-dispatcher (setTarget self-terminant).
export function assaultPlaceTarget(targets, index, tokenId, seriesLength) {
  if (!targets.some(Boolean)) return Array(Math.max(1, seriesLength)).fill(tokenId)
  const next = [...targets]
  next[index] = tokenId
  return next
}

/**
 * @param {typeof ASSAULT_DECLARATION_INITIAL} state
 * @param {{ type: string, [k: string]: any }} action
 */
export function assaultDeclarationReducer(state, action) {
  switch (action.type) {
    // Choisir (ou changer) l'arme = repartir d'une config vierge — P8 / PO-M4-e : changer d'arme
    // resette le détail col. 2 (« on ne parcourt pas les armes sans perdre sa config en cours »).
    // ⚠ Changement de comportement pour le MJ (qui ne resettait pas isDualWield au changement) —
    // volontaire, plus sûr, couvert par un test dédié.
    case 'SELECT_WEAPON':
      return { ...ASSAULT_DECLARATION_INITIAL, weaponId: action.weaponId }

    case 'SET_COUNT':
      return { ...state, count: action.count, targets: resizeTargets(state.targets, action.count) }

    case 'SET_BULLET_COUNT':
      return { ...state, bulletCount: action.value }

    case 'SET_VARIANT_AB':
      return { ...state, variantAB: action.value }

    case 'SET_DUAL_WIELD':
      return { ...state, isDualWield: action.value }

    case 'SET_AIM_TRANCHES':
      return { ...state, aimTranches: action.value }

    case 'SET_AIMED_LOCATION':
      return { ...state, aimedLocation: action.value }

    case 'SET_TARGET':
      return { ...state, targets: assaultPlaceTarget(state.targets, action.index, action.tokenId, action.seriesLength) }

    // Cible unique imposée (clic direct sur un token adverse, sans passer par la liste d'armes) —
    // miroir exact de l'ancien `setAssaultPendingTokenIds([tid])`.
    case 'SET_SOLE_TARGET':
      return { ...state, targets: [action.tokenId] }

    // Efface le sous-état Tir : nouveau tour, changement de slot actif, ou sélection d'une autre
    // action de combat (CaC) — l'exclusivité Tir ⊕ CaC est portée par la fenêtre.
    case 'CLEAR':
      return { ...ASSAULT_DECLARATION_INITIAL }

    default:
      return state
  }
}
