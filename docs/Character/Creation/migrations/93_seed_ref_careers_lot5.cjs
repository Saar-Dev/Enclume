// 093_seed_ref_careers_lot5.cjs
// Lot 5 : Policier/Enquêteur, Prêtre du Trident, Prostitué(e), Scientifique/Ingénieur, Soldat/Milicien

export const seed = async (knex) => {
  // ============================================================
  // 29. POLICIER/ENQUÊTEUR
  // ============================================================
  const [policier] = await knex('ref_careers').insert({
    code: 'policier_enqueteur',
    name: 'Policier/Enquêteur',
    description: 'Qu\'il travaille en tant que policier dans un service officiel ou en tant qu\'agent pour une entreprise privée, le personnage est spécialisé dans les enquêtes et les filatures.',
    contact_frequency: 1,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: policier.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: policier.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: policier.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: policier.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: policier.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: policier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { career_id: policier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Crime organisé
    { career_id: policier.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', skill_group: 'Connaissances' }, // Connaissance des drogues
    { career_id: policier.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', skill_group: 'Connaissances' }, // Droit
    { career_id: policier.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: policier.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: policier.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: policier.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: policier.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: policier.id, skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: policier.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 200 },
    { career_id: policier.id, min_years: 2, max_years: 5, title: 'Policier', salary_per_year: 800 },
    { career_id: policier.id, min_years: 6, max_years: 7, title: 'Policier', salary_per_year: 2400 },
    { career_id: policier.id, min_years: 8, max_years: 11, title: 'Inspecteur', salary_per_year: 5000 },
    { career_id: policier.id, min_years: 12, max_years: 15, title: 'Lieutenant', salary_per_year: 12000 },
    { career_id: policier.id, min_years: 16, max_years: null, title: 'Capitaine', salary_per_year: 20000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: policier.id, sort_order: 1, category: 'Bases de données' },
    { career_id: policier.id, sort_order: 2, category: 'Célébrité' },
    { career_id: policier.id, sort_order: 3, category: 'Corruption/Chantage' },
    { career_id: policier.id, sort_order: 4, category: 'Relations' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: policier.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: policier.id, sort_order: 2, equipment: 'Armes à feu (Pistolet avec permis gratuit)' },
    { career_id: policier.id, sort_order: 3, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: policier.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: policier.id, roll: 2, description: 'Distinction : enquête distinguée. Revenus doublés pour l\'année, points de compétence +3, Célébrité +3.' },
    { career_id: policier.id, roll: 3, description: 'Prestation : remarqué par sa hiérarchie, point de compétence +1, Célébrité +1.' },
    { career_id: policier.id, roll: 4, description: 'Héros : grosse affaire bouclée et distinction. Revenus triplés pour l\'année, points de compétence +4, Célébrité +4.' },
    { career_id: policier.id, roll: 5, description: 'Élite : intégré à un groupe d\'élite. Paie doublée à partir de cette année, points de compétence +6, Célébrité +6.' },
    { career_id: policier.id, roll: 6, description: 'Réseau d\'informateurs : Relations +8.' },
    { career_id: policier.id, roll: 7, description: 'Procédures limites : abus de position. Corruption/Chantage +4, revenus doublés pour l\'année, Ennemi +1.' },
    { career_id: policier.id, roll: 8, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { career_id: policier.id, roll: 9, description: 'Mercenaires/Milice privée : Allié +2, Relations +4.' },
    { career_id: policier.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 30. PRÊTRE DU TRIDENT
  // ============================================================
  const [pretre] = await knex('ref_careers').insert({
    code: 'pretre_trident',
    name: 'Prêtre du Trident',
    description: 'Les Prêtres du Trident sont les individus les plus respectés et les plus craints du fond des mers. Diplomates, médecins, conseillers, chercheurs, ils sont dans tous les domaines d\'activité. Cette Profession n\'est disponible qu\'avec l\'accord du MJ.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Formé sur Équinoxe. Peut venir de n\'importe quelle station.',
    contact_frequency: 3,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: pretre.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: pretre.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: pretre.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil (ou Équinoxe)
    { career_id: pretre.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // Culte du Trident
    { career_id: pretre.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    // « Sciences/Connaissances spécialisées (selon spécialité) » — au choix, non déterminé à la création
    { career_id: pretre.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', skill_group: 'Connaissances', conditional: true },
    // « langue de la communauté d'accueil » — non seedable : LANGUE_ETRANGERE n'existe pas comme ID standalone
    { career_id: pretre.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'LANGAGES_SPECIFIQUES_ABSOLAN', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'LANGAGES_SPECIFIQUES_INESIS', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' },
    { career_id: pretre.id, skill_id: 'BOUCLIER_MENTAL', skill_group: 'Compétences spéciales' },
    { career_id: pretre.id, skill_id: 'CONTROLE_CORPOREL', skill_group: 'Compétences spéciales' },
    // Maîtrise du Polaris : à partir de la 3e année seulement — conditional
    { career_id: pretre.id, skill_id: 'MAITRISE_DE_LA_FORCE_POLARIS', skill_group: 'Compétences spéciales', conditional: true }
  ])

  await knex('ref_career_titles').insert([
    { career_id: pretre.id, min_years: 1, max_years: 2, title: 'Novice', salary_per_year: 100 },
    { career_id: pretre.id, min_years: 3, max_years: 8, title: 'Initié', salary_per_year: 500 },
    { career_id: pretre.id, min_years: 9, max_years: 12, title: 'Aspirant', salary_per_year: 2000 },
    { career_id: pretre.id, min_years: 13, max_years: null, title: 'Prêtre', salary_per_year: 6000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: pretre.id, sort_order: 1, category: 'Relations' },
    { career_id: pretre.id, sort_order: 2, category: 'Célébrité' },
    { career_id: pretre.id, sort_order: 3, category: 'Matériel' },
    { career_id: pretre.id, sort_order: 4, category: 'Cabine privée' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: pretre.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: pretre.id, sort_order: 2, equipment: 'Armes blanches' },
    { career_id: pretre.id, sort_order: 3, equipment: 'Matériel informatique' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: pretre.id, roll: 1, description: 'Attribut augmenté : Volonté +1.' },
    { career_id: pretre.id, roll: 2, description: 'Prestations : travail remarqué. Points de compétence +2, Célébrité +2, Cabine privée +2.' },
    { career_id: pretre.id, roll: 3, description: 'Corps d\'élite : intégré dans un des services d\'élite du Trident en tant qu\'administratif (Orphée, Lares, Esculapes ou Hermès). Points de compétence +4, Célébrité +4, Cabine privée +4.' },
    { career_id: pretre.id, roll: 4, description: 'Ordonnateurs : accepté dans ce corps d\'élite. Accès aux Compétences Acrobatie/Équilibre et Combat au contact. Célébrité +2, Points de compétence +4.' },
    { career_id: pretre.id, roll: 5, description: 'Traître : recruté par un traître au cœur du Trident. Accepte = paie doublée à partir de cette année, Matériel +4. Refuse = confiance des supérieurs, prime (paie doublée), Cabine privée +2, Relations +2, Allié +1, Ennemi +1.' },
    { career_id: pretre.id, roll: 6, description: 'Soleil noir : approché par des membres du Soleil noir. Effets similaires à Traître.' },
    { career_id: pretre.id, roll: 7, description: 'Réseau d\'informateurs sur Équinoxe : Relations +6.' },
    { career_id: pretre.id, roll: 8, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { career_id: pretre.id, roll: 9, description: 'Récompense : excellent travail. Points de compétence +2, Matériel +4, Cabine privée +4, revenus doublés pour l\'année.' },
    { career_id: pretre.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 31. PROSTITUÉ(E)
  // ============================================================
  const [prostitue] = await knex('ref_careers').insert({
    code: 'prostitue',
    name: 'Prostitué(e)',
    description: 'Dans un monde où la vie de couple est assez rare, le labeur quotidien extrêmement lourd à porter et où l\'information revêt une importance vitale, la prostitution joue un rôle primordial.',
    contact_frequency: 2,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: prostitue.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: prostitue.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: prostitue.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: prostitue.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    // « Expression artistique (au choix) » — EXPRESSION_ARTISTIQUE n'est que parent ; sous-skill au choix du joueur
    { career_id: prostitue.id, skill_id: 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', skill_group: 'Communications/Relations sociales', conditional: true },
    { career_id: prostitue.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: prostitue.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { career_id: prostitue.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: prostitue.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', skill_group: 'Connaissances' }, // Connaissance des drogues
    { career_id: prostitue.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE', skill_group: 'Connaissances' }, // Psychologie
    // « langue de la communauté d'accueil » — non seedable : LANGUE_ETRANGERE n'existe pas comme ID standalone
    { career_id: prostitue.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    // « une autre langue courante au choix » — non seedable : variable
    { career_id: prostitue.id, skill_id: 'PICKPOCKET', skill_group: 'Furtivité/Subterfuge' },
    { career_id: prostitue.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: prostitue.id, skill_id: 'ART_ARTISANAT', skill_group: 'Techniques' }, // Art/Artisanat (Cuisine)
    { career_id: prostitue.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: prostitue.id, min_years: 1, max_years: 4, title: 'Apprenti', salary_per_year: 500 },
    { career_id: prostitue.id, min_years: 5, max_years: 8, title: 'Prostitué(e)', salary_per_year: 1000 },
    { career_id: prostitue.id, min_years: 9, max_years: null, title: 'Expert(e)', salary_per_year: 6000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: prostitue.id, sort_order: 1, category: 'Relations' },
    { career_id: prostitue.id, sort_order: 2, category: 'Célébrité' },
    { career_id: prostitue.id, sort_order: 3, category: 'Corruption/Chantage' },
    { career_id: prostitue.id, sort_order: 4, category: 'Matériel' },
    { career_id: prostitue.id, sort_order: 5, category: 'Cabine privée' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: prostitue.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: prostitue.id, sort_order: 2, equipment: 'Poisons et drogues' },
    { career_id: prostitue.id, sort_order: 3, equipment: 'Armes blanches' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: prostitue.id, roll: 1, description: 'Attribut augmenté : Présence +1.' },
    { career_id: prostitue.id, roll: 2, description: 'Prestations : travail remarqué. Points de compétence +2, Célébrité +2, Corruption/Chantage +2.' },
    { career_id: prostitue.id, roll: 3, description: 'Corps d\'élite : engagé par le groupe le plus prestigieux, Néovat. Points de compétence +4, Cabine privée +2, Célébrité +2, Revenus +20% à partir de cette année. Protection de l\'organisation.' },
    { career_id: prostitue.id, roll: 4, description: 'Espion : contacté pour espionner au service d\'un groupe (Veilleurs sur Équinoxe). Si accepte, revenus +10% à partir de cette année, points de compétence +2, Matériel +4, Cabine privée +4.' },
    { career_id: prostitue.id, roll: 5, description: 'Protecteur : protecteur plus ou moins puissant. Allié +1, Célébrité +4, Cabine privée +4.' },
    { career_id: prostitue.id, roll: 6, description: 'Personnalité : client important. Revenus +50% à partir de cette année.' },
    { career_id: prostitue.id, roll: 7, description: 'Prime : argent doublé pour l\'année. Célébrité +1, Points de compétence +2.' },
    { career_id: prostitue.id, roll: 8, description: 'Secret : secret important appris. Le personnage pourra éventuellement monnayer cette information s\'il le souhaite.' },
    { career_id: prostitue.id, roll: 9, description: 'Unité des prostitués : aide des confrères/consoeurs. Alliés +2, Relations +4.' },
    { career_id: prostitue.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 32. SCIENTIFIQUE/INGÉNIEUR
  // ============================================================
  const [scientifique] = await knex('ref_careers').insert({
    code: 'scientifique_ingenieur',
    name: 'Scientifique/Ingénieur',
    description: 'Spécialistes de la recherche scientifique ou de la conception de machines et d\'équipements technologiques, ces personnages sont choyés par les grandes nations et les grandes entreprises.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Études et premières années de carrière dans une grande nation.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: scientifique.id, field: 'Sciences/Sciences humaines' },
    { career_id: scientifique.id, field: 'École d\'ingénieur' }
  ])

  await knex('ref_career_skills').insert([
    { career_id: scientifique.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: scientifique.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communications/Relations sociales' },
    // « Connaissance des nations/organisations (au choix) »
    { career_id: scientifique.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: scientifique.id, skill_id: 'CRYPTOGRAPHIE', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    // « Sciences/Connaissances spécialisées (au choix selon domaine) » — sous-skill au choix du joueur
    { career_id: scientifique.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', skill_group: 'Connaissances', conditional: true },
    { career_id: scientifique.id, skill_id: 'LANGAGES_SPECIFIQUES_METALAN', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'LANGAGES_SPECIFIQUES_NEOLAN', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'ELECTRONIQUE', skill_group: 'Techniques' },
    // « Génie technique (au choix selon domaine) » — GENIE_TECHNIQUE n'est que parent ; sous-skill au choix du joueur
    { career_id: scientifique.id, skill_id: 'GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE', skill_group: 'Techniques', conditional: true },
    { career_id: scientifique.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    // « toute autre Compétence utile au champ d'activité » — variable, non seedable
    { career_id: scientifique.id, skill_id: 'BOUCLIER_MENTAL', skill_group: 'Compétences spéciales' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: scientifique.id, min_years: 1, max_years: 6, title: 'Étudiant', salary_per_year: 200 },
    { career_id: scientifique.id, min_years: 7, max_years: 12, title: 'Doctorant', salary_per_year: 1000 },
    { career_id: scientifique.id, min_years: 13, max_years: 14, title: 'Chercheur', salary_per_year: 4000 },
    { career_id: scientifique.id, min_years: 15, max_years: 16, title: 'Chef de projet', salary_per_year: 8000 },
    { career_id: scientifique.id, min_years: 17, max_years: 18, title: 'Scientifique confirmé', salary_per_year: 12000 },
    { career_id: scientifique.id, min_years: 19, max_years: 20, title: 'Responsable de recherches', salary_per_year: 18000 },
    { career_id: scientifique.id, min_years: 21, max_years: null, title: 'Expert', salary_per_year: 20000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: scientifique.id, sort_order: 1, category: 'Relations' },
    { career_id: scientifique.id, sort_order: 2, category: 'Célébrité' },
    { career_id: scientifique.id, sort_order: 3, category: 'Cabine privée' },
    { career_id: scientifique.id, sort_order: 4, category: 'Influence' },
    { career_id: scientifique.id, sort_order: 5, category: 'Matériel' },
    { career_id: scientifique.id, sort_order: 6, category: 'Bases de données' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: scientifique.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: scientifique.id, sort_order: 2, equipment: 'Drone de traduction et de stockage de données' },
    { career_id: scientifique.id, sort_order: 3, equipment: 'Matériel informatique' },
    { career_id: scientifique.id, sort_order: 4, equipment: 'Réseau' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: scientifique.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: scientifique.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +3, Bases de données +2.' },
    { career_id: scientifique.id, roll: 3, description: 'Découverte : fait scientifique ou procédé technologique important. Points de compétence +4, Célébrité +4, Allié +1, Ennemis +2, Relations +4, Bases de données +4.' },
    { career_id: scientifique.id, roll: 4, description: 'Sombre secret : plans de recherche gênants. Points de compétence +6, Célébrité +6, Allié +1, Opposants +3 (ou Ennemi +1), Relations +4, Bases de données +6.' },
    { career_id: scientifique.id, roll: 5, description: 'Mécène : recherches financées. Points de compétence +2, Célébrité +2, Allié +1, argent doublé, revenus +20% à partir de cette année, Bases de données +4.' },
    { career_id: scientifique.id, roll: 6, description: 'Financement gouvernemental : Points de compétence +3, Célébrité +4, Allié +2, revenus +10% à partir de cette année, Bases de données +6.' },
    { career_id: scientifique.id, roll: 7, description: 'Réseau : réseau de confrères. Relations +6.' },
    { career_id: scientifique.id, roll: 8, description: 'Cabine privée : espace gratuit dans une communauté. Cabine privée +6.' },
    { career_id: scientifique.id, roll: 9, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { career_id: scientifique.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 33. SOLDAT/MILICIEN
  // ============================================================
  const [soldat] = await knex('ref_careers').insert({
    code: 'soldat_milicien',
    name: 'Soldat/Milicien',
    description: 'La Profession de soldat est une des plus risquées qui soient. Un PJ peut faire partie de l\'armée d\'une grande nation ou être milicien dans une petite communauté.',
    contact_frequency: 3,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 5,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: soldat.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: soldat.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: soldat.id, skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    // « Arts martiaux (au choix) » — ARTS_MARTIAUX n'est que parent ; sous-skill au choix du joueur
    { career_id: soldat.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)', conditional: true },
    // « Armes spéciales (au choix) » — ARMES_SPECIALES_CONTACT n'est que parent ; sous-skill au choix du joueur
    { career_id: soldat.id, skill_id: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', skill_group: 'Combat (contact)', conditional: true },
    { career_id: soldat.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'ARMES_LOURDES', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'TIR_AUTOMATIQUES', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'COMMANDEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: soldat.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: soldat.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { career_id: soldat.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { career_id: soldat.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: soldat.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: soldat.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: soldat.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: soldat.id, skill_id: 'EXPLOSIFS', skill_group: 'Techniques' },
    { career_id: soldat.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: soldat.id, min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 100 },
    { career_id: soldat.id, min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 400 },
    { career_id: soldat.id, min_years: 6, max_years: 14, title: 'Vétéran', salary_per_year: 1200 },
    { career_id: soldat.id, min_years: 15, max_years: null, title: 'Sergent (accès au grade de Lieutenant)', salary_per_year: 2500 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: soldat.id, sort_order: 1, category: 'Célébrité' },
    { career_id: soldat.id, sort_order: 2, category: 'Relations' },
    { career_id: soldat.id, sort_order: 3, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: soldat.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: soldat.id, sort_order: 2, equipment: 'Arme de contact (couteau gratuit)' },
    { career_id: soldat.id, sort_order: 3, equipment: 'Arme de poing (Pistolet avec permis gratuit)' },
    { career_id: soldat.id, sort_order: 4, equipment: 'Protections et armures (une armure de base gratuite)' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: soldat.id, roll: 1, description: 'Attribut augmenté : Volonté +1.' },
    { career_id: soldat.id, roll: 2, description: 'Bataille : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: soldat.id, roll: 3, description: 'Distinction : argent doublé pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { career_id: soldat.id, roll: 4, description: 'Héros : Argent triplé pour l\'année, points de compétence +4, Célébrité +4, Matériel +3.' },
    { career_id: soldat.id, roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { career_id: soldat.id, roll: 6, description: 'Prestation : remarqué par sa hiérarchie. Point de compétence +1, Célébrité +1.' },
    { career_id: soldat.id, roll: 7, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { career_id: soldat.id, roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { career_id: soldat.id, roll: 9, description: 'Mercenaires/Milice privée : Alliés +2, Relations +4.' },
    { career_id: soldat.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
