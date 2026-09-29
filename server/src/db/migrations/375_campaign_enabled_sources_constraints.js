// 375_campaign_enabled_sources_constraints.js — contraintes de campaign_enabled_sources (374).
//
// - PK (campaign_id, source_id) : une même activation n'existe qu'une fois ; sert aussi l'EXISTS de
//   filtrage (`WHERE campaign_id = ? AND source_id = ?`), pas besoin d'index séparé.
// - FK campaign_id → campaigns(id) ON DELETE CASCADE : même convention que toutes les tables
//   scoped-campagne du dépôt (ex. 226_combat_roster_foreign_keys.js).
// - FK source_id → ref_sources(id) ON DELETE CASCADE : supprimer une source nettoie ses activations,
//   pas de ligne orpheline.
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."campaign_enabled_sources" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint('campaign_enabled_sources_pkey', 'PRIMARY KEY (campaign_id, source_id)'))
  await knex.raw(addConstraint(
    'campaign_enabled_sources_campaign_id_foreign',
    'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE',
  ))
  await knex.raw(addConstraint(
    'campaign_enabled_sources_source_id_foreign',
    'FOREIGN KEY (source_id) REFERENCES ref_sources(id) ON DELETE CASCADE',
  ))
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."campaign_enabled_sources" DROP CONSTRAINT IF EXISTS campaign_enabled_sources_source_id_foreign')
  await knex.raw('ALTER TABLE "public"."campaign_enabled_sources" DROP CONSTRAINT IF EXISTS campaign_enabled_sources_campaign_id_foreign')
  await knex.raw('ALTER TABLE "public"."campaign_enabled_sources" DROP CONSTRAINT IF EXISTS campaign_enabled_sources_pkey')
}
