// 287_ref_backgrounds_seed.js — seed ref_backgrounds (22 lignes, source: vtt)
export const up = async (knex) => {
  await knex('ref_backgrounds').insert([
    { "id": "39cd5cd6-0660-4f26-9a26-069216732c94", "type": "geo_origin", "code": "navire_nomade", "name": "Navire nomade", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 1 },
    { "id": "bf30bdcb-80dd-4343-bcd6-68f9061b2f9f", "type": "geo_origin", "code": "petite_station", "name": "Petite station", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 2 },
    { "id": "a217037a-1660-49ff-a762-35af8c3d5ffa", "type": "geo_origin", "code": "station_moyenne", "name": "Station de taille moyenne", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 3 },
    { "id": "95e155da-2909-4847-a416-7a279c0dcf76", "type": "social_origin", "code": "bas_fonds", "name": "Bas-fonds", "description": null, "parent_type": "geo_origin", "parent_code": "grande_cite", "pc_cost": 0, "years_added": 0, "sort_order": 1 },
    { "id": "a6f8ff62-5186-45a9-b389-f140e1940d2d", "type": "social_origin", "code": "milieu_ouvrier", "name": "Milieu ouvrier", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 2 },
    { "id": "2e617cf3-6f1e-4e49-93cd-2697c12e784c", "type": "social_origin", "code": "classes_moyennes", "name": "Classes moyennes", "description": null, "parent_type": "geo_origin", "parent_code": "station_moyenne", "pc_cost": 0, "years_added": 0, "sort_order": 3 },
    { "id": "d0ad6ffb-4d8e-46b8-af0e-c2081714fe60", "type": "social_origin", "code": "classes_moyennes", "name": "Classes moyennes", "description": null, "parent_type": "geo_origin", "parent_code": "grande_cite", "pc_cost": 0, "years_added": 0, "sort_order": 3 },
    { "id": "774f6030-65f0-43e5-ad7c-c06ded30fcd5", "type": "training", "code": "apprentissage_technique", "name": "Apprentissage technique", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 2 },
    { "id": "a55f189c-c8ff-4f18-ab70-c27ce44e8682", "type": "training", "code": "autodidacte", "name": "Autodidacte", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 5 },
    { "id": "7554f969-6ed7-488c-ae86-974b90235126", "type": "higher_ed", "code": "commerce_gestion", "name": "Commerce/Gestion", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "43f34e49-55e2-4bdf-90db-83f9dee0089c", "type": "higher_ed", "code": "droit", "name": "Droit", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "7ab0a635-e334-4ed8-9bb5-a59a34674dd7", "type": "higher_ed", "code": "sciences", "name": "Sciences/Sciences humaines", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "738bd8e0-4450-4a35-a2ee-3d716b4556f4", "type": "higher_ed", "code": "sciences_politiques", "name": "Sciences politiques", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "6fc6fdb4-3665-4b4e-a0bb-c174e46f6624", "type": "geo_origin", "code": "grande_cite", "name": "Grande cité", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 4 },
    { "id": "682ec508-2a0e-481e-a28d-caf391354911", "type": "social_origin", "code": "classes_superieures", "name": "Classes supérieures", "description": null, "parent_type": "geo_origin", "parent_code": "grande_cite", "pc_cost": 0, "years_added": 0, "sort_order": 4 },
    { "id": "9fdaeca5-be5c-4a7a-8223-b3bc468a1b7a", "type": "training", "code": "delinquance", "name": "Délinquance/Criminalité", "description": null, "parent_type": null, "parent_code": null, "pc_cost": 0, "years_added": 0, "sort_order": 1 },
    { "id": "ab681cb2-fc74-4996-9a84-bc02c262a040", "type": "training", "code": "education_scolaire", "name": "Éducation scolaire", "description": null, "parent_type": "social_origin", "parent_code": "classes_moyennes", "pc_cost": 0, "years_added": 0, "sort_order": 3 },
    { "id": "5287559b-3644-48da-b67a-5c16f84f7f4f", "type": "training", "code": "education_scolaire", "name": "Éducation scolaire", "description": null, "parent_type": "social_origin", "parent_code": "classes_superieures", "pc_cost": 0, "years_added": 0, "sort_order": 4 },
    { "id": "4f4fdeab-5feb-4b75-95bb-4d1c1b11620c", "type": "higher_ed", "code": "ecole_ingenieurs", "name": "École d'ingénieurs", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "424353b4-0816-4ce2-849a-9a83db137425", "type": "higher_ed", "code": "ecole_militaire", "name": "École militaire", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "54ccfc32-366d-42e6-8684-c5671671a7ef", "type": "higher_ed", "code": "ecole_navale", "name": "École navale", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null },
    { "id": "08617dd4-a2b3-40af-9526-be6c0a8a351a", "type": "higher_ed", "code": "medecine", "name": "Médecine", "description": null, "parent_type": "training", "parent_code": "education_scolaire", "pc_cost": 1, "years_added": 2, "sort_order": null }
  ])
}

export const down = async (knex) => {
  await knex('ref_backgrounds').del()
}
