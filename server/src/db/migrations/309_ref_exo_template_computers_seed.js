// 309_ref_exo_template_computers_seed.js — seed ref_exo_template_computers (21 lignes, source: enclume_squash_check (rejeu neuf, inclut la fusion exo))
export const up = async (knex) => {
  await knex('ref_exo_template_computers').insert([
    { "id": "56c51b28-8a05-4d70-b891-6086bcc55c9b", "template_id": "2e5a9aa3-114f-40aa-9c41-133f032933d5", "role": "principal", "gen": 3, "nt": 3, "sort_order": 1 },
    { "id": "e05c4671-cfbc-408e-91e5-e915146692ce", "template_id": "f8cd5f7c-205e-499e-85e4-db76e122e51c", "role": "principal", "gen": 3, "nt": 3, "sort_order": 1 },
    { "id": "ff051d0e-9ce1-4039-bebd-d60e6652655c", "template_id": "095a927a-4b78-4d8b-8444-f4a225251411", "role": "principal", "gen": 5, "nt": 3, "sort_order": 1 },
    { "id": "35bf53d8-94fe-49f8-8b56-79fc826eeb81", "template_id": "095a927a-4b78-4d8b-8444-f4a225251411", "role": "secours", "gen": 2, "nt": 2, "sort_order": 2 },
    { "id": "8469e512-19d0-46a8-b582-316dd8171a45", "template_id": "a7cc5312-d7bf-4bb6-b44e-810e47daaac8", "role": "principal", "gen": 2, "nt": 3, "sort_order": 1 },
    { "id": "e8f05340-6656-4508-98a7-76cfe10d09be", "template_id": "7a508027-5e54-472c-bc8e-a942028d9b30", "role": "principal", "gen": 3, "nt": 4, "sort_order": 1 },
    { "id": "7d0a3396-3dbc-4ee6-9f1a-7dfc69c8cf4e", "template_id": "05142d24-1b0c-4f18-a13e-2567de1436a9", "role": "principal", "gen": 2, "nt": 4, "sort_order": 1 },
    { "id": "478086ed-108e-4b36-b521-6432d4948d79", "template_id": "a1baa942-f7b9-4d65-8aac-54b2b6d2652f", "role": "principal", "gen": 3, "nt": 4, "sort_order": 1 },
    { "id": "4f448994-5d52-4c60-9264-6028bb65fb59", "template_id": "cc9d5e52-932b-447d-9747-5fcffdf6cd0d", "role": "principal", "gen": 3, "nt": 4, "sort_order": 1 },
    { "id": "22002446-1230-488a-9dfd-a5ab3e02d8cd", "template_id": "cc9d5e52-932b-447d-9747-5fcffdf6cd0d", "role": "secours", "gen": 2, "nt": 4, "sort_order": 2 },
    { "id": "5344d94f-7ea3-4478-8120-bac48bd66080", "template_id": "4e31aae5-7ce0-4317-b3d8-70fc803cc9c3", "role": "principal", "gen": 3, "nt": 2, "sort_order": 1 },
    { "id": "f0fd9a18-de65-4b26-9653-cec8dda056cd", "template_id": "8e02c301-1824-4e62-b894-8cb7a18b848c", "role": "principal", "gen": 4, "nt": 3, "sort_order": 1 },
    { "id": "8f67cbd0-8fdb-445b-8ac0-8823f306624f", "template_id": "8f99609d-dc34-40eb-98ac-3e422e94e870", "role": "principal", "gen": 2, "nt": 4, "sort_order": 1 },
    { "id": "a9c588b0-f135-402a-9cb7-90f47d62b5ed", "template_id": "8f99609d-dc34-40eb-98ac-3e422e94e870", "role": "secours", "gen": 1, "nt": 2, "sort_order": 2 },
    { "id": "b844ea70-5c69-4437-b88e-bec835c617c1", "template_id": "3d1791a4-bdf2-4dfa-8d13-9196880d86dd", "role": "principal", "gen": 4, "nt": 3, "sort_order": 1 },
    { "id": "7467fe3e-3ba7-471e-8f99-92458fdb8d1e", "template_id": "be5ceba1-7ff5-4610-8e43-2d8da2cae165", "role": "principal", "gen": 2, "nt": 4, "sort_order": 1 },
    { "id": "0c8c4223-17b5-44cb-b02f-bc0be6f28ed1", "template_id": "be5ceba1-7ff5-4610-8e43-2d8da2cae165", "role": "secours", "gen": 1, "nt": 2, "sort_order": 2 },
    { "id": "61563ad1-32e6-4cc3-a87e-33709e59e7e8", "template_id": "fb640fa1-1b3f-450d-9303-3dac361e0e72", "role": "principal", "gen": 3, "nt": 3, "sort_order": 1 },
    { "id": "e4f6aed8-cab5-4237-87d7-9d4c73f2a8bd", "template_id": "c8ee8591-36a8-4c42-85dd-0f1310a12b39", "role": "principal", "gen": 3, "nt": 4, "sort_order": 1 },
    { "id": "9b8a89e3-2779-48e0-a657-54787af79d0f", "template_id": "c8ee8591-36a8-4c42-85dd-0f1310a12b39", "role": "secours", "gen": 2, "nt": 3, "sort_order": 2 },
    { "id": "b02cabb2-3e69-4ee3-a748-fc1e9f401cc8", "template_id": "4beda6b4-1045-409f-82bc-519ef8e024bc", "role": "principal", "gen": 4, "nt": 4, "sort_order": 1 }
  ])
}

export const down = async (knex) => {
  await knex('ref_exo_template_computers').del()
}
