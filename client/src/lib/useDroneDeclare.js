import { useState, useEffect, useCallback } from 'react'
import api from './api.js'

export function useDroneDeclare({ charId, tokenId, allures, onEnterMoveMode, onEnterTargetMode }) {
  const [droneWeapons,          setDroneWeapons]          = useState([])
  const [selectedDroneWeaponId, setSelectedDroneWeaponId] = useState(null)
  const [assaultTargetId,       setAssaultTargetId]       = useState(null)
  const [pendingMove,           setPendingMove]           = useState(null)
  const [hasPassed,             setHasPassed]             = useState(false)
  const [isSelectingOnMap,      setIsSelectingOnMap]      = useState(false)

  // Fetch armes drone quand le personnage change (cancelled flag = convention projet)
  useEffect(() => {
    if (!charId) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/drone/weapons`)
      .then(r => {
        if (cancelled) return
        const weapons = r.data.weapons ?? []
        setDroneWeapons(weapons)
        if (weapons.length > 0) setSelectedDroneWeaponId(weapons[0].id)
      })
      .catch(() => { if (!cancelled) setDroneWeapons([]) })
    return () => { cancelled = true }
  }, [charId])

  // Reset état déclaration quand le slot actif change (séparé du fetch, dépendances orthogonales)
  useEffect(() => {
    setSelectedDroneWeaponId(null)
    setAssaultTargetId(null)
    setPendingMove(null)
    setHasPassed(false)
    setDroneWeapons([])
    setIsSelectingOnMap(false)
  }, [tokenId])

  const canDeclare = hasPassed || !!pendingMove || (!!selectedDroneWeaponId && !!assaultTargetId)

  const handleStartMove = useCallback((activeToken) => {
    if (!onEnterMoveMode || !tokenId || !activeToken || !allures) return
    setIsSelectingOnMap(true)
    onEnterMoveMode(
      allures, tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (sel) => { setPendingMove(sel); setIsSelectingOnMap(false) },
      () => { setPendingMove(null); setIsSelectingOnMap(false) },
    )
  }, [allures, tokenId, onEnterMoveMode])

  const handleChooseTarget = useCallback((activeToken) => {
    if (!onEnterTargetMode || !tokenId || !activeToken) return
    setAssaultTargetId(null)
    setIsSelectingOnMap(true)
    onEnterTargetMode(
      tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => { setAssaultTargetId(targetId); setIsSelectingOnMap(false) },
      () => { setIsSelectingOnMap(false) },
      'ranged',
    )
  }, [tokenId, onEnterTargetMode])

  const clearPendingMove = useCallback(() => setPendingMove(null), [])

  // Construit le fragment mapActions pour le payload COMBAT_ACTION_DECLARE
  const buildMapActions = useCallback(() => {
    const hasAttack = !!selectedDroneWeaponId && !!assaultTargetId
    const weapon    = hasAttack ? droneWeapons.find(w => w.id === selectedDroneWeaponId) : null
    const explicitFm    = weapon?.fire_mode
    const isCaC         = explicitFm ? explicitFm === 'cc' : !weapon?.ref_fire_mode
    const stateFireMode = hasAttack ? (isCaC ? 'cc' : (explicitFm ?? 'rc').toLowerCase()) : 'cc'
    const attackPayload = hasAttack
      ? (isCaC
          ? { melee: [{ droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId }] }
          : { attack: { droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId } })
      : {}
    return {
      stateFireMode,
      mapActions: {
        move: pendingMove
          ? { targetPosX: pendingMove.targetPosX, targetPosY: pendingMove.targetPosY,
              targetPosZ: pendingMove.targetPosZ ?? 0, ini_mod: pendingMove.ini_mod ?? 0,
              action_key: pendingMove.action_key }
          : null,
        ...attackPayload,
      },
    }
  }, [selectedDroneWeaponId, assaultTargetId, droneWeapons, pendingMove])

  return {
    droneWeapons, selectedDroneWeaponId, setSelectedDroneWeaponId,
    assaultTargetId, pendingMove, hasPassed, setHasPassed, isSelectingOnMap,
    canDeclare, buildMapActions, clearPendingMove,
    handleStartMove, handleChooseTarget,
  }
}
