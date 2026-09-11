// 339_pending_chance_choices_catastrophe_link.js — lie une ligne pending_chance_choices à la
// pending_catastrophes ouverte par le même jet (PLAN_CHANCE.md L3e-4, retour Saar 2026-09-11 :
// une seule carte MJ unifiée plutôt que deux fenêtres "Catastrophe" séparées pour le même événement).
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" add column "linked_catastrophe_id" integer;

alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_linked_catastrophe_id_foreign" FOREIGN KEY (linked_catastrophe_id) REFERENCES pending_catastrophes(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_linked_catastrophe_id_foreign";
alter table "public"."pending_chance_choices" drop column if exists "linked_catastrophe_id";
  `)
}
