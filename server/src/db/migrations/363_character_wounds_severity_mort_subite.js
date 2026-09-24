// 363_character_wounds_severity_mort_subite.js — la 6ᵉ ligne du compteur de blessures (« Mort subite / Membre détruit »).
//
// Élargit `chk_wounds_severity` (124) de 5 à 6 valeurs : ajoute `mort_subite` (docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md,
// Lot 2). UNE gravité stockée pour les 6 localisations ; le libellé (Mort / Membre détruit) dépend de la localisation.
//
// Rétrocompatible : l'ancien code n'écrit jamais `mort_subite`, l'élargissement d'une contrainte ne touche aucune ligne.
// DO-block gardé + DROP IF EXISTS : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).
//
// down() : les blessures `mort_subite` redeviennent `mortelle` (gravité immédiatement inférieure) AVANT de rétablir la
// contrainte à 5 valeurs — sinon la contrainte refuserait ces lignes. C'est une dégradation assumée du retour arrière :
// la ligne Mortelle peut alors dépasser sa capacité (le code d'avant ne le vérifie pas à la lecture).

const SEVERITIES_BEFORE = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']
const SEVERITIES_AFTER = [...SEVERITIES_BEFORE, 'mort_subite']

const asArray = (list) => list.map((s) => `'${s}'::text`).join(', ')

const replaceConstraint = (list) => `
  ALTER TABLE "public"."character_wounds" DROP CONSTRAINT IF EXISTS "chk_wounds_severity";
  ALTER TABLE "public"."character_wounds" ADD CONSTRAINT "chk_wounds_severity"
    CHECK ((severity = ANY (ARRAY[${asArray(list)}])));
`

export const up = async (knex) => {
  await knex.raw(replaceConstraint(SEVERITIES_AFTER))
}

export const down = async (knex) => {
  await knex.raw(`UPDATE "public"."character_wounds" SET severity = 'mortelle' WHERE severity = 'mort_subite'`)
  await knex.raw(replaceConstraint(SEVERITIES_BEFORE))
}
