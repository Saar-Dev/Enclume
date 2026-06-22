import { useState, useCallback } from 'react'

export function useCombatUIState() {
  const [combatMoveMode,       setCombatMoveMode]       = useState(null)
  const [pendingMoveSelection, setPendingMoveSelection] = useState(null)
  const [combatTargetMode,     setCombatTargetMode]     = useState(null)
  const [combatCameraCenter,   setCombatCameraCenter]   = useState(null)

  // combatCameraCenter intentionnellement NON reset — caméra reste sur la dernière position
  const handleModeReset = useCallback(() => {
    setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
  }, [])

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
      tokenId, mode, pendingTargetId: null,
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
    combatCameraCenter,
    handleModeReset,
    handleEnterMoveMode,
    handleValidateMove,
    handleCancelPendingMove,
    handleEnterTargetMode,
    handleValidateTarget,
  }
}
