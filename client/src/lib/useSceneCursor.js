import { useMemo } from 'react'

// Mode de curseur du canvas 3D — extrait de Canvas3D.jsx (Saar 2026-08-07) pour lui retirer la
// responsabilité curseurs/réticules. Modes exclusifs, ciblage prioritaire sur déplacement (même ordre
// que combatMoveHasPriority dans Canvas3D : Attaque/CaC/LOS/Zone d'effet passent toujours devant le
// déplacement). combatAoeTargetMode (PLAN_AOE.md §8 étape 9) réutilise le curseur 'cible' — même
// nature d'interaction (viser), pas une icône dédiée pour une seule arme. moveTarget (visée
// déplacement d'entité, 9F-B2/Lot A2) réutilise 'case' — même sémantique que combatMoveMode : on
// désigne une case de destination, jamais un token/une entité. Hors de ces modes : null (curseur
// système par défaut).
// Rendu par overlay DOM (SceneCursorOverlay.jsx), pas par `cursor: url()` natif — retiré (Saar
// 2026-08-07) : ni animable, ni fiable selon navigateur pour un SVG avec masque/filtre/<use>.
//
// Signature changée (PLAN_CLIC_3D_UNIFICATION.md §9.1, Lot 2) : prend le tableau `aimModes` construit
// une fois dans Canvas3D (même définition partagée avec aimModeActive et l'annulation Échap), plus
// les 5 props nommées d'avant — ajouter un 6ᵉ mode ne touche plus ce fichier. Priorité 'cible' > 'case'
// par groupement explicite du champ `cursor`, pas par ordre implicite du tableau — reste auditable
// même si l'ordre des entrées change.
export function useSceneCursor(aimModes) {
  return useMemo(() => {
    const active = aimModes.filter(m => m.active)
    if (active.some(m => m.cursor === 'cible')) return 'cible'
    if (active.some(m => m.cursor === 'case')) return 'case'
    return null
  }, [aimModes])
}
