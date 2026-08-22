/**
 * Migration 251 — ref_exo_equipment
 *
 * Catalogue des systèmes/armes montables sur une exo-armure (PLAN_EXOARMURE.md §12), transcrit
 * depuis `docs/REGLES/SEEDEXO.md` (RAW complet, ~34 systèmes + ~10 armes). N'inclut pas les
 * armures elles-mêmes : les ~16 armures prémade RAW sont seedées directement dans
 * `ref_exo_templates` (existante, migrations 233+243), pas dans cette table.
 *
 * Schéma calqué sur `ref_equipment` (migration 48) — price/price_modifier, rarity au format
 * "DIS (M. noir)", fire_mode/init_mod avec les mêmes CHECK — plutôt que d'inventer un second
 * patron pour un besoin déjà résolu (PLAN_EXOARMURE.md §12.1bis, point 5). Deux colonnes propres
 * à ce catalogue, chacune justifiée par plusieurs lignes RAW réelles (pas un cas isolé) :
 *   - `max_level` : plafond de niveau pour les systèmes facturés "X/niv." (ex. Atténuateur sonore,
 *     niveau max. 7) — un SKU à niveau fixe (ex. Analyseur Sea-Star, niv. 12) porte son niveau
 *     dans `name`/`description`, pas ici (ce n'est pas un plafond d'achat, c'est un produit figé).
 *   - `duration` : colonne "Capacité" du tableau Supports vitaux (ex. Réserve d'oxygène = 24 h).
 * Un champ "Cibles" (Analyseurs, 4 lignes sur ~40) a été envisagé puis écarté : aucun code ne le
 * consomme, il reste en texte libre dans `description` plutôt qu'une colonne construite par
 * anticipation.
 */

export const up = async (knex) => {
  await knex.schema.createTable('ref_exo_equipment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    // Identité
    t.text('family').notNullable()
    t.text('category').notNullable()
    t.text('name').notNullable()
    t.text('description')

    // Prix
    t.integer('price')
    t.string('price_modifier', 50)

    // Caractéristiques générales
    t.text('tech_level')
    t.string('rarity', 20)
    t.integer('max_level')
    t.string('duration', 50)

    // Offensif (family='arme' uniquement)
    t.string('damage', 50)
    t.string('shock', 50)
    t.string('range', 50)
    t.integer('init_mod')
    t.string('fire_mode', 20)
    t.string('ammo_cost', 50)

    t.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE ref_exo_equipment
      ADD CONSTRAINT chk_exoeq_family    CHECK (family IN ('arme', 'systeme')),
      ADD CONSTRAINT chk_exoeq_init_mod  CHECK (init_mod IS NULL OR init_mod < 0),
      ADD CONSTRAINT chk_exoeq_fire_mode CHECK (fire_mode IS NULL OR fire_mode IN ('CC','RC','RL','CC/RC','CC/RL','RC/RL','CC/RC/RL','-'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('ref_exo_equipment')
}
