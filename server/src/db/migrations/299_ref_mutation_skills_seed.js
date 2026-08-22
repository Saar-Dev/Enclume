// 299_ref_mutation_skills_seed.js — seed ref_mutation_skills (10 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_mutation_skills').insert([
    { "mutation_id": 1, "skill_name": "Adaptation extérieure", "skill_attrs": "CON/CON", "skill_base": -3, "cost_mult": "1.0" },
    { "mutation_id": 2, "skill_name": "Hybride", "skill_attrs": "CON/COO", "skill_base": -3, "cost_mult": "1.0" },
    { "mutation_id": 8, "skill_name": "Contagion", "skill_attrs": "CON/VOL", "skill_base": -4, "cost_mult": "2.0" },
    { "mutation_id": 13, "skill_name": "Empathie", "skill_attrs": "VOL/PRE", "skill_base": -3, "cost_mult": "2.0" },
    { "mutation_id": 16, "skill_name": "Contrôle moléculaire", "skill_attrs": "CON/VOL", "skill_base": -4, "cost_mult": "2.0" },
    { "mutation_id": 17, "skill_name": "Métamorphose", "skill_attrs": "CON/VOL", "skill_base": -3, "cost_mult": "2.0" },
    { "mutation_id": 30, "skill_name": "Purulence", "skill_attrs": "CON/VOL", "skill_base": -4, "cost_mult": "1.0" },
    { "mutation_id": 31, "skill_name": "Agilité caudale", "skill_attrs": "COO/COO", "skill_base": -4, "cost_mult": "1.0" },
    { "mutation_id": 32, "skill_name": "Radiations", "skill_attrs": "CON/VOL", "skill_base": -3, "cost_mult": "2.0" },
    { "mutation_id": 41, "skill_name": "Sonar", "skill_attrs": "PER/PER", "skill_base": -4, "cost_mult": "1.0" }
  ])
}

export const down = async (knex) => {
  await knex('ref_mutation_skills').del()
}
