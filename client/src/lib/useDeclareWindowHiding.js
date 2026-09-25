import { useState, useCallback } from 'react'

// Masquage des fenêtres d'action de la phase Annonce (Humain / Drone / Exo / MJ) pendant qu'une
// sélection de destination ou de cible utilise la carte. Autorité unique : les quatre fenêtres
// (CombatActionWindow, CombatExoActionWindow, CombatGmDeclareWindow + leur satellite d'état) appellent
// ce hook — plus aucune copie locale de la règle (harmonisation demandée par Saar, 2026-09-25).
//
// Une fenêtre est masquée quand l'état partagé de la carte (useCombatUIState) concerne un des tokens
// qu'elle pilote (`tokenIds` : son token, plus le drone télépiloté pour le pilote) :
//  - ciblage Attaque/CaC (`combatTargetMode`) ou visée de zone (`combatAoeTargetMode`) ;
//  - destination posée qui attend « Valider » (`pendingMoveSelection`) ;
//  - sélection de déplacement EXPLICITE : clic sur la tuile « Déplacement », Retraite, Charge
//    (`armExplicitMove`). Jamais le simple survol ambiant (COMBAT-DEPLACEMENT-HOVER) — sinon la fenêtre
//    resterait masquée en continu pendant tout le tour.
// Le clic direct sur un token (useCombatClickAttack) ne masque rien : décision Saar 2026-07-31.
//
// Sortie d'une sélection explicite : la validation ou l'annulation vident `combatMoveMode` (le bouton
// « Annuler » de la légende, CombatOverlay, reste toujours accessible même fenêtre masquée) — le
// marqueur explicite est lié à CET objet de mode, donc le survol ambiant qui se réarme ensuite ne
// masque plus rien.

export const EXPLICIT_MOVE_PENDING = 'pending'

const ownsMode = (mode, tokenIds) => !!mode && tokenIds.includes(mode.tokenId)

/** Cœur pur (testé) : la fenêtre doit-elle être masquée ? */
export function isDeclareWindowHidden({
  tokenIds, combatMoveMode, pendingMoveSelection, combatTargetMode, combatAoeTargetMode,
  explicitMove = null, holdHidden = false,
}) {
  const ids = (tokenIds ?? []).filter(Boolean)
  if (holdHidden) return true
  if (ownsMode(combatTargetMode, ids) || ownsMode(combatAoeTargetMode, ids)) return true
  if (!ownsMode(combatMoveMode, ids)) return false
  if (pendingMoveSelection) return true
  return explicitMove === EXPLICIT_MOVE_PENDING || explicitMove === combatMoveMode
}

/**
 * @param holdHidden  Maintien explicite pendant un enchaînement de sélections que la fenêtre pilote elle-même
 *                    (MJ : cibles CaC multiples, où `combatTargetMode` retombe à null un instant entre deux cibles).
 * @returns `hidden` et `armExplicitMove(willEnter)` — à appeler AVANT de (ré)armer un déplacement.
 *          `willEnter` = true quand l'appelant crée lui-même un nouveau mode (Retraite, Charge) ; false pour la
 *          tuile « Déplacement » (le survol ambiant existe déjà, ou est réarmé par `rearm`).
 */
export function useDeclareWindowHiding({
  tokenIds, combatMoveMode, pendingMoveSelection, combatTargetMode, combatAoeTargetMode, holdHidden = false,
}) {
  const [explicitMove, setExplicitMove] = useState(null)
  const ownMove = ownsMode(combatMoveMode, (tokenIds ?? []).filter(Boolean)) ? combatMoveMode : null

  // Ajustement d'état pendant le rendu (patron React « storing information from previous renders », pas
  // un effet) : le marqueur en attente s'accroche au mode qui vient d'être armé ; un marqueur dont le
  // mode a disparu (validé, annulé, remplacé) est effacé.
  if (explicitMove === EXPLICIT_MOVE_PENDING) {
    if (ownMove) setExplicitMove(ownMove)
  } else if (explicitMove && explicitMove !== ownMove) {
    setExplicitMove(null)
  }

  const armExplicitMove = useCallback(
    (willEnter = false) => setExplicitMove(willEnter ? EXPLICIT_MOVE_PENDING : (ownMove ?? EXPLICIT_MOVE_PENDING)),
    [ownMove],
  )

  const hidden = isDeclareWindowHidden({
    tokenIds, combatMoveMode, pendingMoveSelection, combatTargetMode, combatAoeTargetMode, explicitMove, holdHidden,
  })
  return { hidden, armExplicitMove }
}
