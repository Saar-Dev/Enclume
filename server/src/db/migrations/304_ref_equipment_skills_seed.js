// 304_ref_equipment_skills_seed.js — seed ref_equipment_skills (31 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_equipment_skills').insert([
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "ARMES_LOURDES" },
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "ARMES_DE_TRAIT" },
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "ARMES_DE_POING" },
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "FUSIL_ARMES_DEPAULES" },
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "TIR_AUTOMATIQUES" },
    { "item_id": "a59ba78f-fd2c-4bc8-9e2f-b7343d08e270", "skill_id": "TIR_DE_PRECISION" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "ARMES_LOURDES" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "ARMES_DE_TRAIT" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "ARMES_DE_POING" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "FUSIL_ARMES_DEPAULES" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "TIR_AUTOMATIQUES" },
    { "item_id": "1c953cca-e92d-4723-9beb-ca67ae1112a8", "skill_id": "TIR_DE_PRECISION" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "ARMES_LOURDES" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "ARMES_DE_TRAIT" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "ARMES_DE_POING" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "FUSIL_ARMES_DEPAULES" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "TIR_AUTOMATIQUES" },
    { "item_id": "6f2aec33-e0af-4a6f-9e57-616e8eae2934", "skill_id": "TIR_DE_PRECISION" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "ARMES_LOURDES" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "ARMES_DE_TRAIT" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "ARMES_DE_POING" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "FUSIL_ARMES_DEPAULES" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "TIR_AUTOMATIQUES" },
    { "item_id": "a20c79aa-a70c-40c7-a644-84032b0376ea", "skill_id": "TIR_DE_PRECISION" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "ARMES_LOURDES" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "ARMES_DE_TRAIT" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "ARMES_DE_POING" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "FUSIL_ARMES_DEPAULES" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "TIR_AUTOMATIQUES" },
    { "item_id": "ab1c58e0-0445-4b6e-ab3e-02c351c8af3a", "skill_id": "TIR_DE_PRECISION" },
    { "item_id": "4228ab1c-8c5c-4a02-b345-e5dbaf26c224", "skill_id": "ARMES_LOURDES" }
  ])
}

export const down = async (knex) => {
  await knex('ref_equipment_skills').del()
}
