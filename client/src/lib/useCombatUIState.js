import { useState, useCallback, useRef } from 'react'

export function useCombatUIState() {
  const [combatMoveMode,       setCombatMoveMode]       = useState(null)
  const [pendingMoveSelection, setPendingMoveSelection] = useState(null)
  const [combatTargetMode,     setCombatTargetMode]     = useState(null)
  const [combatAoeTargetMode,  setCombatAoeTargetMode]  = useState(null)
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
  // (PJ/PNJ/drone déclarant, exactement comme combatMoveMode/combatTargetMode) — le handler async
  // lui-même est enregistré via ref (lu seulement dans un handler, pas besoin de re-render, mêmes
  // patrons que les refs miroir de Canvas3D.jsx).
  //
  // `ambientAttackArmed` reflète en state *si* un handler est enregistré (une fenêtre de déclaration
  // combat l'a armé). Nécessaire car `handleAmbientTokenClick` est un dispatcher `useCallback` stable,
  // donc toujours vérité : le passer inconditionnellement à Canvas3D faisait croire à ce dernier que
  // le clic-attaque ambiant était armé en permanence (`ambientMapClickActive`), gelant toute
  // interaction token hors combat (sélection, drag&drop, menu radial). SessionPage ne passe la prop
  // `onAmbientTokenClick` que si `ambientAttackArmed` — même convention "null quand inactif" que
  // moveTarget / losMode.
  const ambientAttackHandlerRef = useRef(null)
  const [ambientAttackArmed, setAmbientAttackArmed] = useState(false)
  const registerAmbientAttackHandler = useCallback((fn) => {
    ambientAttackHandlerRef.current = fn
    setAmbientAttackArmed(!!fn)
  }, [])
  const handleAmbientTokenClick = useCallback((token, screenX, screenY) => {
    ambientAttackHandlerRef.current?.(token, screenX, screenY)
  }, [])

  // combatCameraCenter intentionnellement NON reset — caméra reste sur la dernière position
  const handleModeReset = useCallback(() => {
    setCombatMoveMode(null); setCombatTargetMode(null); setPendingMoveSelection(null)
    setCombatAoeTargetMode(null)
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

  // Zone d'effet fusil à pompe (PLAN_AOE.md §8 étape 9) — même patron que handleEnterTargetMode
  // ci-dessus (survol continu → clic fige un candidat → Valider/Changer explicites), pas un
  // clic-glisser-relâcher (essayé puis abandonné, retour Saar 2026-09-02 : "pas naturel de maintenir
  // un clic pour sélectionner une cible"). `pendingDirectionDeg` est le pendant continu de
  // `pendingTargetId` — mis à jour en survol tant qu'aucun clic n'a encore figé de valeur, gelé dès
  // qu'un clic en pose une (Canvas3D n'écrit alors plus dedans, cf. handlePointerMove). `weaponRange`
  // (ref_range brut) et `weaponAoeProfile` (ref_equipment.aoe_profile : { shape, angleDeg, mechanic })
  // traversent jusqu'à Canvas3D pour l'aperçu (aoePreviewShape.js), en lecture seule — `shape` choisit
  // couloir ('ray', fusil à pompe) vs secteur ('cone', lance-flammes).
  // armSeq : identifiant unique de CET armement (incrémenté à chaque appel), distinct de
  // pendingDirectionDeg — permet à Canvas3D de détecter un réarmement réel (clic "Viser une zone" ou
  // "Changer" post-Valider) et de le distinguer d'une simple mise à jour de pendingDirectionDeg sur le
  // même armement (fige/dégèle). Sert de garde-fou : au réarmement, le raycaster R3F peut encore
  // pointer vers la dernière position de survol connue AVANT l'ouverture du panneau (le clic sur le
  // bouton a lieu hors du canvas) — sans ce garde-fou l'aperçu apparaît instantanément figé sur cette
  // position obsolète au lieu d'attendre un vrai mouvement de souris sur la carte (bug rapporté Saar
  // 2026-09-02 : "l'AOE est posée dès le clic sur CIBLE").
  const aoeArmSeqRef = useRef(0)
  const handleEnterAoeTargetMode = useCallback((tokenId, tokenPos, weaponRange, weaponAoeProfile, onDirectionSelected, onCancel) => {
    const wrappedSelected = (directionDeg) => {
      onDirectionSelected(directionDeg)
      setCombatAoeTargetMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setCombatAoeTargetMode(null)
    }
    aoeArmSeqRef.current += 1
    setCombatAoeTargetMode({
      tokenId, weaponRange, weaponAoeProfile, pendingDirectionDeg: null, armSeq: aoeArmSeqRef.current,
      onDirectionSelected: wrappedSelected,
      onCancel: wrappedCancel,
      // deg === null repasse en survol libre (bouton "Changer") — jamais un guard self-cible ici
      // (contrairement à onPendingTarget) : une direction n'a pas de notion de "viser soi-même" à
      // exclure au-delà de ce que Canvas3D filtre déjà (atan2(0,0) sur le tireur lui-même).
      onPendingDirection: (deg) => {
        setCombatAoeTargetMode(prev => prev ? { ...prev, pendingDirectionDeg: deg } : null)
      },
    })
    setCombatCameraCenter(tokenPos)
  }, [])

  const handleValidateAoeDirection = useCallback(() => {
    if (combatAoeTargetMode?.pendingDirectionDeg == null) return
    combatAoeTargetMode.onDirectionSelected(combatAoeTargetMode.pendingDirectionDeg)
  }, [combatAoeTargetMode])

  return {
    combatMoveMode,
    pendingMoveSelection,
    combatTargetMode,
    combatAoeTargetMode,
    targetRecap,
    combatCameraCenter,
    handleModeReset,
    handleEnterMoveMode,
    handleValidateMove,
    handleCancelPendingMove,
    handleEnterTargetMode,
    handleValidateTarget,
    handleEnterAoeTargetMode,
    handleValidateAoeDirection,
    registerAmbientAttackHandler,
    handleAmbientTokenClick,
    ambientAttackArmed,
    showTargetRecap,
  }
}
