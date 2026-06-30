// 98_ref_backgrounds.js
// RÃ©fÃ©rentiel des origines/formations + tables de snapshot et revers.
// Source : docs/Character/Creation/PLAN_CREATION_E4.md â€” converti ESM â†’ CJS.
//
// Corrections appliquÃ©es par rapport au plan source :
//   BUG U1 : table.unique([..., knex.raw()]) non supportÃ© par columnize() â†’
//            remplacÃ© par knex.raw('CREATE UNIQUE INDEX ... COALESCE(parent_code, '')')
//   BUG M4a : 2e entrÃ©e classes_moyennes (parent: grande_cite) sans skills â†’
//             const [cm2] stockÃ© + 3 skills insÃ©rÃ©s pour cm2.id
//   BUG M4b : 2e entrÃ©e education_scolaire (parent: classes_superieures) sans skills â†’
//             const [scolaire2] stockÃ© + 6 skills insÃ©rÃ©s dans un insert sÃ©parÃ©

export const up = async (knex) => {

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ref_backgrounds â€” origines gÃ©ographiques, sociales, formations, Ã©tudes sup.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  await knex.schema.createTable('ref_backgrounds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('type').notNullable()        // 'geo_origin' | 'social_origin' | 'training' | 'higher_ed'
    table.text('code').notNullable()        // identifiant unique par (type, parent_code)
    table.text('name').notNullable()        // nom affichÃ©
    table.text('description')              // texte informatif
    table.text('parent_type')              // type du parent pour filtrage
    table.text('parent_code')              // code du parent (null = disponible partout)
    table.integer('pc_cost').defaultTo(0)  // pour Ã©tudes supÃ©rieures
    table.integer('years_added').defaultTo(0)
    table.integer('sort_order')
    // BUG U1 FIX : table.unique([..., knex.raw()]) ne passe pas par columnize() â†’
    // index crÃ©Ã© via knex.raw() aprÃ¨s la table (voir ci-dessous)
  })

  // BUG U1 FIX : index unique sur expression â€” COALESCE traite NULL comme ''
  // pour permettre plusieurs entrÃ©es avec le mÃªme code et parent_code diffÃ©rent,
  // tout en interdisant deux entrÃ©es identiques (type, code, mÃªme parent_code).
  // Sentinel '' est sÃ»r : aucun parent_code rÃ©el n'est une chaÃ®ne vide.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_ref_bg_type_code_parent
      ON ref_backgrounds (type, code, COALESCE(parent_code, ''))
  `)

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ref_background_skills â€” bonus de compÃ©tences par background
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  await knex.schema.createTable('ref_background_skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('background_id').notNullable()
      .references('id').inTable('ref_backgrounds').onDelete('CASCADE')
    table.text('skill_id').notNullable()
    table.integer('bonus').notNullable()
    table.boolean('conditional').defaultTo(false)
    table.text('choice_group')
    table.index(['background_id'])
  })

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ref_setbacks â€” Table des Revers
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  await knex.schema.createTable('ref_setbacks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.integer('roll').notNullable()
    table.text('description').notNullable()
    table.text('category').defaultTo('general')
    table.uuid('career_id').references('id').inTable('ref_careers').onDelete('CASCADE')
    table.check('roll BETWEEN 1 AND 100')
    table.index(['career_id'])
  })

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // char_creation_snapshot â€” sauvegarde pour rollback Step4 â†’ Step3
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  await knex.schema.createTable('char_creation_snapshot', (table) => {
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('step').notNullable()
    table.jsonb('snapshot').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.primary(['char_sheet_id', 'step'])
  })

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SEEDS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â”€â”€â”€ 4 origines gÃ©ographiques â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const [navire] = await knex('ref_backgrounds').insert({
    type: 'geo_origin', code: 'navire_nomade', name: 'Navire nomade', sort_order: 1
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: navire.id, skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
    { background_id: navire.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
    { background_id: navire.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', bonus: 1 },
    { background_id: navire.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 2 },
    { background_id: navire.id, skill_id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', bonus: 1 },
    { background_id: navire.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', bonus: 1 },
  ])

  const [petite] = await knex('ref_backgrounds').insert({
    type: 'geo_origin', code: 'petite_station', name: 'Petite station', sort_order: 2
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: petite.id, skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
    { background_id: petite.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
    { background_id: petite.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 2 },
    { background_id: petite.id, skill_id: 'AQUACULTURE_ELEVAGE', bonus: 2 },
    { background_id: petite.id, skill_id: 'ELECTRONIQUE', bonus: 1 },
  ])

  const [moyenne] = await knex('ref_backgrounds').insert({
    type: 'geo_origin', code: 'station_moyenne', name: 'Station de taille moyenne', sort_order: 3
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: moyenne.id, skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
    { background_id: moyenne.id, skill_id: 'BUREAUCRATIE', bonus: 1 },
    { background_id: moyenne.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
    { background_id: moyenne.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 1 },
    { background_id: moyenne.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: moyenne.id, skill_id: 'ELECTRONIQUE', bonus: 1 },
  ])

  const [grande] = await knex('ref_backgrounds').insert({
    type: 'geo_origin', code: 'grande_cite', name: 'Grande citÃ©', sort_order: 4
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: grande.id, skill_id: 'BUREAUCRATIE', bonus: 2 },
    { background_id: grande.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 3 },
    { background_id: grande.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
  ])

  // â”€â”€â”€ 4 origines sociales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const [basfonds] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'bas_fonds', name: 'Bas-fonds',
    parent_type: 'geo_origin', parent_code: 'grande_cite', sort_order: 1
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: basfonds.id, skill_id: 'INTIMIDATION', bonus: 1 },
    { background_id: basfonds.id, skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
    { background_id: basfonds.id, skill_id: 'COMBAT_ARME', bonus: 1 },
    { background_id: basfonds.id, skill_id: 'PICKPOCKET', bonus: 2 },
  ])

  const [ouvrier] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'milieu_ouvrier', name: 'Milieu ouvrier', sort_order: 2
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: ouvrier.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 1 },
    { background_id: ouvrier.id, skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
    { background_id: ouvrier.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
    { background_id: ouvrier.id, skill_id: 'AQUACULTURE_ELEVAGE', bonus: 2, conditional: true, choice_group: 'ouvrier_specialite' },
    { background_id: ouvrier.id, skill_id: 'MECANIQUE', bonus: 2, conditional: true, choice_group: 'ouvrier_specialite' },
  ])

  // BUG M4a FIX : deux entrÃ©es classes_moyennes (parents diffÃ©rents) â†’ stocker les deux ids
  const [classesMoy] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_moyennes', name: 'Classes moyennes',
    parent_type: 'geo_origin', parent_code: 'station_moyenne', sort_order: 3
  }).returning('id')
  const [cm2] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_moyennes', name: 'Classes moyennes',
    parent_type: 'geo_origin', parent_code: 'grande_cite', sort_order: 3
  }).returning('id')
  // MÃªme 3 skills pour les deux entrÃ©es â€” tous sans conditional/choice_group (clÃ©s homogÃ¨nes)
  await knex('ref_background_skills').insert([
    { background_id: classesMoy.id, skill_id: 'BUREAUCRATIE', bonus: 1 },
    { background_id: classesMoy.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: classesMoy.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
    { background_id: cm2.id,        skill_id: 'BUREAUCRATIE', bonus: 1 },
    { background_id: cm2.id,        skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: cm2.id,        skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
  ])

  const [classesSup] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_superieures', name: 'Classes supÃ©rieures',
    parent_type: 'geo_origin', parent_code: 'grande_cite', sort_order: 4
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: classesSup.id, skill_id: 'BUREAUCRATIE', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
    { background_id: classesSup.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
    { background_id: classesSup.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
  ])

  // â”€â”€â”€ 4 formations de base â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const [delinquance] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'delinquance', name: 'DÃ©linquance/CriminalitÃ©', sort_order: 1
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: delinquance.id, skill_id: 'INTIMIDATION', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'COMMERCE_TRAFIC__ARMES', bonus: 1, conditional: true, choice_group: 'commerce' },
    { background_id: delinquance.id, skill_id: 'COMMERCE_TRAFIC__DROGUES', bonus: 1, conditional: true, choice_group: 'commerce' },
    { background_id: delinquance.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: delinquance.id, skill_id: 'COMBAT_ARME', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'ARMES_DE_POING', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'CAMOUFLAGE_DISSIMULATION', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'PICKPOCKET', bonus: 1 },
    { background_id: delinquance.id, skill_id: 'SYSTEMES_DE_SECURITE', bonus: 1 },
  ])

  const [apprentissage] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'apprentissage_technique', name: 'Apprentissage technique', sort_order: 2
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: apprentissage.id, skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 1 },
    { background_id: apprentissage.id, skill_id: 'ARMES_SOUS_MARINES', bonus: 1, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'ANALYSES_SONSCANS', bonus: 1, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
    { background_id: apprentissage.id, skill_id: 'PILOTAGE__NAVIRES_LEGERS', bonus: 1, conditional: true, choice_group: 'pilotage_au_choix' },
    { background_id: apprentissage.id, skill_id: 'PILOTAGE__VEHICULES_DE_SOL', bonus: 1, conditional: true, choice_group: 'pilotage_au_choix' },
    { background_id: apprentissage.id, skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 1, conditional: true, choice_group: 'pilotage_au_choix' },
    { background_id: apprentissage.id, skill_id: 'CHASSE_PISTAGE', bonus: 1, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', bonus: 1, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'AQUACULTURE_ELEVAGE', bonus: 2, conditional: true, choice_group: 'aquaculture_only' },
    { background_id: apprentissage.id, skill_id: 'ARMES_LOURDES_CONTACT', bonus: 2, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', bonus: 2, conditional: true, choice_group: 'mines_or_usine' },
    { background_id: apprentissage.id, skill_id: 'PILOTAGE__VEHICULES_SOUTERRAINS', bonus: 1, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS', bonus: 2, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'SURVIE', bonus: 1, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'EXPLOSIFS', bonus: 1, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'MECANIQUE_VEHICULES_DE_SOL', bonus: 1, conditional: true, choice_group: 'mines_only' },
    { background_id: apprentissage.id, skill_id: 'BUREAUCRATIE', bonus: 1, conditional: true, choice_group: 'usine_only' },
    { background_id: apprentissage.id, skill_id: 'ELECTRONIQUE', bonus: 1, conditional: true, choice_group: 'usine_only' },
    { background_id: apprentissage.id, skill_id: 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE', bonus: 2, conditional: true, choice_group: 'mecanique_usine' },
    { background_id: apprentissage.id, skill_id: 'MECANIQUE', bonus: 2, conditional: true, choice_group: 'mecanique_usine' },
  ])

  // BUG M4b FIX : deux entrÃ©es education_scolaire (parents diffÃ©rents) â†’ stocker les deux ids
  const [scolaire] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'education_scolaire', name: 'Ã‰ducation scolaire',
    parent_type: 'social_origin', parent_code: 'classes_moyennes', sort_order: 3
  }).returning('id')
  const [scolaire2] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'education_scolaire', name: 'Ã‰ducation scolaire',
    parent_type: 'social_origin', parent_code: 'classes_superieures', sort_order: 4
  }).returning('id')
  // Insert sÃ©parÃ© par background_id pour Ã©viter ambiguÃ¯tÃ© sur les clÃ©s mixtes (conditional prÃ©sent/absent)
  await knex('ref_background_skills').insert([
    { background_id: scolaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: scolaire.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 4 },
    { background_id: scolaire.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
    { background_id: scolaire.id, skill_id: 'INFORMATIQUE', bonus: 1 },
  ])
  // M4b FIX : mÃªmes 6 skills pour scolaire2 (classes_superieures)
  await knex('ref_background_skills').insert([
    { background_id: scolaire2.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: scolaire2.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 4 },
    { background_id: scolaire2.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire2.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire2.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
    { background_id: scolaire2.id, skill_id: 'INFORMATIQUE', bonus: 1 },
  ])

  // Autodidacte â€” pas de skills fixes, 7 points libres gÃ©rÃ©s cÃ´tÃ© UI
  await knex('ref_backgrounds').insert({
    type: 'training', code: 'autodidacte', name: 'Autodidacte', sort_order: 5
  })

  // â”€â”€â”€ 8 filiÃ¨res d'Ã©tudes supÃ©rieures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filieres = [
    {
      code: 'commerce_gestion', name: 'Commerce/Gestion',
      skills: [
        { skill_id: 'BUREAUCRATIE', bonus: 3 },
        { skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', bonus: 2, conditional: true, choice_group: 'commerce_specialite' },
        { skill_id: 'COMMERCE_TRAFIC__VEHICULES', bonus: 2, conditional: true, choice_group: 'commerce_specialite' },
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 1 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', bonus: 2, conditional: true, choice_group: 'gestion_specialite' },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE', bonus: 2, conditional: true, choice_group: 'gestion_specialite' },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 3, conditional: true },
      ]
    },
    {
      code: 'droit', name: 'Droit',
      skills: [
        { skill_id: 'ELOQUENCE_PERSUASION', bonus: 1 },
        { skill_id: 'BUREAUCRATIE', bonus: 3 },
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', bonus: 3 },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
      ]
    },
    {
      code: 'ecole_ingenieurs', name: "Ã‰cole d'ingÃ©nieurs",
      skills: [
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
        { skill_id: 'GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL', bonus: 3, conditional: true, choice_group: 'genie_specialite' },
        { skill_id: 'GENIE_TECHNIQUE_ARCHITECTURE_NAVALE', bonus: 3, conditional: true, choice_group: 'genie_specialite' },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
        { skill_id: 'ELECTRONIQUE', bonus: 2 },
        { skill_id: 'INFORMATIQUE', bonus: 2 },
        { skill_id: 'MECANIQUE', bonus: 2, conditional: true },
      ]
    },
    {
      code: 'ecole_militaire', name: 'Ã‰cole militaire',
      skills: [
        { skill_id: 'COMMANDEMENT', bonus: 3 },
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'ARMES_DE_POING', bonus: 2, conditional: true, choice_group: 'arme_militaire' },
        { skill_id: 'FUSIL_ARMES_DEPAULES', bonus: 2, conditional: true, choice_group: 'arme_militaire' },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
        { skill_id: 'STRATEGIE', bonus: 1 },
        { skill_id: 'TACTIQUE_COMBAT_TERRESTRE', bonus: 2, conditional: true },
      ]
    },
    {
      code: 'ecole_navale', name: 'Ã‰cole navale',
      skills: [
        { skill_id: 'COMMANDEMENT', bonus: 1 },
        { skill_id: 'CARTOGRAPHIE', bonus: 2 },
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'NAVIGATION', bonus: 2 },
        { skill_id: 'ANALYSES_SONSCANS', bonus: 1 },
        { skill_id: 'PILOTAGE__NAVIRES_LEGERS', bonus: 2 },
        { skill_id: 'PILOTAGE__NAVIRES_LOURDS', bonus: 1 },
        { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', bonus: 1 },
      ]
    },
    {
      code: 'medecine', name: 'MÃ©decine',
      skills: [
        { skill_id: 'ANALYSE_EMPATHIQUE', bonus: 1 },
        { skill_id: 'BUREAUCRATIE', bonus: 1 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', bonus: 3 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', bonus: 1 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', bonus: 3 },
        { skill_id: 'PREMIER_SOINS', bonus: 3 },
      ]
    },
    {
      code: 'sciences', name: 'Sciences/Sciences humaines',
      skills: [
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 1 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
        { skill_id: 'INFORMATIQUE', bonus: 2 },
      ]
    },
    {
      code: 'sciences_politiques', name: 'Sciences politiques',
      skills: [
        { skill_id: 'BUREAUCRATIE', bonus: 1 },
        { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 3 },
        { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', bonus: 2 },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', bonus: 1, conditional: true, choice_group: 'politiques_specialite' },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 1, conditional: true, choice_group: 'politiques_specialite' },
        { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 1 },
        { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
      ]
    },
  ]

  for (const fil of filieres) {
    const [row] = await knex('ref_backgrounds').insert({
      type: 'higher_ed',
      code: fil.code,
      name: fil.name,
      pc_cost: 1,
      years_added: 2,
      parent_type: 'training',
      parent_code: 'education_scolaire',
    }).returning('id')
    for (const sk of fil.skills) {
      await knex('ref_background_skills').insert({
        background_id: row.id,
        skill_id: sk.skill_id,
        bonus: sk.bonus,
        conditional: sk.conditional || false,
        choice_group: sk.choice_group || null,
      })
    }
  }

  // â”€â”€â”€ Seed ref_setbacks (5 revers gÃ©nÃ©raux) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // [DETTE-ETAPE4-5] Table partielle â€” ~50 revers attendus selon LdB p.185+
  await knex('ref_setbacks').insert([
    { roll: 1, description: "Perte d'emploi : le personnage perd son travail. L'annÃ©e suivante ne donne que 5 pts de CompÃ©tence et 3 pts d'Avantages pro.", category: 'general' },
    { roll: 2, description: 'Blessure grave : le personnage garde une cicatrice ou un handicap permanent. -1 FOR ou CON (au choix).', category: 'general' },
    { roll: 3, description: "Dette : le personnage contracte une dette Ã©quivalente Ã  1 annÃ©e de salaire.", category: 'general' },
    { roll: 4, description: 'Ennemi : le personnage se fait un ennemi influent.', category: 'general' },
    { roll: 5, description: 'ProblÃ¨me judiciaire : le personnage est inquiÃ©tÃ© par les autoritÃ©s locales.', category: 'general' },
  ])
}

export const down = async (knex) => {
  // Ordre inverse des dÃ©pendances (index sur ref_backgrounds supprimÃ© automatiquement avec la table)
  await knex.schema.dropTableIfExists('char_creation_snapshot')
  await knex.schema.dropTableIfExists('ref_setbacks')
  await knex.schema.dropTableIfExists('ref_background_skills')
  await knex.schema.dropTableIfExists('ref_backgrounds')
}
