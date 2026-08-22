// 133_documents_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."documents" drop constraint if exists "documents_pkey";
  `)
}
