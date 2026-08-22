// 282_ref_genotypes_seed.js — seed ref_genotypes (4 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_genotypes').insert([
    { "id": "HUMAIN", "label": "Humain", "mod_for": 0, "mod_con": 0, "mod_coo": 0, "mod_ada": 0, "mod_per": 0, "mod_int": 0, "mod_vol": 0, "mod_pre": 0, "description": "Humain normal. Aucune modification des Attributs. Aucun Avantage ni DÃ©savantage spÃ©cifique.", "illustration_url": null, "prereq_professions": null, "pc_cost": 0, "has_deserter_option": false },
    { "id": "HYB_NAT", "label": "Hybride naturel", "mod_for": 1, "mod_con": 2, "mod_coo": 2, "mod_ada": 1, "mod_per": 0, "mod_int": -2, "mod_vol": 0, "mod_pre": 0, "description": "Hybride naturel. NÃ© avec les mutations nÃ©cessaires Ã  la survie sous-marine. Le plus avantagÃ© sous l'eau, le plus dÃ©savantagÃ© au sec.", "illustration_url": null, "prereq_professions": null, "pc_cost": 5, "has_deserter_option": false },
    { "id": "GEN_HYB", "label": "Géno-hybride", "mod_for": 1, "mod_con": 1, "mod_coo": 2, "mod_ada": 0, "mod_per": 0, "mod_int": 0, "mod_vol": 0, "mod_pre": -2, "description": "GÃ©no-hybride. Humain transformÃ© par la technologie du Culte du Trident. Apparence prÃ©servÃ©e, adaptation aquatique sans mutation visible.", "illustration_url": null, "prereq_professions": "[{\"years\":1,\"profession_id\":\"culte_trident_gsi\"}]", "pc_cost": 5, "has_deserter_option": false },
    { "id": "TEC_HYB", "label": "Techno-hybride", "mod_for": 2, "mod_con": 3, "mod_coo": 0, "mod_ada": -2, "mod_per": 0, "mod_int": 0, "mod_vol": 3, "mod_pre": -6, "description": "Techno-hybride. Individu modifiÃ© par l'HÃ©gÃ©monie, souvent contre son grÃ©. Attributs physiques grandement augmentÃ©s mais atrocement dÃ©figurÃ©.", "illustration_url": null, "prereq_professions": "[{\"years\":2,\"profession_id\":\"soldat_milicien\"},{\"years\":1,\"profession_id\":\"techno_hybride\"}]", "pc_cost": 5, "has_deserter_option": true }
  ])
}

export const down = async (knex) => {
  await knex('ref_genotypes').del()
}
