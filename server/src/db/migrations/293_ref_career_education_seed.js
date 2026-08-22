// 293_ref_career_education_seed.js — seed ref_career_education (12 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_career_education').insert([
    { "id": "8d34a870-0cdc-4c72-bd1b-3bdb48b35ba8", "career_id": "c1295de1-f8ab-4859-9b8e-b2df5e614d17", "field": "Droit" },
    { "id": "8a021cec-4d2d-407a-b2ec-eccdf518f830", "career_id": "c1295de1-f8ab-4859-9b8e-b2df5e614d17", "field": "Sciences politiques" },
    { "id": "bedd2b2a-5426-431a-81b1-1de29d97a1fb", "career_id": "4022ba37-1771-4321-9a6c-220812d9a8c0", "field": "Sciences/Sciences humaines" },
    { "id": "d765177e-b40b-4d05-bf99-3532056240c8", "career_id": "cb590b9a-e6f4-4761-afbe-07e231ffd605", "field": "Médecine" },
    { "id": "d77c84d7-4e2f-4c8e-8919-37cd3f642e58", "career_id": "4e63b777-354d-42ca-bb1f-ed036c003920", "field": "École navale" },
    { "id": "02f55d0a-d252-418a-9781-30d155c0c3bd", "career_id": "55deaea2-ce0f-4ccb-af7f-6d56328cabe0", "field": "École navale" },
    { "id": "ba568ced-efdc-40e5-b99a-104d47c0ce4b", "career_id": "f5c13938-3f92-43ef-89eb-37fec8a6d5ac", "field": "École militaire" },
    { "id": "ba618a18-b7f5-4d5a-8a36-2791865cbbe2", "career_id": "da9af6eb-99f9-4890-8916-83d491ea274b", "field": "École militaire" },
    { "id": "8e1226df-23b5-4d69-ac18-645907666c25", "career_id": "ef9b7cf1-7e86-45a5-b413-4b9433e904ff", "field": "Sciences" },
    { "id": "8b8c1a78-4ab5-4724-ab11-24c3cefbaf52", "career_id": "0df2ccbb-bde1-44e9-932a-26d102b5807e", "field": "Sciences" },
    { "id": "fc32bcf1-0fe4-4ce3-ae17-10a5aeccc4a3", "career_id": "46a3f1e9-aa2a-4413-9668-7f583f553cc1", "field": "Sciences/Sciences humaines" },
    { "id": "ad205632-9d39-49d0-adf6-4c804acad527", "career_id": "46a3f1e9-aa2a-4413-9668-7f583f553cc1", "field": "École d'ingénieur" }
  ])
}

export const down = async (knex) => {
  await knex('ref_career_education').del()
}
