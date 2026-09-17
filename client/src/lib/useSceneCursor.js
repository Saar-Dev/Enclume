import { useMemo } from 'react'

// Mode de curseur du canvas 3D — extrait de Canvas3D.jsx (Saar 2026-08-07) pour lui retirer la
// responsabilité curseurs/réticules. Modes exclusifs, ciblage prioritaire sur déplacement (même ordre
// que combatMoveHasPriority dans Canvas3D : Attaque/CaC/LOS/Zone d'effet passent toujours devant le
// déplacement). combatAoeTargetMode (PLAN_AOE.md §8 étape 9) réutilise le curseur 'cible' — même
// nature d'interaction (viser), pas une icône dédiée pour une seule arme. moveTarget (visée
// déplacement d'entité, 9F-B2/Lot A2) réutilise 'case' — même sémantique que combatMoveMode : on
// désigne une case de destination, jamais un token/une entité (retour Saar 2026-09-17 : manquait
// depuis l'introduction de la mécanique, jamais recopié ici). Hors de ces modes : null (curseur
// système par défaut).
// Rendu par overlay DOM (SceneCursorOverlay.jsx), pas par `cursor: url()` natif — retiré (Saar
// 2026-08-07) : ni animable, ni fiable selon navigateur pour un SVG avec masque/filtre/<use>.
// Dette connue (docs/PLANS/PLAN_CLIC_3D_UNIFICATION.md) : ces mêmes modes sont aussi recopiés
// individuellement dans l'arbitrage de clic (Canvas3D.jsx) et dans 5 useEffect Échap quasi
// identiques — aucune autorité unique « mode de visée actif », juste une convention répétée à la
// main à chaque nouveau mode. Pas retouché ici : réutiliser la branche 'case' existante ne fait que
// suivre cette même convention, ne l'aggrave pas.
export function useSceneCursor({ combatMoveMode, combatTargetMode, combatAoeTargetMode, losMode, moveTarget }) {
  return useMemo(() => {
    if (combatTargetMode || combatAoeTargetMode || losMode?.active) return 'cible'
    if (combatMoveMode || moveTarget) return 'case'
    return null
  }, [combatMoveMode, combatTargetMode, combatAoeTargetMode, losMode, moveTarget])
}
