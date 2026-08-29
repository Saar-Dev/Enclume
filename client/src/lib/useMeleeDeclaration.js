// client/src/lib/useMeleeDeclaration.js
//
// Hook de domaine du sous-état de sélection Corps à corps (PLAN_RW_DECLARE_DESIGN M0.4). Enveloppe
// le reducer pur `meleeDeclaration.js`. Monté à l'identique par CombatActionWindow (PJ) et
// CombatGmDeclareWindow (MJ). Ne se reset pas seul : la fenêtre appelle `clear()` dans son effet de
// reset [tokenId, has_announced].

import { useReducer, useCallback, useRef, useEffect } from 'react'
import {
  MELEE_DECLARATION_INITIAL,
  meleeDeclarationReducer,
  meleeTargetsFilled,
} from './meleeDeclaration.js'

export function useMeleeDeclaration() {
  const [state, dispatch] = useReducer(meleeDeclarationReducer, MELEE_DECLARATION_INITIAL)

  // Miroir du state pour les callbacks async (chaîne MJ selectNext qui pose target[0] puis, après
  // setTimeout(0), target[1]…). Resync par effet ; pré-avancé dans les mutations de cible.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const selectWeapon  = useCallback((weaponId) => dispatch({ type: 'SELECT_WEAPON', weaponId }), [])
  const selectNatural = useCallback((id) => dispatch({ type: 'SELECT_NATURAL', id }), [])
  const setCount      = useCallback((count) => dispatch({ type: 'SET_COUNT', count }), [])
  const setDualWield  = useCallback((value) => dispatch({ type: 'SET_DUAL_WIELD', value }), [])
  const clear         = useCallback(() => dispatch({ type: 'CLEAR' }), [])
  const resetTargets  = useCallback(() => {
    stateRef.current = { ...stateRef.current, targets: [] }
    dispatch({ type: 'RESET_TARGETS' })
  }, [])
  const setSoleTarget = useCallback((tokenId) => {
    stateRef.current = { ...stateRef.current, targets: [tokenId] }
    dispatch({ type: 'SET_SOLE_TARGET', tokenId })
  }, [])

  // Pose la cible du slot `index` et retourne si la série (`seriesLength`) est désormais complète —
  // pour la chaîne récursive MJ multi-cible (n'a plus besoin de connaître N ni de lire un state périmé).
  const setTarget = useCallback((index, tokenId, seriesLength) => {
    const next = [...stateRef.current.targets]
    next[index] = tokenId
    stateRef.current = { ...stateRef.current, targets: next }
    dispatch({ type: 'SET_TARGET', index, tokenId })
    return next.slice(0, seriesLength).filter(Boolean).length >= seriesLength
  }, [])

  return {
    state,
    dispatch,
    selectWeapon, selectNatural, setCount, setDualWield, clear,
    resetTargets, setSoleTarget, setTarget,
    targetsFilled: () => meleeTargetsFilled(state),
  }
}
