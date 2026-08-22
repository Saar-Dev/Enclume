// 306_ref_equipment_ammo_compat_seed.js — seed ref_equipment_ammo_compat (0 lignes, source: vtt)
export const up = async (knex) => {
  // aucune ligne à ce jour pour ref_equipment_ammo_compat — insert([]) ferait échouer la migration (testé)
}

export const down = async (knex) => {
  await knex('ref_equipment_ammo_compat').del()
}
