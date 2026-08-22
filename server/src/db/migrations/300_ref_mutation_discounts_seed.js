// 300_ref_mutation_discounts_seed.js — seed ref_mutation_discounts (5 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_mutation_discounts').insert([
    { "mutation_id": 6, "target_mutation_id": 15, "discount_amount": 1 },
    { "mutation_id": 6, "target_mutation_id": 45, "discount_amount": 3 },
    { "mutation_id": 6, "target_mutation_id": 10, "discount_amount": 1 },
    { "mutation_id": 6, "target_mutation_id": 31, "discount_amount": 1 },
    { "mutation_id": 32, "target_mutation_id": 39, "discount_amount": 1 }
  ])
}

export const down = async (knex) => {
  await knex('ref_mutation_discounts').del()
}
