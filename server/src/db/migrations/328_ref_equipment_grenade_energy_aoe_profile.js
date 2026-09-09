// 328_ref_equipment_grenade_energy_aoe_profile.js — PLAN_GRENADES.md §6 (Segment 3-bis)
//
// La grenade à énergie devient une arme AOE résoluble : sa zone d'effet est une DONNÉE
// (ref_equipment.aoe_profile), plus un texte libre dans `description`. Autorité de lecture :
// shared/combatAoe.js (getAoeProfile / isAoeWeapon / getAoeMechanic).
//
//   { "shape": "circle", "mechanic": "grenade_energy", "radiusM": 2.5 }
//
// - `shape: 'circle'` — visée « point » côté client (le lanceur choisit où la grenade atterrit),
//   comme la grenade à fragmentation.
// - `mechanic: 'grenade_energy'` — membre de AOE_MECHANICS (shared/combatAoe.js) ; resolver
//   server/src/lib/aoeMechanisms/grenadeEnergy.js (squelette cercle partagé circleGrenade.js).
// - `radiusM: 2.5` — rayon d'effet, autorité UNIQUE lue par grenadeEnergy.buildShape ET par l'aperçu
//   client. RAW : « champ d'énergie, limité à un diamètre de 5 m » → rayon 2,5 m (division Ø→rayon,
//   écart acté JOURNAL8). Champ UNIFORME : aucune dégression, aucune table de paliers.
//
// Miroir exact de 325 (grenade à fragmentation). Matché par `name` (clé métier), jamais par `id` —
// seed non déterministe entre instances (.claude/rules/core.md). Rétrocompatible : une ligne sans
// resolver serait rejetée en amont avec un message clair, mais grenade_energy EST au registre.

const GRENADE_ENERGY_PROFILE = { shape: 'circle', mechanic: 'grenade_energy', radiusM: 2.5 }

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: 'Grenade à énergie' })
    .select('id', 'category', 'aoe_profile')
    .first()
  if (!row) throw new Error('ref_equipment introuvable : Grenade à énergie')
  if (row.category !== 'Grenade') {
    throw new Error(`Grenade à énergie : category inattendue "${row.category}" — vérifier le catalogue avant de figer aoe_profile`)
  }
  if (row.aoe_profile == null) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: JSON.stringify(GRENADE_ENERGY_PROFILE) })
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: 'Grenade à énergie' }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: null })
  }
}
