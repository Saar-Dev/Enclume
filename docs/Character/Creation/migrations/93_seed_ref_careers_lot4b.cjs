// 093_seed_ref_careers_lot4b.cjs
// Lot 4b : Pilote de chasseur sous-marin, Pilote de chasseur atmosphérique, Pirate

export const seed = async (knex) => {
  // ============================================================
  // 26-27. PILOTE DE CHASSE — skills communs
  // ============================================================
  const piloteCommonSkills = [
    { skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { skill_id: 'CARTOGRAPHIE', skill_group: 'Connaissances' },
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'origine
    { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' }, // communauté d'accueil
    { skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
    { skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
    // « langue de la communauté d'accueil » non seedable : LANGUE_ETRANGERE n'existe pas comme ID standalone dans ref_skills
    { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { skill_id: 'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', skill_group: 'Langues' },
    { skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
    { skill_id: 'INFORMATIQUE', skill_group: 'Techniques' },
    { skill_id: 'ELECTRONIQUE', skill_group: 'Techniques' }
  ]

  const piloteSMSkills = [
    { skill_id: 'RESPIRATION_FOE', skill_group: 'Aptitudes physiques' },
    { skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { skill_id: 'TACTIQUE_COMBAT_NAVAL', skill_group: 'Connaissances' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__CHASSEURS_SOUS_MARINS', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__VEHICULES_DE_SOL', skill_group: 'Pilotage' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { skill_id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', skill_group: 'Techniques' }
  ]

  const piloteAtmSkills = [
    { skill_id: 'TACTIQUE_COMBAT_TERRESTRE', skill_group: 'Connaissances' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', skill_group: 'Pilotage' },
    { skill_id: 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES', skill_group: 'Pilotage' },
    { skill_id: 'PILOTAGE__CHASSEURS_ATMOSPHERIQUES', skill_group: 'Pilotage' },
    { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SURFACE', skill_group: 'Survie/Extérieur' },
    { skill_id: 'MECANIQUE_CHASSEURS_ATMOSPHERIQUES', skill_group: 'Techniques' }
  ]

  const piloteTitles = [
    { min_years: 1, max_years: 1, title: 'Recrue', salary_per_year: 800 },
    { min_years: 2, max_years: 5, title: 'Soldat', salary_per_year: 1600 },
    { min_years: 6, max_years: 7, title: 'Vétéran', salary_per_year: 6000 },
    { min_years: 8, max_years: 11, title: 'Sergent', salary_per_year: 12000 },
    { min_years: 12, max_years: 15, title: 'Lieutenant', salary_per_year: 20000 },
    { min_years: 16, max_years: null, title: 'Capitaine', salary_per_year: 36000 }
  ]

  const pilotePointCategories = [
    { sort_order: 1, category: 'Relations' },
    { sort_order: 2, category: 'Célébrité' },
    { sort_order: 3, category: 'Matériel' }
  ]

  const piloteEquipment = [
    { sort_order: 1, equipment: 'Matériel standard' },
    { sort_order: 2, equipment: 'Armes de contact (couteau gratuit)' },
    { sort_order: 3, equipment: 'Armes de poing (Pistolet avec permis gratuit)' },
    { sort_order: 4, equipment: 'Protections et armures' }
  ]

  const piloteBenefits = [
    { roll: 1, description: 'Attribut augmenté : Adaptation +1.' },
    { roll: 2, description: 'Bataille : Points de compétence +2, Célébrité +2, Matériel +1.' },
    { roll: 3, description: 'Distinction : salaire doublé pour l\'année, points de compétence +3, Célébrité +3, Matériel +2.' },
    { roll: 4, description: 'Héros : Salaire triplé pour l\'année, points de compétence +4, Célébrité +4, Matériel +3.' },
    { roll: 5, description: 'Élite : paie doublée à partir de cette année, points de compétence +6, Célébrité +6, Matériel +4.' },
    { roll: 6, description: 'Prestation : remarqué par sa hiérarchie, point de compétence +1, Célébrité +1.' },
    { roll: 7, description: 'Formation : ajouter une Compétence (au choix) dans la liste. Points de compétence +2, Relations +1.' },
    { roll: 8, description: 'Camarades de combat : Allié +1, Relations +2.' },
    { roll: 9, description: 'Mercenaires/Milice privée : Allié +2, Relations +4.' },
    { roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ]

  // ============================================================
  // 26. PILOTE DE CHASSE — SOUS-MARIN
  // ============================================================
  const [piloteSM] = await knex('ref_careers').insert({
    code: 'pilote_chasse_sous_marin',
    name: 'Pilote de chasseur sous-marin',
    description: 'Les pilotes de chasseurs sous-marins forment une élite au cœur des forces armées d\'une communauté ou d\'une nation.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Entraînement comme recrue dans l\'armée d\'une grande nation.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: piloteSM.id, field: 'Sciences' }
  ])

  await knex('ref_career_skills').insert(
    [...piloteCommonSkills, ...piloteSMSkills].map(s => ({ ...s, career_id: piloteSM.id }))
  )

  await knex('ref_career_titles').insert(
    piloteTitles.map(t => ({ ...t, career_id: piloteSM.id }))
  )

  await knex('ref_career_point_categories').insert(
    pilotePointCategories.map(p => ({ ...p, career_id: piloteSM.id }))
  )

  await knex('ref_career_equipment').insert(
    piloteEquipment.map(e => ({ ...e, career_id: piloteSM.id }))
  )

  await knex('ref_career_random_benefits').insert(
    piloteBenefits.map(b => ({ ...b, career_id: piloteSM.id }))
  )

  // ============================================================
  // 27. PILOTE DE CHASSE — ATMOSPHÉRIQUE
  // ============================================================
  const [piloteAtm] = await knex('ref_careers').insert({
    code: 'pilote_chasse_atmospherique',
    name: 'Pilote de chasseur atmosphérique',
    description: 'Les pilotes de chasseurs atmosphériques forment une élite des forces de surface. Entraînement commencé dans les forces navales ou terrestres.',
    restricted_geographic_origin: true,
    geographic_origin_details: 'Entraînement comme recrue dans l\'armée d\'une grande nation.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 6,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_education').insert([
    { career_id: piloteAtm.id, field: 'Sciences' }
  ])

  await knex('ref_career_skills').insert(
    [...piloteCommonSkills, ...piloteAtmSkills].map(s => ({ ...s, career_id: piloteAtm.id }))
  )

  await knex('ref_career_titles').insert(
    piloteTitles.map(t => ({ ...t, career_id: piloteAtm.id }))
  )

  await knex('ref_career_point_categories').insert(
    pilotePointCategories.map(p => ({ ...p, career_id: piloteAtm.id }))
  )

  await knex('ref_career_equipment').insert(
    piloteEquipment.map(e => ({ ...e, career_id: piloteAtm.id }))
  )

  await knex('ref_career_random_benefits').insert(
    piloteBenefits.map(b => ({ ...b, career_id: piloteAtm.id }))
  )

  // ============================================================
  // 28. PIRATE
  // ============================================================
  const [pirate] = await knex('ref_careers').insert({
    code: 'pirate',
    name: 'Pirate',
    description: 'Le personnage est membre d\'une confrérie pirate. Il peut choisir librement d\'être un boucanier, un forban, un pirate, etc.',
    contact_frequency: 2,
    ally_frequency: 4,
    ally_type: 'ally_or_supplier',
    opponent_frequency: 2,
    enemy_rule: '3_opposants_echangent_1_ennemi',
    points_per_year: 5
  }).returning('id')

  await knex('ref_career_skills').insert([
    { career_id: pirate.id, skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
    { career_id: pirate.id, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)' },
    { career_id: pirate.id, skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
    { career_id: pirate.id, skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
    { career_id: pirate.id, skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
    { career_id: pirate.id, skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
    { career_id: pirate.id, skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
    { career_id: pirate.id, skill_id: 'TIR_AUTOMATIQUES', skill_group: 'Combat (tir)' },
    { career_id: pirate.id, skill_id: 'INTIMIDATION', skill_group: 'Communications/Relations sociales' },
    { career_id: pirate.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
    { career_id: pirate.id, skill_id: 'JEU', skill_group: 'Connaissances' },
    { career_id: pirate.id, skill_id: 'TACTIQUE_OPERATIONS_COMMANDO', skill_group: 'Connaissances' },
    { career_id: pirate.id, skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
    { career_id: pirate.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    { career_id: pirate.id, skill_id: 'LANGAGES_SPECIFIQUES_ITHRAXIEN', skill_group: 'Langues' },
    { career_id: pirate.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
    { career_id: pirate.id, skill_id: 'TELEPILOTAGE', skill_group: 'Pilotage' },
    { career_id: pirate.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', skill_group: 'Survie/Extérieur' },
    { career_id: pirate.id, skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
    { career_id: pirate.id, skill_id: 'ORIENTATION', skill_group: 'Survie/Extérieur' },
    { career_id: pirate.id, skill_id: 'SURVIE', skill_group: 'Survie/Extérieur' }
  ])

  await knex('ref_career_titles').insert([
    { career_id: pirate.id, min_years: 1, max_years: 6, title: 'Mousse', salary_formula: '2D100' },
    { career_id: pirate.id, min_years: 7, max_years: 16, title: 'Pirate', salary_formula: '1D10*100' },
    { career_id: pirate.id, min_years: 17, max_years: null, title: 'Pirate', salary_formula: '1D100*100' }
  ])

  await knex('ref_career_point_categories').insert([
    { career_id: pirate.id, sort_order: 1, category: 'Relations' },
    { career_id: pirate.id, sort_order: 2, category: 'Célébrité' },
    { career_id: pirate.id, sort_order: 3, category: 'Matériel' },
    { career_id: pirate.id, sort_order: 4, category: 'Corruption/Chantage' }
  ])

  await knex('ref_career_equipment').insert([
    { career_id: pirate.id, sort_order: 1, equipment: 'Sabre (gratuit)' },
    { career_id: pirate.id, sort_order: 2, equipment: 'Armure de plongée exo-1 (gratuite)' },
    { career_id: pirate.id, sort_order: 3, equipment: 'Tout type de matériel (volé)' }
  ])

  await knex('ref_career_random_benefits').insert([
    { career_id: pirate.id, roll: 1, description: 'Attribut augmenté : Volonté +1.' },
    { career_id: pirate.id, roll: 2, description: 'Prestation : travail remarqué. Points de compétence +2, Célébrité +2, Matériel +2, Corruption/Chantage +2.' },
    { career_id: pirate.id, roll: 3, description: 'Butin : bonne année, 100 x 1D10 sols supplémentaires, Célébrité +2, Matériel +2.' },
    { career_id: pirate.id, roll: 4, description: 'Confrérie : remarqué par une grande confrérie. Argent doublé à partir de cette année, points de compétence +4, Célébrité +4, Matériel +4.' },
    { career_id: pirate.id, roll: 5, description: 'Mise à prix : Célébrité +6. Récompense = Célébrité x 1000 sols. Chaque résultat double la somme.' },
    { career_id: pirate.id, roll: 6, description: 'Carte : carte au trésor récupérée (à déterminer par le MJ).' },
    { career_id: pirate.id, roll: 7, description: 'Respect/Violation du code : réputé pour respecter ou violer le code (au choix). Célébrité +4, Allié +1, Relations +4.' },
    { career_id: pirate.id, roll: 8, description: 'Transfert génétique : honneur de transmettre ses gènes. Célébrité +6, Relations +4, Allié +2.' },
    { career_id: pirate.id, roll: 9, description: 'Arène : triomphe dans un combat d\'arène, revenus doublés pour l\'année, Célébrité +4, Matériel +2.' },
    { career_id: pirate.id, roll: 10, description: 'Un avantage aléatoire au choix ou 7 points à répartir sur les Avantages professionnels automatiques.' }
  ])
}
