// 90_voxel_textures.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."voxel_textures_id_seq";

create table "public"."voxel_textures" (
    "id" integer not null default nextval('voxel_textures_id_seq'::regclass),
    "pack_id" uuid not null,
    "category_id" uuid,
    "label" character varying(255) not null,
    "faces" jsonb not null,
    "allowed_geometries" jsonb,
    "deprecated" boolean default false,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "usage_hint" character varying(255),
    "variant_weight" integer not null default 1
);

alter sequence "public"."voxel_textures_id_seq" owned by "public"."voxel_textures"."id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."voxel_textures" cascade;
  `)
}
