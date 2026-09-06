// 325_ref_equipment_grenade_frag_aoe_profile.js — PLAN_GRENADES.md §6 (Segment 3, migration catalogue)
//
// La grenade à fragmentation devient une arme AOE résoluble : sa zone d'effet est une DONNÉE
// (ref_equipment.aoe_profile, colonne posée en 321), plus un texte libre dans `description`.
// Autorité de lecture : shared/combatAoe.js (getAoeProfile / isAoeWeapon / getAoeMechanic).
//
//   { "shape": "circle", "mechanic": "grenade_frag", "radiusM": 15 }
//
// - `shape: 'circle'` — géométrie couche 1 déjà présente (shared/world/aoeShapes.js). Côté client,
//   `shape === 'circle'` bascule la visée en mode « point » (le lanceur choisit où la grenade
//   atterrit), pas « direction ».
// - `mechanic: 'grenade_frag'` — membre de AOE_MECHANICS (shared/combatAoe.js) ; resolver
//   server/src/lib/aoeMechanisms/grenadeFrag.js (Segment 3a).
// - `radiusM: 15` — rayon d'effet, autorité UNIQUE lue par grenadeFrag.buildShape ET par l'aperçu
//   client (aoePreviewShape.js), comme `angleDeg` pour le cône du lance-flammes. Vaut la borne du
//   dernier palier de dégression RAW (GRENADE_FRAG_BANDS : Ø 20-30 m = rayon 15 m ; au-delà « Rien
//   d'autre n'est affecté », REGLES_ARMES_SPECIALES.md). La table de dégression elle-même n'est pas
//   stockée — c'est une constante de code partagée (grenadeFrag.js).
//
// ⚠ ÉTAT INTERMÉDIAIRE au moment où cette migration s'applique : le LANCER (Test de Coordination +
// dispersion 1D6 sur échec → explosion différée au Tour suivant) est le Segment 3d, pas encore câblé.
// Déclarer un lancer de grenade fonctionne (bouton « Viser un point », aperçu du disque) ; à la
// RÉSOLUTION, resolveAoeAssaultAction renvoie un message clair « pas encore implémenté (Segment 3d) »
// (garde `aoe.intendedOrigin && !aoe.resolvedOrigin`). Rétrocompatible.
//
// Matché par `name` (clé métier), jamais par `id` — seed non déterministe entre instances
// (.claude/rules/core.md). Miroir exact de 322 (lance-flammes). SEULE la ligne fragmentation :
// concussion / sonique / rayons fixes / capsules = Segment 3-bis, une migration par mécanisme.

const GRENADE_FRAG_PROFILE = { shape: 'circle', mechanic: 'grenade_frag', radiusM: 15 }

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: 'Grenade à fragmentation' })
    .select('id', 'category', 'aoe_profile')
    .first()
  if (!row) throw new Error('ref_equipment introuvable : Grenade à fragmentation')
  if (row.category !== 'Grenade') {
    throw new Error(`Grenade à fragmentation : category inattendue "${row.category}" — vérifier le catalogue avant de figer aoe_profile`)
  }
  if (row.aoe_profile == null) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: JSON.stringify(GRENADE_FRAG_PROFILE) })
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: 'Grenade à fragmentation' }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ aoe_profile: null })
  }
}
