// 320_combat_action_targets_damage_modifier_nullable.js — PLAN_ARMES_SPECIALES.md §1.6 segment 0c
//
// combat_action_targets.damage_modifier (JSONB) était NOT NULL (migration 317). Le fusil à pompe y
// écrit { band, damageDice } — le dé de dispersion RAW réellement appliqué. Le lance-flammes (et les
// grenades à venir) n'ont ni band ni dispersion : forcer une valeur factice ({ kind: 'flamethrower' })
// juste pour satisfaire NOT NULL serait un smell (une colonne notNullable que chaque mécanisme
// remplit avec une forme incompatible).
//
// La colonne devient nullable : chaque mécanisme y met ce qui a du sens pour lui, NULL accepté quand
// il n'y a rien de pertinent à consigner. Le fusil à pompe continue d'y écrire { band, damageDice }
// (inchangé).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE combat_action_targets ALTER COLUMN damage_modifier DROP NOT NULL')
}

export const down = async (knex) => {
  // Restaurer NOT NULL sans perdre de ligne : NULL → '{}'::jsonb d'abord.
  await knex.raw("UPDATE combat_action_targets SET damage_modifier = '{}'::jsonb WHERE damage_modifier IS NULL")
  await knex.raw('ALTER TABLE combat_action_targets ALTER COLUMN damage_modifier SET NOT NULL')
}
