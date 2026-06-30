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
    { career_id: policier.id, skill_id: 'athletisme', skill_group: 'Aptitudes physiques' },
    { career_id: policier.id, skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { career_id: policier.id, skill_id: 'arts_martiaux', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: policier.id, skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { career_id: policier.id, skill_id: 'fusils_armes_epaule', skill_group: 'Combat (tir)' },
    { career_id: policier.id, skill_id: 'analyse_empathique', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'commandement', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'intimidation', skill_group: 'Communications/Relations sociales' },
    { career_id: policier.id, skill_id: 'bureaucratie', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'recherche_informations', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    { career_id: policier.id, skill_id: 'discretion_filature', skill_group: 'Furtivité/Subterfuge' },
    { career_id: policier.id, skill_id: 'furtivite_deplacement_silencieux', skill_group: 'Furtivité/Subterfuge' },
    { career_id: policier.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: policier.id, skill_id: 'soleen', skill_group: 'Langues' },
    { career_id: policier.id, skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { career_id: policier.id, skill_id: 'espionnage_surveillance', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'informatique', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'premiers_soins', skill_group: 'Techniques' },
    { career_id: policier.id, skill_id: 'systemes_securite', skill_group: 'Techniques' }
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
    { career_id: pretre.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: pretre.id, skill_id: 'analyse_empathique', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'commandement', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'eloquence_persuasion', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'enseignement', skill_group: 'Communications/Relations sociales' },
    { career_id: pretre.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: pretre.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: pretre.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    // Note : « langue de la communauté d'accueil » — variable
    { career_id: pretre.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'absolan', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'inesis', skill_group: 'Langues' },
    { career_id: pretre.id, skill_id: 'premiers_soins', skill_group: 'Techniques' },
    { career_id: pretre.id, skill_id: 'bouclier_mental', skill_group: 'Compétences spéciales' },
    { career_id: pretre.id, skill_id: 'controle_corporel', skill_group: 'Compétences spéciales' },
    { career_id: pretre.id, skill_id: 'maitrise_polaris', skill_group: 'Compétences spéciales', conditional: true }
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
    { career_id: prostitue.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: prostitue.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: prostitue.id, skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { career_id: prostitue.id, skill_id: 'analyse_empathique', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'entregent_seduction', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'expression_artistique', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'eloquence_persuasion', skill_group: 'Communications/Relations sociales' },
    { career_id: prostitue.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: prostitue.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: prostitue.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    // Note : « langue de la communauté d'accueil » — variable
    { career_id: prostitue.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    // Note : « une autre langue courante au choix » — variable
    { career_id: prostitue.id, skill_id: 'pickpocket', skill_group: 'Furtivité/Subterfuge' },
    { career_id: prostitue.id, skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { career_id: prostitue.id, skill_id: 'artisanat', skill_group: 'Techniques' },
    { career_id: prostitue.id, skill_id: 'premiers_soins', skill_group: 'Techniques' }
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
    { career_id: scientifique.id, skill_id: 'eloquence_persuasion', skill_group: 'Communications/Relations sociales' },
    { career_id: scientifique.id, skill_id: 'enseignement', skill_group: 'Communications/Relations sociales' },
    { career_id: scientifique.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'cryptographie', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'education_culture_generale', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'recherche_informations', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'sciences_connaissances_specialisees', skill_group: 'Connaissances' },
    { career_id: scientifique.id, skill_id: 'metalan', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'neo_azuran', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'neolan', skill_group: 'Langues' },
    { career_id: scientifique.id, skill_id: 'electronique', skill_group: 'Techniques' },
    { career_id: scientifique.id, skill_id: 'genie_technique', skill_group: 'Techniques' },
    { career_id: scientifique.id, skill_id: 'informatique', skill_group: 'Techniques' },
    // Note : « toute autre Compétence utile au champ d'activité du personnage » — variable
    { career_id: scientifique.id, skill_id: 'bouclier_mental', skill_group: 'Compétences spéciales' }
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
    { career_id: soldat.id, skill_id: 'athletisme', skill_group: 'Aptitudes physiques' },
    { career_id: soldat.id, skill_id: 'endurance', skill_group: 'Aptitudes physiques' },
    { career_id: soldat.id, skill_id: 'escalade', skill_group: 'Aptitudes physiques' },
    { career_id: soldat.id, skill_id: 'arts_martiaux', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'armes_speciales', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'combat_arme', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'combat_mains_nues', skill_group: 'Combat (contact)' },
    { career_id: soldat.id, skill_id: 'armes_lourdes_tir', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'armes_poing', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'fusils_armes_epaule', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'tir_automatique', skill_group: 'Combat (tir)' },
    { career_id: soldat.id, skill_id: 'commandement', skill_group: 'Communications/Relations sociales' },
    { career_id: soldat.id, skill_id: 'intimidation', skill_group: 'Communications/Relations sociales' },
    { career_id: soldat.id, skill_id: 'connaissance_nations', skill_group: 'Connaissances' },
    { career_id: soldat.id, skill_id: 'tactique', skill_group: 'Connaissances' },
    { career_id: soldat.id, skill_id: 'furtivite_deplacement_silencieux', skill_group: 'Furtivité/Subterfuge' },
    // Note : « langue de la communauté d'accueil » implicite
    { career_id: soldat.id, skill_id: 'observation', skill_group: 'Survie/Extérieur' },
    { career_id: soldat.id, skill_id: 'orientation', skill_group: 'Survie/Extérieur' },
    { career_id: soldat.id, skill_id: 'explosifs', skill_group: 'Techniques' },
    { career_id: soldat.id, skill_id: 'premiers_soins', skill_group: 'Techniques' }
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