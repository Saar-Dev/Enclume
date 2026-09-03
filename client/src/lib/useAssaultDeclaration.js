// client/src/lib/useAssaultDeclaration.js
//
// Hook de domaine du sous-état de sélection Tir (PLAN_RW_DECLARE_DESIGN M0.4). Enveloppe le reducer
// pur `assaultDeclaration.js` (useReducer) et expose des mutations nommées + un `setTarget`
// self-terminant (retourne « série complète ? ») pour que les callbacks async — onEnterTargetMode,
// chaîne récursive MJ multi-cible — n'aient pas à connaître N ni à lire un `state` de closure périmé.
//
// Monté à l'identique par CombatActionWindow (PJ) et CombatGmDeclareWindow (MJ). Le hook NE se
// reset PAS tout seul : la fenêtre appelle `clear()` dans son effet de reset [tokenId, has_announced].

import { useReducer, useCallback, useRef, useEffect } from 'react'
import {
  ASSAULT_DECLARATION_INITIAL,
  assaultDeclarationReducer,
  assaultPlaceTarget,
  effectiveAssaultCount,
  assaultTargetsFilled,
  assaultTargetsComplete,
  assaultIsAoeMode,
} from './assaultDeclaration.js'

export function useAssaultDeclaration() {
  const [state, dispatch] = useReducer(assaultDeclarationReducer, ASSAULT_DECLARATION_INITIAL)

  // Miroir du state pour les callbacks async (onEnterTargetMode ; chaîne MJ multi-cible qui pose
  // target[0] puis, après un setTimeout(0), target[1]…). Resynchronisé par effet sur le state
  // committé ; pré-avancé dans setTarget / setSoleTarget pour couvrir une cascade synchrone.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const selectWeapon    = useCallback((weaponId) => dispatch({ type: 'SELECT_WEAPON', weaponId }), [])
  const clear           = useCallback(() => dispatch({ type: 'CLEAR' }), [])
  const setCount        = useCallback((count) => dispatch({ type: 'SET_COUNT', count }), [])
  const setBulletCount  = useCallback((value) => dispatch({ type: 'SET_BULLET_COUNT', value }), [])
  const setVariantAB    = useCallback((value) => dispatch({ type: 'SET_VARIANT_AB', value }), [])
  const setDualWield    = useCallback((value) => dispatch({ type: 'SET_DUAL_WIELD', value }), [])
  const setAimTranches  = useCallback((value) => dispatch({ type: 'SET_AIM_TRANCHES', value }), [])
  const setAimedLocation = useCallback((value) => dispatch({ type: 'SET_AIMED_LOCATION', value }), [])
  // Zone d'effet (docs/PLANS/PLAN_AOE.md §8 étape 9) — value en degrés déjà résolus par l'appelant
  // (capture du clic dans Canvas3D), ou null pour effacer. Vide targets côté reducer (exclusivité).
  const setAoeDirection = useCallback((value) => dispatch({ type: 'SET_AOE_DIRECTION', value }), [])
  // aoeDirection effacé dans le miroir : même exclusivité que le reducer (SET_SOLE_TARGET côté
  // assaultDeclaration.js), pour que stateRef reste fidèle au state qui sera réellement commité.
  const setSoleTarget   = useCallback((tokenId) => {
    stateRef.current = { ...stateRef.current, targets: [tokenId], aoeDirection: null }
    dispatch({ type: 'SET_SOLE_TARGET', tokenId })
  }, [])

  // Pose la cible du slot `index` et retourne si la série effective est désormais complète.
  const setTarget = useCallback((index, tokenId, currentFireMode) => {
    const cur = stateRef.current
    const seriesLength = effectiveAssaultCount(cur, currentFireMode)
    const nextTargets = assaultPlaceTarget(cur.targets, index, tokenId, seriesLength)
    stateRef.current = { ...cur, targets: nextTargets, aoeDirection: null }
    dispatch({ type: 'SET_TARGET', index, tokenId, seriesLength })
    return nextTargets.slice(0, seriesLength).filter(Boolean).length >= seriesLength
  }, [])

  return {
    state,
    dispatch,
    selectWeapon, clear, setCount, setBulletCount, setVariantAB, setDualWield,
    setAimTranches, setAimedLocation, setSoleTarget, setTarget, setAoeDirection,
    effectiveCount:  (currentFireMode) => effectiveAssaultCount(state, currentFireMode),
    targetsFilled:   (currentFireMode) => assaultTargetsFilled(state, currentFireMode),
    targetsComplete: (currentFireMode) => assaultTargetsComplete(state, currentFireMode),
    isAoeMode:       assaultIsAoeMode(state),
  }
}
