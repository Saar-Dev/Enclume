// 385_ref_equipment_grenade_frag_throw_range.js — ticket GRENADE-COORD-MODS
//
// La grenade à fragmentation n'avait aucune portée de lancer (`range` = null) : le Test de
// Coordination du lancer ne pouvait donc appliquer aucune difficulté liée à la distance visée
// (carte de jet affichant « Dif. : — »). Décision Saar 2026-10-09 : le RAW (« modificateurs liés à
// la taille des cibles ») est inapplicable ici — une grenade vise toujours un point, jamais une
// cible d'une taille donnée — remplacé par la distance réelle du lancer, seule variable qui ait un
// sens. Valeur = portée déjà publiée du Javelot (aucune formule RAW de portée de lancer n'existe),
// détail et sources : shared/combatRange.js#GRENADE_THROW_RANGE (même chiffre, à maintenir en
// phase manuellement — garde : shared/combatRange.test.mjs, patron de la migration 325).
//
// Matché par `name` (clé métier), jamais par `id` — seed non déterministe entre instances
// (.claude/rules/core.md, SEED-ID-DETERM). Miroir structurel de 325 (aoe_profile de la même arme).

const GRENADE_FRAG_THROW_RANGE = '2/5/10/20 (40)' // doit rester identique à GRENADE_THROW_RANGE

export const up = async (knex) => {
  const row = await knex('ref_equipment')
    .where({ name: 'Grenade à fragmentation' })
    .select('id', 'category', 'range')
    .first()
  if (!row) throw new Error('ref_equipment introuvable : Grenade à fragmentation')
  if (row.category !== 'Grenade') {
    throw new Error(`Grenade à fragmentation : category inattendue "${row.category}" — vérifier le catalogue avant de figer range`)
  }
  if (row.range == null) {
    await knex('ref_equipment').where({ id: row.id }).update({ range: GRENADE_FRAG_THROW_RANGE })
  }
}

export const down = async (knex) => {
  const row = await knex('ref_equipment').where({ name: 'Grenade à fragmentation' }).select('id').first()
  if (row) {
    await knex('ref_equipment').where({ id: row.id }).update({ range: null })
  }
}
