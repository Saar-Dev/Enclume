// 376_exo_sheet_illustration_url.js — docs/PLANS/PLAN_SUPPLEMENTS.md §7 (Lot C)
//
// Illustration par défaut d'une exo-armure possédée. Nullable, pas de backfill : une fiche sans
// template n'a simplement pas d'image par défaut, et le catalogue (ref_exo_templates.illustration_url,
// migration 71) a aujourd'hui toutes ses valeurs à NULL — rien à copier rétroactivement.
//
// Copiée depuis le template par applyExoTemplate (exoTemplateService.js, COPIED_FROM_TEMPLATE_COLUMNS)
// à l'application d'un modèle, puis modifiable ensuite par le joueur via une route dédiée
// (POST /:characterId/exo/illustration, char-sheet.js) — même patron que characters.portrait_url.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE "public"."exo_sheet" ADD COLUMN IF NOT EXISTS "illustration_url" text')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."exo_sheet" DROP COLUMN IF EXISTS "illustration_url"')
}
