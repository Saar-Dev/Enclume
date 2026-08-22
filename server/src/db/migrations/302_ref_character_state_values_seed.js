// 302_ref_character_state_values_seed.js — seed ref_character_state_values (7 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_character_state_values').insert([
    { "id": "15ca87fc-b164-4298-96d4-947627f4be6d", "axis": "position", "value_code": "standing", "label": "Debout" },
    { "id": "c9c43711-f131-4285-b7a1-525fb59d0a7c", "axis": "position", "value_code": "crouching", "label": "Accroupi" },
    { "id": "5b1f64d7-4c89-4fdd-98bc-f76860dfbc3b", "axis": "position", "value_code": "kneeling", "label": "À genou" },
    { "id": "3cd79aa9-32b7-4e32-8836-0bf46a6bdd21", "axis": "position", "value_code": "prone", "label": "Couché" },
    { "id": "7d2b0eba-cc0e-415e-a9a3-65bac483fa6b", "axis": "weapon", "value_code": "holstered", "label": "Rangée" },
    { "id": "7215d6f0-428b-4b07-a1b3-5348aa9b144a", "axis": "weapon", "value_code": "ready", "label": "Main sur l'arme" },
    { "id": "69d3d31d-7753-413d-8d5b-35460fc59772", "axis": "weapon", "value_code": "drawn", "label": "Au clair" }
  ])
}

export const down = async (knex) => {
  await knex('ref_character_state_values').del()
}
