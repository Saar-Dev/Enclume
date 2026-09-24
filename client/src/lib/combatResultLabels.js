// Tables partagees des labels de resultat de combat (localisation, gravite de blessure).
// `label` = cle i18n namespace `combat` (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant via t(), jamais affichee brute. `col` = couleur de gravite.
// Consommateurs : CombatResultPanels.jsx (panneaux GM/joueur) et CombatModifiersWindow.jsx
// (liste par cible d'un tir en zone, PLAN_AOE.md §8 etape 10) — Regle 2, une info = un endroit.
// Fichier dedie (pas un export depuis un .jsx) : la regle react-refresh/only-export-components
// interdit de melanger constantes et composants dans un meme fichier.

import { WOUND_SEVERITIES, SEVERITY_COLORS } from '../../../shared/woundConstants.js'

// DÉRIVÉE de WOUND_SEVERITIES / SEVERITY_COLORS (shared/woundConstants.js, autorité unique des 6 gravités) : une
// gravité ajoutée là a sa couleur ici sans second tableau à tenir à jour. Clé i18n : resultPanels.severity.<gravité>.
export const SEVERITY = Object.fromEntries(WOUND_SEVERITIES.map(severity => [
  severity, { col: SEVERITY_COLORS[severity], label: `resultPanels.severity.${severity}` },
]))

export const LOC = {
  tete:         'resultPanels.location.tete',
  corps:        'resultPanels.location.corps',
  bras_droit:   'resultPanels.location.brasDroit',
  bras_gauche:  'resultPanels.location.brasGauche',
  jambe_droite: 'resultPanels.location.jambeDroite',
  jambe_gauche: 'resultPanels.location.jambeGauche',
}
