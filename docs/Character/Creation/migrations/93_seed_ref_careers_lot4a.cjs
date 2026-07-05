// 093_seed_ref_careers_lot4a.cjs
// Lot 4a : Officier naval (civil + militaire), Officier militaire (souterrain + surface), Ouvrier/Docker

export const seed = async (knex) => {
  // ============================================================
  // 21-22. OFFICIER NAVAL/NAVIGATEUR — skills et titres communs
  // ============================================================
  const navalSkills = [
    { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { skill_id: 'CARTOGRAPHIE', skill_group: 'Connaissances' },
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { skill_id: 'TACTIQUE_COMBAT_NAVAL', skill_group: 'Connaissances' },
    { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    // Note : « langue de la communauté d'accueil » + « une autre langue au choix » — variables
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__NAVIRES_LOURDS', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' }
  ]

  const navalTitles = [
    { min_years: 1, max_years: 5, title: 'Aspirant *', salary_per_year: 12000 },
    { min_years: 6, max_years: 11, title: 'Lieutenant *', salary_per_year: 20000 },
    { min_years: 12, max_years: null, title: 'Capitaine', salary_per_year: 36000 }
  ]

  const navalPointCategories = [
    { sort_order: 1, category: 'Relations' },
    { sort_order: 2, category: 'Célébrité' },
    { sort_order: 3, category: 'Matériel' }
  ]

  const navalEquipment = [
    { sort_order: 1, equipment: 'Matériel standard' },
    { sort_order: 2, equipment: 'Armes de poing (Pistolet avec permis gratuit)' },
    { sort_order: 3, equipment: 'Protections et armures' }
  ]

  const navalBenefits = [
    { roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { roll: 2, description: 'Distinction/Prestation : participation à une bataille ou travail remarqué. Argent doublé pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { roll: 3, description: 'Confrérie : remarqué par une confrérie pirate. Si accepte, devient Pirate. Compétences +3, Relations +2, Célébrité +3.' },
    { roll: 4, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { roll: 5, description: 'Secret/Carte : entendu parler d\'un secret ou d\'une carte au trésor ou d\'une ancienne légende.' },
    { roll: 6, description: 'Unité des marins : Alliés +2, Relations +4.' },
    { roll: 7, description: 'Trafic : transport de marchandise pour une organisation. Revenus +20% à partir de cette année, Allié +1, Relations +3, Matériel +2.' },
    { roll: 8, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { roll: 9, description: 'Des amis dans chaque port : Alliés +3, Relations +6.' },
    { roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ]

  // ============================================================
  // 21. OFFICIER NAVAL — MARINE CIVILE
  // ============================================================
  const [offNavalCivil] = await knex('ref_careers').insert({
    code: 'officier_naval_civil',
    name: 'Officier naval/Navigateur (Marine civile)',
    description: 'Les officiers navals sont spécialisés dans le pilotage de navire de grande taille et les voyages au long cours. Marine civile : Études supérieures (École navale) ou 15 années d\'expérience en tant que Sous-marinier.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Formés par les flottes marchandes des grandes nations.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: offNavalCivil.id, field: 'École navale' }
  ])

  // Prérequis : sera lié après seed complet — sous_marinier, 15 ans, OU
  // Note : sortis du rang accèdent directement au grade de Lieutenant

  await knex('ref_career_skills').insert(
    navalSkills.map(s => ({ ...s, career_id: offNavalCivil.id }))
  )

  await knex('ref_career_titles').insert(
    navalTitles.map(t => ({ ...t, career_id: offNavalCivil.id }))
  )

  await knex('ref_career_point_categories').insert(
    navalPointCategories.map(p => ({ ...p, career_id: offNavalCivil.id }))
  )

  await knex('ref_career_equipment').insert(
    navalEquipment.map(e => ({ ...e, career_id: offNavalCivil.id }))
  )

  await knex('ref_career_random_benefits').insert(
    navalBenefits.map(b => ({ ...b, career_id: offNavalCivil.id }))
  )

  // ============================================================
  // 22. OFFICIER NAVAL — MARINE MILITAIRE
  // ============================================================
  const [offNavalMil] = await knex('ref_careers').insert({
    code: 'officier_naval_militaire',
    name: 'Officier naval/Navigateur (Marine militaire)',
    description: 'Les officiers navals militaires sont formés par les flottes militaires des grandes nations. Marine militaire : Études supérieures (École navale).',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Formés par les flottes militaires des grandes nations.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: offNavalMil.id, field: 'École navale' }
  ])

  await knex('ref_career_skills').insert(
    navalSkills.map(s => ({ ...s, career_id: offNavalMil.id }))
  )

  await knex('ref_career_titles').insert(
    navalTitles.map(t => ({ ...t, career_id: offNavalMil.id }))
  )

  await knex('ref_career_point_categories').insert(
    navalPointCategories.map(p => ({ ...p, career_id: offNavalMil.id }))
  )

  await knex('ref_career_equipment').insert(
    navalEquipment.map(e => ({ ...e, career_id: offNavalMil.id }))
  )

  await knex('ref_career_random_benefits').insert(
    navalBenefits.map(b => ({ ...b, career_id: offNavalMil.id }))
  )

  // ============================================================
  // 23-24. OFFICIER MILITAIRE — skills et titres communs
  // ============================================================
  const offMilCommonSkills = [
    { skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { skill_id: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', skill_group: 'Combat (contact)', conditional: true },
    { skill_id: 'ARMES_LOURDES', skill_group: 'Combat (tir)' },
    { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { skill_id: 'CONNAISSANCE_MILIEUX_SOCIAUX', skill_group: 'Connaissances' },
    { skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité' },
    // Note : « Langue maternelle, langue de la communauté d'accueil, une autre langue au choix » — variables
    { skill_id: 'STRATEGIE', skill_group: 'Opérations militaires' },
    { skill_id: 'TACTIQUE_COMBAT_TERRESTRE', skill_group: 'Opérations militaires' },
    { skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Opérations militaires' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { skill_id: 'EXPLOSIFS', skill_group: 'Techniques' }
  ]

  const offMilSouterrainSkills = [
    { skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité' },
    { skill_id: 'PILOTAGE__VEHICULES_SOUTERRAINS', skill_group: 'Pilotage' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS', skill_group: 'Survie/Extérieur' }
  ]

  const offMilSurfaceSkills = [
    { skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité' },
    { skill_id: 'ARMES_SATELLITES', skill_group: 'Opérations militaires' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SURFACE', skill_group: 'Survie/Extérieur' }
  ]

  const offMilRegularTitles = [
    { min_years: 1, max_years: 5, title: 'Aspirant *', salary_per_year: 4000 },
    { min_years: 6, max_years: 11, title: 'Lieutenant *', salary_per_year: 6000 },
    { min_years: 12, max_years: null, title: 'Capitaine', salary_per_year: 10000 }
  ]

  const offMilEliteTitles = [
    { min_years: 1, max_years: 5, title: 'Aspirant *', salary_per_year: 12000 },
    { min_years: 6, max_years: 11, title: 'Lieutenant *', salary_per_year: 18000 },
    { min_years: 12, max_years: null, title: 'Capitaine', salary_per_year: 30000 }
  ]

  const offMilPointCategories = [
    { sort_order: 1, category: 'Relations' },
    { sort_order: 2, category: 'Célébrité' },
    { sort_order: 3, category: 'Matériel' }
  ]

  const offMilEquipment = [
    { sort_order: 1, equipment: 'Matériel standard' },
    { sort_order: 2, equipment: 'Armes de poing (Pistolet avec permis gratuit)' },
    { sort_order: 3, equipment: 'Protections et armures' }
  ]

  const offMilBenefits = [
    { roll: 1, description: 'Attribut augmenté : Volonté +1.' },
    { roll: 2, description: 'Bataille : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { roll: 3, description: 'Distinction : argent doublé pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { roll: 4, description: 'Héros : Argent triplé pour l\'année, points de compétence +4, Célébrité +4, Matériel +3.' },
    { roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { roll: 6, description: 'Prestation : remarqué par sa hiérarchie. Point de compétence +1, Célébrité +1.' },
    { roll: 7, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { roll: 9, description: 'Mercenaires/Milice privée : Alliés +2, Relations +4.' },
    { roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ]

  // ============================================================
  // 23. OFFICIER MILITAIRE — SOUTERRAIN
  // ============================================================
  const [offMilSouterrain] = await knex('ref_careers').insert({
    code: 'officier_militaire_souterrain',
    name: 'Officier militaire (Souterrain)',
    description: 'Les officiers de l\'armée sont formés par les écoles militaires. Spécialité : Souterrains. Opérations en milieu hostile.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Grandes nations sous-marines pour les officiers directs.',
    min_for: 15,
    min_con: 15,
    min_vol: 15,
    min_attributes_logic: 'ANY_2',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: offMilSouterrain.id, field: 'École militaire' }
  ])

  // Prérequis : École militaire OU 15 ans Soldat/Milicien ou Techno-hybride OU 12 ans Soldat d'élite ou Veilleur
  // Note : sortis du rang accèdent directement au grade de Lieutenant

  await knex('ref_career_skills').insert(
    [...offMilCommonSkills, ...offMilSouterrainSkills].map(s => ({ ...s, career_id: offMilSouterrain.id }))
  )

  // Unités d'élite (milieu hostile)
  await knex('ref_career_titles').insert(
    offMilEliteTitles.map(t => ({ ...t, career_id: offMilSouterrain.id }))
  )

  await knex('ref_career_point_categories').insert(
    offMilPointCategories.map(p => ({ ...p, career_id: offMilSouterrain.id }))
  )

  await knex('ref_career_equipment').insert(
    offMilEquipment.map(e => ({ ...e, career_id: offMilSouterrain.id }))
  )

  await knex('ref_career_random_benefits').insert(
    offMilBenefits.map(b => ({ ...b, career_id: offMilSouterrain.id }))
  )

  // ============================================================
  // 24. OFFICIER MILITAIRE — SURFACE
  // ============================================================
  const [offMilSurface] = await knex('ref_careers').insert({
    code: 'officier_militaire_surface',
    name: 'Officier militaire (Surface)',
    description: 'Les officiers de l\'armée sont formés par les écoles militaires. Spécialité : Surface. Opérations en milieu hostile.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Grandes nations sous-marines pour les officiers directs.',
    min_for: 15,
    min_con: 15,
    min_vol: 15,
    min_attributes_logic: 'ANY_2',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: offMilSurface.id, field: 'École militaire' }
  ])

  await knex('ref_career_skills').insert(
    [...offMilCommonSkills, ...offMilSurfaceSkills].map(s => ({ ...s, career_id: offMilSurface.id }))
  )

  // Unités d'élite (milieu hostile)
  await knex('ref_career_titles').insert(
    offMilEliteTitles.map(t => ({ ...t, career_id: offMilSurface.id }))
  )

  await knex('ref_career_point_categories').insert(
    offMilPointCategories.map(p => ({ ...p, career_id: offMilSurface.id }))
  )

  await knex('ref_career_equipment').insert(
    offMilEquipment.map(e => ({ ...e, career_id: offMilSurface.id }))
  )

  await knex('ref_career_random_benefits').insert(
    offMilBenefits.map(b => ({ ...b, career_id: offMilSurface.id }))
  )

  // ============================================================
  // 25. OUVRIER/DOCKER
  // ============================================================
  const [ouvrier] = await knex('ref_careers').insert({
    code: 'ouvrier_docker',
    name: 'Ouvrier/Docker',
    description: 'Les ouvriers, à l\'instar des mineurs, ont un travail pénible et, en plus, mal rémunéré. Ils ont par contre l\'énorme avantage de bien connaître les stations dans lesquelles ils travaillent.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: ouvrier.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: ouvrier.id, skill_id: 'RESPIRATION_FOE', skill_group: 'Aptitudes physiques' },
    { career_id: ouvrier.id, skill_id: 'ARMES_LOURDES_CONTACT', skill_group: 'Combat (contact)' },
    { career_id: ouvrier.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: ouvrier.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: ouvrier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: ouvrier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    // Note : « langue de la communauté d'accueil » implicite — variable
    { career_id: ouvrier.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { career_id: ouvrier.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: ouvrier.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: ouvrier.id, skill_id: 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE', skill_group: 'Techniques', conditional: true }
  ])

  await knex('ref_career_titles').insert([
    { career_id: ouvrier.id, min_years: 1, max_years: 2, title: 'Apprenti', salary_per_year: 300 },
    { career_id: ouvrier.id, min_years: 3, max_years: 6, title: 'Ouvrier Classe A', salary_per_year: 500 },
    { career_id: ouvrier.id, min_years: 7, max_years: 8, title: 'Ouvrier Classe B', salary_per_year: 1000 },
    { career_id: ouvrier.id, min_years: 9, max_years: 10, title: 'Ouvrier Classe C', salary_per_year: 2000 },
    { career_id: ouvrier.id, min_years: 11, max_years: 12, title: 'Ouvrier Classe D', salary_per_year: 3000 },
    { career_id: ouvrier.id, min_years: 13, max_years: 18, title: 'Ouvrier qualifié', salary_per_year: 4000 },
    { career_id: ouvrier.id, min_years: 19, max_years: 20, title: 'Ouvrier Expert', salary_per_year: 5000 },
    { career_id: ouvrier.id, min_years: 21, max_years: null, title: 'Maître Ouvrier', salary_per_year: 8000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: ouvrier.id, sort_order: 1, category: 'Célébrité' },
    { career_id: ouvrier.id, sort_order: 2, category: 'Relations' },
    { career_id: ouvrier.id, sort_order: 3, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: ouvrier.id, sort_order: 1, equipment: 'Matériel standard' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: ouvrier.id, roll: 1, description: 'Attribut augmenté : Force +1.' },
    { career_id: ouvrier.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2.' },
    { career_id: ouvrier.id, roll: 3, description: 'Guilde : engagé par la Guilde des ouvriers/dockers. Salaire +10% à partir de cette année, Célébrité +4, Matériel +2.' },
    { career_id: ouvrier.id, roll: 4, description: 'Unité ouvrière : Alliés +2, Relations +4.' },
    { career_id: ouvrier.id, roll: 5, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { career_id: ouvrier.id, roll: 6, description: 'Matériel détourné : Matériel +6.' },
    { career_id: ouvrier.id, roll: 7, description: 'Aide à la contrebande : salaire +20% à partir de cette année, Matériel +2.' },
    { career_id: ouvrier.id, roll: 8, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { career_id: ouvrier.id, roll: 9, description: 'Pirates : remarqué par une confrérie pirate. Points de compétence +3, Relations +2, Célébrité +3.' },
    { career_id: ouvrier.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
