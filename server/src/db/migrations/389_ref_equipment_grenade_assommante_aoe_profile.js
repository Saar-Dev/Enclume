// 389_ref_equipment_grenade_assommante_aoe_profile.js — PLAN_GRENADES.md §6 (Segment 3-bis, reprise 1)
//
// La grenade assommante devient une arme AOE résoluble, lançable, avec son Choc câblé. Trois faits
// logiques sur la MÊME ligne catalogue, posés ensemble (jamais de migration empilée pour corriger
// celle-ci — rules/migrations.md) :
//
//   1. `aoe_profile` (shape/mécanisme/rayon), même autorité que 325/328 :
//        { "shape": "circle", "mechanic": "grenade_stun", "radiusM": 2.5 }
//      `radiusM: 2.5` — RAW « 5 mètres de diamètre » → rayon 2,5 m (division Ø→rayon, écart déjà
//      acté pour grenade_energy, JOURNAL8). Champ UNIFORME : aucune dégression, aucune table de paliers.
//      Resolver : server/src/lib/aoeMechanisms/grenadeStun.js (squelette cercle circleGrenade.js).
//
//   2. `shock_mechanism = 'pure'` — même correctif que 323 (lance-flammes) : `shock = '2D10'` est déjà
//      posé au seed (303) mais `_fetchWeaponAndAmmo`/`buildWeaponShockDsl` (damageService.js) refusent
//      de dériver un Choc sans `shock_mechanism` non-null. RAW ne conditionne ce Choc à aucune
//      Localisation (contrairement à une arme contondante « tete_gated ») → `'pure'`, Choc quelle que
//      soit la Localisation touchée. `shock_reduced_by_armor` vaut déjà `true` par défaut de colonne
//      (65_ref_equipment.js) — c'est la norme RAW p.243, rien à changer dessus.
//
//   3. `range = GRENADE_THROW_RANGE` (shared/combatRange.js) — même correctif que 385 (grenade à
//      fragmentation) : sans portée de lancer catalogue, `resolveGrenadeThrow` (socketCombatAoe.js,
//      ticket GRENADE-COORD-MODS) bloque tout lancer (« point visé hors de portée ») quelle que soit
//      la distance réelle — `resolveWeaponRangeBand(distance, null)` ne renvoie jamais `status:'ok'`.
//
// Matché par `name` (clé métier), jamais par `id` — seed non déterministe entre instances
// (.claude/rules/core.md). Rétrocompatible : sans resolver au registre, une ligne `aoe_profile` serait
// rejetée en amont avec un message clair, mais `grenade_stun` EST au registre (voir registry.js).

import { GRENADE_THROW_RANGE } from '../../../../shared/combatRange.js'

const GRENADE_STUN_PROFILE = { shape: 'circle', mechanic: 'grenade_stun', radiusM: 2.5 }
const NAME = 'Grenade assommante'

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: NAME })
    .select('id', 'category', 'shock', 'shock_mechanism', 'aoe_profile', 'range')
    .first()
  if (!row) throw new Error(`ref_equipment introuvable : ${NAME}`)
  if (row.category !== 'Grenade') {
    throw new Error(`${NAME} : category inattendue "${row.category}" — vérifier le catalogue avant de figer aoe_profile/shock_mechanism/range`)
  }
  if (row.shock !== '2D10') {
    throw new Error(`${NAME} : shock inattendu "${row.shock}" — vérifier le catalogue avant de câbler le Choc`)
  }

  const updates = {}
  if (row.aoe_profile == null) updates.aoe_profile = JSON.stringify(GRENADE_STUN_PROFILE)
  if (row.shock_mechanism == null) updates.shock_mechanism = 'pure'
  if (row.range == null) updates.range = GRENADE_THROW_RANGE
  if (Object.keys(updates).length > 0) {
    await knex('ref_equipment').where({ id: row.id }).update(updates)
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: NAME }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: null, shock_mechanism: null, range: null })
  }
}
