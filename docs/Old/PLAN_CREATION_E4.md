> Statut : ⚠️ ARCHITECTURE API OBSOLÈTE — routes step-by-step remplacées par `reconcileCreation`.
> `ref_backgrounds`/`ref_setbacks` existent mais créées par des migrations bien plus tardives (98,
> 126) que celle proposée ici. Le mécanisme de rollback par snapshot (`char_creation_snapshot`)
> n'a jamais été construit. Détail : `docs/JOURNAL6.md` "Session 149".
> Archivé dans `docs/Old/` — Session 149

SOMMAIRE

    Architecture données

    API Routes

    Services

    Fonctions partagées

    Composant UI

    Intégration Wizard

    i18n

    Fichiers touchés

    Scénarios de test

    Dettes documentées

1. ARCHITECTURE DONNÉES
1.1 Migration 097 — 097_ref_backgrounds.cjs
js

export const up = async (knex) => {

  // ════════════════════════════════════════════════════════════
  // ref_backgrounds — origines, formations, études supérieures
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('ref_backgrounds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.text('type').notNullable()       // 'geo_origin' | 'social_origin' | 'training' | 'higher_ed'
    table.text('code').notNullable()       // identifiant unique par type
    table.text('name').notNullable()       // nom affiché
    table.text('description')              // texte informatif
    table.text('parent_type')              // type du parent pour filtrage
    table.text('parent_code')              // code du parent (null = disponible partout)
    table.integer('pc_cost').defaultTo(0)  // pour études supérieures
    table.integer('years_added').defaultTo(0) // pour études supérieures
    table.integer('sort_order')
    table.unique(['type', 'code', knex.raw('COALESCE(parent_code, \'\'::text)')])
  })

  // ════════════════════════════════════════════════════════════
  // ref_background_skills — bonus de compétences par background
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('ref_background_skills', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('background_id').notNullable()
      .references('id').inTable('ref_backgrounds').onDelete('CASCADE')
    table.text('skill_id').notNullable()
    table.integer('bonus').notNullable()
    table.boolean('conditional').defaultTo(false)
    table.text('choice_group')             // groupe pour choix exclusifs
    table.index(['background_id'])
  })

  // ════════════════════════════════════════════════════════════
  // ref_setbacks — Table des Revers
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('ref_setbacks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.integer('roll').notNullable()
    table.text('description').notNullable()
    table.text('category').defaultTo('general')
    table.uuid('career_id').references('id').inTable('ref_careers').onDelete('CASCADE')
    table.check('roll BETWEEN 1 AND 100')
    table.index(['career_id'])
  })

  // ════════════════════════════════════════════════════════════
  // char_creation_snapshot — sauvegarde pour rollback
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_creation_snapshot', (table) => {
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('step').notNullable()
    table.jsonb('snapshot').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.primary(['char_sheet_id', 'step'])
  })

  // ════════════════════════════════════════════════════════════
  // SEED — ref_backgrounds + ref_background_skills
  // ════════════════════════════════════════════════════════════

  // --- 4 origines géographiques ---

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
    type: 'geo_origin', code: 'grande_cite', name: 'Grande cité', sort_order: 4
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: grande.id, skill_id: 'BUREAUCRATIE', bonus: 2 },
    { background_id: grande.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 3 },
    { background_id: grande.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
  ])

  // --- 4 origines sociales ---

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

  const [classesMoy] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_moyennes', name: 'Classes moyennes',
    parent_type: 'geo_origin', parent_code: 'station_moyenne', sort_order: 3
  }).returning('id')
  await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_moyennes', name: 'Classes moyennes',
    parent_type: 'geo_origin', parent_code: 'grande_cite', sort_order: 3
  })
  await knex('ref_background_skills').insert([
    { background_id: classesMoy.id, skill_id: 'BUREAUCRATIE', bonus: 1 },
    { background_id: classesMoy.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: classesMoy.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
  ])

  const [classesSup] = await knex('ref_backgrounds').insert({
    type: 'social_origin', code: 'classes_superieures', name: 'Classes supérieures',
    parent_type: 'geo_origin', parent_code: 'grande_cite', sort_order: 4
  }).returning('id')
  await knex('ref_background_skills').insert([
    { background_id: classesSup.id, skill_id: 'BUREAUCRATIE', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
    { background_id: classesSup.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
    { background_id: classesSup.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
  ])

  // --- 4 formations de base ---

  const [delinquance] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'delinquance', name: 'Délinquance/Criminalité', sort_order: 1
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
  // Spécialités regroupées en choice_groups
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

  const [scolaire] = await knex('ref_backgrounds').insert({
    type: 'training', code: 'education_scolaire', name: 'Éducation scolaire',
    parent_type: 'social_origin', parent_code: 'classes_moyennes', sort_order: 3
  }).returning('id')
  await knex('ref_backgrounds').insert({
    type: 'training', code: 'education_scolaire', name: 'Éducation scolaire',
    parent_type: 'social_origin', parent_code: 'classes_superieures', sort_order: 4
  })
  await knex('ref_background_skills').insert([
    { background_id: scolaire.id, skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
    { background_id: scolaire.id, skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 4 },
    { background_id: scolaire.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire.id, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
    { background_id: scolaire.id, skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
    { background_id: scolaire.id, skill_id: 'INFORMATIQUE', bonus: 1 },
  ])

  await knex('ref_backgrounds').insert({
    type: 'training', code: 'autodidacte', name: 'Autodidacte', sort_order: 5
  })
  // Autodidacte : pas de skills fixes, 7 points libres (géré côté UI)

  // --- 9 filières d'études supérieures ---
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
      code: 'ecole_ingenieurs', name: 'École d\'ingénieurs',
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
      code: 'ecole_militaire', name: 'École militaire',
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
      code: 'ecole_navale', name: 'École navale',
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
      code: 'medecine', name: 'Médecine',
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
      parent_code: 'education_scolaire'
    }).returning('id')
    for (const sk of fil.skills) {
      await knex('ref_background_skills').insert({
        background_id: row.id,
        skill_id: sk.skill_id,
        bonus: sk.bonus,
        conditional: sk.conditional || false,
        choice_group: sk.choice_group || null
      })
    }
  }

  // --- Seed ref_setbacks (général) ---
  await knex('ref_setbacks').insert([
    { roll: 1, description: 'Perte d\'emploi : le personnage perd son travail. L\'année suivante ne donne que 5 pts de Compétence et 3 pts d\'Avantages pro.', category: 'general' },
    { roll: 2, description: 'Blessure grave : le personnage garde une cicatrice ou un handicap permanent. -1 FOR ou CON (au choix).', category: 'general' },
    { roll: 3, description: 'Dette : le personnage contracte une dette équivalente à 1 année de salaire.', category: 'general' },
    { roll: 4, description: 'Ennemi : le personnage se fait un ennemi influent.', category: 'general' },
    { roll: 5, description: 'Problème judiciaire : le personnage est inquiété par les autorités locales.', category: 'general' },
  ])
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_creation_snapshot')
  await knex.schema.dropTableIfExists('ref_setbacks')
  await knex.schema.dropTableIfExists('ref_background_skills')
  await knex.schema.dropTableIfExists('ref_backgrounds')
}

1.2 Tables existantes — rappel
Table	Colonnes utilisées
char_careers	id, char_sheet_id, career_id, years, savings, pro_advantages, random_picks, setbacks
char_skills	char_sheet_id, skill_id, mastery, is_learned
char_archetype	origin_geo, origin_soc, training_base, higher_ed, age
char_attributes	base_level, pc_modifier
char_pc_ledger	pc_spent_step4
char_sheet	creation_state
1.3 State machine
text

draft_step3 → draft_step4  (validation)
draft_step4 → draft_step3  (rollback avec snapshot)

2. API ROUTES
2.1 server/src/routes/creation.js — ajouts
js

// GET /step4/:sheetId — Données pour l'étape 4 + création snapshot
router.get('/step4/:sheetId', async (req, res) => {
  try {
    const data = await creationService.getStep4Data(req.params.sheetId)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /step4/:sheetId — Validation + persistance
router.post('/step4/:sheetId', async (req, res) => {
  try {
    const result = await creationService.validateAndPersistStep4(req.params.sheetId, req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /step4/:sheetId/random-background — Tirage aléatoire origines/formation
router.post('/step4/:sheetId/random-background', async (req, res) => {
  try {
    const { type, parentCode } = req.body
    const result = await creationService.getRandomBackground(req.params.sheetId, type, parentCode)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /rollback-to-step3/:sheetId — Retour à l'étape 3
router.post('/rollback-to-step3/:sheetId', async (req, res) => {
  try {
    const result = await creationService.rollbackToStep3(req.params.sheetId)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

3. SERVICES
3.1 server/src/services/creationService.js — ajouts
js

import { calcSkillCost, getMaxMasteryByYears, getAgeEffects, evaluateSalaryFormula } from '../../../shared/polarisUtils.js'

// ══════════════════════════════════════════════════════════════
// HELPERS DE VALIDATION
// ══════════════════════════════════════════════════════════════

async function validateCareerPrerequisites(sheetId, careerId, trx) {
  const prereqs = await trx('ref_career_prerequisites').where({ career_id: careerId })
  if (prereqs.length === 0) return { valide: true }

  const existingCareers = await trx('char_careers').where({ char_sheet_id: sheetId })

  for (const prereq of prereqs) {
    const match = existingCareers.find(c => c.career_id === prereq.prerequisite_career_id)
    if (!match || match.years < prereq.min_years) {
      const prereqCareer = await trx('ref_careers').where({ id: prereq.prerequisite_career_id }).first()
      return { valide: false, erreur: `Nécessite ${prereq.min_years} an(s) en tant que ${prereqCareer.name}` }
    }
  }
  return { valide: true }
}

async function validateCareerGenotype(sheetId, careerId, trx) {
  const career = await trx('ref_careers').where({ id: careerId }).first()
  if (!career.required_genotype) return { valide: true }

  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  if (archetype.genotype_id !== career.required_genotype) {
    const genotype = await trx('ref_genotypes').where({ id: career.required_genotype }).first()
    return { valide: false, erreur: `Cette profession nécessite le type génétique : ${genotype.label}` }
  }
  return { valide: true }
}

async function validateCareerAttributes(sheetId, careerId, trx) {
  const career = await trx('ref_careers').where({ id: careerId }).first()
  const attributes = await trx('char_attributes').where({ char_sheet_id: sheetId })
  const attrs = {}
  for (const a of attributes) attrs[a.attr_id] = a.base_level + a.pc_modifier

  const attrNames = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']
  const failed = []

  for (const attr of attrNames) {
    const min = career[`min_${attr.toLowerCase()}`]
    if (min !== null && attrs[attr] < min) {
      failed.push(`${attr} ${attrs[attr]}/${min}`)
    }
  }

  if (failed.length > 0) {
    return { valide: false, erreur: `Attributs insuffisants : ${failed.join(', ')}` }
  }
  return { valide: true }
}

async function validateCareerEducation(sheetId, careerId, trx) {
  const educationReqs = await trx('ref_career_education').where({ career_id: careerId })
  if (educationReqs.length === 0) return { valide: true }

  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  if (!archetype.higher_ed) {
    const fields = educationReqs.map(e => e.field).join(' ou ')
    return { valide: false, erreur: `Cette profession nécessite des études supérieures : ${fields}` }
  }

  const higherEd = await trx('ref_backgrounds').where({ type: 'higher_ed', code: archetype.higher_ed }).first()
  const fieldMatch = educationReqs.some(e => e.field === higherEd.code)
  if (!fieldMatch) {
    const fields = educationReqs.map(e => e.field).join(' ou ')
    return { valide: false, erreur: `Cette profession nécessite les études : ${fields}` }
  }
  return { valide: true }
}

async function createSnapshot(sheetId, trx) {
  const skills = await trx('char_skills').where({ char_sheet_id: sheetId })
  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  const attributes = await trx('char_attributes').where({ char_sheet_id: sheetId })

  const snapshot = {
    skills: {},
    archetype: {
      age: archetype.age,
      origin_geo: archetype.origin_geo,
      origin_soc: archetype.origin_soc,
      training_base: archetype.training_base,
      higher_ed: archetype.higher_ed,
    },
    attributes: {},
  }
  for (const s of skills) {
    snapshot.skills[s.skill_id] = { mastery: s.mastery, is_learned: s.is_learned }
  }
  for (const a of attributes) {
    snapshot.attributes[a.attr_id] = { pc_modifier: a.pc_modifier }
  }

  await trx('char_creation_snapshot')
    .insert({ char_sheet_id: sheetId, step: 'step4_before', snapshot: JSON.stringify(snapshot) })
    .onConflict(['char_sheet_id', 'step'])
    .merge(['snapshot', 'created_at'])
}

async function restoreSnapshot(sheetId, trx) {
  const row = await trx('char_creation_snapshot').where({ char_sheet_id: sheetId, step: 'step4_before' }).first()
  if (!row) throw { status: 500, message: 'Snapshot introuvable — rollback impossible.' }

  const snap = row.snapshot

  // Restore skills
  for (const [skillId, data] of Object.entries(snap.skills)) {
    await trx('char_skills')
      .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: data.mastery, is_learned: data.is_learned })
      .onConflict(['char_sheet_id', 'skill_id'])
      .merge(['mastery', 'is_learned'])
  }

  // Restore archetype
  await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
    age: snap.archetype.age,
    origin_geo: snap.archetype.origin_geo,
    origin_soc: snap.archetype.origin_soc,
    training_base: snap.archetype.training_base,
    higher_ed: snap.archetype.higher_ed,
  })

  // Restore attributes pc_modifier
  for (const [attrId, data] of Object.entries(snap.attributes)) {
    await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: attrId }).update({ pc_modifier: data.pc_modifier })
  }

  // Cleanup
  await trx('char_creation_snapshot').where({ char_sheet_id: sheetId, step: 'step4_before' }).del()
}

// ══════════════════════════════════════════════════════════════
// ÉTAPE 4 : EXPÉRIENCE PRÉLIMINAIRE
// ══════════════════════════════════════════════════════════════

export async function getStep4Data(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step3') {
    throw { status: 400, message: 'Wizard non disponible pour cette étape.' }
  }

  const trx = await db.transaction()
  try {
    // Créer snapshot avant toute modification
    await createSnapshot(sheetId, trx)
    await trx.commit()
  } catch (err) {
    await trx.rollback()
    throw err
  }

  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
  const archetype = await db('char_archetype').where({ char_sheet_id: sheetId }).first()
  const attributes = await db('char_attributes').where({ char_sheet_id: sheetId })
  const currentSkills = await db('char_skills').where({ char_sheet_id: sheetId })
  const existingCareers = await db('char_careers').where({ char_sheet_id: sheetId })

  const availablePC = ledger.pc_total
    - ledger.pc_spent_step1
    - ledger.pc_spent_step2
    - ledger.pc_spent_step3
    + ledger.pc_gained_desavantages

  // Charger backgrounds
  const geoOrigins = await db('ref_backgrounds').where({ type: 'geo_origin' }).orderBy('sort_order')

  // Charger professions avec données liées
  const careers = await db('ref_careers').select('*').orderBy('name')
  for (const career of careers) {
    career.skills = await db('ref_career_skills').where({ career_id: career.id })
    career.titles = await db('ref_career_titles').where({ career_id: career.id }).orderBy('min_years')
    career.education = await db('ref_career_education').where({ career_id: career.id })
    career.prerequisites = await db('ref_career_prerequisites').where({ career_id: career.id })
    career.pointCategories = await db('ref_career_point_categories').where({ career_id: career.id }).orderBy('sort_order')
  }

  const rules = await db('campaign_rules').where({ campaign_id: sheet.campaign_id }).first()

  // Attributs formatés
  const attrs = {}
  for (const a of attributes) attrs[a.attr_id] = a.base_level + a.pc_modifier

  // Skills formatés
  const skills = {}
  for (const s of currentSkills) skills[s.skill_id] = { mastery: s.mastery, is_learned: s.is_learned }

  return {
    availablePC,
    geoOrigins,
    currentAge: archetype.age || 16,
    currentGeoOrigin: archetype.origin_geo,
    currentSocOrigin: archetype.origin_soc,
    currentTraining: archetype.training_base,
    currentHigherEd: archetype.higher_ed,
    currentSkills: skills,
    currentAttributes: attrs,
    careers,
    existingCareers,
    rules: {
      optionNiveauMax: rules?.option_niveau_max_competences || false,
      optionPersonnagesExperimentes: rules?.option_personnages_experimentes || false,
      optionPersonnagesJeunes: rules?.option_personnages_jeunes || false,
      optionAvantagesProAleatoires: rules?.option_avantages_pro_aleatoires || false,
    },
  }
}

export async function getRandomBackground(sheetId, type, parentCode) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step3') {
    throw { status: 400, message: 'Étape non accessible.' }
  }

  let query = db('ref_backgrounds').where({ type })
  if (parentCode !== undefined) {
    query = query.where(function() {
      this.where({ parent_code: parentCode }).orWhereNull('parent_code')
    })
  }

  const backgrounds = await query.orderBy('sort_order')
  if (backgrounds.length === 0) {
    throw { status: 404, message: 'Aucun background disponible.' }
  }

  const index = Math.floor(Math.random() * backgrounds.length)
  const selected = backgrounds[index]

  const skills = await db('ref_background_skills').where({ background_id: selected.id })

  return { background: selected, skills }
}

export async function validateAndPersistStep4(sheetId, data) {
  const { age, originGeo, originSoc, training, higherEd, careers: careersData } = data

  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step3') {
    throw { status: 400, message: 'Étape non accessible.' }
  }

  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
  let availablePC = ledger.pc_total
    - ledger.pc_spent_step1
    - ledger.pc_spent_step2
    - ledger.pc_spent_step3
    + ledger.pc_gained_desavantages

  // Calcul coût total PC
  let totalPC = 0
  for (const career of careersData) {
    totalPC += career.years
  }
  if (higherEd) {
    const ed = await db('ref_backgrounds').where({ type: 'higher_ed', code: higherEd }).first()
    if (ed) totalPC += ed.pc_cost
  }

  if (availablePC < totalPC) {
    throw { status: 400, message: `PC insuffisants : ${totalPC} requis, ${availablePC} disponibles.` }
  }

  const trx = await db.transaction()

  try {
    // 1. Mettre à jour char_archetype
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
      age,
      origin_geo: originGeo,
      origin_soc: originSoc,
      training_base: training,
      higher_ed: higherEd,
    })

    // 2. Appliquer bonus de skills des origines/formation/études
    const bgCodes = [originGeo, originSoc, training, higherEd].filter(Boolean)
    if (bgCodes.length > 0) {
      const backgrounds = await trx('ref_backgrounds').whereIn('code', bgCodes)
      const bgIds = backgrounds.map(b => b.id)
      const bgSkills = await trx('ref_background_skills').whereIn('background_id', bgIds)

      for (const bgs of bgSkills) {
        // Appliquer uniquement si non conditionnel OU si le joueur l'a choisi (présent dans data.appliedSkills)
        const isApplied = !bgs.conditional || (data.appliedSkills || []).includes(bgs.skill_id)
        if (!isApplied) continue

        const existing = await trx('char_skills').where({ char_sheet_id: sheetId, skill_id: bgs.skill_id }).first()
        if (existing) {
          await trx('char_skills').where({ char_sheet_id: sheetId, skill_id: bgs.skill_id })
            .update({ mastery: existing.mastery + bgs.bonus })
        } else {
          await trx('char_skills').insert({
            char_sheet_id: sheetId,
            skill_id: bgs.skill_id,
            mastery: bgs.bonus,
            is_learned: false
          })
        }
      }
    }

    // 3. Traiter les carrières
    let totalSavings = 0
    for (const career of careersData) {
      // Validations
      const prereqCheck = await validateCareerPrerequisites(sheetId, career.career_id, trx)
      if (!prereqCheck.valide) {
        await trx.rollback()
        throw { status: 400, message: prereqCheck.erreur }
      }
      const genotypeCheck = await validateCareerGenotype(sheetId, career.career_id, trx)
      if (!genotypeCheck.valide) {
        await trx.rollback()
        throw { status: 400, message: genotypeCheck.erreur }
      }
      const attrCheck = await validateCareerAttributes(sheetId, career.career_id, trx)
      if (!attrCheck.valide) {
        await trx.rollback()
        throw { status: 400, message: attrCheck.erreur }
      }
      const eduCheck = await validateCareerEducation(sheetId, career.career_id, trx)
      if (!eduCheck.valide) {
        await trx.rollback()
        throw { status: 400, message: eduCheck.erreur }
      }

      // Salaire
      const titles = await trx('ref_career_titles').where({ career_id: career.career_id }).orderBy('min_years')
      const title = titles.find(t =>
        career.years >= t.min_years && (t.max_years === null || career.years <= t.max_years)
      )
      let salary = 0
      if (title) {
        if (title.salary_per_year) {
          salary = title.salary_per_year
        } else if (title.salary_formula) {
          // [DETTE-ETAPE4-1] salary_formula : évaluation serveur
          salary = evaluateSalaryFormula(title.salary_formula)
        }
      }
      const savings = salary * career.years
      totalSavings += savings

      // Insert carrière
      await trx('char_careers').insert({
        char_sheet_id: sheetId,
        career_id: career.career_id,
        years: career.years,
        savings,
        pro_advantages: career.proAdvantages || {},
        random_picks: career.randomPicks || null,
        setbacks: career.setbacks || null,
      })

      // Appliquer allocations de compétences
      for (const [skillId, targetMastery] of Object.entries(career.skillAllocations || {})) {
        const existing = await trx('char_skills').where({ char_sheet_id: sheetId, skill_id: skillId }).first()
        const isLearned = career.openedSkills?.includes(skillId) ? true : (existing?.is_learned || false)

        if (existing) {
          await trx('char_skills').where({ char_sheet_id: sheetId, skill_id: skillId })
            .update({ mastery: targetMastery, is_learned: isLearned })
        } else {
          await trx('char_skills').insert({
            char_sheet_id: sheetId,
            skill_id: skillId,
            mastery: targetMastery,
            is_learned: isLearned
          })
        }
      }
    }

    // 4. Effets de l'âge sur Attributs
    const ageEffects = getAgeEffects(age)
    for (const [attrId, malus] of Object.entries(ageEffects)) {
      await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: attrId })
        .increment('pc_modifier', malus)
    }

    // 5. Effets personnage très jeune (optionnel)
    const rules = await trx('campaign_rules').where({ campaign_id: sheet.campaign_id }).first()
    if (rules?.option_personnages_jeunes) {
      if (age >= 16 && age <= 17) {
        await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: 'FOR' }).increment('pc_modifier', -3)
        await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: 'PRE' }).increment('pc_modifier', -2)
      } else if (age === 18) {
        await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: 'FOR' }).increment('pc_modifier', -2)
        await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: 'PRE' }).increment('pc_modifier', -1)
      } else if (age === 19) {
        await trx('char_attributes').where({ char_sheet_id: sheetId, attr_id: 'FOR' }).increment('pc_modifier', -1)
      }
    }

    // 6. Finalisation
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: totalPC })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step4' })

    // Nettoyer le snapshot
    await trx('char_creation_snapshot').where({ char_sheet_id: sheetId, step: 'step4_before' }).del()

    await trx.commit()

    availablePC = availablePC - totalPC
    return { success: true, availablePC, totalSavings }
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

export async function rollbackToStep3(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || !['draft_step3', 'draft_step4'].includes(sheet.creation_state)) {
    throw { status: 400, message: 'Rollback non disponible.' }
  }

  const trx = await db.transaction()

  try {
    // Restaurer depuis snapshot
    await restoreSnapshot(sheetId, trx)

    // Supprimer les carrières
    await trx('char_careers').where({ char_sheet_id: sheetId }).del()

    // Reset ledger
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: 0 })

    // Reset state
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    await trx.commit()

    const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
    const availablePC = ledger.pc_total
      - ledger.pc_spent_step1
      - ledger.pc_spent_step2
      - ledger.pc_spent_step3
      + ledger.pc_gained_desavantages

    return { success: true, availablePC }
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

4. FONCTIONS PARTAGÉES
4.1 shared/polarisUtils.js — ajouts
js

/**
 * Calcule le coût en points pour atteindre un niveau de maîtrise cible.
 * @param {string} skillId — ID de la compétence
 * @param {number|null} currentMastery — niveau actuel (null si jamais apprise)
 * @param {number} targetMastery — niveau visé
 * @param {boolean} isPro — true = compétence professionnelle (coût normal)
 * @param {boolean} isLearned — true si compétence réservée déjà ouverte
 * @param {object[]} refSkills — liste des compétences de référence (pour markers)
 * @returns {{ cost: number, erreur?: string }}
 */
export function calcSkillCost(skillId, currentMastery, targetMastery, isPro, isLearned, refSkills) {
  const skill = refSkills.find(s => s.id === skillId)
  const marker = skill?.marker

  // Compétence réservée non apprise
  if (marker === '(X)' && !isLearned && targetMastery > 0) {
    return { cost: Infinity, erreur: 'Compétence réservée — payer 1 pt pour débloquer (niveau -3)' }
  }

  // Progression Naturelle : gratuit jusqu'à +5
  if (marker === 'PN' && targetMastery <= 5) {
    return { cost: 0 }
  }

  let cost = 0
  let current = currentMastery ?? null

  // Si réservée jamais apprise, le joueur doit d'abord l'ouvrir
  if (marker === '(X)' && current === null && targetMastery >= -3) {
    cost += 1  // 1 pt pour ouvrir
    current = -3
  }

  // Si le joueur ne veut que débloquer sans monter
  if (current === -3 && targetMastery === -3) {
    return { cost }
  }

  // Progression de current+1 à targetMastery
  for (let level = current + 1; level <= targetMastery; level++) {
    if (level <= 0) cost += 1
    else if (level <= 5) cost += 1
    else if (level <= 10) cost += 2
    else if (level === 11) cost += 3
    else if (level === 12) cost += 5
    else if (level === 13) cost += 7
    else cost += (level - 11) * 2
  }

  if (!isPro) cost *= 2
  return { cost }
}

/**
 * Niveau de maîtrise maximum par années d'expérience dans la profession.
 */
export function getMaxMasteryByYears(years) {
  if (years >= 21) return 15
  if (years >= 11) return 13
  if (years >= 6) return 10
  if (years >= 3) return 7
  if (years >= 2) return 5
  return 3
}

/**
 * Effets de l'âge sur les Attributs (malus cumulatifs).
 */
export function getAgeEffects(age) {
  const effects = {}
  if (age >= 45) { effects.FOR = -1; effects.CON = -1; effects.COO = -1; effects.ADA = -1; effects.PER = -1 }
  else if (age >= 41) { effects.FOR = -1; effects.CON = -1; effects.COO = -1; effects.ADA = -1; effects.PER = -1 }
  else if (age >= 36) { effects.FOR = -1; effects.CON = -1 }
  else if (age >= 30) { effects.FOR = -1 }
  // Note : règles LdB — choix parmi les attributs listés. MVP : premier(s) de la liste.
  return effects
}

/**
 * Évalue une formule de salaire (ex: '1D100*20').
 * [DETTE-ETAPE4-1] Support basique — uniquement format XdY*Z.
 */
export function evaluateSalaryFormula(formula) {
  if (!formula) return 0
  const match = formula.match(/^(\d+)D(\d+)\*(\d+)$/)
  if (!match) return 0
  const [, diceCount, diceFaces, multiplier] = match
  let total = 0
  for (let i = 0; i < parseInt(diceCount); i++) {
    total += Math.floor(Math.random() * parseInt(diceFaces)) + 1
  }
  return total * parseInt(multiplier)
}

5. COMPOSANT UI
5.1 client/src/components/creation/Step4Experience.jsx
jsx

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api.js'

// Constantes locales
const SUB_STEPS = {
  AGE: 'age',
  GEO_ORIGIN: 'geo_origin',
  SOCIAL_ORIGIN: 'social_origin',
  TRAINING: 'training',
  HIGHER_ED: 'higher_ed',
  CAREERS: 'careers',
  SUMMARY: 'summary',
}

export default function Step4Experience({ sheetId, availablePC: initialPC, onNext, onPrev }) {
  const { t } = useTranslation()

  // ─── État ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [subStep, setSubStep] = useState(SUB_STEPS.AGE)

  // Données chargées
  const [geoOrigins, setGeoOrigins] = useState([])
  const [careersList, setCareersList] = useState([])
  const [existingCareers, setExistingCareers] = useState([])
  const [currentSkills, setCurrentSkills] = useState({})
  const [currentAttributes, setCurrentAttributes] = useState({})
  const [refSkills, setRefSkills] = useState([])  // Chargé séparément
  const [rules, setRules] = useState({})

  // Choix du joueur
  const [age, setAge] = useState(16)
  const [originGeo, setOriginGeo] = useState(null)
  const [originSoc, setOriginSoc] = useState(null)
  const [training, setTraining] = useState(null)
  const [higherEd, setHigherEd] = useState(null)
  const [careers, setCareers] = useState([])
  const [availablePC, setAvailablePC] = useState(initialPC)

  // Données dérivées
  const [socialOrigins, setSocialOrigins] = useState([])
  const [trainings, setTrainings] = useState([])
  const [higherEds, setHigherEds] = useState([])
  const [previewSkills, setPreviewSkills] = useState({})

  // ─── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [step4Res, skillsRes] = await Promise.all([
          api.get(`/creation/step4/${sheetId}`),
          api.get('/char-ref/skills'),
        ])
        const data = step4Res.data
        setGeoOrigins(data.geoOrigins || [])
        setCareersList(data.careers || [])
        setExistingCareers(data.existingCareers || [])
        setCurrentSkills(data.currentSkills || {})
        setCurrentAttributes(data.currentAttributes || {})
        setRules(data.rules || {})
        setAvailablePC(data.availablePC)
        setRefSkills(skillsRes.data || [])

        if (data.currentAge) setAge(data.currentAge)
        if (data.currentGeoOrigin) {
          setOriginGeo(data.currentGeoOrigin)
          loadSocialOrigins(data.currentGeoOrigin)
        }
        if (data.currentSocOrigin) {
          setOriginSoc(data.currentSocOrigin)
          loadTrainings(data.currentSocOrigin)
        }
        if (data.currentTraining) {
          setTraining(data.currentTraining)
          loadHigherEds()
        }
        if (data.currentHigherEd) setHigherEd(data.currentHigherEd)
      } catch (err) {
        setError(err.response?.data?.error || t('common.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sheetId])

  // ─── Chargements conditionnels ──────────────────────────────────
  const loadSocialOrigins = async (geoCode) => {
    try {
      const res = await api.get(`/creation/step4/${sheetId}/backgrounds`, {
        params: { type: 'social_origin', parentCode: geoCode }
      })
      setSocialOrigins(res.data)
    } catch (err) { /* déjà géré */ }
  }

  const loadTrainings = async (socCode) => {
    try {
      const res = await api.get(`/creation/step4/${sheetId}/backgrounds`, {
        params: { type: 'training', parentCode: socCode }
      })
      setTrainings(res.data)
    } catch (err) { /* déjà géré */ }
  }

  const loadHigherEds = async () => {
    try {
      const res = await api.get(`/creation/step4/${sheetId}/backgrounds`, {
        params: { type: 'higher_ed' }
      })
      setHigherEds(res.data)
    } catch (err) { /* déjà géré */ }
  }

  // ─── Handlers ────────────────────────────────────────────────────
  const handleSelectGeoOrigin = async (code) => {
    setOriginGeo(code)
    await loadSocialOrigins(code)
    setOriginSoc(null)
    setTraining(null)
    setHigherEd(null)
    updatePreviewSkills()
  }

  const handleSelectSocialOrigin = async (code) => {
    setOriginSoc(code)
    await loadTrainings(code)
    setTraining(null)
    setHigherEd(null)
    updatePreviewSkills()
  }

  const handleSelectTraining = (code) => {
    setTraining(code)
    setHigherEd(null)
    if (code === 'education_scolaire') loadHigherEds()
    updatePreviewSkills()
  }

  const handleSelectHigherEd = (code) => {
    setHigherEd(code)
    updatePreviewSkills()
  }

  // ─── Preview skills ──────────────────────────────────────────────
  const updatePreviewSkills = useCallback(() => {
    // Combine les bonus des backgrounds sélectionnés avec les skills actuels
    const preview = { ...currentSkills }
    // La logique exacte dépend des données chargées — simplifié ici
    setPreviewSkills(preview)
  }, [currentSkills, originGeo, originSoc, training, higherEd])

  // ─── Profession handlers ─────────────────────────────────────────
  const handleAddCareer = (careerId, years) => {
    const career = careersList.find(c => c.id === careerId)
    if (!career) return
    const cost = years
    if (availablePC < cost) {
      setError(t('creation.step4.pc_insufficient'))
      return
    }
    setCareers(prev => [...prev, {
      career_id: careerId,
      years,
      skillAllocations: {},
      proAdvantages: {},
      openedSkills: [],
    }])
    setAvailablePC(prev => prev - cost)
  }

  const handleRemoveCareer = (index) => {
    const removed = careers[index]
    setCareers(prev => prev.filter((_, i) => i !== index))
    setAvailablePC(prev => prev + removed.years)
  }

  // ─── Validation finale ───────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const payload = {
        age,
        originGeo,
        originSoc,
        training,
        higherEd,
        careers,
        appliedSkills: [],  // Liste des skills conditionnels choisis
      }
      const res = await api.post(`/creation/step4/${sheetId}`, payload)
      onNext?.(res.data)
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    }
  }

  // ─── Rollback ────────────────────────────────────────────────────
  const handlePrev = async () => {
    try {
      await api.post(`/creation/rollback-to-step3/${sheetId}`)
      onPrev?.()
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    }
  }

  // ─── Calculs dérivés ─────────────────────────────────────────────
  const totalAge = age + (higherEd ? 2 : 0) + careers.reduce((sum, c) => sum + c.years, 0)
  const totalPC = (higherEd ? 1 : 0) + careers.reduce((sum, c) => sum + c.years, 0)
  const canGoNext = originGeo && originSoc && training && careers.length > 0

  if (loading) return <div className="loading">{t('common.loading')}</div>

  // ─── Rendu ───────────────────────────────────────────────────────
  return (
    <div className="step4-container">
      <h2>{t('creation.step4.title')}</h2>
      {error && <div className="error-banner">{error}</div>}

      {/* Indicateur de sous-étape */}
      <div className="substep-indicator">
        {Object.values(SUB_STEPS).map(step => (
          <span key={step} className={subStep === step ? 'active' : ''}>
            {t(`creation.step4.sub_${step}`)}
          </span>
        ))}
      </div>

      {/* PC restants */}
      <div className="pc-display">
        {t('creation.wizard.pc_remaining', { count: availablePC - totalPC })}
      </div>

      {/* Contenu conditionnel */}
      {subStep === SUB_STEPS.AGE && (
        <AgeSelector age={age} onChange={setAge} onNext={() => setSubStep(SUB_STEPS.GEO_ORIGIN)} />
      )}

      {subStep === SUB_STEPS.GEO_ORIGIN && (
        <BackgroundSelector
          items={geoOrigins}
          selected={originGeo}
          onSelect={handleSelectGeoOrigin}
          onRandom={async () => {
            const res = await api.post(`/creation/step4/${sheetId}/random-background`, { type: 'geo_origin' })
            handleSelectGeoOrigin(res.data.background.code)
          }}
          onNext={() => setSubStep(SUB_STEPS.SOCIAL_ORIGIN)}
          onPrev={() => setSubStep(SUB_STEPS.AGE)}
          canNext={!!originGeo}
        />
      )}

      {subStep === SUB_STEPS.SOCIAL_ORIGIN && (
        <BackgroundSelector
          items={socialOrigins}
          selected={originSoc}
          onSelect={handleSelectSocialOrigin}
          onRandom={async () => {
            const res = await api.post(`/creation/step4/${sheetId}/random-background`, { type: 'social_origin', parentCode: originGeo })
            handleSelectSocialOrigin(res.data.background.code)
          }}
          onNext={() => setSubStep(SUB_STEPS.TRAINING)}
          onPrev={() => setSubStep(SUB_STEPS.GEO_ORIGIN)}
          canNext={!!originSoc}
        />
      )}

      {/* ... autres sous-étapes similaires ... */}

      {subStep === SUB_STEPS.CAREERS && (
        <CareersAllocator
          careersList={careersList}
          selectedCareers={careers}
          currentSkills={previewSkills}
          currentAttributes={currentAttributes}
          refSkills={refSkills}
          rules={rules}
          availablePC={availablePC}
          onAdd={handleAddCareer}
          onRemove={handleRemoveCareer}
          onUpdate={(index, updates) => {
            setCareers(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
          }}
          onNext={() => setSubStep(SUB_STEPS.SUMMARY)}
          onPrev={() => setSubStep(SUB_STEPS.HIGHER_ED)}
          canNext={careers.length > 0}
        />
      )}

      {subStep === SUB_STEPS.SUMMARY && (
        <Step4Summary
          age={totalAge}
          originGeo={originGeo}
          originSoc={originSoc}
          training={training}
          higherEd={higherEd}
          careers={careers}
          careersList={careersList}
          pcSpent={totalPC}
          availablePC={availablePC - totalPC}
          skills={previewSkills}
          onSubmit={handleSubmit}
          onPrev={() => setSubStep(SUB_STEPS.CAREERS)}
        />
      )}

      {/* Navigation globale */}
      <div className="step4-nav">
        <button onClick={handlePrev}>{t('creation.wizard.prev')}</button>
      </div>
    </div>
  )
}

6. INTÉGRATION WIZARD
6.1 CreationWizard.jsx — ajout case 4
jsx

case 4:
  return (
    <Step4Experience
      sheetId={sheetId}
      availablePC={availablePC}
      onNext={(data) => {
        setAvailablePC(data.availablePC)
        setCurrentStep(5)
      }}
      onPrev={async () => {
        try {
          const res = await api.post(`/creation/rollback-to-step3/${sheetId}`)
          setAvailablePC(res.data.availablePC)
          setCurrentStep(3)
        } catch (err) {
          setError(err.response?.data?.error || 'Erreur rollback')
        }
      }}
    />
  )

7. i18n
7.1 client/src/locales/fr.json — clés ajoutées
json

{
  "creation": {
    "step4": {
      "title": "Expérience préliminaire",
      "sub_age": "Âge",
      "sub_geo_origin": "Origine",
      "sub_social_origin": "Milieu",
      "sub_training": "Formation",
      "sub_higher_ed": "Études",
      "sub_careers": "Professions",
      "sub_summary": "Récap",
      "age_label": "Âge de départ",
      "age_slider": "{{age}} ans",
      "age_effects_none": "Aucun effet (moins de 30 ans)",
      "age_effects": "Effets de l'âge",
      "age_effects_desc": "Malus aux Attributs : {{effects}}",
      "geo_origin_title": "Origine géographique",
      "geo_random": "Aléatoire (1D10)",
      "social_origin_title": "Origine sociale",
      "social_random": "Aléatoire (1D10)",
      "training_title": "Formation de base",
      "training_random": "Aléatoire (1D10)",
      "training_autodidacte": "Autodidacte — 7 points libres",
      "higher_ed_title": "Études supérieures",
      "higher_ed_cost": "Coûte 1 PC + 2 ans",
      "higher_ed_unavailable": "Nécessite la formation « Éducation scolaire »",
      "higher_ed_skip": "Passer",
      "careers_title": "Professions",
      "career_select": "Ajouter une profession",
      "career_years": "Années",
      "career_add": "Ajouter",
      "career_remove": "Retirer",
      "career_prerequisites": "Prérequis : {{text}}",
      "career_none": "Aucune profession sélectionnée",
      "career_skills_title": "Compétences ({{points}} pts)",
      "career_skills_pro": "Professionnelles (coût normal)",
      "career_skills_other": "Autres (coût doublé)",
      "career_skill_cost": "Coût : {{cost}} pts",
      "career_skill_max": "Niveau max : +{{max}} ({{years}} ans)",
      "career_skill_reserved": "Compétence réservée — 1 pt pour débloquer",
      "career_skill_pn": "Progression naturelle — gratuit jusqu'à +5",
      "career_advantages": "Avantages pro ({{points}} pts)",
      "career_salary": "Salaire : {{amount}}¤/an",
      "career_total_savings": "Économies : {{amount}}¤",
      "career_setback_trigger": "Revers ! Année {{year}}",
      "career_change_warning": "Changer de profession réinitialise le salaire et les titres.",
      "summary_title": "Récapitulatif",
      "summary_age": "Âge total : {{age}} ans",
      "summary_pc": "PC dépensés : {{spent}} / {{total}}",
      "summary_savings": "Économies totales : {{amount}}¤",
      "summary_careers": "{{count}} profession(s)",
      "summary_skills": "{{count}} compétence(s)",
      "pc_insufficient": "PC insuffisants",
      "validate": "Valider l'étape 4"
    }
  }
}

8. FICHIERS TOUCHÉS
Fichier	Action
server/migrations/097_ref_backgrounds.cjs	Nouveau — ref_backgrounds, ref_background_skills, ref_setbacks, char_creation_snapshot + seed
shared/polarisUtils.js	+calcSkillCost, +getMaxMasteryByYears, +getAgeEffects, +evaluateSalaryFormula
server/src/services/creationService.js	+getStep4Data, +validateAndPersistStep4, +rollbackToStep3, +getRandomBackground, +helpers validation, +createSnapshot, +restoreSnapshot
server/src/routes/creation.js	+GET /step4, +POST /step4, +POST /step4/random-background, +POST /rollback-to-step3
server/src/routes/char-ref.js	+GET /backgrounds (filtrage par type + parentCode) — ou intégré dans creation.js
client/src/components/creation/Step4Experience.jsx	Nouveau composant (~400 lignes)
client/src/components/creation/AgeSelector.jsx	Nouveau sous-composant
client/src/components/creation/BackgroundSelector.jsx	Nouveau sous-composant (réutilisé géo/social/formation/études)
client/src/components/creation/CareersAllocator.jsx	Nouveau sous-composant
client/src/components/creation/Step4Summary.jsx	Nouveau sous-composant
client/src/components/creation/CreationWizard.jsx	+case 4
client/src/locales/fr.json	+35 clés creation.step4.*
9. SCÉNARIOS DE TEST
#	Scénario	Résultat attendu
1	Entrée étape 4, pc_spent_step4=0, création snapshot	Snapshot capturé, creation_state=draft_step3
2	Sélection âge 30 ans, aperçu effets	FOR -1 affiché
3	Navire nomade → milieu ouvrier → choix conditionnel Aquaculture	Skills conditionnels filtrés, un seul appliqué
4	Formation éducation scolaire → études supérieures débloquées	9 filières affichées, coût 1 PC + 2 ans
5	Sélection Médecine (+1 PC, +2 ans)	Âge +2, PC -1
6	Ajout Chasseur de primes 5 ans	50 pts compétence, 25 pts avantages, salaire 2500¤
7	Compétence X (PILOTAGE__CHASSEURS_SOUS_MARINS) ouverte	1 pt déduit, mastery=-3, is_learned=true
8	Option niveau max : +11 tenté avec 1 an d'XP	Bloqué, message "Niveau max +3"
9	Changement profession : reset salaire	Nouveau titre, salaire recalculé
10	Soumission : âge 24, 2 professions, creation_state='draft_step4'	Transaction atomique réussie
11	Rollback : retour étape 3 depuis étape 4	Snapshot restauré, skills/attributs remis, pc_spent_step4=0
12	Mutation Sonar (étape 3) → entrée étape 4 → rollback	Compétence Sonar préservée après rollback
10. DETTES DOCUMENTÉES
ID	Description	Impact	Correctif futur
[DETTE-ETAPE4-1]	salary_formula — évaluation basique (XdY*Z uniquement)	Barman, Contrebandier salaires approximatifs	Évaluateur de formules complet
[DETTE-ETAPE4-2]	Prérequis de compétences ignorés (ref_skill_requirements)	Compétences avancées accessibles sans prérequis	Option GM option_skill_requirements
[DETTE-ETAPE4-3]	Avantages professionnels — JSONB libre sans effets mécaniques	Célébrité/Relations inexploitables en jeu	Tables ref_ + intégration étape 5
[DETTE-ETAPE4-4]	Perte de travail / changement communauté non géré	Revers "Perte d'emploi" sans effet mécanique	Logique 5 pts compétence + 3 pts avantages
[DETTE-ETAPE4-5]	Revers seed incomplet (5 entrées générales sur ~50 attendues)	Table des Revers partielle	Compléter avec LdB p.185+

Plan Étape 4 terminé.