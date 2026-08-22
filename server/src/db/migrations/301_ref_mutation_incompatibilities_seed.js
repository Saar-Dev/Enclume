// 301_ref_mutation_incompatibilities_seed.js — seed ref_mutation_incompatibilities (3 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_mutation_incompatibilities').insert([
    { "mutation_id_a": 28, "mutation_id_b": 43 },
    { "mutation_id_a": 28, "mutation_id_b": 33 },
    { "mutation_id_a": 33, "mutation_id_b": 43 }
  ])
}

export const down = async (knex) => {
  await knex('ref_mutation_incompatibilities').del()
}
