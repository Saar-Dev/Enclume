// 093_seed_ref_careers_lot6.cjs
// Lot 6 : Soldat d'élite (×4), Sous-marinier, Technicien/Mécanicien, Techno-hybride, Veilleur, Voleur/Criminel

export const seed = async (knex) => {
  // ============================================================
  // 34-37. SOLDAT D'ÉLITE — commun
  // ============================================================
  const soldatEliteCommonSkills = [
    { skill_id: 'athletisme', skill_group: 'Aptitudes physiques' },
    { skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { skill_id: 'arts_martiaux', skill_group: 'Combat (contact)' },
    { skill_id: 'armes_speciales', skill_group: 'Combat (contact)' },
    { skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { skill_id: 'armes_lourdes_tir', skill_group: 'Combat (tir)' },
    { skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { skill_id: 'fusils_armes_epaule', skill_group: 'Combat (tir)' },
    { skill_id: 'tir_automatique', skill_group: 'Combat (tir)' },
    { skill_id: 'cartographie', skill_group: 'Connaissances' },
    { skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { skill_id: 'connaissance_milieux_sociaux', skill_group: 'Connaissances' },
    { skill_id: 'tactique', skill_group: 'Connaissances' },
    { skill_id: 'camouflage_dissimulation', skill_group: 'Furtivité' },
    { skill_id: 'furtivite_deplacement_silencieux', skill_group: 'Furtivité' },
    // Note : « langue de la communauté d'accueil » — variable
    { skill_id: 'neo_azuran', skill_group: 'Langues' },
    { skill_id: 'telepilotage', skill_group: 'Pilotage' },
    { skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { skill_id: 'survie', skill_group: 'Survie/Extérieur' },
    { skill_id: 'analyse_sonscans', skill_group: 'Techniques' },
    { skill_id: 'explosifs', skill_group: 'Techniques' },
    { skill_id: 'premiers_soins', skill_group: 'Techniques' }
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
    { skill_id: 'manoeuvres_sous_marines', skill_group: 'Aptitudes physiques' },
    { skill_id: 'respiration_foe', skill_group: 'Aptitudes physiques' },
    { skill_id: 'armes_lourdes_contact', skill_group: 'Combat (contact)' },
    { skill_id: 'armes_sous_marines', skill_group: 'Combat (tir)' },
    { skill_id: 'langage_signes', skill_group: 'Langues' },
    { skill_id: 'manoeuvre_armure', skill_group: 'Pilotage' },
    { skill_id: 'pilotage', skill_group: 'Pilotage' },
    { skill_id: 'chasse_pistage', skill_group: 'Survie/Extérieur' },
    { skill_id: 'connaissance_milieu_naturel', skill_group: 'Survie/Extérieur' },
    { skill_id: 'pieges', skill_group: 'Techniques' }
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
    { skill_id: 'escalade', skill_group: 'Aptitudes physiques' },
    { skill_id: 'manoeuvre_armure', skill_group: 'Pilotage' },
    { skill_id: 'pilotage', skill_group: 'Pilotage' },
    { skill_id: 'chasse_pistage', skill_group: 'Survie/Extérieur' },
    { skill_id: 'connaissance_milieu_naturel', skill_group: 'Survie/Extérieur' },
    { skill_id: 'pieges', skill_group: 'Techniques' }
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
    { skill_id: 'escalade', skill_group: 'Aptitudes physiques' },
    { skill_id: 'tir_precision', skill_group: 'Combat (tir)' },
    { skill_id: 'manoeuvre_armure', skill_group: 'Pilotage' },
    { skill_id: 'pilotage', skill_group: 'Pilotage' },
    { skill_id: 'chasse_pistage', skill_group: 'Survie/Extérieur' },
    { skill_id: 'connaissance_milieu_naturel', skill_group: 'Survie/Extérieur' },
    { skill_id: 'pieges', skill_group: 'Techniques' },
    { skill_id: 'mecanique', skill_group: 'Techniques' }
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
    { skill_id: 'tir_precision', skill_group: 'Combat (tir)' },
    { skill_id: 'espionnage_surveillance', skill_group: 'Techniques' },
    { skill_id: 'systemes_securite', skill_group: 'Techniques' }
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
    { career_id: sousMarinier.id, skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { career_id: sousMarinier.id, skill_id: 'manoeuvres_sous_marines', skill_group: 'Aptitudes physiques' },
    { career_id: sousMarinier.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: sousMarinier.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: sousMarinier.id, skill_id: 'armes_sous_marines', skill_group: 'Combat (tir)' },
    { career_id: sousMarinier.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: sousMarinier.id, skill_id: 'jeu', skill_group: 'Connaissances' },
    { career_id: sousMarinier.id, skill_id: 'navigation', skill_group: 'Connaissances' },
    { career_id: sousMarinier.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: sousMarinier.id, skill_id: 'soleen', skill_group: 'Langues' },
    { career_id: sousMarinier.id, skill_id: 'manoeuvre_armure', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'pilotage', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'telepilotage', skill_group: 'Pilotage' },
    { career_id: sousMarinier.id, skill_id: 'chasse_pistage', skill_group: 'Survie/Extérieur', conditional: true },
    { career_id: sousMarinier.id, skill_id: 'connaissance_milieu_naturel', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'survie', skill_group: 'Survie/Extérieur' },
    { career_id: sousMarinier.id, skill_id: 'analyse_sonscans', skill_group: 'Techniques' },
    { career_id: sousMarinier.id, skill_id: 'armes_embarquees', skill_group: 'Techniques' }
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
    { career_id: technicien.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: technicien.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: technicien.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    { career_id: technicien.id, skill_id: 'cryptographie', skill_group: 'Connaissances', conditional: true },
    // Note : « langue de la communauté d'accueil » — variable
    { career_id: technicien.id, skill_id: 'neolan', skill_group: 'Langues' },
    { career_id: technicien.id, skill_id: 'telepilotage', skill_group: 'Pilotage' },
    { career_id: technicien.id, skill_id: 'systemes_securite', skill_group: 'Subterfuge' },
    { career_id: technicien.id, skill_id: 'electronique', skill_group: 'Techniques' },
    { career_id: technicien.id, skill_id: 'informatique', skill_group: 'Techniques' },
    { career_id: technicien.id, skill_id: 'mecanique', skill_group: 'Techniques' },
    { career_id: technicien.id, skill_id: 'piratage_informatique', skill_group: 'Techniques', conditional: true }
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
    { career_id: technoHybride.id, skill_id: 'athletisme', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'manoeuvres_sous_marines', skill_group: 'Aptitudes physiques' },
    { career_id: technoHybride.id, skill_id: 'armes_lourdes_contact', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'arts_martiaux', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: technoHybride.id, skill_id: 'armes_sous_marines', skill_group: 'Combat (tir)' },
    // Note : « une autre Compétence d'arme au choix » — variable
    { career_id: technoHybride.id, skill_id: 'intimidation', skill_group: 'Communication/Relations sociales' },
    { career_id: technoHybride.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: technoHybride.id, skill_id: 'tactique', skill_group: 'Connaissances' },
    { career_id: technoHybride.id, skill_id: 'furtivite_deplacement_silencieux', skill_group: 'Furtivité/Subterfuge' },
    { career_id: technoHybride.id, skill_id: 'langage_signes', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'exon', skill_group: 'Langues' },
    { career_id: technoHybride.id, skill_id: 'connaissance_milieu_naturel', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'survie', skill_group: 'Survie/Extérieur' },
    { career_id: technoHybride.id, skill_id: 'hybride', skill_group: 'Compétences spéciales' }
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
    { career_id: veilleur.id, skill_id: 'athletisme', skill_group: 'Aptitudes physiques' },
    { career_id: veilleur.id, skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { career_id: veilleur.id, skill_id: 'arts_martiaux', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: veilleur.id, skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'fusils_armes_epaule', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'tir_automatique', skill_group: 'Combat (tir)' },
    { career_id: veilleur.id, skill_id: 'commandement', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'intimidation', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'eloquence_persuasion', skill_group: 'Communications/Relations sociales' },
    { career_id: veilleur.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: veilleur.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: veilleur.id, skill_id: 'tactique', skill_group: 'Connaissances' },
    { career_id: veilleur.id, skill_id: 'discretion_filature', skill_group: 'Furtivité/Subterfuge' },
    { career_id: veilleur.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: veilleur.id, skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { career_id: veilleur.id, skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { career_id: veilleur.id, skill_id: 'premiers_soins', skill_group: 'Techniques' }
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
    { career_id: voleur.id, skill_id: 'acrobatie_equilibre', skill_group: 'Aptitudes physiques' },
    { career_id: voleur.id, skill_id: 'escalade', skill_group: 'Aptitudes physiques' },
    { career_id: voleur.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: voleur.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: voleur.id, skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { career_id: voleur.id, skill_id: 'intimidation', skill_group: 'Communications/Relations sociales' },
    { career_id: voleur.id, skill_id: 'commerce_trafic', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'jeu', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    { career_id: voleur.id, skill_id: 'discretion_filature', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'evasion', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'furtivite_deplacement_silencieux', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'pickpocket', skill_group: 'Furtivité/Subterfuge' },
    { career_id: voleur.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: voleur.id, skill_id: 'sirs', skill_group: 'Langues' },
    { career_id: voleur.id, skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'survie', skill_group: 'Survie/Extérieur' },
    { career_id: voleur.id, skill_id: 'falsification', skill_group: 'Techniques' },
    { career_id: voleur.id, skill_id: 'systemes_securite', skill_group: 'Techniques' }
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