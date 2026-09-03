// 321_ref_equipment_aoe_profile.js — PLAN_ARMES_SPECIALES.md §1.6 segment 0b-A
//
// L'AOE-ness d'une arme devient une DONNÉE, plus un nom en dur (SHOTGUN_SPREAD_WEAPON_NAMES,
// ref_name === 'Lance-flammes'). Pattern Foundry VTT dnd5e : target.template = { type, size, ... }
// résolu via un registre. Autorité de lecture : shared/combatAoe.js (getAoeProfile / isAoeWeapon /
// getAoeMechanic).
//
// Forme de aoe_profile (JSONB, nullable — NULL = arme non-AOE, le cas courant) :
//   { "shape": "ray"|"cone"|"circle", "mechanic": "<id>", ...params propres au mécanisme }
//
// Colonne + première ligne peuplée (Klauss / fusil à pompe) dans la même migration : un seul fait
// logique (« aoe_profile existe, et le Klauss est une arme de dispersion »). Le Lance-flammes prendra
// son propre profil dans une migration du segment 1. Matché par `name` (clé métier), jamais par `id`
// (seed non déterministe entre instances — .claude/rules/core.md).

const KLAUSS_PROFILE = { shape: 'ray', mechanic: 'shotgun_spread' }

export const up = async (knex) => {
  await knex.raw("ALTER TABLE ref_equipment ADD COLUMN IF NOT EXISTS aoe_profile jsonb")

  const klauss = await knex('ref_equipment').where({ name: 'Klauss' }).select('id', 'category', 'aoe_profile').first()
  if (!klauss) throw new Error('ref_equipment introuvable : Klauss')
  if (klauss.category !== "Arme d'épaule") {
    throw new Error(`Klauss : category inattendue "${klauss.category}" — vérifier le catalogue avant de figer aoe_profile`)
  }
  if (klauss.aoe_profile == null) {
    await knex('ref_equipment').where({ id: klauss.id }).update({ aoe_profile: JSON.stringify(KLAUSS_PROFILE) })
  }
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE ref_equipment DROP COLUMN IF EXISTS aoe_profile')
}
