import { useState, useEffect, useCallback } from 'react'
import api from './api.js'
import { resolveWeaponRangeBand } from '../../../shared/combatRange.js'
import { useAutoMoveMode } from './useAutoMoveMode.js'
import { useCombatClickAttack } from './useCombatClickAttack.js'
import { buildDroneMapActions } from './buildDeclarePayload.js'

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
    if (!selectedWeapon) return null  // aucune arme sélectionnée — rien à proposer
    // CaC ⟺ `ref_category === 'Arme de contact'` — même autorité que l'exo (useExoDeclare) et le
    // serveur (resolveDroneAssaultAction). `fire_mode` (`CC`/`RC`/`RL`) est un mode de tir, pas un
    // discriminant Tir/CaC. Ticket DRONE-CC-MELEE-MISCLASS.
    const isCaC = selectedWeapon.ref_category === 'Arme de contact'
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
    // Mode dérivé de l'arme sélectionnée (miroir resolveDroneClickAttackMode#isCaC) — jamais
    // 'ranged' en dur : seul effet du paramètre = la légende flottante "Corps à corps" vs "Assaut"
    // pendant la sélection (CombatOverlay.jsx#combatTargetMode.mode).
    const selectedWeapon = droneWeapons.find(w => w.id === selectedDroneWeaponId)
    const isCaC = selectedWeapon?.ref_category === 'Arme de contact'
    onEnterTargetMode(
      tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => { setAssaultTargetId(targetId); setIsSelectingTarget(false) },
      () => { setIsSelectingTarget(false) },
      isCaC ? 'melee' : 'ranged',
    )
  }, [tokenId, onEnterTargetMode, droneWeapons, selectedDroneWeaponId])

  const clearPendingMove = useCallback(() => setPendingMove(null), [])

  // COM-MOVEUI1 — même réarmement explicite que CombatActionWindow (PJ)/CombatGmDeclareWindow (PNJ),
  // exposé tel quel à la tuile "Déplacement" du drone (DroneDeclareSection onMoveToggle).
  const rearmDroneMove = useCallback(() => {
    if (pendingMove) setPendingMove(null)
    rearmMove()
  }, [pendingMove, rearmMove])

  // Construit le fragment mapActions pour le payload COMBAT_ACTION_DECLARE — cœur pur testé
  // (client/src/lib/buildDeclarePayload.js, module 0 M0.3).
  const buildMapActions = useCallback(
    () => buildDroneMapActions({ selectedDroneWeaponId, assaultTargetId, droneWeapons, pendingMove }),
    [selectedDroneWeaponId, assaultTargetId, droneWeapons, pendingMove],
  )

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
