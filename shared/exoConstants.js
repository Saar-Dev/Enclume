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
