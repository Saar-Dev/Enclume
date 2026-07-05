// 116_seed_ref_careers_lot6.js — Seed lot 6 (COUCHE 4c) : 9 carrières
// Soldat d'élite (Commando marin/souterrain/surface, Forces spéciales), Sous-marinier,
// Technicien/Mécanicien, Techno-hybride, Veilleur, Voleur/Criminel
// Source : docs/Character/Creation/migrations/93_seed_ref_careers_lot6.cjs (déjà audité/corrigé)
// skill_group non repris (colonne supprimée migration 111 — ref_skills.family fait foi désormais)
// Correction appliquée ici : required_genotype 'techno_hybride' (inexistant) -> 'TEC_HYB'
// (ref_genotypes, même bug que hybride_trident lot2 — voir docs/PLAN_LOTS_3_6_CAREERS.md)
// Voir docs/PLAN_LOTS_3_6_CAREERS.md pour le détail de la vérification (skill_id + MinIO)

const CODES = [
  'soldat_elite_commando_marin', 'soldat_elite_commando_souterrain', 'soldat_elite_commando_surface',
  'soldat_elite_forces_speciales', 'sous_marinier', 'technicien_mecanicien', 'techno_hybride',
  'veilleur', 'voleur_criminel',
]

const soldatEliteCommonSkills = [
  'ATHLETISME', 'ENDURANCE', 'COMBAT_ARME', 'COMBAT_A_MAINS_NUES', 'ARMES_LOURDES', 'ARMES_DE_POING',
  'FUSIL_ARMES_DEPAULES', 'TIR_AUTOMATIQUES', 'CARTOGRAPHIE', 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',
  'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', 'CONNAISSANCE_MILIEUX_SOCIAUX', 'TACTIQUE_OPERATIONS_COMMANDO',
  'CAMOUFLAGE_DISSIMULATION', 'FURTIVITE_DEPLACEMENT_SILENCIEUX', 'LANGUE_ETRANGERE_NEO_AZURAN', 'TELEPILOTAGE',
  'OBSERVATION', 'ORIENTATION', 'SURVIE', 'ANALYSES_SONSCANS', 'EXPLOSIFS', 'PREMIER_SOINS',
]
const soldatEliteCommonConditional = ['ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION']

const soldatEliteTitles = [
  { min_years: 1, max_years: 1, title: 'Recrue' },
  { min_years: 2, max_years: 5, title: 'Soldat' },
  { min_years: 6, max_years: 7, title: 'Vétéran' },
  { min_years: 8, max_years: 11, title: 'Sergent' },
  { min_years: 12, max_years: null, title: 'Sergent (accès au grade de Lieutenant)' },
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
  { roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
]

const soldatElitePointCategories = [
  { sort_order: 1, category: 'Célébrité' },
  { sort_order: 2, category: 'Relations' },
  { sort_order: 3, category: 'Matériel' },
]

export const up = async (knex) => {
  // ============================================================
  // SOLDAT D'ÉLITE — COMMANDO MARIN
  // ============================================================
  const commandoMarinSkills = [
    'MANOEUVRES_SOUS_MARINES', 'RESPIRATION_FOE', 'ARMES_LOURDES_CONTACT', 'ARMES_SOUS_MARINES',
    'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', 'PILOTAGE__VEHICULES_DE_SOL',
    'CHASSE_PISTAGE', 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', 'PIEGES',
  ]

  const [soldatEliteMarin] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_marin',
    name: 'Soldat d\'élite (Commando marin)',
    description: 'Les commandos marins sont spécialistes du combat en armure de plongée. Ce sont des unités particulièrement renommées dans toutes les grandes armées du monde.',
    illustration: 'assets/s4_soldat_elite_commando_marin.webp',
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
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    ...soldatEliteCommonSkills.map(skill_id => ({ career_id: soldatEliteMarin.id, skill_id })),
    ...soldatEliteCommonConditional.map(skill_id => ({ career_id: soldatEliteMarin.id, skill_id, conditional: true })),
    ...commandoMarinSkills.map(skill_id => ({ career_id: soldatEliteMarin.id, skill_id })),
  ])

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteMarin.id, salary_per_year: [400, 800, 3000, 6000, 6000][i] }))
  )
  await knex('ref_career_point_categories').insert(soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteMarin.id })))

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteMarin.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteMarin.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteMarin.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteMarin.id, sort_order: 4, equipment: 'Armure de plongée exo-1 (gratuite)' },
    { career_id: soldatEliteMarin.id, sort_order: 5, equipment: 'Protections et armures' },
  ])

  await knex('ref_career_random_benefits').insert(soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteMarin.id })))

  // ============================================================
  // SOLDAT D'ÉLITE — COMMANDO SOUTERRAIN
  // ============================================================
  const commandoSouterrainSkills = [
    'ESCALADE', 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', 'PILOTAGE__VEHICULES_SOUTERRAINS', 'PILOTAGE__VEHICULES_DE_SOL',
    'CHASSE_PISTAGE', 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS', 'PIEGES',
  ]

  const [soldatEliteSouterrain] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_souterrain',
    name: 'Soldat d\'élite (Commando souterrain)',
    description: 'Les soldats entraînés à se battre sous terre sont généralement peu connus de la population. Ils passent leur vie dans les bases proches des territoires des Foreurs.',
    illustration: 'assets/s4_soldat_elite_commando_souterrain.webp',
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
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    ...soldatEliteCommonSkills.map(skill_id => ({ career_id: soldatEliteSouterrain.id, skill_id })),
    ...soldatEliteCommonConditional.map(skill_id => ({ career_id: soldatEliteSouterrain.id, skill_id, conditional: true })),
    ...commandoSouterrainSkills.map(skill_id => ({ career_id: soldatEliteSouterrain.id, skill_id })),
  ])

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteSouterrain.id, salary_per_year: [500, 1200, 3600, 7500, 7500][i] }))
  )
  await knex('ref_career_point_categories').insert(soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteSouterrain.id })))

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteSouterrain.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteSouterrain.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 4, equipment: 'Armure externe exo-1 (gratuite)' },
    { career_id: soldatEliteSouterrain.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' },
  ])

  await knex('ref_career_random_benefits').insert(soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteSouterrain.id })))

  // ============================================================
  // SOLDAT D'ÉLITE — COMMANDO DE SURFACE
  // ============================================================
  const commandoSurfaceSkills = [
    'ESCALADE', 'TIR_DE_PRECISION', 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES',
    'PILOTAGE__VEHICULES_DE_SOL', 'CHASSE_PISTAGE', 'CONNAISSANCE_MILIEU_NATUREL_SURFACE', 'PIEGES', 'MECANIQUE_VEHICULES_DE_SOL',
  ]

  const [soldatEliteSurface] = await knex('ref_careers').insert({
    code: 'soldat_elite_commando_surface',
    name: 'Soldat d\'élite (Commando de surface)',
    description: 'Entraînés pour se battre en surface, ces soldats sont particulièrement robustes et psychologiquement préparés à affronter les horreurs de l\'ancien monde.',
    illustration: 'assets/s4_soldat_elite_commando_surface.webp',
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
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    ...soldatEliteCommonSkills.map(skill_id => ({ career_id: soldatEliteSurface.id, skill_id })),
    ...soldatEliteCommonConditional.map(skill_id => ({ career_id: soldatEliteSurface.id, skill_id, conditional: true })),
    ...commandoSurfaceSkills.map(skill_id => ({ career_id: soldatEliteSurface.id, skill_id })),
  ])

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteSurface.id, salary_per_year: [500, 1200, 3600, 7500, 7500][i] }))
  )
  await knex('ref_career_point_categories').insert(soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteSurface.id })))

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteSurface.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteSurface.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteSurface.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteSurface.id, sort_order: 4, equipment: 'Armure externe exo-1 (gratuite)' },
    { career_id: soldatEliteSurface.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' },
  ])

  await knex('ref_career_random_benefits').insert(soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteSurface.id })))

  // ============================================================
  // SOLDAT D'ÉLITE — FORCES SPÉCIALES
  // ============================================================
  const forcesSpecialesSkills = ['TIR_DE_PRECISION', 'ESPIONNAGE_SURVEILLANCE', 'SYSTEMES_DE_SECURITE']

  const [soldatEliteFS] = await knex('ref_careers').insert({
    code: 'soldat_elite_forces_speciales',
    name: 'Soldat d\'élite (Forces spéciales)',
    description: 'Les soldats des forces spéciales sont spécialisés dans les interventions rapides et/ou discrètes (assassinat, sabotage, infiltration, enlèvement, anti-terrorisme…).',
    illustration: 'assets/s4_soldat_elite_forces_speciales.webp',
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
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    ...soldatEliteCommonSkills.map(skill_id => ({ career_id: soldatEliteFS.id, skill_id })),
    ...soldatEliteCommonConditional.map(skill_id => ({ career_id: soldatEliteFS.id, skill_id, conditional: true })),
    ...forcesSpecialesSkills.map(skill_id => ({ career_id: soldatEliteFS.id, skill_id })),
  ])

  await knex('ref_career_titles').insert(
    soldatEliteTitles.map((t, i) => ({ ...t, career_id: soldatEliteFS.id, salary_per_year: [400, 800, 3000, 6000, 6000][i] }))
  )
  await knex('ref_career_point_categories').insert(soldatElitePointCategories.map(p => ({ ...p, career_id: soldatEliteFS.id })))

  await knex('ref_career_equipment').insert([
    { career_id: soldatEliteFS.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldatEliteFS.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldatEliteFS.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldatEliteFS.id, sort_order: 4, equipment: 'Protections et armures (une armure de base gratuite)' },
  ])

  await knex('ref_career_random_benefits').insert(soldatEliteBenefits.map(b => ({ ...b, career_id: soldatEliteFS.id })))

  // ============================================================
  // SOUS-MARINIER
  // ============================================================
  const [sousMarinier] = await knex('ref_careers').insert({
    code: 'sous_marinier',
    name: 'Sous-marinier',
    description: 'Les sous-mariniers constituent les équipages des navires de pêche, des bâtiments militaires ou des cargos civils. Ils passent le plus clair de leur temps en mer.',
    illustration: 'assets/s4_sousmarinier.webp',
    contact_frequency: 1,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 3,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: sousMarinier.id, skill_id: 'ENDURANCE' },
    { career_id: sousMarinier.id, skill_id: 'MANOEUVRES_SOUS_MARINES' },
    { career_id: sousMarinier.id, skill_id: 'COMBAT_ARME' },
    { career_id: sousMarinier.id, skill_id: 'COMBAT_A_MAINS_NUES' },
    { career_id: sousMarinier.id, skill_id: 'ARMES_SOUS_MARINES' },
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: sousMarinier.id, skill_id: 'JEU' },
    { career_id: sousMarinier.id, skill_id: 'NAVIGATION' },
    { career_id: sousMarinier.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: sousMarinier.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN' },
    { career_id: sousMarinier.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__NAVIRES_LOURDS' },
    { career_id: sousMarinier.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS' },
    { career_id: sousMarinier.id, skill_id: 'TELEPILOTAGE' },
    { career_id: sousMarinier.id, skill_id: 'CHASSE_PISTAGE', conditional: true },
    { career_id: sousMarinier.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS' },
    { career_id: sousMarinier.id, skill_id: 'ORIENTATION' },
    { career_id: sousMarinier.id, skill_id: 'SURVIE' },
    { career_id: sousMarinier.id, skill_id: 'ANALYSES_SONSCANS' },
    { career_id: sousMarinier.id, skill_id: 'ARMES_EMBARQUEES_ARTILLERIE' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: sousMarinier.id, min_years: 1, max_years: 2, title: 'Mousse', salary_per_year: 500 },
    { career_id: sousMarinier.id, min_years: 3, max_years: 7, title: 'Sous-marinier', salary_per_year: 1500 },
    { career_id: sousMarinier.id, min_years: 8, max_years: 14, title: 'Quartier-maître', salary_per_year: 3000 },
    { career_id: sousMarinier.id, min_years: 15, max_years: null, title: 'Patron (accès au grade de Lieutenant)', salary_per_year: 4000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: sousMarinier.id, sort_order: 1, category: 'Relations' },
    { career_id: sousMarinier.id, sort_order: 2, category: 'Célébrité' },
    { career_id: sousMarinier.id, sort_order: 3, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: sousMarinier.id, sort_order: 1, equipment: 'Petit navire de pêche ou de transport (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: sousMarinier.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: sousMarinier.id, sort_order: 3, equipment: 'Matériel de pêche' },
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
    { career_id: sousMarinier.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // TECHNICIEN/MÉCANICIEN
  // ============================================================
  const [technicien] = await knex('ref_careers').insert({
    code: 'technicien_mecanicien',
    name: 'Technicien/Mécanicien',
    description: 'Les techniciens sont certainement les individus les plus respectés au fond des mers puisque ce sont eux qui réparent les installations et les appareils.',
    illustration: 'assets/s4_technicien.webp',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: technicien.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: technicien.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: technicien.id, skill_id: 'EDUCATION_CULTURE_GENERALE' },
    { career_id: technicien.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', conditional: true },
    { career_id: technicien.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', conditional: true },
    { career_id: technicien.id, skill_id: 'CRYPTOGRAPHIE', conditional: true },
    { career_id: technicien.id, skill_id: 'LANGAGES_SPECIFIQUES_NEOLAN' },
    { career_id: technicien.id, skill_id: 'TELEPILOTAGE' },
    { career_id: technicien.id, skill_id: 'SYSTEMES_DE_SECURITE' },
    { career_id: technicien.id, skill_id: 'ELECTRONIQUE' },
    { career_id: technicien.id, skill_id: 'INFORMATIQUE' },
    { career_id: technicien.id, skill_id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', conditional: true },
    { career_id: technicien.id, skill_id: 'PIRATAGE_INFORMATIQUE', conditional: true },
  ])

  await knex('ref_career_titles').insert([
    { career_id: technicien.id, min_years: 1, max_years: 7, title: 'Apprenti', salary_per_year: 500 },
    { career_id: technicien.id, min_years: 8, max_years: 13, title: 'Technicien indépendant', salary_per_year: 1500 },
    { career_id: technicien.id, min_years: 14, max_years: 15, title: 'Technicien Classe A', salary_per_year: 3000 },
    { career_id: technicien.id, min_years: 16, max_years: 17, title: 'Technicien Classe B', salary_per_year: 6000 },
    { career_id: technicien.id, min_years: 18, max_years: 19, title: 'Technicien confirmé', salary_per_year: 8000 },
    { career_id: technicien.id, min_years: 20, max_years: 21, title: 'Technicien senior', salary_per_year: 12000 },
    { career_id: technicien.id, min_years: 22, max_years: null, title: 'Maître Technicien', salary_per_year: 20000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: technicien.id, sort_order: 1, category: 'Relations' },
    { career_id: technicien.id, sort_order: 2, category: 'Célébrité' },
    { career_id: technicien.id, sort_order: 3, category: 'Matériel' },
    { career_id: technicien.id, sort_order: 4, category: 'Atelier' },
    { career_id: technicien.id, sort_order: 5, category: 'Assemblage' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: technicien.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: technicien.id, sort_order: 2, equipment: 'Matériel correspondant à la profession du personnage' },
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
    { career_id: technicien.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // TECHNO-HYBRIDE
  // ============================================================
  const [technoHybride] = await knex('ref_careers').insert({
    code: 'techno_hybride',
    name: 'Techno-Hybride',
    description: 'Les techno-hybrides sont le produit de la science hégémonienne. Atrocement déformés par les implants qui leur permettent de respirer sous l\'eau, ils forment un des groupes de combat les plus redoutés sous l\'eau.',
    illustration: 'assets/s4_technohybride.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Un techno-hybride ne peut être qu\'Hégémonien.',
    required_genotype: 'TEC_HYB',
    contact_frequency: 8,
    ally_frequency: 10,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 10,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: technoHybride.id, skill_id: 'ATHLETISME' },
    { career_id: technoHybride.id, skill_id: 'ENDURANCE' },
    { career_id: technoHybride.id, skill_id: 'MANOEUVRES_SOUS_MARINES' },
    { career_id: technoHybride.id, skill_id: 'ARMES_LOURDES_CONTACT' },
    { career_id: technoHybride.id, skill_id: 'ARTS_MARTIAUX_LUTTE' },
    { career_id: technoHybride.id, skill_id: 'COMBAT_ARME' },
    { career_id: technoHybride.id, skill_id: 'COMBAT_A_MAINS_NUES' },
    { career_id: technoHybride.id, skill_id: 'ARMES_SOUS_MARINES' },
    { career_id: technoHybride.id, skill_id: 'INTIMIDATION' },
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: technoHybride.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO' },
    { career_id: technoHybride.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX' },
    { career_id: technoHybride.id, skill_id: 'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES' },
    { career_id: technoHybride.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: technoHybride.id, skill_id: 'LANGAGES_SPECIFIQUES_EXON' },
    { career_id: technoHybride.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS' },
    { career_id: technoHybride.id, skill_id: 'ORIENTATION' },
    { career_id: technoHybride.id, skill_id: 'SURVIE' },
    { career_id: technoHybride.id, skill_id: 'HYBRIDE' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: technoHybride.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 100 },
    { career_id: technoHybride.id, min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 400 },
    { career_id: technoHybride.id, min_years: 6, max_years: 7, title: 'Vétéran', salary_per_year: 1200 },
    { career_id: technoHybride.id, min_years: 8, max_years: 11, title: 'Sergent', salary_per_year: 2500 },
    { career_id: technoHybride.id, min_years: 12, max_years: 14, title: 'Major', salary_per_year: 6000 },
    { career_id: technoHybride.id, min_years: 15, max_years: null, title: 'Major (accès au grade de Lieutenant)', salary_per_year: 6000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: technoHybride.id, sort_order: 1, category: 'Relations' },
    { career_id: technoHybride.id, sort_order: 2, category: 'Célébrité' },
    { career_id: technoHybride.id, sort_order: 3, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: technoHybride.id, sort_order: 1, equipment: 'Arme de poignet hybride (gratuit)' },
    { career_id: technoHybride.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: technoHybride.id, sort_order: 3, equipment: 'Armes blanches (couteau gratuit)' },
    { career_id: technoHybride.id, sort_order: 4, equipment: 'Armes de poing (Pistolet avec permis gratuit)' },
    { career_id: technoHybride.id, sort_order: 5, equipment: 'Protections et armures (une armure de base gratuite)' },
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
    { career_id: technoHybride.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // VEILLEUR
  // ============================================================
  const [veilleur] = await knex('ref_careers').insert({
    code: 'veilleur',
    name: 'Veilleur',
    description: 'Les Veilleurs sont les soldats du Culte du Trident et de l\'OESM. C\'est avant tout une police internationale chargée de protéger les intérêts du Trident et ceux des petites communautés sous-marines.',
    illustration: 'assets/s4_veilleur.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Formés sur Équinoxe pour la plupart. Peuvent être de n\'importe quelle origine.',
    contact_frequency: 2,
    ally_frequency: 3,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: veilleur.id, skill_id: 'ATHLETISME' },
    { career_id: veilleur.id, skill_id: 'ENDURANCE' },
    { career_id: veilleur.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES' },
    { career_id: veilleur.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES' },
    { career_id: veilleur.id, skill_id: 'COMBAT_ARME' },
    { career_id: veilleur.id, skill_id: 'COMBAT_A_MAINS_NUES' },
    { career_id: veilleur.id, skill_id: 'ARMES_DE_POING' },
    { career_id: veilleur.id, skill_id: 'FUSIL_ARMES_DEPAULES' },
    { career_id: veilleur.id, skill_id: 'TIR_AUTOMATIQUES' },
    { career_id: veilleur.id, skill_id: 'COMMANDEMENT' },
    { career_id: veilleur.id, skill_id: 'INTIMIDATION' },
    { career_id: veilleur.id, skill_id: 'ELOQUENCE_PERSUASION' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: veilleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: veilleur.id, skill_id: 'EDUCATION_CULTURE_GENERALE' },
    { career_id: veilleur.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO' },
    { career_id: veilleur.id, skill_id: 'DISCRETION_FILATURE' },
    { career_id: veilleur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: veilleur.id, skill_id: 'OBSERVATION' },
    { career_id: veilleur.id, skill_id: 'ORIENTATION' },
    { career_id: veilleur.id, skill_id: 'PREMIER_SOINS' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: veilleur.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 200 },
    { career_id: veilleur.id, min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 800 },
    { career_id: veilleur.id, min_years: 6, max_years: 7, title: 'Vétéran', salary_per_year: 2400 },
    { career_id: veilleur.id, min_years: 8, max_years: 11, title: 'Sergent', salary_per_year: 5000 },
    { career_id: veilleur.id, min_years: 12, max_years: null, title: 'Sergent (accès au grade de Lieutenant)', salary_per_year: 5000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: veilleur.id, sort_order: 1, category: 'Relations' },
    { career_id: veilleur.id, sort_order: 2, category: 'Célébrité' },
    { career_id: veilleur.id, sort_order: 3, category: 'Cabine privée' },
    { career_id: veilleur.id, sort_order: 4, category: 'Corruption/Chantage' },
    { career_id: veilleur.id, sort_order: 5, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: veilleur.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: veilleur.id, sort_order: 2, equipment: 'Armes blanches (couteau gratuit)' },
    { career_id: veilleur.id, sort_order: 3, equipment: 'Armes à feu (Pistolet avec permis gratuit)' },
    { career_id: veilleur.id, sort_order: 4, equipment: 'Protections et armures (une armure de base gratuite)' },
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
    { career_id: veilleur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // VOLEUR/CRIMINEL
  // ============================================================
  const [voleur] = await knex('ref_careers').insert({
    code: 'voleur_criminel',
    name: 'Voleur/Criminel',
    description: 'Voleurs et petits criminels sont légion dans les bas-fonds des grandes cités sous-marines. On les trouve très rarement dans les petites communautés.',
    illustration: 'assets/s4_voleur.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Grandes villes sous-marines, particulièrement les ports commerciaux.',
    contact_frequency: 1,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 1,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: voleur.id, skill_id: 'ACROBATIE_EQUILIBRE' },
    { career_id: voleur.id, skill_id: 'ESCALADE' },
    { career_id: voleur.id, skill_id: 'COMBAT_ARME' },
    { career_id: voleur.id, skill_id: 'COMBAT_A_MAINS_NUES' },
    { career_id: voleur.id, skill_id: 'ARMES_DE_POING' },
    { career_id: voleur.id, skill_id: 'INTIMIDATION' },
    { career_id: voleur.id, skill_id: 'COMMERCE_TRAFIC__DROGUES' },
    { career_id: voleur.id, skill_id: 'COMMERCE_TRAFIC__ARMES' },
    { career_id: voleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: voleur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: voleur.id, skill_id: 'JEU' },
    { career_id: voleur.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE' },
    { career_id: voleur.id, skill_id: 'DISCRETION_FILATURE' },
    { career_id: voleur.id, skill_id: 'EVASION' },
    { career_id: voleur.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX' },
    { career_id: voleur.id, skill_id: 'PICKPOCKET' },
    { career_id: voleur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: voleur.id, skill_id: 'LANGAGES_SPECIFIQUES_SIRS' },
    { career_id: voleur.id, skill_id: 'OBSERVATION' },
    { career_id: voleur.id, skill_id: 'ORIENTATION' },
    { career_id: voleur.id, skill_id: 'SURVIE' },
    { career_id: voleur.id, skill_id: 'FALSIFICATION' },
    { career_id: voleur.id, skill_id: 'SYSTEMES_DE_SECURITE' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: voleur.id, min_years: 1, max_years: 3, title: 'Guetteur', salary_formula: '1D10*100' },
    { career_id: voleur.id, min_years: 4, max_years: 6, title: 'Voleur/Criminel', salary_formula: '1D10*300' },
    { career_id: voleur.id, min_years: 7, max_years: 10, title: 'Voleur/Criminel', salary_formula: '1D10*500' },
    { career_id: voleur.id, min_years: 11, max_years: 15, title: 'Chef de gang', salary_per_year: 7000 },
    { career_id: voleur.id, min_years: 16, max_years: 20, title: 'Chef de gang', salary_per_year: 12000 },
    { career_id: voleur.id, min_years: 21, max_years: null, title: 'Seigneur du crime', salary_per_year: 20000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: voleur.id, sort_order: 1, category: 'Relations' },
    { career_id: voleur.id, sort_order: 2, category: 'Célébrité' },
    { career_id: voleur.id, sort_order: 3, category: 'Cache/Planque' },
    { career_id: voleur.id, sort_order: 4, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: voleur.id, sort_order: 1, equipment: 'Un peu de tout… mais il s\'agit toujours de matériel volé et/ou d\'occasion' },
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
    { career_id: voleur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])
}

export const down = async (knex) => {
  await knex('ref_careers').whereIn('code', CODES).delete()
}
