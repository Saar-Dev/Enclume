// 135_ref_equipment_skill_assoc_weapons.js
// ref_equipment_skill_assoc (« compétence d'utilisation ») n'a jamais été peuplée pour la quasi-
// totalité du catalogue d'armes — table distincte de ref_equipment_skills (« compétences boostées/
// requises »), jamais alimentée par aucun seed/migration depuis sa création (migration 48). Les 25
// lignes trouvées en base provenaient de tests manuels ponctuels via l'admin API (routes/equipment.js),
// jamais reliées à la donnée source. Voir docs/JOURNAL6.md pour l'investigation complète.
//
// Source : docs/ExtractCOMP.md (colonne « Compétence associée », 139 armes) — chaque nom recoupé
// avec ref_equipment.name (139/139 matchés, 0 orphelin, 0 doublon), chaque libellé recoupé avec
// ref_skills.id (11 libellés, tous vérifiés existants). Contenu de WEAPON_SKILL_PAIRS généré par
// script depuis ce fichier, jamais retapé à la main.
//
// 3 corrections confirmées par Saar sur des items hors périmètre du fichier (déjà en base, valeurs
// jugées incorrectes après vérification croisée avec REGLECOMPETENCE.md) :
//  - TMP II : Fusil/Armes d'épaules (erroné, catégorisation Arme à énergie ambiguë) → Armes lourdes
//    + Tir automatique.
//  - Canon à infrasons : Arme spéciale à distance générique → Armes lourdes (décision Saar).
//  - Lance-flammes : Arme spéciale de CONTACT (FOR/COO) → Arme spéciale à DISTANCE (COO/PER) —
//    REGLECOMPETENCE.md p.191 cite littéralement le lance-flamme comme exemple de la compétence
//    distance, jamais contact ; confirmé par le texte même de ref_skills.description pour
//    ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION. category='Lanceur'/fire_mode='RL' cohérents.

const WEAPON_SKILL_PAIRS = [
  ["TMP II", "ARMES_LOURDES"],
  ["TMP II", "TIR_AUTOMATIQUES"],
  ["AX 56", "FUSIL_ARMES_DEPAULES"],
  ["AX 56", "TIR_AUTOMATIQUES"],
  ["FAV 34", "FUSIL_ARMES_DEPAULES"],
  ["FAV 34", "TIR_AUTOMATIQUES"],
  ["Kevler", "TIR_AUTOMATIQUES"],
  ["MASS 64", "FUSIL_ARMES_DEPAULES"],
  ["MASS 64", "TIR_AUTOMATIQUES"],
  ["Morgan EX", "FUSIL_ARMES_DEPAULES"],
  ["Scorpion Ultra", "FUSIL_ARMES_DEPAULES"],
  ["Scorpion Ultra", "TIR_AUTOMATIQUES"],
  ["FAV 76", "FUSIL_ARMES_DEPAULES"],
  ["FAV 76", "TIR_AUTOMATIQUES"],
  ["FV 12 Répliquant", "TIR_AUTOMATIQUES"],
  ["Gem 400", "TIR_AUTOMATIQUES"],
  ["Loknar", "FUSIL_ARMES_DEPAULES"],
  ["Néca II", "FUSIL_ARMES_DEPAULES"],
  ["Slice Mod II", "FUSIL_ARMES_DEPAULES"],
  ["Ten DS", "FUSIL_ARMES_DEPAULES"],
  ["Klauss", "FUSIL_ARMES_DEPAULES"],
  ["Bâton de combat", "COMBAT_ARME"],
  ["Bâton Ordonnateurs", "COMBAT_ARME"],
  ["Batte Dicta", "COMBAT_ARME"],
  ["Canne de combat", "COMBAT_ARME"],
  ["Chalumeau", "COMBAT_ARME"],
  ["Couteau Congre", "COMBAT_ARME"],
  ["Couteau en os", "COMBAT_ARME"],
  ["Dague moléc. Pulsar", "COMBAT_ARME"],
  ["Dague Shark", "COMBAT_ARME"],
  ["Dague thermique Thermo IV", "COMBAT_ARME"],
  ["Découpe carlingue Scianor", "COMBAT_ARME"],
  ["Découpe roche poche", "COMBAT_ARME"],
  ["Découpe roche Portable", "COMBAT_ARME"],
  ["Électro-fouet", "COMBAT_ARME"],
  ["Épée/sabre Capitan", "COMBAT_ARME"],
  ["Foreuse Clyss", "COMBAT_ARME"],
  ["Gant choc", "COMBAT_ARME"],
  ["Gant énergétique", "COMBAT_ARME"],
  ["Gant magma", "COMBAT_ARME"],
  ["Griffe de combat", "COMBAT_ARME"],
  ["Griffes primitives", "COMBAT_ARME"],
  ["GriffesTech", "COMBAT_ARME"],
  ["Hache", "COMBAT_ARME"],
  ["Hache lourde (2M)", "COMBAT_ARME"],
  ["Lance", "COMBAT_ARME"],
  ["Lance thermique Fléau", "COMBAT_ARME"],
  ["Lance thermique Solar", "COMBAT_ARME"],
  ["Masse", "COMBAT_ARME"],
  ["Masse/maillet à deux mains", "COMBAT_ARME"],
  ["Massue en bois", "COMBAT_ARME"],
  ["Massue en os", "COMBAT_ARME"],
  ["Matraque", "COMBAT_ARME"],
  ["Matraque Mao", "COMBAT_ARME"],
  ["Perforateur", "COMBAT_ARME"],
  ["Poing américain", "COMBAT_ARME"],
  ["Poing choc", "COMBAT_ARME"],
  ["Sabre à 2 mains", "COMBAT_ARME"],
  ["Arbalète Leysur IV", "ARMES_DE_TRAIT"],
  ["Arbalète primitive", "ARMES_DE_TRAIT"],
  ["Arc Ibram Flexi", "ARMES_DE_TRAIT"],
  ["Arc primitif", "ARMES_DE_TRAIT"],
  ["Fronde", "ARMES_DE_TRAIT"],
  ["Lance poignard", "ARMES_DE_TRAIT"],
  ["F67", "ARMES_LOURDES"],
  ["Gatling micro Cyclone", "ARMES_LOURDES"],
  ["Ningram", "ARMES_LOURDES"],
  ["Thor", "ARMES_LOURDES"],
  ["NeoA", "ARMES_LOURDES"],
  ["NeoA", "TIR_AUTOMATIQUES"],
  ["Telen II", "ARMES_LOURDES"],
  ["Telen II", "TIR_AUTOMATIQUES"],
  ["Oxi4", "ARMES_LOURDES"],
  ["Oxi4", "TIR_AUTOMATIQUES"],
  ["Mini-canon rotatif", "ARMES_LOURDES"],
  ["Fusil Gauss", "ARMES_LOURDES"],
  ["MHCT-micro", "ARMES_LOURDES"],
  ["Gatling SC Kora", "TIR_AUTOMATIQUES"],
  ["Canon Manta V", "ARMES_LOURDES"],
  ["Hellion Alpha", "ARMES_DE_POING"],
  ["Hellion Alpha II", "ARMES_DE_POING"],
  ["Cougar 125", "ARMES_DE_POING"],
  ["Beldam II", "FUSIL_ARMES_DEPAULES"],
  ["Beldam II", "TIR_AUTOMATIQUES"],
  ["« Disque fou » sick", "ARMES_DE_JET"],
  ["Boomerang", "ARMES_DE_JET"],
  ["Couteau de lancer", "ARMES_DE_JET"],
  ["Dague de lancer", "ARMES_DE_JET"],
  ["Dard", "ARMES_DE_JET"],
  ["Disque à énergie foudre", "ARMES_DE_JET"],
  ["Disque à fragmentation", "ARMES_DE_JET"],
  ["Disque tranchant (normal)", "ARMES_DE_JET"],
  ["Disque-drone", "ARMES_DE_JET"],
  ["Hache (1 main)", "ARMES_DE_JET"],
  ["Hache de lancer", "ARMES_DE_JET"],
  ["Hache de lancer lourde", "ARMES_DE_JET"],
  ["Javelot", "ARMES_DE_JET"],
  ["Lance", "ARMES_DE_JET"],
  ["Shuriken", "ARMES_DE_JET"],
  ["Trident", "ARMES_DE_JET"],
  ["Flex", "ARMES_DE_POING"],
  ["Faucheur III", "ARMES_DE_POING"],
  ["MK 56", "ARMES_DE_POING"],
  ["Prion", "ARMES_DE_POING"],
  ["ANG 200", "ARMES_DE_POING"],
  ["Exiss Delta", "ARMES_DE_POING"],
  ["Slington Sp.", "ARMES_DE_POING"],
  ["Vega Ultra", "ARMES_DE_JET"],
  ["Neuman", "ARMES_DE_POING"],
  ["Peclinor", "ARMES_DE_POING"],
  ["Scorpion", "ARMES_DE_POING"],
  ["MK28", "ARMES_DE_POING"],
  ["Norston", "ARMES_DE_POING"],
  ["Ozer 43", "ARMES_DE_POING"],
  ["Vega python", "ARMES_DE_POING"],
  ["Mc Glenn", "ARMES_DE_POING"],
  ["Paloma", "ARMES_DE_POING"],
  ["Paloma", "TIR_AUTOMATIQUES"],
  ["Pek II", "ARMES_DE_POING"],
  ["Tylman", "ARMES_DE_POING"],
  ["Lanceur de poignet Hybri 500", "ARMES_SOUS_MARINES"],
  ["Nomrad IP", "ARMES_SOUS_MARINES"],
  ["Locard ExelP", "ARMES_SOUS_MARINES"],
  ["Embol Mk 4P", "ARMES_SOUS_MARINES"],
  ["Lance-harpon mini", "ARMES_SOUS_MARINES"],
  ["Lance-harpon mini double Bis", "ARMES_SOUS_MARINES"],
  ["Lance-harpon à répétition Fulgur", "ARMES_SOUS_MARINES"],
  ["Lance-harpon moyen", "ARMES_SOUS_MARINES"],
  ["Lance-harpon lourd", "ARMES_SOUS_MARINES"],
  ["Lance-harpon lourd à répétition Nihil", "ARMES_SOUS_MARINES"],
]

const MANUAL_DELETE = [
  ["TMP II", "FUSIL_ARMES_DEPAULES"],
  ["Canon à infrasons", "ARME_SPECIALE_DISTANCE"],
  ["Lance-flammes", "ARMES_SPECIALES_CONTACT_FORCE_COORDINATION"],
]

const MANUAL_INSERT = [
  ["Canon à infrasons", "ARMES_LOURDES"],
  ["Lance-flammes", "ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION"],
]

async function getItemIds(knex, names) {
  const rows = await knex('ref_equipment').whereIn('name', names).select('id', 'name')
  const map = {}
  for (const r of rows) map[r.name] = r.id
  for (const n of names) {
    if (!map[n]) throw new Error()
  }
  return map
}

export const up = async (knex) => {
  const allNames = [...new Set([...WEAPON_SKILL_PAIRS, ...MANUAL_DELETE, ...MANUAL_INSERT].map(p => p[0]))]
  const ids = await getItemIds(knex, allNames)

  for (const [name, skillId] of MANUAL_DELETE) {
    await knex('ref_equipment_skill_assoc').where({ item_id: ids[name], skill_id: skillId }).del()
  }

  const toInsert = [...WEAPON_SKILL_PAIRS, ...MANUAL_INSERT].map(([name, skillId]) => ({ item_id: ids[name], skill_id: skillId }))
  await knex('ref_equipment_skill_assoc').insert(toInsert).onConflict(['item_id', 'skill_id']).ignore()
}

export const down = async (knex) => {
  const allNames = [...new Set([...WEAPON_SKILL_PAIRS, ...MANUAL_DELETE, ...MANUAL_INSERT].map(p => p[0]))]
  const ids = await getItemIds(knex, allNames)

  const toRemove = [...WEAPON_SKILL_PAIRS, ...MANUAL_INSERT]
  for (const [name, skillId] of toRemove) {
    await knex('ref_equipment_skill_assoc').where({ item_id: ids[name], skill_id: skillId }).del()
  }

  const toRestore = MANUAL_DELETE.map(([name, skillId]) => ({ item_id: ids[name], skill_id: skillId }))
  if (toRestore.length) {
    await knex('ref_equipment_skill_assoc').insert(toRestore).onConflict(['item_id', 'skill_id']).ignore()
  }
}
