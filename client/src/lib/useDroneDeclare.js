import { useState, useEffect, useCallback } from 'react'
import api from './api.js'
import { resolveWeaponRangeBand } from '../../../shared/combatRange.js'
import { useAutoMoveMode } from './useAutoMoveMode.js'
import { useCombatClickAttack } from './useCombatClickAttack.js'

export function useDroneDeclare({
  charId, tokenId, tokenPos, allures, onEnterMoveMode, onEnterTargetMode,
  moveHoverEnabled = false, combatMoveMode = null, pendingMoveSelection = null,
  battlemapId = null, registerAmbientAttackHandler = null, showTargetRecap = null,
}) {
  const [droneWeapons,          setDroneWeapons]          = useState([])
  const [selectedDroneWeaponId, setSelectedDroneWeaponId] = useState(null)
  const [assaultTargetId,       setAssaultTargetId]       = useState(null)
  const [pendingMove,           setPendingMove]           = useState(null)
  const [hasPassed,             setHasPassed]             = useState(false)
  // Uniquement le ciblage Attaque (picking explicite) — le déplacement est géré en ambiant par
  // useAutoMoveMode ci-dessous, jamais par ce flag (COMBAT-DEPLACEMENT-HOVER).
  const [isSelectingTarget,     setIsSelectingTarget]     = useState(false)

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
    setIsSelectingTarget(false)
  }, [tokenId])

  const canDeclare = hasPassed || !!pendingMove || (!!selectedDroneWeaponId && !!assaultTargetId)

  // Déplacement : plus de clic préalable — useAutoMoveMode maintient le survol/preview actif par
  // défaut tant qu'aucun ciblage Attaque n'est en cours (décision Saar, COMBAT-DEPLACEMENT-HOVER).
  const { rearm: rearmMove } = useAutoMoveMode({
    enabled: moveHoverEnabled && !isSelectingTarget,
    allures, tokenId, tokenPos, combatMoveMode,
    onEnterMoveMode,
    onMoveSelected: (sel) => setPendingMove(sel),
    onCancel: () => setPendingMove(null),
  })

  // Clic direct sur un token adverse (sans clic préalable sur "Cibler") — même hook que
  // CombatActionWindow (PJ)/CombatGmDeclareWindow (PNJ), cf. useCombatClickAttack.js. Mode CaC/Tir
  // dérivé du programme actuellement sélectionné (selectedDroneWeaponId, dropdown existant) — jamais
  // de la distance : un drone avec deux programmes installés (CaC+Tir) laisse le choix au joueur via
  // ce dropdown, pas une bascule automatique (décision Saar 2026-07-31, docs/BUGIDENTIFIE.md
  // COMBAT-CLICK-AUTOSOLVE) — contrairement au PJ/PNJ où la portée tranche.
  const resolveDroneClickAttackMode = useCallback((distanceM) => {
    const selectedWeapon = droneWeapons.find(w => w.id === selectedDroneWeaponId)
    if (!selectedWeapon) return null  // aucun programme sélectionné — rien à proposer
    const isCaC = selectedWeapon.fire_mode ? selectedWeapon.fire_mode === 'cc' : !selectedWeapon.ref_fire_mode
    return {
      mode: isCaC ? 'melee' : 'ranged',
      band: isCaC ? null : resolveWeaponRangeBand(distanceM, selectedWeapon.ref_range).band,
    }
  }, [droneWeapons, selectedDroneWeaponId])
  useCombatClickAttack({
    enabled: moveHoverEnabled && !isSelectingTarget,
    battlemapId,
    tokenId, tokenPos,
    moveDestination: pendingMove
      ? { pos_x: pendingMove.targetPosX, pos_y: pendingMove.targetPosY, pos_z: pendingMove.targetPosZ ?? 0 }
      : null,
    resolveMode: resolveDroneClickAttackMode,
    showTargetRecap,
    registerAmbientAttackHandler,
    onMeleeTarget:   (tid) => setAssaultTargetId(tid),
    onAssaultTarget: (tid) => setAssaultTargetId(tid),
  })

  const handleChooseTarget = useCallback((activeToken) => {
    if (!onEnterTargetMode || !tokenId || !activeToken) return
    setAssaultTargetId(null)
    setIsSelectingTarget(true)
    onEnterTargetMode(
      tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => { setAssaultTargetId(targetId); setIsSelectingTarget(false) },
      () => { setIsSelectingTarget(false) },
      'ranged',
    )
  }, [tokenId, onEnterTargetMode])

  const clearPendingMove = useCallback(() => setPendingMove(null), [])

  // COM-MOVEUI1 — même réarmement explicite que CombatActionWindow (PJ)/CombatGmDeclareWindow (PNJ),
  // exposé tel quel à la tuile "Déplacement" du drone (DroneDeclareSection onMoveToggle).
  const rearmDroneMove = useCallback(() => {
    if (pendingMove) setPendingMove(null)
    rearmMove()
  }, [pendingMove, rearmMove])

  // Construit le fragment mapActions pour le payload COMBAT_ACTION_DECLARE
  const buildMapActions = useCallback(() => {
    const hasAttack = !!selectedDroneWeaponId && !!assaultTargetId
    const weapon    = hasAttack ? droneWeapons.find(w => w.id === selectedDroneWeaponId) : null
    const explicitFm    = weapon?.fire_mode
    const isCaC         = explicitFm ? explicitFm === 'cc' : !weapon?.ref_fire_mode
    const stateFireMode = hasAttack ? (isCaC ? 'cc' : (explicitFm ?? 'rc').toLowerCase()) : 'cc'
    // mapActions.attack est toujours un array (docs/PLAN_TIRMULTI.md D1, contrat unique côté serveur)
    // — un drone reste hors scope Tir Multi (D6), donc toujours longueur 1 ici.
    const attackPayload = hasAttack
      ? (isCaC
          ? { melee: [{ droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId }] }
          : { attack: [{ droneWeaponInvId: selectedDroneWeaponId, targetTokenId: assaultTargetId }] })
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

  // Exposé tel quel aux appelants (nom stable) — combine ciblage explicite ET sélection de
  // déplacement en attente de validation, mêmes deux raisons qui masquaient la fenêtre avant
  // COMBAT-DEPLACEMENT-HOVER (seule la 2e ne vient plus d'un clic explicite).
  const hasPendingMove = combatMoveMode?.tokenId === tokenId && !!pendingMoveSelection
  const isSelectingOnMap = isSelectingTarget || hasPendingMove

  return {
    droneWeapons, selectedDroneWeaponId, setSelectedDroneWeaponId,
    assaultTargetId, pendingMove, hasPassed, setHasPassed, isSelectingOnMap,
    canDeclare, buildMapActions, clearPendingMove, rearmDroneMove,
    handleChooseTarget,
  }
}
