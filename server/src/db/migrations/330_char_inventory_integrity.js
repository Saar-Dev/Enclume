// 330_char_inventory_integrity.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 §2.2
//
// Une LIGNE d'inventaire porte l'état d'Intégrité de l'objet physique qu'elle représente :
//   - `integrity_current` / `integrity_max` : ITG courante et max, sur 25 (MANUEL_USURE.md §3.3) ;
//   - `malfunction_severity` : porte de panne binaire (§4.4) — non NULL ⇒ objet inutilisable,
//     `'simple'` (réparable normalement) ou `'critical'` (atelier).
// Colonnes dédiées et NON `custom_props` jsonb : L6 filtrera `integrity_current < integrity_max`
// et L4 triera par palier — besoin d'un WHERE indexable (PLAN §2.2 M7).
//
// AUCUN backfill : décision D1 (PLAN §2.3) — les inventaires de dev sont réinitialisés par le
// script one-shot `server/src/scripts/wipe_inventories_for_integrity.js` (lancé par Saar, hors
// migration : un DELETE dans une migration rejouerait sur tout déploiement neuf, cf. M1). Les
// lignes existantes gardent `integrity_current = integrity_max = NULL` — cohérent avec
// `has_integrity` défaut OFF (un objet sans ITG). Rétro-compatible : aucun code ne lit encore ces
// colonnes (vérifié 2026-09-09).
//
// Idempotent (`ADD COLUMN IF NOT EXISTS`, CHECK gardées). `down()` = `DROP`.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE char_inventory ADD COLUMN IF NOT EXISTS integrity_current integer')
  await knex.raw('ALTER TABLE char_inventory ADD COLUMN IF NOT EXISTS integrity_max integer')
  await knex.raw('ALTER TABLE char_inventory ADD COLUMN IF NOT EXISTS malfunction_severity text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_char_inventory_integrity_range') THEN
        ALTER TABLE char_inventory ADD CONSTRAINT chk_char_inventory_integrity_range CHECK (
          (integrity_current IS NULL OR integrity_current >= 0)
          AND (integrity_max IS NULL OR integrity_max BETWEEN 1 AND 25)
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_char_inventory_integrity_coherence') THEN
        ALTER TABLE char_inventory ADD CONSTRAINT chk_char_inventory_integrity_coherence CHECK (
          (integrity_current IS NULL) = (integrity_max IS NULL)
          AND (integrity_current IS NULL OR integrity_current <= integrity_max)
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_char_inventory_malfunction_severity') THEN
        ALTER TABLE char_inventory ADD CONSTRAINT chk_char_inventory_malfunction_severity
          CHECK (malfunction_severity IS NULL OR malfunction_severity IN ('simple', 'critical'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_inventory DROP CONSTRAINT IF EXISTS chk_char_inventory_malfunction_severity')
  await knex.raw('ALTER TABLE char_inventory DROP CONSTRAINT IF EXISTS chk_char_inventory_integrity_coherence')
  await knex.raw('ALTER TABLE char_inventory DROP CONSTRAINT IF EXISTS chk_char_inventory_integrity_range')
  await knex.raw('ALTER TABLE char_inventory DROP COLUMN IF EXISTS malfunction_severity')
  await knex.raw('ALTER TABLE char_inventory DROP COLUMN IF EXISTS integrity_max')
  await knex.raw('ALTER TABLE char_inventory DROP COLUMN IF EXISTS integrity_current')
}
