// 298_ref_mutation_subtypes_seed.js — seed ref_mutation_subtypes (8 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_mutation_subtypes').insert([
    { "subtype_id": 1, "mutation_id": 6, "name": "Caractère félin", "d4_roll": 1, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 2, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": "Acrobatie/Équilibre:+3", "immunity": "vertige", "special_trait": null, "description": "COO +2, pas sujet au vertige, +3 Acrobatie/Équilibre. Griffes et Vision nocturne à -1 PC." },
    { "subtype_id": 2, "mutation_id": 6, "name": "Caractère canin", "d4_roll": 2, "mod_FOR": 0, "mod_CON": 1, "mod_COO": 0, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": "Perception(odorat):+3", "immunity": null, "special_trait": null, "description": "CON +1, très bon odorat (+3 Perception odorat). Crocs gratuit." },
    { "subtype_id": 3, "mutation_id": 6, "name": "Caractère reptilien", "d4_roll": 3, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 1, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": "Perception(odorat):+3;Évasion:+3", "immunity": null, "special_trait": "Se faufiler dans espaces étroits", "description": "COO +1, odorat langue bifide (+3 Perception), +3 Évasion, se faufile dans espaces étroits." },
    { "subtype_id": 4, "mutation_id": 6, "name": "Caractère simiesque", "d4_roll": 4, "mod_FOR": 1, "mod_CON": 0, "mod_COO": 1, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": "Escalade:+3", "immunity": null, "special_trait": null, "description": "FOR +1, COO +1, +3 Escalade. Queue gratuite." },
    { "subtype_id": 5, "mutation_id": 28, "name": "1 parasite", "d4_roll": 1, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 0, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": null, "immunity": null, "special_trait": null, "description": "Le personnage abrite 1 parasite." },
    { "subtype_id": 6, "mutation_id": 28, "name": "2 parasites", "d4_roll": 2, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 0, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": null, "immunity": null, "special_trait": null, "description": "Le personnage abrite 2 parasites." },
    { "subtype_id": 7, "mutation_id": 28, "name": "3 parasites", "d4_roll": 3, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 0, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": null, "immunity": null, "special_trait": null, "description": "Le personnage abrite 3 parasites." },
    { "subtype_id": 8, "mutation_id": 28, "name": "4 parasites", "d4_roll": 4, "mod_FOR": 0, "mod_CON": 0, "mod_COO": 0, "mod_INT": 0, "mod_VOL": 0, "mod_PRE": 0, "skill_bonus": null, "immunity": null, "special_trait": null, "description": "Le personnage abrite 4 parasites." }
  ])
  await knex.raw('SELECT setval(?, (SELECT COALESCE(MAX(subtype_id), 1) FROM "ref_mutation_subtypes"))', ['ref_mutation_subtypes_subtype_id_seq'])
}

export const down = async (knex) => {
  await knex('ref_mutation_subtypes').del()
}
