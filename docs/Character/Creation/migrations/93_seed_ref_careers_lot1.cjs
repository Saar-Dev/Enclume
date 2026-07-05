// 093_seed_ref_careers.cjs
// Lot 1 : Artisan/Artiste, Assassin, Barman, Chasseur de primes, Contrebandier

export const seed = async (knex) => {
  // Nettoyage (ordre inverse des dépendances)
  await knex('ref_career_random_benefits').del()
  await knex('ref_career_equipment').del()
  await knex('ref_career_point_categories').del()
  await knex('ref_career_education').del()
  await knex('ref_career_prerequisites').del()
  await knex('ref_career_titles').del()
  await knex('ref_career_skills').del()
  await knex('ref_careers').del()

  // ============================================================
  // 1. ARTISAN/ARTISTE
  // ============================================================
  const [artisan] = await knex('ref_careers').insert({
    code: 'artisan_artiste',
    name: 'Artisan/Artiste',
    description: 'Les artisans fabriquent les produits qu\'ils vendent ou rendent divers services. Les artistes produisent eux des œuvres d\'art.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Très peu dans l\'Alliance polaire ou les Royaumes pirates. Artistes uniquement dans les grandes cités.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  // NOTE : ENSEIGNEMENT absent de ref_skills (migration 37 + 74) — skill à ajouter
  await knex('ref_career_skills').insert([
    { career_id: artisan.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: artisan.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communication/Relations sociales' },
    { career_id: artisan.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
    { career_id: artisan.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communication/Relations sociales' },
    { career_id: artisan.id, skill_id: 'COMMERCE_TRAFIC', skill_group: 'Connaissances' },
    { career_id: artisan.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: artisan.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: artisan.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', skill_group: 'Connaissances', conditional: true },
    { career_id: artisan.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: artisan.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: artisan.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: artisan.id, skill_id: 'ART_ARTISANAT', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: artisan.id, min_years: 1, max_years: 2, title: 'Apprenti', salary_per_year: 50 },
    { career_id: artisan.id, min_years: 3, max_years: 6, title: 'Compagnon', salary_per_year: 1500 },
    { career_id: artisan.id, min_years: 7, max_years: 12, title: 'Artisan/Artiste', salary_per_year: 15000 },
    { career_id: artisan.id, min_years: 13, max_years: null, title: 'Maître', salary_per_year: 30000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: artisan.id, sort_order: 1, category: 'Étal/Boutique' },
    { career_id: artisan.id, sort_order: 2, category: 'Art/Artisanat' },
    { career_id: artisan.id, sort_order: 3, category: 'Célébrité' },
    { career_id: artisan.id, sort_order: 4, category: 'Relations' },
    { career_id: artisan.id, sort_order: 5, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: artisan.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: artisan.id, sort_order: 2, equipment: 'Matériel d\'artisanat' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: artisan.id, roll: 1, description: 'Attribut augmenté : Intelligence +1' },
    { career_id: artisan.id, roll: 2, description: 'Prestation : travail remarqué. Points de Compétence +1, Art/Artisanat +2, Célébrité +2.' },
    { career_id: artisan.id, roll: 3, description: 'Hautes sphères : travail pour un personnage haut placé. Salaire doublé pour l\'année, Célébrité +4, points de Compétence +2, Art/Artisanat +2, Relations +1.' },
    { career_id: artisan.id, roll: 4, description: 'Guilde/Compagnie : engagé par la Guilde. Salaire +10% à partir de cette année, Célébrité +2, Étal/Boutique +2, Relations +1.' },
    { career_id: artisan.id, roll: 5, description: 'Protecteur/Mécène : protégé par un puissant personnage. Célébrité +4, Art/Artisanat +6, revenus +20% à partir de cette année, Étal/Boutique +1, Allié +1.' },
    { career_id: artisan.id, roll: 6, description: 'Chef-d\'œuvre : création d\'un chef-d\'œuvre. Célébrité +6, revenus triplés pour l\'année, points de compétence +4, Relations +2.' },
    { career_id: artisan.id, roll: 7, description: 'Contrat : contrat avec une société. Célébrité +4, Art/Artisanat +6, revenus +10% à partir de cette année, Contact +1.' },
    { career_id: artisan.id, roll: 8, description: 'Renommée : excellente réputation. Célébrité +8, revenus +50% à partir de cette année, points de compétence +2.' },
    { career_id: artisan.id, roll: 9, description: 'Année faste : paye triplée pour l\'année, Art/Artisanat +4.' },
    { career_id: artisan.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 2. ASSASSIN
  // ============================================================
  const [assassin] = await knex('ref_careers').insert({
    code: 'assassin',
    name: 'Assassin',
    description: 'Les assassins sont des tueurs professionnels de haut niveau, payés pour faire le sale boulot… plus ou moins discrètement.',
    contact_frequency: 1,
    ally_frequency: 3,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 1,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: assassin.id, skill_id: 'ACROBATIE_EQUILIBRE', skill_group: 'Aptitudes physiques' },
    { career_id: assassin.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: assassin.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: assassin.id, skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { career_id: assassin.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' },
    { career_id: assassin.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: assassin.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: assassin.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: assassin.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: assassin.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: assassin.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: assassin.id, skill_id: 'TIR_DE_PRECISION', skill_group: 'Combat (tir)' },
    { career_id: assassin.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: assassin.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: assassin.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: assassin.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: assassin.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: assassin.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', skill_group: 'Connaissances' },
    { career_id: assassin.id, skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: assassin.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: assassin.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: assassin.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: assassin.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: assassin.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: assassin.id, skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Techniques' },
    { career_id: assassin.id, skill_id: 'PIEGES', skill_group: 'Techniques' },
    { career_id: assassin.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: assassin.id, min_years: 1, max_years: 3, title: 'Tueur à gages', salary_per_year: 500 },
    { career_id: assassin.id, min_years: 4, max_years: 7, title: 'Assassin', salary_per_year: 1000 },
    { career_id: assassin.id, min_years: 8, max_years: 9, title: 'Assassin', salary_per_year: 2000 },
    { career_id: assassin.id, min_years: 10, max_years: 12, title: 'Assassin', salary_per_year: 4000 },
    { career_id: assassin.id, min_years: 13, max_years: null, title: 'Nettoyeur', salary_per_year: 6000 }
  ])

  // Prérequis : sera lié après seed complet (chasseur_prime, espion, mercenaire, soldat_milicien, voleur_criminel)
  // Inséré en lot suivant

  await knex('ref_career_point_categories').insert([
    { career_id: assassin.id, sort_order: 1, category: 'Corruption/Chantage' },
    { career_id: assassin.id, sort_order: 2, category: 'Falsification' },
    { career_id: assassin.id, sort_order: 3, category: 'Fausse identité' },
    { career_id: assassin.id, sort_order: 4, category: 'Planque/Cache' },
    { career_id: assassin.id, sort_order: 5, category: 'Célébrité' },
    { career_id: assassin.id, sort_order: 6, category: 'Relations' },
    { career_id: assassin.id, sort_order: 7, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: assassin.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: assassin.id, sort_order: 2, equipment: 'Arme de contact' },
    { career_id: assassin.id, sort_order: 3, equipment: 'Arme de poing' },
    { career_id: assassin.id, sort_order: 4, equipment: 'Fusil de précision' },
    { career_id: assassin.id, sort_order: 5, equipment: 'Matériel d\'espionnage et de sécurité' },
    { career_id: assassin.id, sort_order: 6, equipment: 'Poisons et drogues' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: assassin.id, roll: 1, description: 'Attribut augmenté : Adaptation +1' },
    { career_id: assassin.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +1, Célébrité +2, Falsification +2, Corruption/Chantage +2.' },
    { career_id: assassin.id, roll: 3, description: 'Secret : le personnage a appris un secret intéressant.' },
    { career_id: assassin.id, roll: 4, description: 'Corruption : Corruption/Chantage +6.' },
    { career_id: assassin.id, roll: 5, description: 'Coup d\'éclat : assassinat d\'une personnalité importante. Points de compétence +2, Célébrité +4, Falsification +4, Corruption/Chantage +4.' },
    { career_id: assassin.id, roll: 6, description: 'Falsification : Falsification +6.' },
    { career_id: assassin.id, roll: 7, description: 'Fausse identité : Fausse identité +6.' },
    { career_id: assassin.id, roll: 8, description: 'Contrat : contrat auprès d\'un groupe important. Célébrité +5, revenus +10% à partir de cette année, Relations +2, Allié ou Fournisseur +1.' },
    { career_id: assassin.id, roll: 9, description: 'Réseau : Relations +6.' },
    { career_id: assassin.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 3. BARMAN
  // ============================================================
  const [barman] = await knex('ref_careers').insert({
    code: 'barman',
    name: 'Barman',
    description: 'Ils sont les confidents de la plupart des marins et connaissent beaucoup de monde.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Communautés suffisamment importantes',
    contact_frequency: 2,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: barman.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: barman.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: barman.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    { career_id: barman.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: barman.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: barman.id, skill_id: 'JEU', skill_group: 'Connaissances' },
    { career_id: barman.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', skill_group: 'Connaissances' },
    { career_id: barman.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: barman.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: barman.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: barman.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)', conditional: true },
    { career_id: barman.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: barman.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: barman.id, min_years: 1, max_years: 2, title: 'Apprenti', salary_per_year: 400 },
    { career_id: barman.id, min_years: 3, max_years: 6, title: 'Barman', salary_per_year: 800 },
    { career_id: barman.id, min_years: 7, max_years: 14, title: 'Barman', salary_formula: '1D100*20' },
    { career_id: barman.id, min_years: 15, max_years: null, title: 'Barman', salary_formula: '1D100*100' }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: barman.id, sort_order: 1, category: 'Bar' },
    { career_id: barman.id, sort_order: 2, category: 'Stock de marchandises' },
    { career_id: barman.id, sort_order: 3, category: 'Célébrité' },
    { career_id: barman.id, sort_order: 4, category: 'Relations' },
    { career_id: barman.id, sort_order: 5, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: barman.id, sort_order: 1, equipment: 'Matériel standard' },
    { career_id: barman.id, sort_order: 2, equipment: 'Armes blanches' },
    { career_id: barman.id, sort_order: 3, equipment: 'Armes de contact' },
    { career_id: barman.id, sort_order: 4, equipment: 'Armes de poing' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: barman.id, roll: 1, description: 'Attribut augmenté : Volonté +1' },
    { career_id: barman.id, roll: 2, description: 'Prestation : le barman est particulièrement apprécié de sa clientèle. Points de compétence +2, Célébrité +1, Bar +2.' },
    { career_id: barman.id, roll: 3, description: 'Protection : le barman est protégé par un groupe (gang, contrebandiers, pirates, police) auquel il peut faire appel en cas de coup dur. L\'un de ses Alliés acquiert gratuitement l\'amélioration Groupe/Gang.' },
    { career_id: barman.id, roll: 4, description: 'Clientèle prestigieuse : un ou plusieurs clients du bar sont connus, Célébrité +4, Relations +2, Allié +1, revenus augmentés de 10% à partir de cette année.' },
    { career_id: barman.id, roll: 5, description: 'Année faste : bonne année pour le barman, la paye est doublée, Bar +1.' },
    { career_id: barman.id, roll: 6, description: 'Dépôt de marchandises : le barman peut stocker des marchandises mises en dépôt par des clients. Stock de marchandises +4, Relations +1, revenus augmentés de 10% à partir de cette année.' },
    { career_id: barman.id, roll: 7, description: 'Réseau : le barman connaît vraiment beaucoup de monde… Relations +8.' },
    { career_id: barman.id, roll: 8, description: 'Trafic de marchandises : le bar sert de plaque tournante pour des trafics divers. Revenus augmentés de +20% à partir de cette année, Relations +2, Stock de marchandises +3.' },
    { career_id: barman.id, roll: 9, description: 'Secret : le Barman connaît un secret qu\'un de ses clients lui a confié un soir de beuverie. Le personnage pourra éventuellement monnayer cette information s\'il le souhaite.' },
    { career_id: barman.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 4. CHASSEUR DE PRIMES
  // ============================================================
  const [chasseur] = await knex('ref_careers').insert({
    code: 'chasseur_primes',
    name: 'Chasseur de primes',
    description: 'Les Chasseurs de primes passent la plus grande partie de leur temps à courir après des criminels, des pirates, des contrebandiers ou des fugitifs.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: chasseur.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: chasseur.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: chasseur.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: chasseur.id, skill_id: 'ARTS_MARTIAUX', skill_group: 'Combat (contact)', conditional: true },
    { career_id: chasseur.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: chasseur.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: chasseur.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: chasseur.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: chasseur.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: chasseur.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: chasseur.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: chasseur.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: chasseur.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: chasseur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: chasseur.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: chasseur.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: chasseur.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: chasseur.id, skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: chasseur.id, skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: chasseur.id, skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: chasseur.id, skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Furtivité/Subterfuge' },
    { career_id: chasseur.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: chasseur.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: chasseur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: chasseur.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { career_id: chasseur.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
    { career_id: chasseur.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: chasseur.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: chasseur.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: chasseur.id, min_years: 1, max_years: 6, title: 'Apprenti', salary_per_year: 500 },
    { career_id: chasseur.id, min_years: 7, max_years: 8, title: 'Chasseur de primes', salary_per_year: 1000 },
    { career_id: chasseur.id, min_years: 9, max_years: 10, title: 'Chasseur de primes', salary_per_year: 2000 },
    { career_id: chasseur.id, min_years: 11, max_years: 14, title: 'Chasseur de primes', salary_per_year: 6000 },
    { career_id: chasseur.id, min_years: 15, max_years: 18, title: 'Chasseur de primes', salary_per_year: 8000 },
    { career_id: chasseur.id, min_years: 19, max_years: null, title: 'Chasseur de primes', salary_per_year: 12000 }
  ])

  // Pas de point_categories ni d'equipment pour Chasseur de primes — absent de la LdB p.156

  await knex('ref_career_random_benefits').insert([
    { career_id: chasseur.id, roll: 1, description: 'Attribut augmenté : Adaptation +1.' },
    { career_id: chasseur.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: chasseur.id, roll: 3, description: 'Guilde : engagé par une Guilde de Mercenaires. Salaire +10% à partir de cette année, Célébrité +4, Matériel +2.' },
    { career_id: chasseur.id, roll: 4, description: 'Grande société : contacté par Limier. Salaire +20%, Célébrité +4, Points de compétence +4.' },
    { career_id: chasseur.id, roll: 5, description: 'Action d\'éclat : interpellation d\'un personnage important. Points de compétence +4, Célébrité +4, revenu doublé pour l\'année.' },
    { career_id: chasseur.id, roll: 6, description: 'Réseau : réseau d\'informateurs. Célébrité +2, Relations +8.' },
    { career_id: chasseur.id, roll: 7, description: 'Dépôt d\'armes : Matériel +6.' },
    { career_id: chasseur.id, roll: 8, description: 'Camarades de combat : Allié acquiert gratuitement l\'amélioration Groupe/Gang.' },
    { career_id: chasseur.id, roll: 9, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { career_id: chasseur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 5. CONTREBANDIER
  // ============================================================
  const [contrebandier] = await knex('ref_careers').insert({
    code: 'contrebandier',
    name: 'Contrebandier',
    description: 'Spécialisés dans le trafic des marchandises en tout genre, les contrebandiers sont indispensables à la survie du marché noir.',
    contact_frequency: 1,
    ally_frequency: 3,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: contrebandier.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: contrebandier.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: contrebandier.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: contrebandier.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: contrebandier.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: contrebandier.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: contrebandier.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: contrebandier.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: contrebandier.id, skill_id: 'COMMERCE_TRAFIC', skill_group: 'Connaissances' },
    { career_id: contrebandier.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: contrebandier.id, skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité/Subterfuge' },
    { career_id: contrebandier.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: contrebandier.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    // Note : « langue de la communauté d'accueil » — variable, à déterminer par le PJ
    { career_id: contrebandier.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { career_id: contrebandier.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
    { career_id: contrebandier.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: contrebandier.id, skill_id: 'FALSIFICATION', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: contrebandier.id, min_years: 1, max_years: 6, title: 'Contrebandier', salary_formula: '1D6*100' },
    { career_id: contrebandier.id, min_years: 7, max_years: null, title: 'Contrebandier', salary_formula: '1D100*100' }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: contrebandier.id, sort_order: 1, category: 'Célébrité' },
    { career_id: contrebandier.id, sort_order: 2, category: 'Relations' },
    { career_id: contrebandier.id, sort_order: 3, category: 'Falsification' },
    { career_id: contrebandier.id, sort_order: 4, category: 'Réseau de contrebande' },
    { career_id: contrebandier.id, sort_order: 5, category: 'Cache à marchandises' },
    { career_id: contrebandier.id, sort_order: 6, category: 'Planque/Cache' },
    { career_id: contrebandier.id, sort_order: 7, category: 'Stock de marchandises' },
    { career_id: contrebandier.id, sort_order: 8, category: 'Corruption/Chantage' },
    { career_id: contrebandier.id, sort_order: 9, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: contrebandier.id, sort_order: 1, equipment: 'Petit navire de transport (à crédit)' },
    { career_id: contrebandier.id, sort_order: 2, equipment: 'Arme d\'épaule' },
    { career_id: contrebandier.id, sort_order: 3, equipment: 'Arme de poing' },
    { career_id: contrebandier.id, sort_order: 4, equipment: 'Arme de contact' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: contrebandier.id, roll: 1, description: 'Attribut augmenté : Adaptation +1' },
    { career_id: contrebandier.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +1, Célébrité +2, Stock de marchandises +2.' },
    { career_id: contrebandier.id, roll: 3, description: 'Coup d\'éclat : gros coup dans le milieu. Points de compétence +2, Célébrité +4, Stock de marchandises +4, Argent doublé pour l\'année.' },
    { career_id: contrebandier.id, roll: 4, description: 'Contrat : contrat avec une organisation. Célébrité +2, Revenus +10% à partir de cette année, Relations +3.' },
    { career_id: contrebandier.id, roll: 5, description: 'Exclusivité : contrat exclusif. Célébrité +4, Revenus +20% à partir de cette année, Relations +5, Allié +1.' },
    { career_id: contrebandier.id, roll: 6, description: 'Corruption : aide de membres des autorités. Relations +1, Corruption/Chantage +4, Planque/Cache +1.' },
    { career_id: contrebandier.id, roll: 7, description: 'Falsification : aide d\'un membre de l\'administration. Relations +1, Falsification +4.' },
    { career_id: contrebandier.id, roll: 8, description: 'Réseau : Relations +6.' },
    { career_id: contrebandier.id, roll: 9, description: 'Caches et planques : Cache à marchandises +4, Planque/Cache +4.' },
    { career_id: contrebandier.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
