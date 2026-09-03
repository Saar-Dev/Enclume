import { useMemo } from 'react'

// Mode de curseur du canvas 3D — extrait de Canvas3D.jsx (Saar 2026-08-07) pour lui retirer la
// responsabilité curseurs/réticules. Modes exclusifs, ciblage prioritaire sur déplacement (même ordre
// que combatMoveHasPriority dans Canvas3D : Attaque/CaC/LOS/Zone d'effet passent toujours devant le
// déplacement). combatAoeTargetMode (PLAN_AOE.md §8 étape 9) réutilise le curseur 'cible' — même
// nature d'interaction (viser), pas une icône dédiée pour une seule arme. Hors de ces modes : null
// (curseur système par défaut).
// Rendu par overlay DOM (SceneCursorOverlay.jsx), pas par `cursor: url()` natif — retiré (Saar
// 2026-08-07) : ni animable, ni fiable selon navigateur pour un SVG avec masque/filtre/<use>.
export function useSceneCursor({ combatMoveMode, combatTargetMode, combatAoeTargetMode, losMode }) {
  return useMemo(() => {
    if (combatTargetMode || combatAoeTargetMode || losMode?.active) return 'cible'
    if (combatMoveMode) return 'case'
    return null
  }, [combatMoveMode, combatTargetMode, combatAoeTargetMode, losMode])
}
