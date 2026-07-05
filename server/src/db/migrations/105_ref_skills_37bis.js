// Migration 105 (« 37-bis ») — consolidation ref_skills après 37/74/103/103b (3e révision du
// catalogue, audit ligne par ligne des 251 lignes ref_skills + 94 ref_skill_requirements dans
// docs/MIGRATION_37BIS.md, section "PLAN DE MIGRATION 37-BIS — CONSOLIDÉ").
//
// Légende `marker` réelle (LdB p.188 — le schéma de la migration 34 documentait à tort DIFF/RES_X/LIMIT/PN) :
//   (X)  = Compétence réservée (apprentissage requis avant usage)
//   (-3) = Compétence difficile (malus initial)
//   PN   = Progression naturelle
//   •    = Compétence limitative (première utilisation réelle ici : ENSEIGNEMENT, compétence maison)
//   PREREQ = convention interne au projet (catégorie qui n'existe que si un enfant existe), pas une notion LdB — conservé tel quel (PILOTAGE)
//   'S'  = artefact de corruption historique (migration 74), sans rapport avec le LdB
//
// `is_category` (nouvelle colonne) remplace le sentinel `attr_1 = 'CHC'` utilisé jusqu'ici par
// client/src/character/SkillsPanel.jsx pour décider si une ligne s'affiche en en-tête de groupe
// repliable. Permet de donner leurs vrais attributs LdB aux catégories qui en ont (ex: Pouvoirs
// Polaris INT/VOL) sans casser le regroupement UI (voir docs/MIGRATION_37BIS.md).

const IS_CATEGORY_IDS = [
  'ARME_SPECIALE_CONTACT', 'ARME_SPECIALE_DISTANCE', 'ARTS_MARTIAUX', 'COMMERCE_TRAFIC',
  'CONNAISSANCE_MILIEU_NATUREL', 'CONTROLE_DES_MUTATIONS', 'EXPRESSION_ARTISTIQUE',
  'GENIE_TECHNIQUE', 'LANGAGES_SPECIFIQUES', 'LANGUE_ANCIENNE', 'LANGUE_ETRANGERE',
  'MANOEUVRE_DARMURE', 'MECANIQUE', 'PILOTAGE', 'POUVOIRS_POLARIS',
  'SCIENCES_CONNAISANCES_SPECIALISEES', 'TACTIQUE',
]

const MUTATION_CHILDREN = [
  'MUTATION_AGILITE_CAUDALE', 'MUTATION_CONTAGION', 'MUTATION_CONTROLE_MOLECULAIRE',
  'MUTATION_EMPATHIE', 'MUTATION_METAMORPHOSE', 'MUTATION_PURULENCE',
  'MUTATION_RADIATIONS', 'MUTATION_SONAR',
]

const LABELS_UP = {
  ARMES_LOURDES_CONTACT: 'Armes lourdes (contact)',
  ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES: 'Techniques défensives',
  ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES: 'Techniques offensives',
  ARMES_DE_JET: 'Armes de jet',
  ARMES_DE_POING: 'Armes de poing',
  ARMES_DE_TRAIT: 'Armes de trait',
  ARMES_LOURDES: 'Armes lourdes (tir)',
  ARMES_SOUS_MARINES: 'Armes sous-marines',
  FUSIL_ARMES_DEPAULES: "Fusils/Armes d'épaule",
  ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION: 'Arme spéciale à distance (COO/PER)',
  MAITRISE_DE_LECHO_POLARIS: "Maîtrise de l'Écho Polaris",
}

const LABELS_DOWN = {
  ARMES_LOURDES_CONTACT: 'Arme Lourde (contact)',
  ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES: 'Technique défensive',
  ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES: 'Technique offensive',
  ARMES_DE_JET: 'Arme de Jet',
  ARMES_DE_POING: 'Arme de poing',
  ARMES_DE_TRAIT: 'Arme de Trait',
  ARMES_LOURDES: 'Arme Lourde',
  ARMES_SOUS_MARINES: 'Arme sous-marine',
  FUSIL_ARMES_DEPAULES: "Fusil/Armes d'épaule",
  ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION: 'Arme spéciale à distance (COO/COO)',
  MAITRISE_DE_LECHO_POLARIS: "Maîtrise de l'Echo Polaris",
}

// Groupes D — enfants dont le marker corrompu 'S' (migration 74) est restauré vers sa vraie valeur LdB
const MARKER_S_TO_X = [
  'CONNAISSANCE_MILIEU_NATUREL_SURFACE', 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES',
  'PILOTAGE__CHASSEURS_ATMOSPHERIQUES', 'PILOTAGE__CHASSEURS_SOUS_MARINS', 'PILOTAGE__ENGINS_SPATIAUX',
  'PILOTAGE__NAVIRES_LEGERS', 'PILOTAGE__NAVIRES_LOURDS', 'PILOTAGE__VEHICULES_SOUTERRAINS',
  'COMMERCE_TRAFIC__ARMES', 'COMMERCE_TRAFIC__DROGUES',
  'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', 'SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT',
  'SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE', 'SCIENCES_CONNAISANCES_SPECIALISEES_CRIMINALISTIQUE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_FINANCES', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE',
  'SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE',
  'LANGAGES_SPECIFIQUES_ABSOLAN', 'LANGAGES_SPECIFIQUES_ENEFID', 'LANGAGES_SPECIFIQUES_EXON',
  'LANGAGES_SPECIFIQUES_FOREUR', 'LANGAGES_SPECIFIQUES_INESIS', 'LANGAGES_SPECIFIQUES_ITHRAXIEN',
  'LANGAGES_SPECIFIQUES_KLAN', 'LANGAGES_SPECIFIQUES_LEVEAN', 'LANGAGES_SPECIFIQUES_METALAN',
  'LANGAGES_SPECIFIQUES_NEOLAN', 'LANGAGES_SPECIFIQUES_SOLEEN',
  'LANGUE_ANCIENNE_ARKONIEN', 'LANGUE_ANCIENNE_AZURAN', 'LANGUE_ANCIENNE_AZUREEN', 'LANGUE_ANCIENNE_GATEEN',
  'LANGUE_ETRANGERE_AMANEUN', 'LANGUE_ETRANGERE_AZRAN', 'LANGUE_ETRANGERE_GASHKLAR', 'LANGUE_ETRANGERE_ISITAC',
  'LANGUE_ETRANGERE_LESARACH', 'LANGUE_ETRANGERE_LEXZION', 'LANGUE_ETRANGERE_NEO_AZURAN', 'LANGUE_ETRANGERE_NEZRAIS',
  'LANGUE_ETRANGERE_OCEANE', 'LANGUE_ETRANGERE_OLAKAR', 'LANGUE_ETRANGERE_OLOSAK', 'LANGUE_ETRANGERE_OSSYRIEN',
  'LANGUE_ETRANGERE_RENAREAN', 'LANGUE_ETRANGERE_TERNASET', 'LANGUE_ETRANGERE_TRASHAN',
]
const MARKER_S_TO_NULL = [
  'LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES', 'LANGAGES_SPECIFIQUES_SIRS',
  'TACTIQUE_COMBAT_SOUTERRAIN', 'TACTIQUE_COMBAT_TERRESTRE', 'TACTIQUE_OPERATIONS_COMMANDO',
  'MANOEUVRE_DARMURE__ARMURES_EXTERNES', 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES',
  'PILOTAGE__SCOOTERS_SOUS_MARINS', 'PILOTAGE__VEHICULES_DE_SOL',
  'GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL', 'GENIE_TECHNIQUE_ARCHITECTURE_NAVALE',
  'GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE', 'GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE',
  'GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE', 'GENIE_TECHNIQUE_LOGICIELS',
  'GENIE_TECHNIQUE_NANOTECHNOLOGIE', 'GENIE_TECHNIQUE_ROBOTIQUE', 'GENIE_TECHNIQUE_TELECOMMUNICATIONS',
  'MECANIQUE_CHASSEURS_ATMOSPHERIQUES', 'MECANIQUE_EXO_ARMURES', 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE',
  'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', 'MECANIQUE_VEHICULES_DE_SOL', 'MECANIQUE_VEHICULES_SOUTERRAINS',
]
const MARKER_S_TO_MOINS3 = [
  'MANOEUVRE_DARMURE__ARMURES_SPATIALES', 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', 'CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS',
  'TACTIQUE_COMBAT_NAVAL',
  'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', 'COMMERCE_TRAFIC__INFORMATIONS', 'COMMERCE_TRAFIC__MATERIEL_MEDICAL',
  'COMMERCE_TRAFIC__MATIERES_PREMIERES', 'COMMERCE_TRAFIC__VEHICULES',
  'EXPRESSION_ARTISTIQUE_CHANT', 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', 'EXPRESSION_ARTISTIQUE_DANSE',
]

// Groupe D — corrections isolées (origine ≠ 'S')
const MARKER_X_TO_NULL = ['MUTATION_AGILITE_CAUDALE', 'MUTATION_CONTROLE_MOLECULAIRE', 'MUTATION_SONAR', 'HYBRIDE']
const MARKER_X_TO_MOINS3 = ['MUTATION_EMPATHIE', 'MUTATION_METAMORPHOSE', 'MUTATION_RADIATIONS']

const ENSEIGNEMENT_DESCRIPTION =
  "Enseignement (compétence maison — absente du LdB officiel). Attributs associés : INT/ADA. " +
  "Cette Compétence représente la capacité d'un personnage à transmettre son savoir à autrui, dans un cadre " +
  "formel (cours structuré) ou informel (compagnonnage, apprentissage sur le terrain). Elle recouvre la " +
  "pédagogie — structurer une leçon, choisir les bons exemples, corriger les erreurs — autant que la capacité " +
  "à adapter son discours et sa méthode au profil de l'élève (rythme d'apprentissage, expérience préalable, " +
  "aptitudes propres). Note : Enseignement est une Compétence limitative — le niveau de l'instructeur dans " +
  "cette Compétence plafonne l'efficacité de la formation qu'il dispense (un personnage ne peut transmettre " +
  "une Compétence à un niveau supérieur à son propre niveau en Enseignement)."

export const up = async (knex) => {
  // --- Schéma ---
  await knex.schema.alterTable('ref_skills', (table) => {
    table.text('attr_1').nullable().alter()
  })
  await knex.schema.alterTable('ref_skills', (table) => {
    table.boolean('is_category').notNullable().defaultTo(false)
  })

  // --- A. Re-parentage puis suppressions ---
  await knex('ref_skills').where('parent', 'MUTATION').update({ parent: 'CONTROLE_DES_MUTATIONS' })
  await knex('ref_skills').where('id', 'MUTATION').delete()
  await knex('ref_skills').where('id', 'ARMES_SATELLITES').delete()

  // --- B. Corrections label ---
  for (const [id, label] of Object.entries(LABELS_UP)) {
    await knex('ref_skills').where('id', id).update({ label })
  }

  // --- C. Corrections attr_1/attr_2 (hors catégories) ---
  await knex('ref_skills').where('id', 'ENDURANCE').update({ attr_1: 'CON', attr_2: 'VOL' })
  await knex('ref_skills').where('id', 'ACROBATIE_EQUILIBRE').update({ attr_2: null })
  await knex('ref_skills').where('id', 'ANALYSE_EMPATHIQUE').update({ attr_2: 'PER' })
  await knex('ref_skills').where('id', 'ART_ARTISANAT').update({ attr_2: 'PER' })

  // --- is_category (17 lignes) : remplace le sentinel attr_1='CHC' ---
  await knex('ref_skills').whereIn('id', IS_CATEGORY_IDS).update({ is_category: true })
  await knex('ref_skills').where('id', 'ARME_SPECIALE_CONTACT').update({ attr_1: null })
  await knex('ref_skills').where('id', 'ARME_SPECIALE_DISTANCE').update({ attr_1: null })
  await knex('ref_skills').where('id', 'COMMERCE_TRAFIC').update({ attr_1: 'INT', attr_2: 'PRE' })
  await knex('ref_skills').where('id', 'CONTROLE_DES_MUTATIONS').update({ attr_1: null })
  await knex('ref_skills').where('id', 'EXPRESSION_ARTISTIQUE').update({ attr_1: null })
  await knex('ref_skills').where('id', 'GENIE_TECHNIQUE').update({ attr_1: 'INT' })
  await knex('ref_skills').where('id', 'PILOTAGE').update({ attr_1: null })
  await knex('ref_skills').where('id', 'POUVOIRS_POLARIS').update({ attr_1: 'INT', attr_2: 'VOL' })
  await knex('ref_skills').where('id', 'SCIENCES_CONNAISANCES_SPECIALISEES').update({ attr_1: 'INT' })
  // ARTS_MARTIAUX, CONNAISSANCE_MILIEU_NATUREL, LANGAGES_SPECIFIQUES, LANGUE_ANCIENNE, LANGUE_ETRANGERE,
  // MANOEUVRE_DARMURE, MECANIQUE, TACTIQUE : attrs déjà corrects, seul is_category change (ci-dessus).

  // --- D. Corrections marker (113 lignes) ---
  await knex('ref_skills').whereIn('id', MARKER_S_TO_X).update({ marker: '(X)' })
  await knex('ref_skills').whereIn('id', MARKER_S_TO_NULL).update({ marker: null })
  await knex('ref_skills').whereIn('id', MARKER_S_TO_MOINS3).update({ marker: '(-3)' })
  await knex('ref_skills').whereIn('id', MARKER_X_TO_NULL).update({ marker: null })
  await knex('ref_skills').whereIn('id', MARKER_X_TO_MOINS3).update({ marker: '(-3)' })
  await knex('ref_skills').where('id', 'ACROBATIE_EQUILIBRE').update({ marker: null })
  await knex('ref_skills').where('id', 'COMMERCE_TRAFIC').update({ marker: null })
  await knex('ref_skills').where('id', 'MECANIQUE').update({ marker: null })
  await knex('ref_skills').where('id', 'CARTOGRAPHIE').update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'EVASION').update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'POUVOIRS_POLARIS').update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'GENIE_TECHNIQUE').update({ marker: '(X)' })
  await knex('ref_skills').whereIn('id', ['LANGAGES_SPECIFIQUES', 'LANGUE_ETRANGERE']).update({ marker: 'PN' })
  await knex('ref_skills').where('id', 'LANGUE_ANCIENNE').update({ marker: null })
  await knex('ref_skills').where('id', 'ENSEIGNEMENT').update({ marker: '•', description: ENSEIGNEMENT_DESCRIPTION })
  // PILOTAGE : marker déjà 'PREREQ', ne bouge pas (seul attr_1 change, ci-dessus).

  // --- E. ref_skill_requirements : déplacement (mix-up MECANIQUE/PILOTAGE chasseurs atmosphériques) ---
  await knex('ref_skill_requirements')
    .where('skill_id', 'MECANIQUE_CHASSEURS_ATMOSPHERIQUES')
    .whereIn('value', ['ATHLETISME', 'EDUCATION_CULTURE_GENERALE'])
    .delete()
  await knex('ref_skill_requirements').insert([
    { skill_id: 'PILOTAGE__CHASSEURS_ATMOSPHERIQUES', type: 'SKILL_MIN', value: 'ATHLETISME', threshold: 10 },
    { skill_id: 'PILOTAGE__CHASSEURS_ATMOSPHERIQUES', type: 'SKILL_MIN', value: 'EDUCATION_CULTURE_GENERALE', threshold: 10 },
  ])
}

export const down = async (knex) => {
  // --- E. Restaurer le déplacement ---
  await knex('ref_skill_requirements')
    .where('skill_id', 'PILOTAGE__CHASSEURS_ATMOSPHERIQUES')
    .whereIn('value', ['ATHLETISME', 'EDUCATION_CULTURE_GENERALE'])
    .delete()
  await knex('ref_skill_requirements').insert([
    { skill_id: 'MECANIQUE_CHASSEURS_ATMOSPHERIQUES', type: 'SKILL_MIN', value: 'ATHLETISME', threshold: 10 },
    { skill_id: 'MECANIQUE_CHASSEURS_ATMOSPHERIQUES', type: 'SKILL_MIN', value: 'EDUCATION_CULTURE_GENERALE', threshold: 10 },
  ])

  // --- D. Restaurer les markers d'origine ---
  await knex('ref_skills').whereIn('id', [...MARKER_S_TO_X, ...MARKER_S_TO_NULL, ...MARKER_S_TO_MOINS3]).update({ marker: 'S' })
  await knex('ref_skills').whereIn('id', [...MARKER_X_TO_NULL, ...MARKER_X_TO_MOINS3]).update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'ACROBATIE_EQUILIBRE').update({ marker: '(-3)' })
  await knex('ref_skills').where('id', 'COMMERCE_TRAFIC').update({ marker: 'PREREQ' })
  await knex('ref_skills').where('id', 'MECANIQUE').update({ marker: '(-3)' })
  await knex('ref_skills').where('id', 'CARTOGRAPHIE').update({ marker: null })
  await knex('ref_skills').where('id', 'EVASION').update({ marker: null })
  await knex('ref_skills').where('id', 'POUVOIRS_POLARIS').update({ marker: null })
  await knex('ref_skills').where('id', 'GENIE_TECHNIQUE').update({ marker: null })
  await knex('ref_skills').whereIn('id', ['LANGAGES_SPECIFIQUES', 'LANGUE_ETRANGERE']).update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'LANGUE_ANCIENNE').update({ marker: '(X)' })
  await knex('ref_skills').where('id', 'ENSEIGNEMENT').update({ marker: null, description: null })

  // --- is_category : restaurer attr_1/attr_2 (sentinel CHC) ---
  await knex('ref_skills').where('id', 'ARME_SPECIALE_CONTACT').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'ARME_SPECIALE_DISTANCE').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'COMMERCE_TRAFIC').update({ attr_1: 'CHC', attr_2: null })
  await knex('ref_skills').where('id', 'CONTROLE_DES_MUTATIONS').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'EXPRESSION_ARTISTIQUE').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'GENIE_TECHNIQUE').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'PILOTAGE').update({ attr_1: 'CHC' })
  await knex('ref_skills').where('id', 'POUVOIRS_POLARIS').update({ attr_1: 'CHC', attr_2: null })
  await knex('ref_skills').where('id', 'SCIENCES_CONNAISANCES_SPECIALISEES').update({ attr_1: 'CHC' })
  await knex('ref_skills').whereIn('id', IS_CATEGORY_IDS).update({ is_category: false })

  // --- C. Restaurer attr_1/attr_2 ---
  await knex('ref_skills').where('id', 'ENDURANCE').update({ attr_1: 'FOR', attr_2: 'COO' })
  await knex('ref_skills').where('id', 'ACROBATIE_EQUILIBRE').update({ attr_2: 'PER' })
  await knex('ref_skills').where('id', 'ANALYSE_EMPATHIQUE').update({ attr_2: 'PRE' })
  await knex('ref_skills').where('id', 'ART_ARTISANAT').update({ attr_2: null })

  // --- B. Restaurer les labels ---
  for (const [id, label] of Object.entries(LABELS_DOWN)) {
    await knex('ref_skills').where('id', id).update({ label })
  }

  // --- A. Ré-insérer les lignes supprimées puis re-parenter ---
  await knex('ref_skills').insert({
    id: 'MUTATION', family: 'Compétences Spéciales', label: 'Mutation',
    parent: null, attr_1: 'CHC', attr_2: null, marker: null, description: null,
  })
  await knex('ref_skills').insert({
    id: 'ARMES_SATELLITES', family: 'Techniques', label: 'Armes satellites',
    parent: null, attr_1: 'INT', attr_2: null, marker: '(X)', description: null,
  })
  await knex('ref_skills').whereIn('id', MUTATION_CHILDREN).update({ parent: 'MUTATION' })

  // --- Schéma ---
  await knex.schema.alterTable('ref_skills', (table) => {
    table.dropColumn('is_category')
  })
  await knex.schema.alterTable('ref_skills', (table) => {
    table.text('attr_1').notNullable().alter()
  })
}
