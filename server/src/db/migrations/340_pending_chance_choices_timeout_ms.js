// 340_pending_chance_choices_timeout_ms.js — persiste le délai de timeout réellement utilisé à
// l'ouverture (PLAN_CHANCE.md L3e-4, retour Saar : décompte visible côté client, résync fiable
// même si un futur site passe un timeoutMs différent du défaut).
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" add column "timeout_ms" integer not null default 45000;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" drop column if exists "timeout_ms";
  `)
}
