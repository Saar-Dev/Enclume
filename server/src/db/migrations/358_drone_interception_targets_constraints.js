// 358_drone_interception_targets_constraints.js — contraintes de drone_interception_targets (357).
//
// - PK (drone, protégé) : un même lien n'existe qu'une fois.
// - FK ON DELETE CASCADE des deux côtés : supprimer le drone OU le protégé supprime le lien.
// - CHECK drone ≠ protégé : un drone ne se protège pas lui-même.
// - INDEX sur le protégé : la lecture à CHAQUE tir se fait par protégé (« qui protège cette cible ? »),
//   la PK composite ne sert que la recherche par drone.
//
// Ce que la base ne peut pas garantir (même campagne, le protecteur est de type `drone`) est validé par
// la route qui écrit (char-sheet.js). Garde du coffre : cette table a une FK vers `characters` et DOIT
// figurer dans EXCLUDED_TABLES de vaultService.js, sinon tout clonage de personnage lève une 500
// (assertRegistryUpToDate).
//
// DO-blocks gardés : idempotent, sûr à rejouer (docs/SYSTEME/CORE.md P54).

const addConstraint = (name, definition) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "public"."drone_interception_targets" ADD CONSTRAINT "${name}" ${definition};
    END IF;
  END $$;
`

export const up = async (knex) => {
  await knex.raw(addConstraint('drone_interception_targets_pkey', 'PRIMARY KEY (drone_character_id, protected_character_id)'))
  await knex.raw(addConstraint(
    'drone_interception_targets_drone_character_id_foreign',
    'FOREIGN KEY (drone_character_id) REFERENCES characters(id) ON DELETE CASCADE',
  ))
  await knex.raw(addConstraint(
    'drone_interception_targets_protected_character_id_foreign',
    'FOREIGN KEY (protected_character_id) REFERENCES characters(id) ON DELETE CASCADE',
  ))
  await knex.raw(addConstraint('chk_dit_not_self', 'CHECK (drone_character_id <> protected_character_id)'))
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_dit_protected ON "public"."drone_interception_targets" (protected_character_id)')
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_dit_protected')
  await knex.raw('ALTER TABLE "public"."drone_interception_targets" DROP CONSTRAINT IF EXISTS chk_dit_not_self')
  await knex.raw('ALTER TABLE "public"."drone_interception_targets" DROP CONSTRAINT IF EXISTS drone_interception_targets_protected_character_id_foreign')
  await knex.raw('ALTER TABLE "public"."drone_interception_targets" DROP CONSTRAINT IF EXISTS drone_interception_targets_drone_character_id_foreign')
  await knex.raw('ALTER TABLE "public"."drone_interception_targets" DROP CONSTRAINT IF EXISTS drone_interception_targets_pkey')
}
