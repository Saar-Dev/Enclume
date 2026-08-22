// 292_ref_career_prerequisites_seed.js — seed ref_career_prerequisites (0 lignes, source: vtt)
export const up = async (knex) => {
  // aucune ligne à ce jour pour ref_career_prerequisites — insert([]) ferait échouer la migration (testé)
}

export const down = async (knex) => {
  await knex('ref_career_prerequisites').del()
}
