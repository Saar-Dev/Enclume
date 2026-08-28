import { useState, useEffect, useCallback } from 'react'
import api from './api.js'
import { resolveWeaponRangeBand } from '../../../shared/combatRange.js'
import { useCombatClickAttack } from './useCombatClickAttack.js'
import { buildExoMapActions } from './buildDeclarePayload.js'

// PLAN_EXOARMURE.md §16.4 — Tir/CaC exo, mirroir useDroneDeclare.js (même structure : fetch armes,
// ciblage par clic direct + tuile "Choisir une cible" explicite, buildMapActions). Le déplacement
// n'est PAS géré ici : CombatExoActionWindow.jsx le gère déjà en local via useAutoMoveMode (§16.3),
// ce hook ne couvre que l'armement — jamais de deuxième copie de l'état de déplacement.
//
// Une seule arme sélectionnable à la fois (pas de dual-wield hardpoint, aucun mod exo à ce jour,
// §16.4 contrat serveur) — contrairement au PJ humain, jamais de offhandWeaponInvId/isDualWield ici.
// Tir Multi et CaC-multiple sont bloqués côté serveur pour une exo (RAW « une seule Attaque/Tour »,
// REGLEARMURE.md:206-207) — mapActions.attack/melee restent donc toujours de longueur 1.
export function useExoDeclare({
  charId, tokenId, tokenPos, enabled, moveSelection,
  onEnterTargetMode, battlemapId, registerAmbientAttackHandler, showTargetRecap,
}) {
  const [exoWeapons,          setExoWeapons]          = useState([])
  const [selectedExoWeaponId, setSelectedExoWeaponId]  = useState(null)
  const [assaultTargetId,     setAssaultTargetId]      = useState(null)
  const [isSelectingTarget,   setIsSelectingTarget]    = useState(false)

  // Fetch armes exo quand le personnage change — GET /:characterId/exo/weapons (déjà existant, Lot C).
  useEffect(() => {
    if (!charId) return
    let cancelled = false
    api.get(`/char-sheet/${charId}/exo/weapons`)
      .then(r => { if (!cancelled) setExoWeapons(r.data.weapons ?? []) })
      .catch(e => {
        if (cancelled) return
        console.error('[useExoDeclare] erreur fetch armes exo :', e)
        setExoWeapons([])
      })
    return () => { cancelled = true }
  }, [charId])

  // Reset état déclaration quand le slot actif change (même discipline que useDroneDeclare).
  useEffect(() => {
    setSelectedExoWeaponId(null)
    setAssaultTargetId(null)
    setExoWeapons([])
    setIsSelectingTarget(false)
  }, [tokenId])

  // category === 'Arme de contact' est l'autorité serveur pour CaC (socketCombatExo.js,
  // resolveExoMeleeAction) — jamais déduit de fire_mode nul (coïncidence côté catalogue actuel,
  // pas la règle). Mirroir exact du champ que le serveur vérifie.
  const resolveExoClickAttackMode = useCallback((distanceM) => {
    const weapon = exoWeapons.find(w => w.id === selectedExoWeaponId)
    if (!weapon) return null
    const isCaC = weapon.ref_category === 'Arme de contact'
    return {
      mode: isCaC ? 'melee' : 'ranged',
      band: isCaC ? null : resolveWeaponRangeBand(distanceM, weapon.ref_range).band,
    }
  }, [exoWeapons, selectedExoWeaponId])

  useCombatClickAttack({
    enabled: enabled && !isSelectingTarget,
    battlemapId,
    tokenId, tokenPos,
    moveDestination: moveSelection
      ? { pos_x: moveSelection.targetPosX, pos_y: moveSelection.targetPosY, pos_z: moveSelection.targetPosZ ?? 0 }
      : null,
    resolveMode: resolveExoClickAttackMode,
    showTargetRecap,
    registerAmbientAttackHandler,
    onMeleeTarget:   (tid) => setAssaultTargetId(tid),
    onAssaultTarget: (tid) => setAssaultTargetId(tid),
  })

  const handleChooseTarget = useCallback((activeToken) => {
    if (!onEnterTargetMode || !tokenId || !activeToken) return
    setAssaultTargetId(null)
    setIsSelectingTarget(true)
    // Mode dérivé de l'arme réellement sélectionnée — jamais 'ranged' en dur (le seul effet de ce
    // paramètre est la légende flottante "Corps à corps" vs "Assaut" affichée pendant la sélection,
    // CombatOverlay.jsx#combatTargetMode.mode). useDroneDeclare#handleChooseTarget applique la même
    // dérivation depuis 2026-08-27 (dette ROADMAP §5 close).
    const weapon = exoWeapons.find(w => w.id === selectedExoWeaponId)
    const targetMode = weapon?.ref_category === 'Arme de contact' ? 'melee' : 'ranged'
    onEnterTargetMode(
      tokenId,
      { x: activeToken.pos_x, z: activeToken.pos_y },
      (targetId) => { setAssaultTargetId(targetId); setIsSelectingTarget(false) },
      () => { setIsSelectingTarget(false) },
      targetMode,
    )
  }, [tokenId, onEnterTargetMode, exoWeapons, selectedExoWeaponId])

  const selectWeapon = useCallback((weaponId) => {
    setSelectedExoWeaponId(prev => (prev === weaponId ? null : weaponId))
    setAssaultTargetId(null)
  }, [])

  // Construit le fragment mapActions pour le payload COMBAT_ACTION_DECLARE — cœur pur testé
  // (client/src/lib/buildDeclarePayload.js, module 0 M0.3).
  const buildMapActions = useCallback(
    () => buildExoMapActions({ selectedExoWeaponId, assaultTargetId, exoWeapons }),
    [selectedExoWeaponId, assaultTargetId, exoWeapons],
  )

  return {
    exoWeapons, selectedExoWeaponId, selectWeapon,
    assaultTargetId, handleChooseTarget, buildMapActions,
    canDeclareAttack: !!selectedExoWeaponId && !!assaultTargetId,
    // Bug UI trouvé en jeu réel (Saar, 2026-08-27) : sélectionner une arme puis Déclarer sans cible
    // envoyait un payload sans attack/melee (buildMapActions() → {}) — la sélection se perdait
    // silencieusement, rien ne l'indiquait. Mirroir exact du gate déjà en place pour PJ
    // (CombatActionWindow.jsx#canDeclare) et drone (useDroneDeclare#canDeclare) : DÉCLARER se
    // désactive tant qu'une arme est choisie sans cible — jamais bloqué si rien n'est sélectionné du
    // tout (passer le Tour reste toujours permis, cf. exoActionWindow.normalHint).
    canDeclare: !selectedExoWeaponId || !!assaultTargetId,
  }
}
