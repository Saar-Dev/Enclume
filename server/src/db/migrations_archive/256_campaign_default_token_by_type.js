/**
 * Migration 256 — campaigns.default_token_glb_url_drone/_exo
 *
 * `campaigns.default_token_glb_url` (migration 66) sert de repli pour tout personnage sans `glb_url`
 * propre, quel que soit son type (Canvas3D.jsx, résolution `character.glb_url ?? defaultTokenGlbUrl
 * ?? HARDCODED_DEFAULT_TOKEN_URL`) — un seul modèle 3D de repli pour humanoïde/drone/exo confondus.
 * Demande Saar (2026-08-20) : drone et exo-armure doivent avoir leur propre repli, comme l'humanoïde.
 * `default_token_glb_url` existant devient implicitement le repli humanoïde (nom conservé — colonne
 * déjà utilisée par la route d'upload et l'UI existantes, pas de migration de données nécessaire).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (t) => {
    t.text('default_token_glb_url_drone')
    t.text('default_token_glb_url_exo')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (t) => {
    t.dropColumn('default_token_glb_url_drone')
    t.dropColumn('default_token_glb_url_exo')
  })
}
