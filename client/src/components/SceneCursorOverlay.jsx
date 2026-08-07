import { useEffect, useState } from 'react'

// Curseur custom du canvas 3D — overlay DOM (Saar 2026-08-07), remplace `cursor: url()` natif.
// Raison : le curseur natif n'est ni animable (aucun navigateur n'anime un SVG référencé en
// `cursor:`, image figée) ni fiable pour un SVG avec masque/filtre/<use> (CURSEUR_CIBLE restait
// invisible). Un <img> DOM classique n'a aucune de ces limites — rendu standard, CSS animable.
// Position : `position: fixed` + clientX/clientY bruts — pas de calcul de rect nécessaire,
// fixed est déjà relatif au viewport comme clientX/clientY. `pointer-events: none` impératif :
// l'overlay ne doit jamais intercepter les événements destinés au canvas en dessous.
// hoveringEntityRef : ref (pas state) écrite par Scene au survol d'une EntityMesh — lue à chaque
// pointermove pour supprimer CURSEUR_CIBLE sur une entité interactive non-cible (ex. coffre),
// sans re-render du sous-arbre Scene à chaque survol (pattern P40, cf. Canvas3D.jsx).
// hoveringTokenRef : ref miroir de ambientHoverTokenId — au survol d'un token pendant le
// déplacement combat (mode='case' de base), bascule sur CIBLE : un seul curseur possible à la fois
// (retour Saar 2026-08-07 — "curseur = SOIT curseur_cible SOIT curseur_case", jamais les deux, et
// CASE ne doit pas garder la place sur un token survolé).
// resolveMode() sert à la fois au rendu de l'overlay ET au masquage du curseur natif du canvas
// (canvasEl.style.cursor) — une seule source de vérité, jamais deux décisions qui peuvent diverger.
function resolveMode(mode, hoveringEntityRef, hoveringTokenRef) {
  let resolved = mode
  if (resolved === 'case' && hoveringTokenRef?.current) resolved = 'cible'
  if (resolved === 'cible' && hoveringEntityRef?.current) resolved = null
  return resolved
}

export default function SceneCursorOverlay({ canvasEl, mode, hoveringEntityRef, hoveringTokenRef }) {
  const [pos, setPos] = useState(null)

  // Masquage immédiat du curseur natif dès le changement de mode explicite (combatMoveMode/
  // combatTargetMode/losMode), sans attendre un pointermove — sinon le curseur natif resterait
  // visible jusqu'au premier mouvement de souris après l'entrée en mode.
  useEffect(() => {
    if (!canvasEl) return
    canvasEl.style.cursor = mode ? 'none' : 'auto'
  }, [canvasEl, mode])

  useEffect(() => {
    if (!canvasEl) return
    const onMove = (e) => {
      canvasEl.style.cursor = resolveMode(mode, hoveringEntityRef, hoveringTokenRef) ? 'none' : 'auto'
      setPos({ x: e.clientX, y: e.clientY })
    }
    const onLeave = () => {
      canvasEl.style.cursor = 'auto'
      setPos(null)
    }
    canvasEl.addEventListener('pointermove', onMove)
    canvasEl.addEventListener('pointerleave', onLeave)
    return () => {
      canvasEl.removeEventListener('pointermove', onMove)
      canvasEl.removeEventListener('pointerleave', onLeave)
    }
  }, [canvasEl, mode, hoveringEntityRef, hoveringTokenRef])

  if (!pos) return null

  const resolvedMode = resolveMode(mode, hoveringEntityRef, hoveringTokenRef)
  if (!resolvedMode) return null

  const src = resolvedMode === 'cible' ? '/assets/CURSEUR_CIBLE.svg' : '/assets/CURSEUR_CASE.svg'

  return (
    <img
      src={src}
      alt=""
      className={`scene-cursor-overlay scene-cursor-overlay-${resolvedMode}`}
      style={{ left: pos.x, top: pos.y }}
    />
  )
}
