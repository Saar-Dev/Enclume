// 108_seed_ref_careers_lot2.js — Seed lot 2 (COUCHE 4c) : 5 carrières
// Cultivateur/Éleveur, Diplomate, Érudit/Archéologue, Espion, Hybride du Trident
// Source : docs/Character/Creation/migrations/93_seed_ref_careers_lot2.cjs (déjà audité/corrigé)
// Correction appliquée ici : required_genotype 'geno_hybride' (inexistant) -> 'GEN_HYB' (ref_genotypes,
// LdB REGLE_PROFESSION.md L.24 "Être un géno-hybride")
// Prérequis espion (diplomate/mercenaire/policier_enqueteur/soldat_milicien/veilleur, 3 ans) :
// non inséré ici -> migration dédiée après le seed complet des lots 2-6 (ref_career_prerequisites)

const CODES = ['cultivateur_eleveur', 'diplomate', 'erudit_archeologue', 'espion', 'hybride_trident']

export const up = async (knex) => {
  // ============================================================
  // CULTIVATEUR/ÉLEVEUR
  // ============================================================
  const [cultivateur] = await knex('ref_careers').insert({
    code: 'cultivateur_eleveur',
    name: 'Cultivateur/Éleveur',
    description: 'Les cultivateurs travaillent dans les grands champs sous-marins qui s\'étendent autour de presque toutes les communautés sous-marines. Cette Profession est aussi difficile que celle de Mineur !',
    contact_frequency: 3,
    ally_frequency: 5,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 5,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: cultivateur.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: cultivateur.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: cultivateur.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: cultivateur.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: cultivateur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: cultivateur.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', skill_group: 'Connaissances' },
    { career_id: cultivateur.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE', skill_group: 'Connaissances' },
    { career_id: cultivateur.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE', skill_group: 'Connaissances' },
    { career_id: cultivateur.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: cultivateur.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: cultivateur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: cultivateur.id, skill_id: 'LANGAGES_SPECIFIQUES_EXON', skill_group: 'Langues' },
    { career_id: cultivateur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: cultivateur.id, skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { career_id: cultivateur.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
    { career_id: cultivateur.id, skill_id: 'PREMIER_SOINS', skill_group: 'Pilotage' },
    { career_id: cultivateur.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: cultivateur.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: cultivateur.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: cultivateur.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: cultivateur.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: cultivateur.id, skill_id: 'AQUACULTURE_ELEVAGE', skill_group: 'Techniques' },
    { career_id: cultivateur.id, skill_id: 'ART_ARTISANAT', skill_group: 'Techniques' },
    { career_id: cultivateur.id, skill_id: 'DRESSAGE', skill_group: 'Techniques' },
    { career_id: cultivateur.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: cultivateur.id, min_years: 1, max_years: 1, title: 'Apprenti', salary_per_year: 100 },
    { career_id: cultivateur.id, min_years: 2, max_years: 9, title: 'Ouvrier agricole', salary_per_year: 1000 },
    { career_id: cultivateur.id, min_years: 10, max_years: 11, title: 'Responsable culture', salary_per_year: 1500 },
    { career_id: cultivateur.id, min_years: 12, max_years: 13, title: 'Maître d\'élevage/culture', salary_per_year: 2000 },
    { career_id: cultivateur.id, min_years: 14, max_years: 15, title: 'Éleveur/Aquaculteur', salary_per_year: 3000 },
    { career_id: cultivateur.id, min_years: 16, max_years: 20, title: 'Éleveur/Aquaculteur', salary_per_year: 4000 },
    { career_id: cultivateur.id, min_years: 21, max_years: null, title: 'Responsable d\'exploitation', salary_per_year: 6000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: cultivateur.id, sort_order: 1, category: 'Parcelle/Ferme' },
    { career_id: cultivateur.id, sort_order: 2, category: 'Célébrité' },
    { career_id: cultivateur.id, sort_order: 3, category: 'Relations' },
    { career_id: cultivateur.id, sort_order: 4, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: cultivateur.id, sort_order: 1, equipment: 'Armure sous-marine (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: cultivateur.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: cultivateur.id, sort_order: 3, equipment: 'Matériel d\'aquaculture et d\'élevage (drone, armure, véhicule, etc.)' },
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: cultivateur.id, roll: 1, description: 'Attribut augmenté : Constitution +1' },
    { career_id: cultivateur.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Parcelle/Ferme +2.' },
    { career_id: cultivateur.id, roll: 3, description: 'Guilde : engagé par la Guilde des aquaculteurs. Revenus +10% à partir de cette année, Célébrité +2, points de compétence +2, Parcelle/Ferme +2.' },
    { career_id: cultivateur.id, roll: 4, description: 'Empathie : développe automatiquement la mutation Empathie au niveau 1.' },
    { career_id: cultivateur.id, roll: 5, description: 'Dauphin : l\'éleveur/aquaculteur se lie d\'amitié avec un dauphin.' },
    { career_id: cultivateur.id, roll: 6, description: 'Association : l\'éleveur/aquaculteur s\'associe. Allié +1, Relations +2, revenus +10% à partir de cette année.' },
    { career_id: cultivateur.id, roll: 7, description: 'Année faste : Revenus doublés pour cette année, points de compétence +2, Parcelle/Ferme +1.' },
    { career_id: cultivateur.id, roll: 8, description: 'Parcelle/Ferme : acquisition de terrains supplémentaires. Parcelle/Ferme +6, revenus +10% à partir de cette année.' },
    { career_id: cultivateur.id, roll: 9, description: 'Laboratoire : contrat pour élever des créatures destinées à un laboratoire. Revenus +20% à partir de cette année, points de compétence +2, Célébrité +2, Parcelle/Ferme +2.' },
    { career_id: cultivateur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // DIPLOMATE
  // ============================================================
  const [diplomate] = await knex('ref_careers').insert({
    code: 'diplomate',
    name: 'Diplomate',
    description: 'Les Diplomates sont généralement des individus très respectés dans une communauté. Leur principale tâche est de régler les conflits qui peuvent opposer plusieurs stations et quelquefois même des nations.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: diplomate.id, field: 'Droit' },
    { career_id: diplomate.id, field: 'Sciences politiques' },
  ])

  await knex('ref_career_skills').insert([
    { career_id: diplomate.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: diplomate.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: diplomate.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: diplomate.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: diplomate.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    { career_id: diplomate.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: diplomate.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: diplomate.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: diplomate.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: diplomate.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: diplomate.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: diplomate.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: diplomate.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', skill_group: 'Connaissances' },
    { career_id: diplomate.id, skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: diplomate.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: diplomate.id, skill_id: 'LANGAGES_SPECIFIQUES_ABSOLAN', skill_group: 'Langues' },
    { career_id: diplomate.id, skill_id: 'BOUCLIER_MENTAL', skill_group: 'Compétences spéciales' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: diplomate.id, min_years: 1, max_years: 2, title: 'Étudiant', salary_per_year: 1000 },
    { career_id: diplomate.id, min_years: 3, max_years: 8, title: 'Universitaire', salary_per_year: 2000 },
    { career_id: diplomate.id, min_years: 9, max_years: 12, title: 'Assistant', salary_per_year: 4000 },
    { career_id: diplomate.id, min_years: 13, max_years: 18, title: 'Diplomate', salary_per_year: 20000 },
    { career_id: diplomate.id, min_years: 19, max_years: null, title: 'Conseiller', salary_per_year: 40000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: diplomate.id, sort_order: 1, category: 'Célébrité' },
    { career_id: diplomate.id, sort_order: 2, category: 'Relations' },
    { career_id: diplomate.id, sort_order: 3, category: 'Corruption/Chantage' },
    { career_id: diplomate.id, sort_order: 4, category: 'Matériel' },
    { career_id: diplomate.id, sort_order: 5, category: 'Cabine privée' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: diplomate.id, sort_order: 1, equipment: 'Drones de traduction et de stockage de données' },
    { career_id: diplomate.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: diplomate.id, sort_order: 3, equipment: 'Matériel d\'espionnage et contre-espionnage' },
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: diplomate.id, roll: 1, description: 'Attribut augmenté : Présence +1' },
    { career_id: diplomate.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +3, Corruption/Chantage +2, Cabine privée +1.' },
    { career_id: diplomate.id, roll: 3, description: 'Coup d\'éclat : médiation particulièrement remarquée. Points de compétence +4, Célébrité +4, Allié +1, Ennemis +2, Relations +2, Corruption/Chantage +3.' },
    { career_id: diplomate.id, roll: 4, description: 'Hautes sphères : intervention dans les hautes sphères de la politique mondiale. Points de compétence +6, Célébrité +6, Allié +1, Ennemis +2, Relations +4, Corruption/Chantage +2, Cabine privée +2.' },
    { career_id: diplomate.id, roll: 5, description: 'Corruption : approché par des gens qui souhaitent qu\'il agisse en leur faveur. Refus = incorruptible (Célébrité +6, Alliés +2, Relations +4, Ennemi +1). Accepte = revenus doublés pour l\'année, Relations +2, Corruption/Chantage +2, Cabine privée +1.' },
    { career_id: diplomate.id, roll: 6, description: 'Réseau diplomatique : réseau d\'informations dans les administrations d\'une nation. Relations +6.' },
    { career_id: diplomate.id, roll: 7, description: 'Cabine privée : espace gratuit dans une communauté. Cabine privée +6.' },
    { career_id: diplomate.id, roll: 8, description: 'Service rendu : à une personne ou un groupe influent. Célébrité +2, Paie doublée pour l\'année, Allié +1, Relations +4.' },
    { career_id: diplomate.id, roll: 9, description: 'Sombre secret : le diplomate connaît un secret important concernant un puissant personnage, une communauté, un groupe ou une nation.' },
    { career_id: diplomate.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // ÉRUDIT/ARCHÉOLOGUE
  // ============================================================
  const [erudit] = await knex('ref_careers').insert({
    code: 'erudit_archeologue',
    name: 'Érudit/Archéologue',
    description: 'Les érudits se consacrent à la recherche de la connaissance sous toutes ses formes. Ce sont les spécialistes de l\'histoire contemporaine et ancienne.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Principalement dans les grandes nations du monde sous-marin. Extrêmement rares dans les petites communautés.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: erudit.id, field: 'Sciences/Sciences humaines' },
  ])

  await knex('ref_career_skills').insert([
    { career_id: erudit.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: erudit.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: erudit.id, skill_id: 'CARTOGRAPHIE', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'CRYPTOGRAPHIE', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: erudit.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', skill_group: 'Connaissances', conditional: true },
    { career_id: erudit.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: erudit.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: erudit.id, skill_id: 'BOUCLIER_MENTAL', skill_group: 'Compétences spéciales' },
    { career_id: erudit.id, skill_id: 'MEDITATION', skill_group: 'Compétences spéciales' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: erudit.id, min_years: 1, max_years: 2, title: 'Étudiant', salary_per_year: 1000 },
    { career_id: erudit.id, min_years: 3, max_years: 6, title: 'Universitaire', salary_per_year: 2000 },
    { career_id: erudit.id, min_years: 7, max_years: 12, title: 'Assistant', salary_per_year: 4000 },
    { career_id: erudit.id, min_years: 13, max_years: null, title: 'Érudit', salary_per_year: 14000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: erudit.id, sort_order: 1, category: 'Relations' },
    { career_id: erudit.id, sort_order: 2, category: 'Célébrité' },
    { career_id: erudit.id, sort_order: 3, category: 'Cabine privée' },
    { career_id: erudit.id, sort_order: 4, category: 'Matériel' },
    { career_id: erudit.id, sort_order: 5, category: 'Bases de données' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: erudit.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: erudit.id, sort_order: 2, equipment: 'Drone de traduction et de stockage de données' },
    { career_id: erudit.id, sort_order: 3, equipment: 'Matériel informatique' },
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: erudit.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: erudit.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +3, Bases de données +2.' },
    { career_id: erudit.id, roll: 3, description: 'Coup d\'éclat : découverte d\'éléments importants du passé. Points de compétence +4, Célébrité +4, Allié +1, Ennemis +2, Relations +4, Bases de données +4.' },
    { career_id: erudit.id, roll: 4, description: 'Sombre secret : découverte d\'éléments historiques gênants pour un puissant personnage. Points de compétence +6, Célébrité +6, Allié +1, Opposants +3 (ou Ennemi +1), Relations +4, Bases de données +6.' },
    { career_id: erudit.id, roll: 5, description: 'Mécène : recherches financées par un mécène. Points de compétence +2, Célébrité +2, Allié +1, argent doublé pour l\'année, revenus +20% à partir de cette année, Bases de données +4.' },
    { career_id: erudit.id, roll: 6, description: 'Financement gouvernemental : Points de compétence +3, Célébrité +4, Allié +2, revenus +10% à partir de cette année, Bases de données +6.' },
    { career_id: erudit.id, roll: 7, description: 'Réseau d\'érudits : réseau de confrères. Relations +6.' },
    { career_id: erudit.id, roll: 8, description: 'Cabine privée : espace gratuit dans une communauté. Cabine privée +6.' },
    { career_id: erudit.id, roll: 9, description: 'Données : l\'érudit a collecté des données dans différents endroits. Bases de données +8.' },
    { career_id: erudit.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // ESPION
  // ============================================================
  const [espion] = await knex('ref_careers').insert({
    code: 'espion',
    name: 'Espion',
    description: 'Des agents de renseignement, il y en a partout dans l\'univers de Polaris. Le métier d\'Espion correspond à tous les agents de renseignement actifs et entraînés, appartenant à un organisme tel que le Prisme.',
    contact_frequency: 1,
    ally_frequency: 3,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: espion.id, skill_id: 'ACROBATIE_EQUILIBRE', skill_group: 'Aptitudes physiques' },
    { career_id: espion.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: espion.id, skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { career_id: espion.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' },
    { career_id: espion.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: espion.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: espion.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: espion.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: espion.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: espion.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: espion.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: espion.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: espion.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    { career_id: espion.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: espion.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: espion.id, skill_id: 'CRYPTOGRAPHIE', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: espion.id, skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'EVASION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'PICKPOCKET', skill_group: 'Furtivité/Subterfuge' },
    { career_id: espion.id, skill_id: 'LANGAGES_SPECIFIQUES_ENEFID', skill_group: 'Langues' },
    { career_id: espion.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: espion.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: espion.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: espion.id, skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Techniques' },
    { career_id: espion.id, skill_id: 'FALSIFICATION', skill_group: 'Techniques' },
    { career_id: espion.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: espion.id, skill_id: 'PIRATAGE_INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: espion.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' },
    { career_id: espion.id, skill_id: 'BOUCLIER_MENTAL', skill_group: 'Compétences spéciales' },
  ])

  // Prérequis (diplomate, mercenaire, policier_enqueteur, soldat_milicien, veilleur — 3 ans) :
  // lié après le seed complet des lots 2-6, via ref_career_prerequisites (migration dédiée)

  await knex('ref_career_titles').insert([
    { career_id: espion.id, min_years: 1, max_years: 6, title: 'Novice', salary_per_year: 600 },
    { career_id: espion.id, min_years: 7, max_years: null, title: 'Espion', salary_per_year: 6000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: espion.id, sort_order: 1, category: 'Corruption/Chantage' },
    { career_id: espion.id, sort_order: 2, category: 'Falsification' },
    { career_id: espion.id, sort_order: 3, category: 'Fausse identité' },
    { career_id: espion.id, sort_order: 4, category: 'Planque/Cache' },
    { career_id: espion.id, sort_order: 5, category: 'Célébrité' },
    { career_id: espion.id, sort_order: 6, category: 'Relations' },
    { career_id: espion.id, sort_order: 7, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: espion.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: espion.id, sort_order: 2, equipment: 'Arme de contact' },
    { career_id: espion.id, sort_order: 3, equipment: 'Arme de poing' },
    { career_id: espion.id, sort_order: 4, equipment: 'Matériel d\'espionnage et de sécurité' },
    { career_id: espion.id, sort_order: 5, equipment: 'Matériel de falsification' },
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: espion.id, roll: 1, description: 'Attribut augmenté : Adaptation +1' },
    { career_id: espion.id, roll: 2, description: 'Agent double : le personnage a été contacté par les services d\'une autre nation et peut devenir agent double. S\'il refuse, il ne pourra pas espionner dans le pays qui l\'a contacté. S\'il accepte, son salaire est doublé pendant 1D6 ans.' },
    { career_id: espion.id, roll: 3, description: 'Secret : le personnage a appris un secret intéressant. Joueur et MJ peuvent s\'entendre pour déterminer quel est ce secret.' },
    { career_id: espion.id, roll: 4, description: 'Corruption : +6 points de Corruption/Chantage.' },
    { career_id: espion.id, roll: 5, description: 'Coup d\'éclat : assassinat d\'un personnage important ou découverte d\'une information capitale. Points de compétence +2, Célébrité +4, Falsification +4, Corruption/Chantage +4.' },
    { career_id: espion.id, roll: 6, description: 'Falsification : +6 points de falsification.' },
    { career_id: espion.id, roll: 7, description: 'Fausse identité : +6 points de Fausse identité.' },
    { career_id: espion.id, roll: 8, description: 'Prestation : travail remarqué. Points de compétence +1, Célébrité +2, Falsification +2, Corruption/Chantage +2.' },
    { career_id: espion.id, roll: 9, description: 'Réseau : +6 points de réseau.' },
    { career_id: espion.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // HYBRIDE DU TRIDENT (membre du G.S.I.)
  // ============================================================
  const [hybrideTrident] = await knex('ref_careers').insert({
    code: 'hybride_trident',
    name: 'Hybride du Trident (membre du G.S.I.)',
    description: 'Le personnage commence forcément à Équinoxe dans le service G.S.I. du Culte du Trident.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Exerce sur Équinoxe. Peut venir de n\'importe quelle communauté.',
    required_genotype: 'GEN_HYB',
    contact_frequency: 4,
    ally_frequency: 5,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 5,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: hybrideTrident.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: hybrideTrident.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: hybrideTrident.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques', conditional: true },
    { career_id: hybrideTrident.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' },
    { career_id: hybrideTrident.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: hybrideTrident.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: hybrideTrident.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: hybrideTrident.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communication/Relations sociales' },
    { career_id: hybrideTrident.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: hybrideTrident.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: hybrideTrident.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: hybrideTrident.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: hybrideTrident.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: hybrideTrident.id, skill_id: 'EVASION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: hybrideTrident.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: hybrideTrident.id, skill_id: 'LANGAGES_SPECIFIQUES_INESIS', skill_group: 'Langues' },
    { career_id: hybrideTrident.id, skill_id: 'LANGAGES_SPECIFIQUES_EXON', skill_group: 'Langues' },
    { career_id: hybrideTrident.id, skill_id: 'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', skill_group: 'Langues' },
    { career_id: hybrideTrident.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: hybrideTrident.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: hybrideTrident.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: hybrideTrident.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: hybrideTrident.id, skill_id: 'HYBRIDE', skill_group: 'Compétences spéciales' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: hybrideTrident.id, min_years: 1, max_years: null, title: 'Hybride', salary_per_year: 1000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: hybrideTrident.id, sort_order: 1, category: 'Célébrité' },
    { career_id: hybrideTrident.id, sort_order: 2, category: 'Relations' },
    { career_id: hybrideTrident.id, sort_order: 3, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: hybrideTrident.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: hybrideTrident.id, sort_order: 2, equipment: 'Matériel de plongée' },
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: hybrideTrident.id, roll: 1, description: 'Attribut augmenté : Coordination +1' },
    { career_id: hybrideTrident.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2.' },
    { career_id: hybrideTrident.id, roll: 3, description: 'Mammifères marins : l\'hybride s\'est lié d\'amitié avec un mammifère marin (pas une baleine léviathan toutefois…).' },
    { career_id: hybrideTrident.id, roll: 4, description: 'Soleil noir : contacté par le Soleil noir. Accepte = renégat aux yeux du Culte du Trident. Refus = confiance du Culte, ennemi du Soleil noir. Dans les deux cas : revenus doublés pour l\'année, Relations +2, Allié +1, Ennemi +1.' },
    { career_id: hybrideTrident.id, roll: 5, description: 'Mission : participation à une mission et distinction. Revenus doublés pour l\'année, Points de compétence +3, Célébrité +3.' },
    { career_id: hybrideTrident.id, roll: 6, description: 'Mission périlleuse : participation à une mission particulièrement délicate. Revenus triplés pour l\'année, Points de compétence +4, Célébrité +4.' },
    { career_id: hybrideTrident.id, roll: 7, description: 'Unité d\'élite : intégré à un groupe d\'élite. Salaire doublé à partir de cette année, Points de compétence +6, Célébrité +6.' },
    { career_id: hybrideTrident.id, roll: 8, description: 'Formation : ajouter une Compétence (au choix) dans la liste des Compétences professionnelles. Points de compétence +2, Relations +1.' },
    { career_id: hybrideTrident.id, roll: 9, description: 'Fraternité des hybrides : peut compter sur l\'aide des autres hybrides. Allié +2, Relations +4.' },
    { career_id: hybrideTrident.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])
}

export const down = async (knex) => {
  // CASCADE supprime skills, titles, education, point_categories, equipment, random_benefits
  await knex('ref_careers').whereIn('code', CODES).delete()
}
