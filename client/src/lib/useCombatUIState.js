import { useState, useCallback, useRef } from 'react'

export function useCombatUIState() {
  const [combatMoveMode,       setCombatMoveMode]       = useState(null)
  const [pendingMoveSelection, setPendingMoveSelection] = useState(null)
  const [combatTargetMode,     setCombatTargetMode]     = useState(null)
  const [combatCameraCenter,   setCombatCameraCenter]   = useState(null)

  // Recap flottant temporaire (LOS/distance/portée) au clic direct sur un token — texte pur, aucune
  // fenêtre, 2s (Saar 2026-07-31, répété explicitement) — cycle de vie totalement indépendant de
  // combatTargetMode (jamais lié à une validation/annulation), déclenché directement par
  // useCombatClickAttack.js.
  const [targetRecap, setTargetRecap] = useState(null)
  const targetRecapTimerRef = useRef(null)
  const showTargetRecap = useCallback((recap, screenPos) => {
    if (targetRecapTimerRef.current) clearTimeout(targetRecapTimerRef.current)
    setTargetRecap({ ...recap, screenPos })
    targetRecapTimerRef.current = setTimeout(() => setTargetRecap(null), 2000)
  }, [])
  const clearTargetRecap = useCallback(() => {
    if (targetRecapTimerRef.current) clearTimeout(targetRecapTimerRef.current)
    targetRecapTimerRef.current = null
    setTargetRecap(null)
  }, [])

  // Clic direct sur un token adverse (sans tuile Attaque/CaC préalable) — décision Saar 2026-07-31
  // (docs/BUGIDENTIFIE.md COMBAT-CLICK-AUTOSOLVE, scope réduit). Un seul appelant "actif" à la fois
  // (PJ/PNJ/drone déclarant, exactement comme combatMoveMode/combatTargetMode) — enregistré via ref,
  // jamais un state (pas de re-render nécessaire, mêmes patrons que les refs miroir de Canvas3D.jsx).
  const ambientAttackHandlerRef = useRef(null)
  const registerAmbientAttackHandler = useCallback((fn) => { ambientAttackHandlerRef.current = fn }, [])
  const handleAmbientTokenClick = useCallback((token, screenX, screenY) => {
    ambientAttackHandlerRef.current?.(token, screenX, screenY)
  }, [])

  // combatCameraCenter intentionnellement NON reset — caméra reste sur la dernière position
  const handleModeReset = useCallback(() => {
    setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
    clearTargetRecap()
  }, [clearTargetRecap])

  const handleEnterMoveMode = useCallback((allures, tokenId, tokenPos, onMoveSelected, onCancel) => {
    const wrappedSelected = (sel) => {
      onMoveSelected(sel)
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    setCombatMoveMode({
      tokenId, allures,
      onMoveSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingMove: (sel) => setPendingMoveSelection(sel),
    })
    setCombatCameraCenter(tokenPos)
  }, [])

  const handleValidateMove = useCallback(() => {
    if (!combatMoveMode || !pendingMoveSelection) return
    combatMoveMode.onMoveSelected(pendingMoveSelection)
  }, [combatMoveMode, pendingMoveSelection])

  const handleCancelPendingMove = useCallback(() => setPendingMoveSelection(null), [])

  // Flux tuile Attaque/CaC classique uniquement (le clic direct ne passe plus par ici, cf.
  // useCombatClickAttack.js — appelle onMeleeTarget/onAssaultTarget directement) : armé vide, la cible
  // est choisie dans un second clic séparé (onPendingTarget).
  const handleEnterTargetMode = useCallback((tokenId, tokenPos, onTargetSelected, onCancel, mode = 'ranged') => {
    const wrappedSelected = (targetTokenId) => {
      onTargetSelected(targetTokenId)
      setCombatTargetMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setCombatTargetMode(null)
    }
    setCombatTargetMode({
      tokenId, mode, pendingTargetId: null, pendingTargetScreenPos: null,
      onTargetSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingTarget: (id, screenX, screenY) => {
        if (id === tokenId) return  // guard self-targeting — P-R14-3
        setCombatTargetMode(prev => prev
          ? { ...prev, pendingTargetId: id,
              pendingTargetScreenPos: screenX != null ? { x: screenX, y: screenY } : null }
          : null)
      },
    })
    setCombatCameraCenter(tokenPos)
  }, [])

  const handleValidateTarget = useCallback(() => {
    if (!combatTargetMode?.pendingTargetId) return
    combatTargetMode.onTargetSelected(combatTargetMode.pendingTargetId)
  }, [combatTargetMode])

  return {
    combatMoveMode,
    pendingMoveSelection,
    combatTargetMode,
    targetRecap,
    combatCameraCenter,
    handleModeReset,
    handleEnterMoveMode,
    handleValidateMove,
    handleCancelPendingMove,
    handleEnterTargetMode,
    handleValidateTarget,
    registerAmbientAttackHandler,
    handleAmbientTokenClick,
    showTargetRecap,
  }
}
