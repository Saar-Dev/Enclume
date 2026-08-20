// Transcription RAW pure des tables par catégorie d'exo-armure (docs/REGLES/REGLEARMURE.md) —
// aucune logique, données seules. Consommées à partir du Lot 2 (Saisie), Lot 2bis (Armure à terre)
// et Lot 4 (RD + dégâts au contact) — définies dès le Lot 1 pour n'avoir qu'une seule source.

// Rang explicite des 9 catégories dans leur ordre RAW — nécessaire pour exprimer "catégorie X et
// plus" (Saisie, Armure à terre) sans comparaison de chaînes dans le désordre.
export const EXO_CATEGORY_ORDER = [
  'exo-alpha', 'exo-0', 'exo-1', 'exo-2', 'exo-3', 'exo-4', 'exo-5', 'exo-6', 'exo-omega',
]

// Résistance aux Dommages par catégorie (REGLEARMURE.md:90-98)
export const EXO_RD_TABLE = {
  'exo-alpha': 0,
  'exo-0': -1,
  'exo-1': -2,
  'exo-2': -3,
  'exo-3': -4,
  'exo-4': -5,
  'exo-5': 6,
  'exo-6': 5,
  'exo-omega': 4,
}

// Dés de dégâts au contact par catégorie (REGLEARMURE.md:258-264) — le modificateur EXF vient de
// getModDom(exf) (server/src/lib/charStats.js), jamais dupliqué ici.
export const EXO_CONTACT_DAMAGE_TABLE = {
  'exo-alpha': '1D6+2',
  'exo-0': '1D6+2',
  'exo-1': '1D10',
  'exo-2': '1D10+3',
  'exo-3': '1D10+3',
  'exo-4': '2D10',
  'exo-5': '2D10+3',
  'exo-6': '3D10',
  'exo-omega': '3D10+3',
}

// Malus de Saisie/Lutte (optionnel, REGLEARMURE.md:371-380) — exo-2 et plus uniquement.
export const EXO_GRAPPLE_MALUS_TABLE = {
  'exo-2': -3,
  'exo-3': -3,
  'exo-4': -5,
  'exo-5': -7,
  'exo-6': -7,
  'exo-omega': -10,
}

// Armure à terre — malus au Test de Manœuvre d'armure pour se redresser (optionnel,
// REGLEARMURE.md:381-391) — exo-1 et plus uniquement.
export const EXO_PRONE_RECOVERY_TABLE = {
  'exo-1': 5,
  'exo-2': 3,
  'exo-3': 0,
  'exo-4': -3,
  'exo-5': -5,
  'exo-6': -7,
  'exo-omega': -10,
}

// Compteur d'Avaries (REGLEARMURE.md:317-407, table p.326) — capture Saar, cases confirmées
// 2026-08-19 (PLAN_EXOARMURE.md §11.2). Seuils identiques par coïncidence à la table de sévérité des
// Blessures humaines (LdB p.114, 5/10/15/20/25/30) — deux tables RAW indépendantes, jamais partagées
// (voir server/src/lib/exoAvarieService.js, severityForExoDamage).
// `maxCount` : nombre de cases de la ligne — la case qui COMPLÈTERAIT la ligne déclenche la promotion
// au lieu d'être posée (même interprétation que resolveWoundInsertion, woundUtils.js:47, "currentCount
// >= maxCount - 1" → jamais réellement maxCount cases cochées en pratique).
// `incidentModifier` : ajouté au 1D10 du jet d'incident (Lot 5a, pas consommé par le Lot 4 — transcrit
// ici pour n'avoir qu'une seule source RAW de cette table).
// `itgLossStructure` : perte définitive d'ITG Structure, sur la transition 0→1 du compteur concerné
// uniquement (REGLEARMURE.md:344-353 — "et non à chaque Avarie reçue dans l'un d'eux"), sauf
// `destruction` qui est inconditionnelle (pas de compteur persistant pour ce palier).
export const EXO_AVARIE_TABLE = {
  legere:         { threshold: 5,  maxCount: 5, incidentModifier: 0, itgLossStructure: 0 },
  moyenne:        { threshold: 10, maxCount: 5, incidentModifier: 2, itgLossStructure: 0 },
  grave:          { threshold: 15, maxCount: 4, incidentModifier: 4, itgLossStructure: 0 },
  critique:       { threshold: 20, maxCount: 3, incidentModifier: 6, itgLossStructure: 1 },
  catastrophique: { threshold: 25, maxCount: 2, incidentModifier: 8, itgLossStructure: 1 },
  destruction:    { threshold: 30, itgLossStructure: 2 },  // pas de case/compteur — immédiat
}

// Ordre RAW des paliers d'Avaries — nécessaire pour exprimer la cascade de promotion
// (exoAvarieService.js) sans dépendre de l'ordre d'insertion des clés d'un objet.
export const EXO_AVARIE_SEVERITY_ORDER = [
  'legere', 'moyenne', 'grave', 'critique', 'catastrophique', 'destruction',
]

// Colonne exo_sheet par palier — déplacé depuis exoAvarieService.js (2026-08-20, Lot A) pour être
// consommable côté client aussi (ExoAvariesPanel.jsx a besoin de savoir quelle colonne de `exo` lire
// par palier, sans dupliquer ce mapping). 'destruction' volontairement absent : pas de colonne/case
// persistante pour ce palier (§11.2).
export const EXO_AVARIE_COLUMN_BY_SEVERITY = {
  legere:         'avaries_legeres',
  moyenne:        'avaries_moyennes',
  grave:          'avaries_graves',
  critique:       'avaries_critiques',
  catastrophique: 'avaries_catastrophiques',
}
