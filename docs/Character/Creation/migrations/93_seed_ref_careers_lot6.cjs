// 093_seed_ref_careers_lot6.cjs
// Lot 6 : Soldat d'élite (×4), Sous-marinier, Technicien/Mécanicien, Techno-hybride, Veilleur, Voleur/Criminel

export const seed = async (knex) => {
  // ============================================================
  // 34-37. SOLDAT D'ÉLITE — commun
  // ============================================================
  const soldatEliteCommonSkills = [
    { skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)', conditional: true }, // LdB L.1911 : "au choix"
    { skill_id: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', skill_group: 'Combat (contact)', conditional: true },
    { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { skill_id: 'ARMES_LOURDES', skill_group: 'Combat (tir)' },
    { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { skill_id: 'TIR_AUTOMATIQUES', skill_group: 'Combat (tir)' },
    { skill_id: 'CARTOGRAPHIE', skill_group: 'Connaissances' },
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { skill_id: 'CONNAISSANCE_MILIEUX_SOCIAUX', skill_group: 'Connaissances' }, // Armée — migration 103
    { skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité' },
    { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité' },
    // Note : « langue de la communauté d'accueil » — variable, non seedable
    { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { skill_id: 'EXPLOSIFS', skill_group: 'Techniques' },
    { skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ]

  const soldatEliteTitles = [
    { min_years: 1, max_years: 1, title: 'Recrue' },
    { min_years: 2, max_years: 5, title: 'Soldat' },
    { min_years: 6, max_years: 7, title: 'Vétéran' },
    { min_years: 8, max_years: 11, title: 'Sergent' },
    { min_years: 12, max_years: null, title: 'Sergent (accès au grade de Lieutenant)' }
  ]

  const soldatEliteBenefits = [
    { roll: 1, description: 'Attribut augmenté : Volonté +1.' },
    { roll: 2, description: 'Bataille : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { roll: 3, description: 'Distinction : argent doublé pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { roll: 4, description: 'Héros : Argent triplé pour l\'année, Points de compétence +4, Célébrité +4, Matériel +3.' },
    { roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { roll: 6, description: 'Prestation : remarqué par sa hiérarchie. Point de compétence +1, Célébrité +1.' },
    { roll: 7, description: 'Formation : ajouter une Compétence au choix. Points de compétence +2, Relations +1.' },
    { roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { roll: 9, description: 'Mercenaires/Milice privée : Alliés +2, Relations +4.' },
    { roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ]

  const soldatElitePointCategories = [
    { sort_order: 1, category: 'Célébrité' },
    { sort_order: 2, category: 'Relations' },
    { sort_order: 3, category: 'Matériel' }
  ]

  // ============================================================
  // 34. SOLDAT D'ÉLITE — COMMANDO MARIN
  // ============================================================
  const commandoMarinSkills = [
    { skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { skill_id: 'RESPIRATION_FOE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ARMES_LOURDES_CONTACT', skill_group: 'Combat (contact)' },
    { skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { skill_id: 'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', skill_group: 'Langues' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CHASSE_PISTAGE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { skill_id: 'PIEGES', skill_group: 'Techniques' }
  ]

  const [soldatEliteMarin] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_marin',
    name: 'Soldat d\'élite (Commando marin)',
    description: 'Les commandos marins sont spécialistes du combat en armure de plongée. Ce sont des unités particulièrement renommées dans toutes les grandes armées du monde.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Forcément originaire d\'une des grandes nations sous-marines.',
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

  // Prérequis : 3 ans soldat_milicien
  // await knex('ref_career_prerequisites').insert([
  //   { career_id: soldatEliteMarin.id, prerequisite_career_id: null, min_years: 3 }
  // ])

  await knex('ref_career_skills').insert(
    [...soldatEliteCommonSkills, ...commandoMarinSkills].map(s => ({ ...s, career_id: soldatEliteMarin.id }))
  )

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteMarin.id, salary_per_year: [400, 800, 3000, 6000, 6000][i] }))
  )

  await knex('ref_career_point_categories').insert(
    soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteMarin.id }))
  )

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteMarin.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteMarin.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteMarin.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteMarin.id, sort_order: 4, equipment: 'Armure de plongée exo-1 (gratuite)' },
    { career_id: soldatEliteMarin.id, sort_order: 5, equipment: 'Protections et armures' }
  ])

  await knex('ref_career_random_benefits').insert(
    soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteMarin.id }))
  )

  // ============================================================
  // 35. SOLDAT D'ÉLITE — COMMANDO SOUTERRAIN
  // ============================================================
  const commandoSouterrainSkills = [
    { skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_SOUTERRAINS', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CHASSE_PISTAGE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS', skill_group: 'Survie/Extérieur' },
    { skill_id: 'PIEGES', skill_group: 'Techniques' }
  ]

  const [soldatEliteSouterrain] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_souterrain',
    name: 'Soldat d\'élite (Commando souterrain)',
    description: 'Les soldats entraînés à se battre sous terre sont généralement peu connus de la population. Ils passent leur vie dans les bases proches des territoires des Foreurs.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Communauté ou pays ayant un contact avec les Foreurs.',
    min_for: 15,
    min_con: 15,
    min_vol: 15,
    min_attributes_logic: 'ANY_2',
    contact_frequency: 3,
    ally_frequency: 5,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert(
    [...soldatEliteCommonSkills, ...commandoSouterrainSkills].map(s => ({ ...s, career_id: soldatEliteSouterrain.id }))
  )

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteSouterrain.id, salary_per_year: [500, 1200, 3600, 7500, 7500][i] }))
  )

  await knex('ref_career_point_categories').insert(
    soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteSouterrain.id }))
  )

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteSouterrain.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteSouterrain.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 4, equipment: 'Armure externe exo-1 (gratuite)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert(
    soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteSouterrain.id }))
  )

  // ============================================================
  // 36. SOLDAT D'ÉLITE — COMMANDO DE SURFACE
  // ============================================================
  const commandoSurfaceSkills = [
    { skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'TIR_DE_PRECISION', skill_group: 'Combat (tir)' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CHASSE_PISTAGE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SURFACE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'PIEGES', skill_group: 'Techniques' },
    { skill_id: 'MECANIQUE_VEHICULES_DE_SOL', skill_group: 'Techniques' }
  ]

  const [soldatEliteSurface] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_surface',
    name: 'Soldat d\'élite (Commando de surface)',
    description: 'Entraînés pour se battre en surface, ces soldats sont particulièrement robustes et psychologiquement préparés à affronter les horreurs de l\'ancien monde.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Nation ou communauté ayant accès à la surface.',
    min_for: 15,
    min_con: 15,
    min_vol: 15,
    min_attributes_logic: 'ANY_2',
    contact_frequency: 5,
    ally_frequency: 6,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert(
    [...soldatEliteCommonSkills, ...commandoSurfaceSkills].map(s => ({ ...s, career_id: soldatEliteSurface.id }))
  )

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteSurface.id, salary_per_year: [500, 1200, 3600, 7500, 7500][i] }))
  )

  await knex('ref_career_point_categories').insert(
    soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteSurface.id }))
  )

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteSurface.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteSurface.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteSurface.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteSurface.id, sort_order: 4, equipment: 'Armure externe exo-1 (gratuite)' },
    { career_id: soldatEliteSurface.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert(
    soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteSurface.id }))
  )

  // ============================================================
  // 37. SOLDAT D'ÉLITE — FORCES SPÉCIALES
  // ============================================================
  const forcesSpecialesSkills = [
    { skill_id: 'TIR_DE_PRECISION', skill_group: 'Combat (tir)' },
    { skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Techniques' },
    { skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' }
  ]

  const [soldatEliteFS] = await knex('ref_careers').insert({
    code: 'soldat_elite_forces_speciales',
    name: 'Soldat d\'élite (Forces spéciales)',
    description: 'Les soldats des forces spéciales sont spécialisés dans les interventions rapides et/ou discrètes (assassinat, sabotage, infiltration, enlèvement, anti-terrorisme…).',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Grandes nations. Plus rares dans les communautés modestes.',
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

  await knex('ref_career_skills').insert(
    [...soldatEliteCommonSkills, ...forcesSpecialesSkills].map(s => ({ ...s, career_id: soldatEliteFS.id }))
  )

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteFS.id, salary_per_year: [400, 800, 3000, 6000, 6000][i] }))
  )

  await knex('ref_career_point_categories').insert(
    soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteFS.id }))
  )

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteFS.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteFS.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteFS.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteFS.id, sort_order: 4, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert(
    soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteFS.id }))
  )

  // ============================================================
  // 38. SOUS-MARINIER
  // ============================================================
  const [sousMarinier] = await knex('ref_careers').insert({
    code: 'sous_marinier',
    name: 'Sous-marinier',
    description: 'Les sous-mariniers constituent les équipages des navires de pêche, des bâtiments militaires ou des cargos civils. Ils passent le plus clair de leur temps en mer.',
    contact_frequency: 1,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 3,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: sousMarinier.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: sousMarinier.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: sousMarinier.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: sousMarinier.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: sousMarinier.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // ports commerciaux
    { career_id: sousMarinier.id, skill_id: 'JEU', skill_group: 'Connaissances' },
    { career_id: sousMarinier.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: sousMarinier.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: sousMarinier.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: sousMarinier.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__NAVIRES_LOURDS', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'CHASSE_PISTAGE', skill_group: 'Survie/Extérieur', conditional: true }, // équipage des navires de pêche seulement
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: sousMarinier.id, skill_id: 'ARMES_EMBARQUEES_ARTILLERIE', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: sousMarinier.id, min_years: 1, max_years: 2, title: 'Mousse', salary_per_year: 500 },
    { career_id: sousMarinier.id, min_years: 3, max_years: 7, title: 'Sous-marinier', salary_per_year: 1500 },
    { career_id: sousMarinier.id, min_years: 8, max_years: 14, title: 'Quartier-maître', salary_per_year: 3000 },
    { career_id: sousMarinier.id, min_years: 15, max_years: null, title: 'Patron (accès au grade de Lieutenant)', salary_per_year: 4000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: sousMarinier.id, sort_order: 1, category: 'Relations' },
    { career_id: sousMarinier.id, sort_order: 2, category: 'Célébrité' },
    { career_id: sousMarinier.id, sort_order: 3, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: sousMarinier.id, sort_order: 1, equipment: 'Petit navire de pêche ou de transport (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: sousMarinier.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: sousMarinier.id, sort_order: 3, equipment: 'Matériel de pêche' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: sousMarinier.id, roll: 1, description: 'Attribut augmenté : Constitution +1.' },
    { career_id: sousMarinier.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: sousMarinier.id, roll: 3, description: 'Confrérie : remarqué par une confrérie pirate. Accepte = Pirate. Compétences +3, Relations +2, Célébrité +3.' },
    { career_id: sousMarinier.id, roll: 4, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { career_id: sousMarinier.id, roll: 5, description: 'Guilde : engagé par la Guilde des marins/pêcheurs. Salaire +10% à partir de cette année, Célébrité +3, Relations +2.' },
    { career_id: sousMarinier.id, roll: 6, description: 'Secret/Carte : entendu parler d\'un secret ou d\'une carte au trésor ou d\'une ancienne légende.' },
    { career_id: sousMarinier.id, roll: 7, description: 'Unité des marins : Alliés +2, Relations +4.' },
    { career_id: sousMarinier.id, roll: 8, description: 'Trafic : transport de marchandise pour une organisation. Revenus +20% à partir de cette année, Allié +1, Relations +3, Matériel +2.' },
    { career_id: sousMarinier.id, roll: 9, description: 'Des amis dans chaque port : Alliés +3, Relations +6.' },
    { career_id: sousMarinier.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 39. TECHNICIEN/MÉCANICIEN
  // ============================================================
  const [technicien] = await knex('ref_careers').insert({
    code: 'technicien_mecanicien',
    name: 'Technicien/Mécanicien',
    description: 'Les techniciens sont certainement les individus les plus respectés au fond des mers puisque ce sont eux qui réparent les installations et les appareils.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: technicien.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: technicien.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { career_id: technicien.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: technicien.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', skill_group: 'Connaissances', conditional: true }, // en rapport avec le domaine d'activité
    { career_id: technicien.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', skill_group: 'Connaissances', conditional: true },
    { career_id: technicien.id, skill_id: 'CRYPTOGRAPHIE', skill_group: 'Connaissances', conditional: true }, // pour les spécialistes de la sécurité
    // Note : « langue de la communauté d'accueil » — variable, non seedable
    { career_id: technicien.id, skill_id: 'LANGAGES_SPECIFIQUES_NEOLAN', skill_group: 'Langues' },
    { career_id: technicien.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: technicien.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Subterfuge' },
    { career_id: technicien.id, skill_id: 'ELECTRONIQUE', skill_group: 'Techniques' },
    { career_id: technicien.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: technicien.id, skill_id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', skill_group: 'Techniques', conditional: true }, // au choix selon domaine
    { career_id: technicien.id, skill_id: 'PIRATAGE_INFORMATIQUE', skill_group: 'Techniques', conditional: true } // pour les spécialistes de la sécurité informatique
  ])

  await knex('ref_career_titles').insert([
    { career_id: technicien.id, min_years: 1, max_years: 7, title: 'Apprenti', salary_per_year: 500 },
    { career_id: technicien.id, min_years: 8, max_years: 13, title: 'Technicien indépendant', salary_per_year: 1500 },
    { career_id: technicien.id, min_years: 14, max_years: 15, title: 'Technicien Classe A', salary_per_year: 3000 },
    { career_id: technicien.id, min_years: 16, max_years: 17, title: 'Technicien Classe B', salary_per_year: 6000 },
    { career_id: technicien.id, min_years: 18, max_years: 19, title: 'Technicien confirmé', salary_per_year: 8000 },
    { career_id: technicien.id, min_years: 20, max_years: 21, title: 'Technicien senior', salary_per_year: 12000 },
    { career_id: technicien.id, min_years: 22, max_years: null, title: 'Maître Technicien', salary_per_year: 20000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: technicien.id, sort_order: 1, category: 'Relations' },
    { career_id: technicien.id, sort_order: 2, category: 'Célébrité' },
    { career_id: technicien.id, sort_order: 3, category: 'Matériel' },
    { career_id: technicien.id, sort_order: 4, category: 'Atelier' },
    { career_id: technicien.id, sort_order: 5, category: 'Assemblage' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: technicien.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: technicien.id, sort_order: 2, equipment: 'Matériel correspondant à la profession du personnage' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: technicien.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: technicien.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Assemblage +2, Matériel +2.' },
    { career_id: technicien.id, roll: 3, description: 'Guilde : engagé par la Guilde des techniciens. Revenus +10% à partir de cette année, Atelier +2, Célébrité +3, Points de compétence +2, Matériel +2.' },
    { career_id: technicien.id, roll: 4, description: 'Œuvre : participation à l\'élaboration d\'une œuvre importante (prototype, réparation majeure, création d\'un navire…). Célébrité +4, Points de compétence +4, Assemblage +4, Atelier +4, Matériel +4.' },
    { career_id: technicien.id, roll: 5, description: 'Contact : contacté par une grande entreprise, Malgo Huit-pattes ou les Charognards. Atelier +2, Matériel +4, Célébrité +3, Points de compétence +2, Assemblage +4.' },
    { career_id: technicien.id, roll: 6, description: 'Année faste : paie doublée pour l\'année, Matériel +4, Atelier +2.' },
    { career_id: technicien.id, roll: 7, description: 'Pièces détachées : obtention de matériel. Matériel +6, Atelier +1.' },
    { career_id: technicien.id, roll: 8, description: 'Protecteur/Mécène : protégé par un puissant personnage. Célébrité +4, Assemblage +6, revenus +20% à partir de cette année, Atelier +1, Allié +1.' },
    { career_id: technicien.id, roll: 9, description: 'Contrebandiers/pirates : aide à des pirates ou contrebandiers. Revenus +10% à partir de cette année, Matériel +4, Assemblage +4, Relations +4, Alliés +2.' },
    { career_id: technicien.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 40. TECHNO-HYBRIDE
  // ============================================================
  const [technoHybride] = await knex('ref_careers').insert({
    code: 'techno_hybride',
    name: 'Techno-Hybride',
    description: 'Les techno-hybrides sont le produit de la science hégémonienne. Atrocement déformés par les implants qui leur permettent de respirer sous l\'eau, ils forment un des groupes de combat les plus redoutés sous l\'eau.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Un techno-hybride ne peut être qu\'Hégémonien.',
    required_genotype: 'techno_hybride',
    contact_frequency: 8,
    ally_frequency: 10,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 10,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: technoHybride.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'ARMES_LOURDES_CONTACT', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' }, // LdB L.2177 : "(Lutte)" — définitif
    { career_id: technoHybride.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    // Note : « une autre Compétence d'arme au choix » — variable, non seedable
    { career_id: technoHybride.id, skill_id: 'INTIMIDATION', skill_group: 'Communication/Relations sociales' },
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Hégémonie
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Armée hégémonienne
    { career_id: technoHybride.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: technoHybride.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: technoHybride.id, skill_id: 'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'LANGAGES_SPECIFIQUES_EXON', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'HYBRIDE', skill_group: 'Compétences spéciales' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: technoHybride.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 100 },
    { career_id: technoHybride.id, min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 400 },
    { career_id: technoHybride.id, min_years: 6, max_years: 7, title: 'Vétéran', salary_per_year: 1200 },
    { career_id: technoHybride.id, min_years: 8, max_years: 11, title: 'Sergent', salary_per_year: 2500 },
    { career_id: technoHybride.id, min_years: 12, max_years: 14, title: 'Major', salary_per_year: 6000 },
    { career_id: technoHybride.id, min_years: 15, max_years: null, title: 'Major (accès au grade de Lieutenant)', salary_per_year: 6000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: technoHybride.id, sort_order: 1, category: 'Relations' },
    { career_id: technoHybride.id, sort_order: 2, category: 'Célébrité' },
    { career_id: technoHybride.id, sort_order: 3, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: technoHybride.id, sort_order: 1, equipment: 'Arme de poignet hybride (gratuit)' },
    { career_id: technoHybride.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: technoHybride.id, sort_order: 3, equipment: 'Armes blanches (couteau gratuit)' },
    { career_id: technoHybride.id, sort_order: 4, equipment: 'Armes de poing (Pistolet avec permis gratuit)' },
    { career_id: technoHybride.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: technoHybride.id, roll: 1, description: 'Attribut augmenté : Constitution +1' },
    { career_id: technoHybride.id, roll: 2, description: 'Bataille : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: technoHybride.id, roll: 3, description: 'Distinction : Revenus doublés pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { career_id: technoHybride.id, roll: 4, description: 'Héros : Revenus triplés pour l\'année, points de compétence +4, Célébrité +4, Matériel +3.' },
    { career_id: technoHybride.id, roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { career_id: technoHybride.id, roll: 6, description: 'Prestation : remarqué par sa hiérarchie. Point de compétence +2, Célébrité +2.' },
    { career_id: technoHybride.id, roll: 7, description: 'Formation : ajouter une Compétence au choix. Points de compétence +2, Relations +1.' },
    { career_id: technoHybride.id, roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { career_id: technoHybride.id, roll: 9, description: 'Mercenaires/Milice privée : Allié +2, Relations +4.' },
    { career_id: technoHybride.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 41. VEILLEUR
  // ============================================================
  const [veilleur] = await knex('ref_careers').insert({
    code: 'veilleur',
    name: 'Veilleur',
    description: 'Les Veilleurs sont les soldats du Culte du Trident et de l\'OESM. C\'est avant tout une police internationale chargée de protéger les intérêts du Trident et ceux des petites communautés sous-marines.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Formés sur Équinoxe pour la plupart. Peuvent être de n\'importe quelle origine.',
    contact_frequency: 2,
    ally_frequency: 3,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: veilleur.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: veilleur.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: veilleur.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)' }, // LdB L.2250-2251 : virgule = 2 définitifs
    { career_id: veilleur.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'TIR_AUTOMATIQUES', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Équinoxe
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Veilleurs
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Culte du Trident
    { career_id: veilleur.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: veilleur.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: veilleur.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: veilleur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: veilleur.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: veilleur.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: veilleur.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: veilleur.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 200 },
    { career_id: veilleur.id, min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 800 },
    { career_id: veilleur.id, min_years: 6, max_years: 7, title: 'Vétéran', salary_per_year: 2400 },
    { career_id: veilleur.id, min_years: 8, max_years: 11, title: 'Sergent', salary_per_year: 5000 },
    { career_id: veilleur.id, min_years: 12, max_years: null, title: 'Sergent (accès au grade de Lieutenant)', salary_per_year: 5000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: veilleur.id, sort_order: 1, category: 'Relations' },
    { career_id: veilleur.id, sort_order: 2, category: 'Célébrité' },
    { career_id: veilleur.id, sort_order: 3, category: 'Cabine privée' },
    { career_id: veilleur.id, sort_order: 4, category: 'Corruption/Chantage' },
    { career_id: veilleur.id, sort_order: 5, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: veilleur.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: veilleur.id, sort_order: 2, equipment: 'Armes blanches (couteau gratuit)' },
    { career_id: veilleur.id, sort_order: 3, equipment: 'Armes à feu (Pistolet avec permis gratuit)' },
    { career_id: veilleur.id, sort_order: 4, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: veilleur.id, roll: 1, description: 'Attribut augmenté : Volonté +1' },
    { career_id: veilleur.id, roll: 2, description: 'Bataille/Émeute : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: veilleur.id, roll: 3, description: 'Distinction : Revenus doublés pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { career_id: veilleur.id, roll: 4, description: 'Héros : Revenus triplés pour l\'année, points de compétence +4, Célébrité +4, Matériel +3.' },
    { career_id: veilleur.id, roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { career_id: veilleur.id, roll: 6, description: 'Réseau d\'informateurs : sur Équinoxe, Relations +8.' },
    { career_id: veilleur.id, roll: 7, description: 'Procédures limites : abus de position. Matériel +4, Corruption/Chantage +4, revenus doublés pour l\'année, Ennemi +1.' },
    { career_id: veilleur.id, roll: 8, description: 'Formation : ajouter une Compétence au choix. Points de compétence +2, Relations +1.' },
    { career_id: veilleur.id, roll: 9, description: 'Mercenaires/Milice privée : Allié +2, Relations +4.' },
    { career_id: veilleur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 42. VOLEUR/CRIMINEL
  // ============================================================
  const [voleur] = await knex('ref_careers').insert({
    code: 'voleur_criminel',
    name: 'Voleur/Criminel',
    description: 'Voleurs et petits criminels sont légion dans les bas-fonds des grandes cités sous-marines. On les trouve très rarement dans les petites communautés.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Grandes villes sous-marines, particulièrement les ports commerciaux.',
    contact_frequency: 1,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 1,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: voleur.id, skill_id: 'ACROBATIE_EQUILIBRE', skill_group: 'Aptitudes physiques' },
    { career_id: voleur.id, skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { career_id: voleur.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: voleur.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: voleur.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: voleur.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: voleur.id, skill_id: 'COMMERCE_TRAFIC__DROGUES', skill_group: 'Connaissances' }, // LdB L.2324 : "Drogues, Armes"
    { career_id: voleur.id, skill_id: 'COMMERCE_TRAFIC__ARMES', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Contrebandiers
    { career_id: voleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Crime organisé
    { career_id: voleur.id, skill_id: 'JEU', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', skill_group: 'Connaissances' }, // LdB : "Connaissance des poisons"
    { career_id: voleur.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'EVASION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'PICKPOCKET', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: voleur.id, skill_id: 'LANGAGES_SPECIFIQUES_SIRS', skill_group: 'Langues' },
    { career_id: voleur.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'FALSIFICATION', skill_group: 'Techniques' },
    { career_id: voleur.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: voleur.id, min_years: 1, max_years: 3, title: 'Guetteur', salary_formula: '1D10*100' },
    { career_id: voleur.id, min_years: 4, max_years: 6, title: 'Voleur/Criminel', salary_formula: '1D10*300' },
    { career_id: voleur.id, min_years: 7, max_years: 10, title: 'Voleur/Criminel', salary_formula: '1D10*500' },
    { career_id: voleur.id, min_years: 11, max_years: 15, title: 'Chef de gang', salary_per_year: 7000 },
    { career_id: voleur.id, min_years: 16, max_years: 20, title: 'Chef de gang', salary_per_year: 12000 },
    { career_id: voleur.id, min_years: 21, max_years: null, title: 'Seigneur du crime', salary_per_year: 20000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: voleur.id, sort_order: 1, category: 'Relations' },
    { career_id: voleur.id, sort_order: 2, category: 'Célébrité' },
    { career_id: voleur.id, sort_order: 3, category: 'Cache/Planque' },
    { career_id: voleur.id, sort_order: 4, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: voleur.id, sort_order: 1, equipment: 'Un peu de tout… mais il s\'agit toujours de matériel volé et/ou d\'occasion' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: voleur.id, roll: 1, description: 'Attribut augmenté : Adaptation +1.' },
    { career_id: voleur.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +4.' },
    { career_id: voleur.id, roll: 3, description: 'Groupe criminel : travaille pour un seigneur du crime. Célébrité +3, Points de compétence +4, Relations +2, Allié +1.' },
    { career_id: voleur.id, roll: 4, description: 'Réseau : Célébrité +2, Points de compétence +2, Matériel +4, Réseau +4. Revenus +10% à partir de cette année.' },
    { career_id: voleur.id, roll: 5, description: 'Mise à prix : Célébrité +4. Récompense = Célébrité x 500 sols. Chaque résultat double la somme.' },
    { career_id: voleur.id, roll: 6, description: 'Année faste : revenus doublés, Matériel +4.' },
    { career_id: voleur.id, roll: 7, description: 'Indic : travaille comme indic. Célébrité +2, revenus doublés à partir de cette année, Allié +1, Ennemi +1.' },
    { career_id: voleur.id, roll: 8, description: 'Animal de compagnie : possède un rat-lynx par exemple.' },
    { career_id: voleur.id, roll: 9, description: 'Petit confort : Cache/Planque +4, Matériel +4.' },
    { career_id: voleur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
