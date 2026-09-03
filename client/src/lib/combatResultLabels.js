// Tables partagees des labels de resultat de combat (localisation, gravite de blessure).
// `label` = cle i18n namespace `combat` (docs/SYSTEME/LOCALISATION.md §3.1), resolue par le
// composant via t(), jamais affichee brute. `col` = couleur de gravite.
// Consommateurs : CombatResultPanels.jsx (panneaux GM/joueur) et CombatModifiersWindow.jsx
// (liste par cible d'un tir en zone, PLAN_AOE.md §8 etape 10) — Regle 2, une info = un endroit.
// Fichier dedie (pas un export depuis un .jsx) : la regle react-refresh/only-export-components
// interdit de melanger constantes et composants dans un meme fichier.

export const SEVERITY = {
  legere:   { col: '#FFD700', label: 'resultPanels.severity.legere'   },
  moyenne:  { col: '#FFA500', label: 'resultPanels.severity.moyenne'  },
  grave:    { col: '#FF6B6B', label: 'resultPanels.severity.grave'    },
  critique: { col: '#FF0000', label: 'resultPanels.severity.critique' },
  mortelle: { col: '#8B0000', label: 'resultPanels.severity.mortelle' },
}

export const LOC = {
  tete:         'resultPanels.location.tete',
  corps:        'resultPanels.location.corps',
  bras_droit:   'resultPanels.location.brasDroit',
  bras_gauche:  'resultPanels.location.brasGauche',
  jambe_droite: 'resultPanels.location.jambeDroite',
  jambe_gauche: 'resultPanels.location.jambeGauche',
}
