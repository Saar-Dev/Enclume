// 379_ref_equipment_source_id_constraints.js — contraintes de ref_equipment.source_id (378).
//
// - FK vers ref_sources(id) ON DELETE RESTRICT : jamais de suppression silencieuse d'une source tant
//   que des lignes d'équipement la référencent (même garde que 373_ref_exo_templates_source_id_
//   constraints.js).
// - UNIQUE(name, source_id) : deux sources peuvent porter un item du même nom sans collision, mais
//   jamais deux fois le même nom pour la même source. Vérifié sans risque avant migration (797
//   lignes, 0 doublon de name, PLAN_SUPPLEMENTS.md §2.5).
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."ref_equipment" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint(
    'ref_equipment_source_id_foreign',
    'FOREIGN KEY (source_id) REFERENCES ref_sources(id) ON DELETE RESTRICT',
  ))
  await knex.raw(addConstraint('ref_equipment_name_source_id_unique', 'UNIQUE (name, source_id)'))
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_equipment" DROP CONSTRAINT IF EXISTS ref_equipment_name_source_id_unique')
  await knex.raw('ALTER TABLE "public"."ref_equipment" DROP CONSTRAINT IF EXISTS ref_equipment_source_id_foreign')
}
