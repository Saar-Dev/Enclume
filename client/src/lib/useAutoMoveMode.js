import { useEffect, useRef } from 'react'

// Active automatiquement le mode déplacement combat (survol + preview de chemin), sans clic
// préalable sur une tuile "Déplacement" — décision Saar 2026-07-31 (docs/BUGIDENTIFIE.md
// COMBAT-DEPLACEMENT-HOVER). Point d'entrée unique partagé par CombatActionWindow (PJ),
// CombatGmDeclareWindow (PNJ) et useDroneDeclare (drone PJ/GM) — jamais dupliqué.
//
// `enabled` doit être faux tant qu'un autre mode exclusif utilise la carte (ciblage Attaque/CaC,
// Charge/Retraite — ces deux derniers gèrent leur propre entrée en mode déplacement avec des allures
// restreintes ; ce hook ne doit jamais les écraser). `combatMoveMode` (état partagé
// useCombatUIState) doit être passé tel quel : sa présence dans les dépendances permet de
// réactiver le survol par défaut après une validation ou une annulation (Échap), sans quoi le mode
// resterait éteint jusqu'au prochain changement d'allures/token.
export function useAutoMoveMode({ enabled, allures, tokenId, tokenPos, combatMoveMode, onEnterMoveMode, onMoveSelected, onCancel }) {
  const onMoveSelectedRef = useRef(onMoveSelected)
  onMoveSelectedRef.current = onMoveSelected
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!enabled || !allures || !tokenId || !onEnterMoveMode) return
    if (combatMoveMode) return // déjà actif (nous-même ou un mode explicite en cours) — ne pas écraser
    onEnterMoveMode(
      allures, tokenId, tokenPos,
      (sel) => onMoveSelectedRef.current(sel),
      () => onCancelRef.current(),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, allures, tokenId, tokenPos?.x, tokenPos?.z, onEnterMoveMode, combatMoveMode])

  // Désarmement (docs/BUGIDENTIFIE.md ALLURE-TURNGATE1) — ce hook savait s'armer mais jamais se
  // désarmer : dès que `enabled` redevenait faux (tour/phase terminé pour ce déclarant), le mode
  // restait affiché indéfiniment, le réarmement ci-dessus contredisant aussitôt tout nettoyage externe
  // (`handleModeReset`, useCombatUIState) tant que `enabled` restait vrai entre-temps. Ref miroir (même
  // patron que Canvas3D.jsx/useCombatClickAttack.js) : assignation directe en rendu, lue seulement dans
  // les nettoyages ci-dessous — garantit de lire l'état réel au moment du désarmement, jamais une
  // valeur capturée au dernier changement de `enabled`.
  const stateRef = useRef({})
  stateRef.current = { combatMoveMode, tokenId }

  const prevEnabledRef = useRef(enabled)
  useEffect(() => {
    if (prevEnabledRef.current && !enabled) {
      const { combatMoveMode: current, tokenId: ownTokenId } = stateRef.current
      if (current?.tokenId === ownTokenId) current.onCancel()
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  // Démontage du composant appelant (ex. CombatGmDeclareWindow, qui ne monte qu'en phase ANNONCE) —
  // filet indépendant de la transition `enabled` ci-dessus, pour le cas où le composant disparaît sans
  // jamais revoir `enabled` passer à faux dans un rendu.
  useEffect(() => () => {
    const { combatMoveMode: current, tokenId: ownTokenId } = stateRef.current
    if (current?.tokenId === ownTokenId) current.onCancel()
  }, [])
}
