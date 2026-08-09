// 190_choc1_palier1_shock_mechanism.js
// CHOC1 Palier 1 (docs/PLAN_CHOC1.md §4) — câblage du Choc porté par l'arme elle-même
// (ref_equipment.shock, jamais lu en résolution jusqu'ici) et par la mutation Corne.
//
// `shock_mechanism` est le seul signal d'opt-in : NULL = arme non câblée par ce palier (comportement
// strictement inchangé, y compris pour les ~15 armes à `shock` non-NULL mais hors scope — Palier 2
// bespoke [Gant choc, Bâton Ordonnateurs], mécaniques narratives/spéciales [Canon à infrasons, Sonar
// d'attaque(s), Canon sonique], armes à énergie [TMP I/II], `damage_h` tronqué [Chalumeau, Dague
// thermique Thermo IV, Lance thermique Solar/Fléau], armes de zone/Lance-flammes non tranchés — voir
// PLAN_CHOC1.md §4/§5). Ne JAMAIS dériver ce câblage de la simple présence de `shock` : deux colonnes
// par défaut (`shock_reduced_by_armor` true, `shock_mechanism` null) seraient indiscernables d'une
// ligne volontairement non traitée.
// 'tete_gated'  = catégorie 1 (dégât physique réel + Choc, LdB p.243 : Tête uniquement).
// 'pure'        = catégorie 2 (Choc pur, aucun gate de localisation).
// `shock_reduced_by_armor` : true par défaut (RAW p.243, Résistance du personnage/protection_shock
// s'applique) — seule exception connue : Dague neurale Brain, description propre "ignore toute
// protection" (docs/PLAN_CHOC1.md §3.2).
const CATEGORIE1_TETE_GATED = [
  'Matraque Mao', 'Poing choc', 'Électro-fouet', 'Fusil sonique d’attaque', 'Batte Dicta',
  'Bâton de combat', 'Canne de combat', 'Gant énergétique', 'Hache', 'Hache lourde (2M)',
  'Masse', 'Massue en bois', 'Massue en os',
]
const CATEGORIE2_PURE = [
  'Dague neurale Brain', 'Flex', 'Fusil choc Stun', 'Fusil sonique incap. sirène', 'Pistolet choc Stun II',
]

export const up = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.string('shock_mechanism', 20).nullable()
    table.boolean('shock_reduced_by_armor').notNullable().defaultTo(true)
  })
  await knex.schema.alterTable('ref_mutations', (table) => {
    // Mutation Corne (docs/PLAN_CHOC1.md §3.4) : bonus "+1D6 Choc si tête" — seule mutation concernée
    // aujourd'hui, gate/réduction RAW fixes (jamais de variation observée) donc pas de colonne
    // gate/armor séparée ici (contrairement à ref_equipment, où 18 armes ont un comportement mixte) —
    // à ajouter seulement si une 2ᵉ mutation Choc avec un comportement différent apparaît.
    table.string('natural_weapon_choc_formula', 20).nullable()
  })

  const countTeteGated = await knex('ref_equipment').whereIn('name', CATEGORIE1_TETE_GATED)
    .update({ shock_mechanism: 'tete_gated' })
  if (countTeteGated !== CATEGORIE1_TETE_GATED.length) {
    throw new Error(`190_choc1_palier1_shock_mechanism — attendu ${CATEGORIE1_TETE_GATED.length} lignes catégorie 1, ${countTeteGated} mises à jour (nom introuvable en base ?)`)
  }

  const countPure = await knex('ref_equipment').whereIn('name', CATEGORIE2_PURE)
    .update({ shock_mechanism: 'pure' })
  if (countPure !== CATEGORIE2_PURE.length) {
    throw new Error(`190_choc1_palier1_shock_mechanism — attendu ${CATEGORIE2_PURE.length} lignes catégorie 2, ${countPure} mises à jour (nom introuvable en base ?)`)
  }

  const countDagueBrain = await knex('ref_equipment').where({ name: 'Dague neurale Brain' })
    .update({ shock_reduced_by_armor: false })
  if (countDagueBrain !== 1) {
    throw new Error(`190_choc1_palier1_shock_mechanism — Dague neurale Brain introuvable (${countDagueBrain} ligne mise à jour)`)
  }

  const countCorne = await knex('ref_mutations').where({ name: 'Corne' })
    .update({ natural_weapon_choc_formula: '1D6' })
  if (countCorne !== 1) {
    throw new Error(`190_choc1_palier1_shock_mechanism — mutation Corne introuvable (${countCorne} ligne mise à jour)`)
  }
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.dropColumn('natural_weapon_choc_formula')
  })
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.dropColumn('shock_mechanism')
    table.dropColumn('shock_reduced_by_armor')
  })
}
