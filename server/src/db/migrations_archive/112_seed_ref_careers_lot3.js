// 112_seed_ref_careers_lot3.js — Seed lot 3 (COUCHE 4c) : 5 carrières
// Marchand, Marchand itinérant/Conteur, Médecin/Chirurgien, Mercenaire, Mineur
// Source : docs/Character/Creation/migrations/93_seed_ref_careers_lot3.cjs (déjà audité/corrigé)
// skill_group non repris (colonne supprimée migration 111 — ref_skills.family fait foi désormais)
// Voir docs/PLAN_LOTS_3_6_CAREERS.md pour le détail de la vérification (skill_id + MinIO)

const CODES = ['marchand', 'marchand_itinerant', 'medecin_chirurgien', 'mercenaire', 'mineur']

export const up = async (knex) => {
  // ============================================================
  // MARCHAND
  // ============================================================
  const [marchand] = await knex('ref_careers').insert({
    code: 'marchand',
    name: 'Marchand',
    description: 'Voici une Profession qui permet de voyager dans toutes les mers et dans tous les océans !',
    illustration: 'assets/s4_marchand.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Très peu dans l\'Alliance polaire ou les Royaumes pirates.',
    contact_frequency: 1,
    ally_frequency: 2,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: marchand.id, skill_id: 'COMBAT_ARME' },
    { career_id: marchand.id, skill_id: 'ANALYSE_EMPATHIQUE' },
    { career_id: marchand.id, skill_id: 'ELOQUENCE_PERSUASION' },
    { career_id: marchand.id, skill_id: 'ENTREGENT_SEDUCTION' },
    { career_id: marchand.id, skill_id: 'BUREAUCRATIE' },
    { career_id: marchand.id, skill_id: 'COMMERCE_TRAFIC', conditional: true },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: marchand.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: marchand.id, skill_id: 'EDUCATION_CULTURE_GENERALE' },
    { career_id: marchand.id, skill_id: 'RECHERCHE_DINFORMATIONS' },
    { career_id: marchand.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION' },
    { career_id: marchand.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE' },
    { career_id: marchand.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: marchand.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN' },
    { career_id: marchand.id, skill_id: 'FALSIFICATION' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: marchand.id, min_years: 1, max_years: 5, title: 'Employé', salary_per_year: 100 },
    { career_id: marchand.id, min_years: 6, max_years: 7, title: 'Apprenti marchand', salary_per_year: 1000 },
    { career_id: marchand.id, min_years: 8, max_years: 11, title: 'Marchand', salary_per_year: 2000 },
    { career_id: marchand.id, min_years: 12, max_years: 15, title: 'Marchand', salary_per_year: 4000 },
    { career_id: marchand.id, min_years: 16, max_years: 19, title: 'Marchand', salary_per_year: 6000 },
    { career_id: marchand.id, min_years: 20, max_years: 23, title: 'Marchand', salary_per_year: 12000 },
    { career_id: marchand.id, min_years: 24, max_years: 26, title: 'Marchand', salary_per_year: 20000 },
    { career_id: marchand.id, min_years: 27, max_years: null, title: 'Marchand', salary_per_year: 30000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: marchand.id, sort_order: 1, category: 'Étal/Boutique' },
    { career_id: marchand.id, sort_order: 2, category: 'Stock de marchandises' },
    { career_id: marchand.id, sort_order: 3, category: 'Célébrité' },
    { career_id: marchand.id, sort_order: 4, category: 'Relations' },
    { career_id: marchand.id, sort_order: 5, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: marchand.id, sort_order: 1, equipment: 'Matériel standard' },
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
    { career_id: marchand.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // MARCHAND ITINÉRANT/CONTEUR
  // ============================================================
  const [marchandItinerant] = await knex('ref_careers').insert({
    code: 'marchand_itinerant',
    name: 'Marchand itinérant/Conteur',
    description: 'De nombreux marchands itinérants sont également conteurs ; ce sont en fait des sortes de bardes sous-marins qui voyagent de communauté en communauté.',
    illustration: 'assets/s4_marchanditinerant.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Visitent le plus souvent les petites communautés isolées.',
    contact_frequency: 2,
    ally_frequency: 1,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: marchandItinerant.id, skill_id: 'COMBAT_ARME' },
    { career_id: marchandItinerant.id, skill_id: 'ANALYSE_EMPATHIQUE' },
    { career_id: marchandItinerant.id, skill_id: 'ELOQUENCE_PERSUASION' },
    { career_id: marchandItinerant.id, skill_id: 'ENTREGENT_SEDUCTION' },
    { career_id: marchandItinerant.id, skill_id: 'ENSEIGNEMENT' },
    { career_id: marchandItinerant.id, skill_id: 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'CARTOGRAPHIE' },
    { career_id: marchandItinerant.id, skill_id: 'COMMERCE_TRAFIC', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', conditional: true },
    { career_id: marchandItinerant.id, skill_id: 'EDUCATION_CULTURE_GENERALE' },
    { career_id: marchandItinerant.id, skill_id: 'NAVIGATION' },
    { career_id: marchandItinerant.id, skill_id: 'DEGUISEMENT_IMITATION' },
    { career_id: marchandItinerant.id, skill_id: 'PICKPOCKET' },
    { career_id: marchandItinerant.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: marchandItinerant.id, skill_id: 'LANGAGES_SPECIFIQUES_SOLEEN' },
    { career_id: marchandItinerant.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS' },
    { career_id: marchandItinerant.id, skill_id: 'ANALYSES_SONSCANS' },
    { career_id: marchandItinerant.id, skill_id: 'ART_ARTISANAT' },
    { career_id: marchandItinerant.id, skill_id: 'PREMIER_SOINS' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: marchandItinerant.id, min_years: 1, max_years: null, title: 'Marchand itinérant', salary_per_year: 500 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: marchandItinerant.id, sort_order: 1, category: 'Relations' },
    { career_id: marchandItinerant.id, sort_order: 2, category: 'Célébrité' },
    { career_id: marchandItinerant.id, sort_order: 3, category: 'Matériel' },
    { career_id: marchandItinerant.id, sort_order: 4, category: 'Stock de marchandises' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: marchandItinerant.id, sort_order: 1, equipment: 'Petit navire de transport (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: marchandItinerant.id, sort_order: 2, equipment: 'Matériel standard' },
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
    { career_id: marchandItinerant.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // MÉDECIN/CHIRURGIEN
  // ============================================================
  const [medecin] = await knex('ref_careers').insert({
    code: 'medecin_chirurgien',
    name: 'Médecin/Chirurgien',
    description: 'Spécialistes des soins et des maladies, les médecins et les chirurgiens sont utiles partout. Leur formation est généralement assurée par de grandes sociétés pharmaceutiques, génétiques ou par les prêtres du Culte du Trident.',
    illustration: 'assets/s4_medecin.webp',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Premières années dans les grandes stations comme Équinoxe ou les capitales des nations sous-marines.',
    contact_frequency: 4,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 4,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: medecin.id, field: 'Médecine' },
  ])

  await knex('ref_career_skills').insert([
    { career_id: medecin.id, skill_id: 'ANALYSE_EMPATHIQUE' },
    { career_id: medecin.id, skill_id: 'BUREAUCRATIE' },
    { career_id: medecin.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: medecin.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: medecin.id, skill_id: 'EDUCATION_CULTURE_GENERALE' },
    { career_id: medecin.id, skill_id: 'RECHERCHE_DINFORMATIONS' },
    { career_id: medecin.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES', conditional: true },
    { career_id: medecin.id, skill_id: 'LANGAGES_SPECIFIQUES_METALAN' },
    { career_id: medecin.id, skill_id: 'LANGUE_ANCIENNE_AZURAN' },
    { career_id: medecin.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN' },
    { career_id: medecin.id, skill_id: 'CHIRURGIE' },
    { career_id: medecin.id, skill_id: 'INFORMATIQUE' },
    { career_id: medecin.id, skill_id: 'PREMIER_SOINS' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: medecin.id, min_years: 1, max_years: 6, title: 'Étudiant', salary_per_year: 200 },
    { career_id: medecin.id, min_years: 7, max_years: 12, title: 'Médecin public', salary_per_year: 1000 },
    { career_id: medecin.id, min_years: 13, max_years: 14, title: 'Médecin privé', salary_per_year: 4000 },
    { career_id: medecin.id, min_years: 15, max_years: 16, title: 'Médecin 1ère catégorie', salary_per_year: 8000 },
    { career_id: medecin.id, min_years: 17, max_years: 18, title: 'Médecin confirmé', salary_per_year: 12000 },
    { career_id: medecin.id, min_years: 19, max_years: 20, title: 'Médecin', salary_per_year: 18000 },
    { career_id: medecin.id, min_years: 21, max_years: null, title: 'Expert en médecine', salary_per_year: 20000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: medecin.id, sort_order: 1, category: 'Relations' },
    { career_id: medecin.id, sort_order: 2, category: 'Célébrité' },
    { career_id: medecin.id, sort_order: 3, category: 'Cabinet médical' },
    { career_id: medecin.id, sort_order: 4, category: 'Pharmacie personnelle' },
    { career_id: medecin.id, sort_order: 5, category: 'Matériel' },
    { career_id: medecin.id, sort_order: 6, category: 'Base de données médicales' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: medecin.id, sort_order: 1, equipment: 'Matériel médical' },
    { career_id: medecin.id, sort_order: 2, equipment: 'Matériel standard' },
    { career_id: medecin.id, sort_order: 3, equipment: 'Poisons et drogues' },
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
    { career_id: medecin.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // MERCENAIRE
  // ============================================================
  const [mercenaire] = await knex('ref_careers').insert({
    code: 'mercenaire',
    name: 'Mercenaire',
    description: 'Voici une Profession de plus en plus répandue au fond des mers. Il y a donc beaucoup de concurrence et seuls quelques élus arrivent à se faire un nom.',
    illustration: 'assets/s4_mercenaire.webp',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: mercenaire.id, skill_id: 'ATHLETISME' },
    { career_id: mercenaire.id, skill_id: 'ENDURANCE' },
    { career_id: mercenaire.id, skill_id: 'MANOEUVRES_SOUS_MARINES' },
    { career_id: mercenaire.id, skill_id: 'RESPIRATION_FOE' },
    { career_id: mercenaire.id, skill_id: 'INTIMIDATION' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: mercenaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: mercenaire.id, skill_id: 'NAVIGATION' },
    { career_id: mercenaire.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO' },
    { career_id: mercenaire.id, skill_id: 'ARTS_MARTIAUX_LUTTE' },
    { career_id: mercenaire.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES' },
    { career_id: mercenaire.id, skill_id: 'COMBAT_ARME' },
    { career_id: mercenaire.id, skill_id: 'COMBAT_A_MAINS_NUES' },
    { career_id: mercenaire.id, skill_id: 'ARMES_LOURDES' },
    { career_id: mercenaire.id, skill_id: 'ARMES_DE_POING' },
    { career_id: mercenaire.id, skill_id: 'ARMES_SOUS_MARINES' },
    { career_id: mercenaire.id, skill_id: 'FUSIL_ARMES_DEPAULES' },
    { career_id: mercenaire.id, skill_id: 'TIR_AUTOMATIQUES' },
    { career_id: mercenaire.id, skill_id: 'CAMOUFLAGE_DISSIMULATION' },
    { career_id: mercenaire.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX' },
    { career_id: mercenaire.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES' },
    { career_id: mercenaire.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS' },
    { career_id: mercenaire.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS' },
    { career_id: mercenaire.id, skill_id: 'TELEPILOTAGE' },
    { career_id: mercenaire.id, skill_id: 'OBSERVATION' },
    { career_id: mercenaire.id, skill_id: 'ORIENTATION' },
    { career_id: mercenaire.id, skill_id: 'PIEGES' },
    { career_id: mercenaire.id, skill_id: 'SURVIE' },
    { career_id: mercenaire.id, skill_id: 'ANALYSES_SONSCANS' },
    { career_id: mercenaire.id, skill_id: 'EXPLOSIFS' },
    { career_id: mercenaire.id, skill_id: 'PREMIER_SOINS' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: mercenaire.id, min_years: 1, max_years: 6, title: 'Mercenaire', salary_per_year: 500 },
    { career_id: mercenaire.id, min_years: 7, max_years: 8, title: 'Sergent', salary_per_year: 1000 },
    { career_id: mercenaire.id, min_years: 9, max_years: 10, title: 'Sergent', salary_per_year: 2000 },
    { career_id: mercenaire.id, min_years: 11, max_years: 14, title: 'Sergent', salary_per_year: 4000 },
    { career_id: mercenaire.id, min_years: 15, max_years: 18, title: 'Lieutenant', salary_per_year: 8000 },
    { career_id: mercenaire.id, min_years: 19, max_years: null, title: 'Capitaine', salary_per_year: 12000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: mercenaire.id, sort_order: 1, category: 'Célébrité' },
    { career_id: mercenaire.id, sort_order: 2, category: 'Relations' },
    { career_id: mercenaire.id, sort_order: 3, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: mercenaire.id, sort_order: 1, equipment: 'Armure de plongée Exo-1 ou petit navire sous-marin (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: mercenaire.id, sort_order: 2, equipment: 'Armement' },
    { career_id: mercenaire.id, sort_order: 3, equipment: 'Armures et protections' },
    { career_id: mercenaire.id, sort_order: 4, equipment: 'Matériel standard' },
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
    { career_id: mercenaire.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])

  // ============================================================
  // MINEUR
  // ============================================================
  const [mineur] = await knex('ref_careers').insert({
    code: 'mineur',
    name: 'Mineur',
    description: 'Les mineurs mènent certainement une existence parmi les plus dures qui soient. Ils passent leur vie dans les mines sous-marines les plus profondes, à extraire de précieux minerais.',
    illustration: 'assets/s4_mineur.webp',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5,
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: mineur.id, skill_id: 'ENDURANCE' },
    { career_id: mineur.id, skill_id: 'ESCALADE' },
    { career_id: mineur.id, skill_id: 'MANOEUVRES_SOUS_MARINES' },
    { career_id: mineur.id, skill_id: 'RESPIRATION_FOE' },
    { career_id: mineur.id, skill_id: 'ARMES_LOURDES_CONTACT' },
    { career_id: mineur.id, skill_id: 'COMBAT_ARME' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS' },
    { career_id: mineur.id, skill_id: 'LANGAGES_SPECIFIQUES_KLAN' },
    { career_id: mineur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES' },
    { career_id: mineur.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES' },
    { career_id: mineur.id, skill_id: 'PILOTAGE__VEHICULES_DE_SOL' },
    { career_id: mineur.id, skill_id: 'PILOTAGE__VEHICULES_SOUTERRAINS' },
    { career_id: mineur.id, skill_id: 'TELEPILOTAGE' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS' },
    { career_id: mineur.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS' },
    { career_id: mineur.id, skill_id: 'SURVIE' },
    { career_id: mineur.id, skill_id: 'EXPLOSIFS' },
    { career_id: mineur.id, skill_id: 'MECANIQUE_VEHICULES_DE_SOL' },
    { career_id: mineur.id, skill_id: 'MECANIQUE_VEHICULES_SOUTERRAINS' },
  ])

  await knex('ref_career_titles').insert([
    { career_id: mineur.id, min_years: 1, max_years: 2, title: 'Mineur apprenti', salary_per_year: 500 },
    { career_id: mineur.id, min_years: 3, max_years: 6, title: 'Mineur', salary_per_year: 1000 },
    { career_id: mineur.id, min_years: 7, max_years: 8, title: 'Mineur 1ère catégorie', salary_per_year: 2000 },
    { career_id: mineur.id, min_years: 9, max_years: 10, title: 'Mineur Classe A', salary_per_year: 3000 },
    { career_id: mineur.id, min_years: 11, max_years: 12, title: 'Mineur Classe B', salary_per_year: 4000 },
    { career_id: mineur.id, min_years: 13, max_years: 18, title: 'Mineur Classe C', salary_per_year: 5000 },
    { career_id: mineur.id, min_years: 19, max_years: 20, title: 'Mineur expert', salary_per_year: 8000 },
    { career_id: mineur.id, min_years: 21, max_years: null, title: 'Maître de mine', salary_per_year: 12000 },
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: mineur.id, sort_order: 1, category: 'Concession' },
    { career_id: mineur.id, sort_order: 2, category: 'Relations' },
    { career_id: mineur.id, sort_order: 3, category: 'Célébrité' },
    { career_id: mineur.id, sort_order: 4, category: 'Matériel' },
  ])

  await knex('ref_career_equipment').insert([
    { career_id: mineur.id, sort_order: 1, equipment: 'Armure de plongée exo-1 (à crédit, endettement réduit de 1 à 5% par an)' },
    { career_id: mineur.id, sort_order: 2, equipment: 'Matériel standard' },
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
    { career_id: mineur.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' },
  ])
}

export const down = async (knex) => {
  await knex('ref_careers').whereIn('code', CODES).delete()
}
