// 361_drone_interception_uses_constraints.js — contraintes de drone_interception_uses (360).
//
// - PK (campagne, drone, Tour) : cible de l'ON CONFLICT du compteur atomique ; sert aussi la lecture « usages de ce
//   drone ce Tour », donc aucun index supplémentaire.
// - FK campagne → combat_state(campaign_id) ON DELETE CASCADE : les lignes disparaissent avec le combat
//   (COMBAT_END supprime combat_state). combat_state a pour PK campaign_id.
// - FK drone → characters ON DELETE CASCADE : supprimer le drone supprime son compteur.
// - CHECK turn_number ≥ 1 et uses ≥ 1 : une ligne n'existe que parce qu'une interception a été engagée.
//
// Garde du coffre : cette table a une FK vers `characters` et DOIT figurer dans EXCLUDED_TABLES de
// vaultService.js (état de combat d'une campagne, jamais copié avec un personnage), sinon tout clonage de
// personnage lève une 500 (assertRegistryUpToDate).
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."drone_interception_uses" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint('drone_interception_uses_pkey', 'PRIMARY KEY (campaign_id, drone_character_id, turn_number)'))
  await knex.raw(addConstraint(
    'drone_interception_uses_campaign_id_foreign',
    'FOREIGN KEY (campaign_id) REFERENCES combat_state(campaign_id) ON DELETE CASCADE',
  ))
  await knex.raw(addConstraint(
    'drone_interception_uses_drone_character_id_foreign',
    'FOREIGN KEY (drone_character_id) REFERENCES characters(id) ON DELETE CASCADE',
  ))
  await knex.raw(addConstraint('chk_diu_turn_number', 'CHECK (turn_number >= 1)'))
  await knex.raw(addConstraint('chk_diu_uses', 'CHECK (uses >= 1)'))
}

// `ALTER TABLE IF EXISTS` : down() sûr à rejouer même si la table (360) a déjà été supprimée.
export const down = async (knex) => {
  await knex.raw('ALTER TABLE IF EXISTS "public"."drone_interception_uses" DROP CONSTRAINT IF EXISTS chk_diu_uses')
  await knex.raw('ALTER TABLE IF EXISTS "public"."drone_interception_uses" DROP CONSTRAINT IF EXISTS chk_diu_turn_number')
  await knex.raw('ALTER TABLE IF EXISTS "public"."drone_interception_uses" DROP CONSTRAINT IF EXISTS drone_interception_uses_drone_character_id_foreign')
  await knex.raw('ALTER TABLE IF EXISTS "public"."drone_interception_uses" DROP CONSTRAINT IF EXISTS drone_interception_uses_campaign_id_foreign')
  await knex.raw('ALTER TABLE IF EXISTS "public"."drone_interception_uses" DROP CONSTRAINT IF EXISTS drone_interception_uses_pkey')
}
