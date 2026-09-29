// 373_ref_exo_templates_source_id_constraints.js — contraintes de ref_exo_templates.source_id (372).
//
// - FK vers ref_sources(id) ON DELETE RESTRICT : jamais de suppression silencieuse d'une source tant
//   que des templates la référencent (même garde que ref_exo_template_equipment → ref_equipment,
//   258_ref_exo_template_equipment_foreign_keys.js).
// - UNIQUE(name, source_id) : deux sources peuvent porter un modèle du même nom (ex. deux « Mentor »,
//   LdB et Guide Technique) sans collision, mais jamais deux fois le même nom pour la même source.
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."ref_exo_templates" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint(
    'ref_exo_templates_source_id_foreign',
    'FOREIGN KEY (source_id) REFERENCES ref_sources(id) ON DELETE RESTRICT',
  ))
  await knex.raw(addConstraint('ref_exo_templates_name_source_id_unique', 'UNIQUE (name, source_id)'))
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_exo_templates" DROP CONSTRAINT IF EXISTS ref_exo_templates_name_source_id_unique')
  await knex.raw('ALTER TABLE "public"."ref_exo_templates" DROP CONSTRAINT IF EXISTS ref_exo_templates_source_id_foreign')
}
