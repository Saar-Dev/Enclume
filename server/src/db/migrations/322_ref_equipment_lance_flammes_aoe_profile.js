// 322_ref_equipment_lance_flammes_aoe_profile.js — PLAN_ARMES_SPECIALES.md §1.4 segment 1 (1a)
//
// Le lance-flammes devient une arme AOE résoluble : sa zone d'effet est une DONNÉE
// (ref_equipment.aoe_profile, colonne posée en 321), plus un nom en dur. Autorité de lecture :
// shared/combatAoe.js (getAoeProfile / isAoeWeapon / getAoeMechanic). Le tronc de résolution
// (server/src/socket/socketCombatAoe.js) lira `mechanic === 'flamethrower'` pour router vers la
// branche cône (segment 1e).
//
//   { "shape": "cone", "angleDeg": 30, "mechanic": "flamethrower" }
//
// - `shape: 'cone'` — géométrie couche 1 déjà présente (shared/world/aoeShapes.js).
// - `angleDeg: 30` — SEUL paramètre libre : le RAW ne dit rien de l'angle (décision A,
//   docs/PLANS/PLAN_ARMES_SPECIALES.md §1.5-A → JOURNAL8). ±15° autour de la visée, réaliste pour
//   un jet qui s'évase peu.
// - Longueur du cône NON stockée : le resolver la dérive de `parseWeaponRangeBands(ref_range)` →
//   dernier seuil = 40 m (portée extrême du catalogue `3/7/15/30 (40)`, RAW, on n'y touche pas).
// - `mechanic: 'flamethrower'` — membre de AOE_MECHANICS (shared/combatAoe.js).
//
// Matché par `name` (clé métier), jamais par `id` — seed non déterministe entre instances
// (.claude/rules/core.md). Miroir exact de 321 pour le Klauss.

const LANCE_FLAMMES_PROFILE = { shape: 'cone', angleDeg: 30, mechanic: 'flamethrower' }

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: 'Lance-flammes' })
    .select('id', 'category', 'aoe_profile')
    .first()
  if (!row) throw new Error('ref_equipment introuvable : Lance-flammes')
  if (row.category !== 'Lanceur') {
    throw new Error(`Lance-flammes : category inattendue "${row.category}" — vérifier le catalogue avant de figer aoe_profile`)
  }
  if (row.aoe_profile == null) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: JSON.stringify(LANCE_FLAMMES_PROFILE) })
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: 'Lance-flammes' }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: null })
  }
}
