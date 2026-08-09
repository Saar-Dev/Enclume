// 142_ref_equipment_lunette_niveaux.js
// docs/PLAN_MODING_PHASEB.md Groupe 2 — la ligne générique "Lunette de visée" (bonus="niv", texte
// non exploitable) est remplacée par 10 lignes catalogue distinctes (niv. 1 à 10), chacune avec un
// bonus entier réel. mod_slot='optique' (même slot exclusif que les autres optiques, Groupe 1/
// migration 141) + mod_requires_aim=true (jamais un bonus plat — variante du Tir visé).
// Prix : 1000×niveau² (formule ref_equipment.price_modifier, jamais exploitée par le code d'achat
// à ce jour — dette EQ1, hors scope ici — valeur précalculée en dur).
// 0 usage réel vérifié avant migration (char_inventory: 0, char_inventory_mods: 0) — remplacement
// propre sans perte de données.

const OLD_NAME = 'Systèmes d’aide à la visée : Lunette de visée'

const NEW_ROWS = Array.from({ length: 10 }, (_, i) => {
  const niv = i + 1
  return {
    name: `Systèmes d’aide à la visée : Lunette de visée niv. ${niv}`,
    bonus: String(niv),
    price: 1000 * niv * niv,
  }
})

export const up = async (knex) => {
  const old = await knex('ref_equipment').where({ name: OLD_NAME }).first()
  if (!old) throw new Error(`Migration 142 — ligne "${OLD_NAME}" introuvable`)

  await knex('ref_equipment').insert(NEW_ROWS.map(row => ({
    family:         old.family,
    category:       old.category,
    name:           row.name,
    description:    old.description,
    price:          row.price,
    price_modifier: old.price_modifier,
    weight:         old.weight,
    tech_level:     old.tech_level,
    manufacturer:   old.manufacturer,
    bonus:          row.bonus,
    nation:         old.nation,
    rarity:         old.rarity,
    mod_slot:         'optique',
    mod_requires_aim: true,
  })))

  await knex('ref_equipment').where({ id: old.id }).del()
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where('name', 'like', 'Systèmes d’aide à la visée : Lunette de visée niv. %')
    .del()

  // Valeurs vérifiées contre la source pré-migration (docs/Old/script Extraction Excel/equipement/
  // ref_equipments_data.js, EQ_00163) et les 15 accessoires soeurs intacts en base — sauf
  // price_modifier, jamais capturé avant suppression de la ligne originale par up() : reconstruit
  // par analogie avec "Silencieux" (seul autre accessoire de cette table à en avoir un, "x niv") et
  // le texte source "1000 x (niv x niv)" — best-effort, non revérifié caractère pour caractère.
  await knex('ref_equipment').insert({
    family: 'Armes',
    category: 'Accessoires pour armes',
    name: OLD_NAME,
    description: 'Une lunette est prévue pour équiper un type d’arme bien précis (pistolet, fusil d’assaut, fusil de précision, etc.). Chaque niveau offre un bonus de +1 au Test de tir, jusqu’à un maximum de +10. Pour utiliser une lunette il faut obligatoirement effectuer un Tir visé, en consacrant un point d’Initiative par point de bonus (ex : lunette niv. 5 = 5 points d’Initiative). Attention : le bonus de la lunette et celui du Tir visé ne sont pas cumulatifs : on ne prend que le plus élevé. De plus, plus le niveau d’une lunette est élevé, plus elle est destinée à des tirs à longue portée (un personnage ne devrait pas pouvoir utiliser une lunette de niveau supérieur à 3 à courte portée, ou supérieur à 5 à moyenne portée). Une lunette peut être équipée d’un système de détection spécial (voir Lunettes, jumelles et visières, page 294).',
    price: 1000,
    price_modifier: 'x (niv x niv)',
    weight: 0.1,
    tech_level: 2,
    manufacturer: 'Trinicom',
    bonus: 'niv',
    rarity: '15 (20)',
    mod_slot: 'optique',
    mod_requires_aim: true,
  })
}
