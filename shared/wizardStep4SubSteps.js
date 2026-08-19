// Sous-navigation locale de l'Étape 4 (Âge/Origines/Formation/Carrières/Avantages & Revers/Récap).
// Source unique partagée client/serveur (CLAUDE.md §7) — le client (Step4Experience.jsx) l'utilise
// pour sa navigation, le serveur (creationService.js) pour valider `highestSubStep` avant de le
// persister (char_sheet.wizard_progress.step4_highest_substep, migration 248).

export const SUB_STEPS = {
  AGE: 'age',
  GEO_ORIGIN: 'geo_origin',
  SOCIAL_ORIGIN: 'social_origin',
  TRAINING: 'training',
  HIGHER_ED: 'higher_ed',
  CAREERS: 'careers',
  ADVANTAGES_AND_SETBACKS: 'advantages_and_setbacks',
  SUMMARY: 'summary',
}

export const SUB_STEP_ORDER = Object.values(SUB_STEPS)
