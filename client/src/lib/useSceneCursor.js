import { useMemo } from 'react'

// Mode de curseur du canvas 3D — extrait de Canvas3D.jsx (Saar 2026-08-07) pour lui retirer la
// responsabilité curseurs/réticules. Deux modes exclusifs, ciblage prioritaire sur déplacement (même
// ordre que combatMoveHasPriority dans Canvas3D : Attaque/CaC/LOS passent toujours devant le
// déplacement). Hors de ces deux modes : null (curseur système par défaut).
// Rendu par overlay DOM (SceneCursorOverlay.jsx), pas par `cursor: url()` natif — retiré (Saar
// 2026-08-07) : ni animable, ni fiable selon navigateur pour un SVG avec masque/filtre/<use>.
export function useSceneCursor({ combatMoveMode, combatTargetMode, losMode }) {
  return useMemo(() => {
    if (combatTargetMode || losMode?.active) return 'cible'
    if (combatMoveMode) return 'case'
    return null
  }, [combatMoveMode, combatTargetMode, losMode])
}
