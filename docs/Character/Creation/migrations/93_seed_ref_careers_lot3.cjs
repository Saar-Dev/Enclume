// 093_seed_ref_careers_lot3.cjs
// Lot 3 : Marchand, Marchand itinérant/Conteur, Médecin/Chirurgien, Mercenaire, Mineur

export const seed = async (knex) => {
  // ============================================================
  // 11. MARCHAND
  // ============================================================
  const [marchand] = await knex('ref_careers').insert({
    code: 'marchand',
    name: 'Marchand',
    description: 'Voici une Profession qui permet de voyager dans toutes les mers et dans tous les océans !',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Très peu dans l\'Alliance polaire ou les Royaumes pirates.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: marchand.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: marchand.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: marchand.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: marchand.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    { career_id: marchand.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'COMMERCE_TRAFIC', skill_group: 'Connaissances', conditional: true },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE', skill_group: 'Connaissances' },
    { career_id: marchand.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: marchand.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    { career_id: marchand.id, skill_id: 'FALSIFICATION', skill_group: 'Techniques' },
    // Note : « toute autre Compétence en rapport avec les produits vendus » — variable
  ])

  await knex('ref_career_titles').insert([
    { career_id: marchand.id, min_years: 1, max_years: 5, title: 'Employé', salary_per_year: 100 },
    { career_id: marchand.id, min_years: 6, max_years: 7, title: 'Apprenti marchand', salary_per_year: 1000 },
    { career_id: marchand.id, min_years: 8, max_years: 11, title: 'Marchand', salary_per_year: 2000 },
    { career_id: marchand.id, min_years: 12, max_years: 15, title: 'Marchand', salary_per_year: 4000 },
    { career_id: marchand.id, min_years: 16, max_years: 19, title: 'Marchand', salary_per_year: 6000 },
    { career_id: marchand.id, min_years: 20, max_years: 23, title: 'Marchand', salary_per_year: 12000 },
    { career_id: marchand.id, min_years: 24, max_years: 26, title: 'Marchand', salary_per_year: 20000 },
    { career_id: marchand.id, min_years: 27, max_years: null, title: 'Marchand', salary_per_year: 30000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: marchand.id, sort_order: 1, category: 'Étal/Boutique' },
    { career_id: marchand.id, sort_order: 2, category: 'Stock de marchandises' },
    { career_id: marchand.id, sort_order: 3, category: 'Célébrité' },
    { career_id: marchand.id, sort_order: 4, category: 'Relations' },
    { career_id: marchand.id, sort_order: 5, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: marchand.id, sort_order: 1, equipment: 'Matériel standard' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: marchand.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: marchand.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Stock de marchandises +2.' },
    { career_id: marchand.id, roll: 3, description: 'Guilde : engagé par la Guilde des marchands. Salaire +10% à partir de cette année, Célébrité +2, Étal/Boutique +2, Relations +1.' },
    { career_id: marchand.id, roll: 4, description: 'Coup commercial : gros coup commercial. Salaire doublé pour l\'année, Célébrité +4, points de compétence +4, Stock de marchandises +4.' },
    { career_id: marchand.id, roll: 5, description: 'Année faste : Revenus triplés pour l\'année, stock de marchandises +4.' },
    { career_id: marchand.id, roll: 6, description: 'Réseau au marché noir : Allié +1, Relations +6.' },
    { career_id: marchand.id, roll: 7, description: 'Réseau de fournisseurs : Allié +1, Relations +6, Stock de marchandises +4.' },
    { career_id: marchand.id, roll: 8, description: 'Récupération de stocks : Stock de marchandises +6.' },
    { career_id: marchand.id, roll: 9, description: 'Marché fructueux : Étal/Boutique +6, Revenus +10% à partir de cette année.' },
    { career_id: marchand.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 12. MARCHAND ITINÉRANT/CONTEUR
  // ============================================================
  const [marchandItinerant] = await knex('ref_careers').insert({
    code: 'marchand_itinerant',
    name: 'Marchand itinérant/Conteur',
    description: 'De nombreux marchands itinérants sont également conteurs ; ce sont en fait des sortes de bardes sous-marins qui voyagent de communauté en communauté.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Visitent le plus souvent les petites communautés isolées.',
    contact_frequency: 2,
    ally_frequency: 1,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: marchandItinerant.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: marchandItinerant.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: marchandItinerant.id, skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communications/Relations sociales' },
    { career_id: marchandItinerant.id, skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communications/Relations sociales' },
    { career_id: marchandItinerant.id, skill_id: 'ENSEIGNEMENT', skill_group: 'Communications/Relations sociales' },
    { career_id: marchandItinerant.id, skill_id: 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', skill_group: 'Communications/Relations sociales', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'CARTOGRAPHIE', skill_group: 'Connaissances' },
    { career_id: marchandItinerant.id, skill_id: 'COMMERCE_TRAFIC', skill_group: 'Connaissances', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: marchandItinerant.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: marchandItinerant.id, skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuges' },
    { career_id: marchandItinerant.id, skill_id: 'PICKPOCKET', skill_group: 'Furtivité/Subterfuges' },
    { career_id: marchandItinerant.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: marchandItinerant.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN', skill_group: 'Langues' },
    // Note : « un autre langue courante au choix » — variable
    { career_id: marchandItinerant.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { career_id: marchandItinerant.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: marchandItinerant.id, skill_id: 'ART_ARTISANAT', skill_group: 'Techniques' },
    { career_id: marchandItinerant.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: marchandItinerant.id, min_years: 1, max_years: null, title: 'Marchand itinérant', salary_per_year: 500 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: marchandItinerant.id, sort_order: 1, category: 'Relations' },
    { career_id: marchandItinerant.id, sort_order: 2, category: 'Célébrité' },
    { career_id: marchandItinerant.id, sort_order: 3, category: 'Matériel' },
    { career_id: marchandItinerant.id, sort_order: 4, category: 'Stock de marchandises' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: marchandItinerant.id, sort_order: 1, equipment: 'Petit navire de transport (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: marchandItinerant.id, sort_order: 2, equipment: 'Matériel standard' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: marchandItinerant.id, roll: 1, description: 'Attribut augmenté : Adaptation +1' },
    { career_id: marchandItinerant.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Stock de marchandises +2.' },
    { career_id: marchandItinerant.id, roll: 3, description: 'Secret : le marchand connaît un secret découvert au cours d\'un de ses voyages. Emplacement d\'une base secrète, d\'une épave, etc.' },
    { career_id: marchandItinerant.id, roll: 4, description: 'Reliques : découverte de reliques du temps passé ou d\'objets étranges. Valeur 1D100 x 500 sols.' },
    { career_id: marchandItinerant.id, roll: 5, description: 'Accueil des communautés : bien accueilli sur une communauté. Allié +1, Célébrité +2, Relations +4.' },
    { career_id: marchandItinerant.id, roll: 6, description: 'Année faste : Revenus triplés pour l\'année, stock de marchandises +4.' },
    { career_id: marchandItinerant.id, roll: 7, description: 'Réseau au marché noir : pour écouler sa marchandise. Réseau +6, Allié +1, Relation +2.' },
    { career_id: marchandItinerant.id, roll: 8, description: 'Récupération de marchandises : stock récupéré dans une épave. Stock de marchandises +6.' },
    { career_id: marchandItinerant.id, roll: 9, description: 'Coup commercial : gros coup. Salaire doublé pour l\'année, Célébrité +4, Points de compétence +4, stock marchandises +4.' },
    { career_id: marchandItinerant.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 13. MÉDECIN/CHIRURGIEN
  // ============================================================
  const [medecin] = await knex('ref_careers').insert({
    code: 'medecin_chirurgien',
    name: 'Médecin/Chirurgien',
    description: 'Spécialistes des soins et des maladies, les médecins et les chirurgiens sont utiles partout. Leur formation est généralement assurée par de grandes sociétés pharmaceutiques, génétiques ou par les prêtres du Culte du Trident.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Premières années dans les grandes stations comme Équinoxe ou les capitales des nations sous-marines.',
    contact_frequency: 4,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: medecin.id, field: 'Médecine' }
  ])

  await knex('ref_career_skills').insert([
    { career_id: medecin.id, skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communications/Relations sociales' },
    { career_id: medecin.id, skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
    { career_id: medecin.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: medecin.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: medecin.id, skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { career_id: medecin.id, skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
    { career_id: medecin.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', skill_group: 'Connaissances', conditional: true },
    // Note : spécialités au choix en fonction de la spécialité médicale : Biologie/Physiologie, Cybertechnologie, Génétique, Psychologie/Psychiatrie
    { career_id: medecin.id, skill_id: 'LANGAGES_SPECIFIQUES_METALAN', skill_group: 'Langues' },
    { career_id: medecin.id, skill_id: 'LANGUE_ANCIENNE_AZURAN', skill_group: 'Langues' },
    { career_id: medecin.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: medecin.id, skill_id: 'CHIRURGIE', skill_group: 'Techniques' },
    { career_id: medecin.id, skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { career_id: medecin.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: medecin.id, min_years: 1, max_years: 6, title: 'Étudiant', salary_per_year: 200 },
    { career_id: medecin.id, min_years: 7, max_years: 12, title: 'Médecin public', salary_per_year: 1000 },
    { career_id: medecin.id, min_years: 13, max_years: 14, title: 'Médecin privé', salary_per_year: 4000 },
    { career_id: medecin.id, min_years: 15, max_years: 16, title: 'Médecin 1ère catégorie', salary_per_year: 8000 },
    { career_id: medecin.id, min_years: 17, max_years: 18, title: 'Médecin confirmé', salary_per_year: 12000 },
    { career_id: medecin.id, min_years: 19, max_years: 20, title: 'Médecin', salary_per_year: 18000 },
    { career_id: medecin.id, min_years: 21, max_years: null, title: 'Expert en médecine', salary_per_year: 20000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: medecin.id, sort_order: 1, category: 'Relations' },
    { career_id: medecin.id, sort_order: 2, category: 'Célébrité' },
    { career_id: medecin.id, sort_order: 3, category: 'Cabinet médical' },
    { career_id: medecin.id, sort_order: 4, category: 'Pharmacie personnelle' },
    { career_id: medecin.id, sort_order: 5, category: 'Matériel' },
    { career_id: medecin.id, sort_order: 6, category: 'Base de données médicales' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: medecin.id, sort_order: 1, equipment: 'Matériel médical' },
    { career_id: medecin.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: medecin.id, sort_order: 3, equipment: 'Poisons et drogues' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: medecin.id, roll: 1, description: 'Attribut augmenté : Intelligence +1.' },
    { career_id: medecin.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Pharmacie personnelle +2.' },
    { career_id: medecin.id, roll: 3, description: 'Guilde : engagé par la Guilde des médecins. Salaire +10% à partir de cette année, Célébrité +4, Cabinet médical +2.' },
    { career_id: medecin.id, roll: 4, description: 'Grande société : contacté par une grande société (comme Cortex). Salaire +20%, Célébrité +4, Points de compétence +3, Cabinet médical +2.' },
    { career_id: medecin.id, roll: 5, description: 'Trafiquants : contacté par des trafiquants d\'organes. Salaire quadruplé pour l\'année si accepte.' },
    { career_id: medecin.id, roll: 6, description: 'Personnage influent : soigné un personnage influent. Points de compétence +2, Célébrité +4, Salaire doublé, Cabinet médical +2, Allié +1, Relations +2.' },
    { career_id: medecin.id, roll: 7, description: 'Client prestigieux : Revenu +10% à partir de cette année, Célébrité +6, Cabinet médical +4, Allié +1, Relations +2.' },
    { career_id: medecin.id, roll: 8, description: 'Expérience interdite : expériences médicales dangereuses. Points de compétence +5, Revenu doublé, Pharmacie personnelle +2.' },
    { career_id: medecin.id, roll: 9, description: 'Stock et données : Pharmacie personnelle +6, Données médicales +4.' },
    { career_id: medecin.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 14. MERCENAIRE
  // ============================================================
  const [mercenaire] = await knex('ref_careers').insert({
    code: 'mercenaire',
    name: 'Mercenaire',
    description: 'Voici une Profession de plus en plus répandue au fond des mers. Il y a donc beaucoup de concurrence et seuls quelques élus arrivent à se faire un nom.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: mercenaire.id, skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { career_id: mercenaire.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: mercenaire.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: mercenaire.id, skill_id: 'RESPIRATION_FOE', skill_group: 'Aptitudes physiques' },
    { career_id: mercenaire.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: mercenaire.id, skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    { career_id: mercenaire.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: mercenaire.id, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)' },
    { career_id: mercenaire.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: mercenaire.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: mercenaire.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: mercenaire.id, skill_id: 'ARMES_LOURDES', skill_group: 'Combat (tir)' },
    { career_id: mercenaire.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: mercenaire.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: mercenaire.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: mercenaire.id, skill_id: 'TIR_AUTOMATIQUES', skill_group: 'Combat (tir)' },
    { career_id: mercenaire.id, skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité' },
    { career_id: mercenaire.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité' },
    // Note : « langue de la communauté d'accueil » — variable
    { career_id: mercenaire.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: mercenaire.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { career_id: mercenaire.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
    { career_id: mercenaire.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: mercenaire.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: mercenaire.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: mercenaire.id, skill_id: 'PIEGES', skill_group: 'Survie/Extérieur' },
    { career_id: mercenaire.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: mercenaire.id, skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { career_id: mercenaire.id, skill_id: 'EXPLOSIFS', skill_group: 'Techniques' },
    { career_id: mercenaire.id, skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: mercenaire.id, min_years: 1, max_years: 6, title: 'Mercenaire', salary_per_year: 500 },
    { career_id: mercenaire.id, min_years: 7, max_years: 8, title: 'Sergent', salary_per_year: 1000 },
    { career_id: mercenaire.id, min_years: 9, max_years: 10, title: 'Sergent', salary_per_year: 2000 },
    { career_id: mercenaire.id, min_years: 11, max_years: 14, title: 'Sergent', salary_per_year: 4000 },
    { career_id: mercenaire.id, min_years: 15, max_years: 18, title: 'Lieutenant', salary_per_year: 8000 },
    { career_id: mercenaire.id, min_years: 19, max_years: null, title: 'Capitaine', salary_per_year: 12000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: mercenaire.id, sort_order: 1, category: 'Célébrité' },
    { career_id: mercenaire.id, sort_order: 2, category: 'Relations' },
    { career_id: mercenaire.id, sort_order: 3, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: mercenaire.id, sort_order: 1, equipment: 'Armure de plongée Exo-1 ou petit navire sous-marin (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: mercenaire.id, sort_order: 2, equipment: 'Armement' },
    { career_id: mercenaire.id, sort_order: 3, equipment: 'Armures et protections' },
    { career_id: mercenaire.id, sort_order: 4, equipment: 'Matériel standard' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: mercenaire.id, roll: 1, description: 'Attribut augmenté : Constitution +1' },
    { career_id: mercenaire.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +1.' },
    { career_id: mercenaire.id, roll: 3, description: 'Guilde : engagé par la Guilde des Mercenaires. Salaire +10% à partir de cette année, Célébrité +4, Matériel +2.' },
    { career_id: mercenaire.id, roll: 4, description: 'Grande société : contacté par Légion, les Loups des Profondeurs, la Cohorte Gabrielle, etc. Salaire +20%, Célébrité +4, Points de compétence +4.' },
    { career_id: mercenaire.id, roll: 5, description: 'Action d\'éclat : participation à une bataille importante. Points de compétence +4, Célébrité +4, revenu doublé pour l\'année.' },
    { career_id: mercenaire.id, roll: 6, description: 'Réseau d\'informateurs : Célébrité +2, Relations +6.' },
    { career_id: mercenaire.id, roll: 7, description: 'Dépôt d\'armes : matériel militaire accumulé. Matériel +6.' },
    { career_id: mercenaire.id, roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { career_id: mercenaire.id, roll: 9, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { career_id: mercenaire.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])

  // ============================================================
  // 15. MINEUR
  // ============================================================
  const [mineur] = await knex('ref_careers').insert({
    code: 'mineur',
    name: 'Mineur',
    description: 'Les mineurs mènent certainement une existence parmi les plus dures qui soient. Ils passent leur vie dans les mines sous-marines les plus profondes, à extraire de précieux minerais.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: mineur.id, skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { career_id: mineur.id, skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
    { career_id: mineur.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: mineur.id, skill_id: 'RESPIRATION_FOE', skill_group: 'Aptitudes physiques' },
    { career_id: mineur.id, skill_id: 'ARMES_LOURDES_CONTACT', skill_group: 'Combat (contact)' },
    { career_id: mineur.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: mineur.id, skill_id: 'LANGAGES_SPECIFIQUES_KLAN', skill_group: 'Langues' },
    { career_id: mineur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { career_id: mineur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: mineur.id, skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { career_id: mineur.id, skill_id: 'PILOTAGE__VEHICULES_SOUTERRAINS', skill_group: 'Pilotage' },
    { career_id: mineur.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS', skill_group: 'Survie/Extérieur' },
    { career_id: mineur.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' },
    { career_id: mineur.id, skill_id: 'EXPLOSIFS', skill_group: 'Techniques' },
    { career_id: mineur.id, skill_id: 'MECANIQUE_VEHICULES_DE_SOL', skill_group: 'Techniques' },
    { career_id: mineur.id, skill_id: 'MECANIQUE_VEHICULES_SOUTERRAINS', skill_group: 'Techniques' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: mineur.id, min_years: 1, max_years: 2, title: 'Mineur apprenti', salary_per_year: 500 },
    { career_id: mineur.id, min_years: 3, max_years: 6, title: 'Mineur', salary_per_year: 1000 },
    { career_id: mineur.id, min_years: 7, max_years: 8, title: 'Mineur 1ère catégorie', salary_per_year: 2000 },
    { career_id: mineur.id, min_years: 9, max_years: 10, title: 'Mineur Classe A', salary_per_year: 3000 },
    { career_id: mineur.id, min_years: 11, max_years: 12, title: 'Mineur Classe B', salary_per_year: 4000 },
    { career_id: mineur.id, min_years: 13, max_years: 18, title: 'Mineur Classe C', salary_per_year: 5000 },
    { career_id: mineur.id, min_years: 19, max_years: 20, title: 'Mineur expert', salary_per_year: 8000 },
    { career_id: mineur.id, min_years: 21, max_years: null, title: 'Maître de mine', salary_per_year: 12000 }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: mineur.id, sort_order: 1, category: 'Concession' },
    { career_id: mineur.id, sort_order: 2, category: 'Relations' },
    { career_id: mineur.id, sort_order: 3, category: 'Célébrité' },
    { career_id: mineur.id, sort_order: 4, category: 'Matériel' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: mineur.id, sort_order: 1, equipment: 'Armure de plongée exo-1 (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: mineur.id, sort_order: 2, equipment: 'Matériel standard' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: mineur.id, roll: 1, description: 'Attribut augmenté : Force +1.' },
    { career_id: mineur.id, roll: 2, description: 'Concession : droits d\'une nouvelle concession non exploitée (à définir par le MJ).' },
    { career_id: mineur.id, roll: 3, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +2.' },
    { career_id: mineur.id, roll: 4, description: 'Guilde : engagé par la Guilde des mineurs. Salaire +10% à partir de cette année, Célébrité +4, Concession +2.' },
    { career_id: mineur.id, roll: 5, description: 'Année faste : paie doublée, Célébrité +2, Matériel +2.' },
    { career_id: mineur.id, roll: 6, description: 'Unité des mineurs : aide des confrères. Alliés +2, Relations +4.' },
    { career_id: mineur.id, roll: 7, description: 'Aide de la communauté : Matériel +6, Concession +2.' },
    { career_id: mineur.id, roll: 8, description: 'Entreprise privée : engagé par une entreprise privée. Salaire +20% à partir de cette année, Célébrité +2.' },
    { career_id: mineur.id, roll: 9, description: 'Nouveau filon : Concession +6.' },
    { career_id: mineur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
