/**
 * Migration 264 — catalogue Lance-leurre (PLAN_EXOARMURE.md §13.4.4, Moloch 15/16 + §14)
 *
 * "Lance-leurres, 6 leurres niv. 3" (Moloch) n'avait aucune correspondance catalogue — recherché
 * exhaustivement dans `ref_exo_equipment` ET `ref_equipment` (leurre/décoy/contre-mesure/diffuseur/
 * appât/diversion), aucun résultat. Saar a clarifié que "niv. 3" du RAW est en réalité une **Taille**
 * (même grille que Lance-torpilles/Lance-missiles, migration 261) et fourni la table RAW complète
 * TAILLE/COÛT/DOMMAGES/PORTÉE/DIS, avec Ini. -7 et Mode de tir CC constants sur toute la grille, NT II.
 *
 * `damage=null` sur les 10 lignes : la colonne "Dommages" RAW est vide sur toute la table — un leurre
 * ne fait pas de dégâts, c'est un objectif de diversion pour torpilles/missiles adverses, cohérent avec
 * sa fonction (pas une omission de transcription).
 *
 * Seule la Taille 3 est attestée dans les 16 fiches (Moloch) ; Taille 1-2 et 4-10 sont ajoutées par
 * extensibilité, même principe que Lance-torpilles/Lance-missiles Taille 1 (migration 261).
 *
 * id laissés à gen_random_uuid() (cf. `.claude/rules/core.md` — idempotence par `name` uniquement).
 */

const TAILLE_TABLE = [
  { taille: 1,  price: 1000,   range: 'Courte',  rarity: '15 (20)' },
  { taille: 2,  price: 2000,   range: 'Courte',  rarity: '15 (20)' },
  { taille: 3,  price: 4000,   range: 'Moyenne', rarity: '10 (15)' },
  { taille: 4,  price: 10000,  range: 'Moyenne', rarity: '10 (15)' },
  { taille: 5,  price: 20000,  range: 'Longue',  rarity: '10 (15)' },
  { taille: 6,  price: 40000,  range: 'Longue',  rarity: '5 (10)' },
  { taille: 7,  price: 80000,  range: 'Longue',  rarity: '5 (10)' },
  { taille: 8,  price: 100000, range: 'Extrême', rarity: '5 (10)' },
  { taille: 9,  price: 200000, range: 'Extrême', rarity: '-1 (5)' },
  { taille: 10, price: 250000, range: 'Extrême', rarity: '-1 (5)' },
]

const EQUIPMENT = TAILLE_TABLE.map(({ taille, price, range, rarity }) => ({
  family: 'arme',
  category: 'Torpilles et missiles',
  name: `Lance-leurre Taille ${taille}`,
  price,
  range,
  rarity,
  init_mod: -7,
  fire_mode: 'CC',
  tech_level: 'II',
  damage: null,
  description: taille === 3
    ? 'Attesté (Moloch, "6 leurres niv. 3" — RAW "niv." désigne ici la Taille, PLAN_EXOARMURE.md §14).'
    : 'Non attestée dans les 16 fiches RAW — ajoutée par extensibilité, grille Taille 1-10 fournie par Saar.',
}))

export const up = async (knex) => {
  await knex('ref_exo_equipment').insert(EQUIPMENT)
}

export const down = async (knex) => {
  await knex('ref_exo_equipment').whereIn('name', EQUIPMENT.map((e) => e.name)).delete()
}
