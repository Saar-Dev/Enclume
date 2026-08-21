/**
 * Migration 258 — exo_programs.exo_computer_id (Lot C, PLAN_EXOARMURE.md §13.4.2, révision 2026-08-21)
 *
 * Trou trouvé en préparant la route `POST /:characterId/exo/programs` (miroir `drone_programs`, qui
 * valide déjà Potentiel/Niveau max contre `drone_sheet.ordinateur_gen/nt`) : le RAW est explicite
 * (`docs/REGLES/REGLE_ORDINATEUR.md:11,16` — "Potentiel"/"Niveau max. des programmes" sont des
 * propriétés de **l'ordinateur**, singulier, pas de l'armure entière). Le drone n'a qu'un seul
 * ordinateur (colonnes scalaires `drone_sheet.ordinateur_gen/nt`), jamais ambigu. L'exo peut en avoir
 * 0, 1 ou 2 (`exo_computers`, migration 257, révision 2026-08-21 — un principal ET un secours sur
 * 4 armures RAW/16) : sans cette colonne, valider un programme contre "le bon" ordinateur serait
 * impossible dès qu'une instance en a deux.
 *
 * Décision Saar (2026-08-21, question posée explicitement) : `exo_computer_id` nullable — si
 * renseigné, la route valide Potentiel/Niveau max contre CET ordinateur précis (même logique que le
 * drone) ; si absent (aucun ordinateur choisi, ou aucun sur l'armure), aucune validation — mirror
 * exact du comportement déjà existant du drone quand `ordinateur_gen`/`ordinateur_nt` sont NULL
 * (`char-sheet.js:1676`, "si configuré").
 *
 * `ON DELETE SET NULL`, pas CASCADE : un programme installé sur un ordinateur retiré ne doit pas
 * disparaître avec lui — RAW le confirme implicitement ("un système non géré par ordinateur ne peut
 * être activé que manuellement", REGLE_ORDINATEUR.md:14-15) : un programme orphelin devient
 * non-géré/manuel, il ne cesse pas d'exister. Même philosophie que `exo_sheet.template_id SET NULL`
 * (une référence d'origine qui peut se perdre sans détruire l'instance) — `exo_programs` est une
 * donnée d'instance, pas une ligne de loadout catalogue (contrairement à
 * `ref_exo_template_equipment.template_id`, CASCADE, qui n'a aucun sens sans son template).
 *
 * Validation d'appartenance (`exo_computer_id` doit référencer un ordinateur du MÊME personnage que
 * le programme) : référence croisée inter-lignes, ne peut pas être portée par un CHECK Postgres —
 * appliquée dans le handler de route, pas ici (même patron que `pilot_character_id`, PLAN_EXOARMURE.md
 * §6.5).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('exo_programs', (t) => {
    t.uuid('exo_computer_id').references('id').inTable('exo_computers').onDelete('SET NULL')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('exo_programs', (t) => {
    t.dropColumn('exo_computer_id')
  })
}
