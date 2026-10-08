// server/src/db/migrations/384_ref_equipment_remove_legacy_programmes.js
// Catalogue — 19 lignes "Programmes" legacy (chantier Informatique Lot 1,
// docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 1, 2026-09-15/16) : doublons jamais référencés de la
// vraie famille "Logiciels" (347_ref_equipment_guidetech_programs_seed.js) — ex. "Programme
// ami/ennemi" (ici) vs "Ami/ennemi" (famille Logiciels, utilisée par exo_programs/drone_programs).
// Confirmé par correspondance directe des noms (2026-10-08) : les 19 noms "Programme(s) X" de
// cette catégorie reprennent, préfixe en moins, des noms déjà présents dans family='Logiciels'.
//
// Ciblage par clé métier (family + category), jamais par id ni par liste de noms exacts
// (rules/core.md, SEED-ID-DETERM) : ces lignes portent des variantes d'encodage historiques sur
// le nom (apostrophe courbe/droite, une troncature) — matcher par nom serait fragile d'un
// environnement à l'autre. family+category sont les chaînes littérales exactes du seed d'origine
// (303_ref_equipment_seed.js), identiques sur tout environnement ayant déjà cette migration
// foundational. Un comptage strict (exactement 19) protège malgré tout contre toute dérive : un
// écart fait échouer la migration avant de rien supprimer.
//
// Garde défensive : certaines FK vers ref_equipment sont SET NULL/CASCADE (char_inventory
// .equipment_id/.current_ammo, char_inventory_mods.equipment_id, ref_equipment_ammo_compat
// .ammo_id/.weapon_id, ref_equipment_skill_assoc.item_id, ref_equipment_skills.item_id) — une
// suppression y réussirait silencieusement même si une vraie ligne de jeu dépendait de l'une des
// 19 lignes (vécu ailleurs : incident Kiwi documenté docs/SYSTEME/CORE.md P57). Les FK
// RESTRICT/NO ACTION (drone_programs, drone_weapons, exo_programs, exo_systems, exo_weapons,
// ref_exo_template_equipment) bloqueraient déjà nativement, mais sont vérifiées ici aussi pour un
// message d'erreur explicite plutôt qu'une exception SQL brute à l'exécution réelle (Kiwi compris).

const FAMILY = 'Équipement informatique et logiciels'
const CATEGORY = 'Programmes'
const EXPECTED_COUNT = 19

const REFERENCING_TABLES = [
  ['char_inventory', 'equipment_id'],
  ['char_inventory', 'current_ammo'],
  ['char_inventory_mods', 'equipment_id'],
  ['ref_equipment_ammo_compat', 'ammo_id'],
  ['ref_equipment_ammo_compat', 'weapon_id'],
  ['ref_equipment_skill_assoc', 'item_id'],
  ['ref_equipment_skills', 'item_id'],
  ['drone_programs', 'equipment_id'],
  ['drone_weapons', 'equipment_id'],
  ['exo_programs', 'equipment_id'],
  ['exo_systems', 'ref_equipment_id'],
  ['exo_weapons', 'ref_equipment_id'],
  ['ref_exo_template_equipment', 'ref_equipment_id'],
]

export async function up(knex) {
  const rows = await knex('ref_equipment').select('id').where({ family: FAMILY, category: CATEGORY })
  if (rows.length !== EXPECTED_COUNT) {
    throw new Error(
      `384_ref_equipment_remove_legacy_programmes : ${rows.length} ligne(s) trouvée(s) pour `
      + `family="${FAMILY}" category="${CATEGORY}", ${EXPECTED_COUNT} attendues — migration interrompue, rien supprimé.`
    )
  }
  const ids = rows.map((r) => r.id)

  for (const [table, column] of REFERENCING_TABLES) {
    const { count } = await knex(table).whereIn(column, ids).count('* as count').first()
    if (Number(count) > 0) {
      throw new Error(
        `384_ref_equipment_remove_legacy_programmes : ${count} ligne(s) de ${table}.${column} `
        + 'référencent encore une des 19 lignes "Programmes" legacy — migration interrompue, rien supprimé.'
      )
    }
  }

  await knex('ref_equipment').whereIn('id', ids).del()
}

export async function down() {
  // Irréversible par nature (suppression de données confirmées mortes, doublons jamais
  // référencés) — même convention que 132_char_sheet_dedupe_and_unique.js et
  // 75_ammo_caliber_names_fix.js (migrations_archive) : down() ne restaure pas les lignes
  // supprimées, ce n'est pas un défaut de cette migration.
}
