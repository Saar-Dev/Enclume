// 370_ref_sources_constraints.js — contraintes de ref_sources (369).
//
// - PK (id).
// - UNIQUE (code) : clé métier stable pour tout lookup futur (`SELECT id FROM ref_sources WHERE
//   code = 'ldb'`) — jamais un `id` recopié d'une migration à l'autre (leçon 307→308/309,
//   docs/PLANS/PLAN_SUPPLEMENTS.md §6.5).
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."ref_sources" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint('ref_sources_pkey', 'PRIMARY KEY (id)'))
  await knex.raw(addConstraint('ref_sources_code_unique', 'UNIQUE (code)'))
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_sources" DROP CONSTRAINT IF EXISTS ref_sources_code_unique')
  await knex.raw('ALTER TABLE "public"."ref_sources" DROP CONSTRAINT IF EXISTS ref_sources_pkey')
}
