// 359_ref_equipment_interception_category.js — docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.5
//
// Le logiciel « Interception » (ref_equipment, famille Logiciels) était seedé en category='pilotage'
// (303_ref_equipment_seed.js), catégorie PARTAGÉE avec « Pilotage » et « Dissimulation » : impossible de
// retrouver un programme d'interception sans se fier au nom. La catégorie d'un programme est COPIÉE du
// catalogue à l'ajout (char-sheet.js, POST /drone/programs) : on corrige donc le catalogue ET les lignes
// drone_programs déjà copiées. `docs/SYSTEME/COMBAT REFERENCE.md` attendait déjà `interception`.
//
// Matching par clé naturelle (famille + nom), JAMAIS par id (règle SEED-ID-DETERM, rules/core.md : deux
// bases seedées indépendamment ont des id différents). Gardé par l'ancienne valeur : idempotent, ne touche
// pas un programme que le MJ aurait déjà reclassé à la main.

export const up = async (knex) => {
  await knex.raw(`
    UPDATE drone_programs
       SET category = 'interception'
     WHERE category = 'pilotage'
       AND equipment_id IN (SELECT id FROM ref_equipment WHERE family = 'Logiciels' AND name = 'Interception')
  `)
  await knex.raw(`
    UPDATE ref_equipment
       SET category = 'interception'
     WHERE family = 'Logiciels' AND name = 'Interception' AND category = 'pilotage'
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    UPDATE drone_programs
       SET category = 'pilotage'
     WHERE category = 'interception'
       AND equipment_id IN (SELECT id FROM ref_equipment WHERE family = 'Logiciels' AND name = 'Interception')
  `)
  await knex.raw(`
    UPDATE ref_equipment
       SET category = 'pilotage'
     WHERE family = 'Logiciels' AND name = 'Interception' AND category = 'interception'
  `)
}
