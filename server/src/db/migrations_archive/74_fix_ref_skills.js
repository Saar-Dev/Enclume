/**
 * Migration 74 — fix_ref_skills : correctifs catalogue compétences
 *
 * Reproduit 3 scripts SQL correctifs appliqués manuellement après la migration 37
 * (fix_ref_skills.sql + fix_special_skills_markers.sql + fix_polaris_requirements.sql)
 * qui n'avaient pas été capturés en migration — la version distante Kiwi reste
 * à l'état du seed 37 (231 lignes), la BDD locale en compte 248.
 *
 * Opérations :
 *   A. INSERT 10 groupes CHC + compétence réelle ARTS_MARTIAUX (→ 242 lignes)
 *   B. UPDATE labels/markers/parent des enfants ARMES_SPECIALES (S→(X), parent corrigé)
 *   C. UPDATE markers+labels enfants ARTS_MARTIAUX (S→(-3))
 *   D. UPDATE markers MUTATION_* et POUVOIRS_POLARIS_* (S→(X))
 *   E. UPDATE marker EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE (S→(X))
 *   F. Renommage PK ACCROBATIE_EQUILIBRE → ACROBATIE_EQUILIBRE (typo ID)
 *   G. INSERT prérequis : CHIRURGIE, FALSIFICATION, Polaris (muta_029), AGILITE_CAUDALE (muta_026)
 *      Note : MECANIQUE→ELECTRONIQUE déjà seedé en migration 39 — non répété ici.
 */

export const up = async (knex) => {

  // ─── A. Groupes structurels CHC + compétence réelle ARTS_MARTIAUX ─────────
  // ON CONFLICT IGNORE : la BDD locale a déjà ces lignes (scripts manuels sans migration).
  // Kiwi (231 rows) : toutes insérées. Local (248 rows) : ignorées si déjà présentes.
  await knex('ref_skills').insert([
    {
      id: 'ARME_SPECIALE_CONTACT',
      family: 'Combat (contact)',
      label: 'Armes Spéciales (contact)',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'ARTS_MARTIAUX',
      family: 'Combat (contact)',
      label: 'Arts martiaux',
      parent: null, attr_1: 'COO', attr_2: 'ADA', marker: '(-3)',
      description: 'Compétence limitative pour : les autres Compétences de combat au contact.',
    },
    {
      id: 'ARME_SPECIALE_DISTANCE',
      family: 'Combat (tir)',
      label: 'Armes Spéciales (distance)',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'EXPRESSION_ARTISTIQUE',
      family: 'Communication / Relations sociales',
      label: 'Expression artistique',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'CONTROLE_DES_MUTATIONS',
      family: 'Compétences Spéciales',
      label: 'Contrôle des mutations',
      parent: null, attr_1: 'CHC', attr_2: null, marker: '(X)',
    },
    {
      id: 'MUTATION',
      family: 'Compétences Spéciales',
      label: 'Mutation',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'POUVOIRS_POLARIS',
      family: 'Compétences Spéciales',
      label: 'Pouvoirs Polaris',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'COMMERCE_TRAFIC',
      family: 'Connaissances',
      label: 'Commerce/Trafic',
      parent: null, attr_1: 'CHC', attr_2: null, marker: 'PREREQ',
    },
    {
      id: 'SCIENCES_CONNAISANCES_SPECIALISEES',
      family: 'Connaissances',
      label: 'Sciences/Connaissances spécialisées',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
    {
      id: 'PILOTAGE',
      family: 'Pilotage',
      label: 'Pilotage',
      parent: null, attr_1: 'CHC', attr_2: null, marker: 'PREREQ',
    },
    {
      id: 'GENIE_TECHNIQUE',
      family: 'Techniques',
      label: 'Génie technique',
      parent: null, attr_1: 'CHC', attr_2: null, marker: null,
    },
  ]).onConflict('id').ignore()

  // ─── B. Enfants ARMES_SPECIALES : parent corrigé + label + marker S→(X) ──
  // Le seed 37 référençait ARMES_SPECIALES_CONTACT (pluriel inexistant).
  // Le parent correct inséré ci-dessus est ARME_SPECIALE_CONTACT (singulier).
  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION')
    .update({ parent: 'ARME_SPECIALE_CONTACT', label: 'Arme spéciale de contact (FOR/COO)', marker: '(X)' })

  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION')
    .update({ parent: 'ARME_SPECIALE_CONTACT', label: 'Arme spéciale de contact (COO/COO)', marker: '(X)' })

  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_DISTANCE_FORCE_COORDINATION')
    .update({ parent: 'ARME_SPECIALE_DISTANCE', label: 'Arme spéciale à distance (FOR/COO)', marker: '(X)' })

  await knex('ref_skills')
    .where('id', 'ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION')
    .update({ parent: 'ARME_SPECIALE_DISTANCE', label: 'Arme spéciale à distance (COO/COO)', marker: '(X)' })

  // ─── C. Enfants ARTS_MARTIAUX : S → (-3), labels singuliers ──────────────
  await knex('ref_skills')
    .where('id', 'ARTS_MARTIAUX_LUTTE')
    .update({ marker: '(-3)' })

  await knex('ref_skills')
    .where('id', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES')
    .update({ marker: '(-3)', label: 'Technique défensive' })

  await knex('ref_skills')
    .where('id', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES')
    .update({ marker: '(-3)', label: 'Technique offensive' })

  // ─── D. MUTATION_* et POUVOIRS_POLARIS_* : marker S → (X) ────────────────
  // Les enfants référençaient déjà MUTATION/POUVOIRS_POLARIS dans le seed 37
  // (parents fantômes). Le marker S rendait ces compétences toujours visibles
  // (isVisible ne testait pas 'S'). Correction : (X) les masque correctement.
  await knex('ref_skills').where('parent', 'MUTATION').update({ marker: '(X)' })
  await knex('ref_skills').where('parent', 'POUVOIRS_POLARIS').update({ marker: '(X)' })

  // ─── E. EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE : S → (X) ────────────
  await knex('ref_skills')
    .where('id', 'EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE')
    .update({ marker: '(X)' })

  // ─── F. Renommage PK : ACCROBATIE_EQUILIBRE → ACROBATIE_EQUILIBRE ─────────
  // Mise à jour des tables enfants en premier pour respecter les contraintes FK.
  await knex('char_skills')
    .where('skill_id', 'ACCROBATIE_EQUILIBRE')
    .update({ skill_id: 'ACROBATIE_EQUILIBRE' })

  await knex('ref_skill_requirements')
    .where('skill_id', 'ACCROBATIE_EQUILIBRE')
    .update({ skill_id: 'ACROBATIE_EQUILIBRE' })

  await knex('ref_skill_requirements')
    .where('value', 'ACCROBATIE_EQUILIBRE')
    .update({ value: 'ACROBATIE_EQUILIBRE' })

  await knex('ref_skills')
    .where('id', 'ACCROBATIE_EQUILIBRE')
    .update({ id: 'ACROBATIE_EQUILIBRE' })

  // ─── G. Prérequis ajoutés via fix scripts (absents de la migration 39) ────
  // ON CONFLICT IGNORE : même protection idempotente que l'étape A.
  await knex('ref_skill_requirements').insert([
    {
      skill_id:  'CHIRURGIE',
      type:      'SKILL_MIN',
      value:     'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE',
      threshold: 10,
    },
    {
      skill_id:  'FALSIFICATION',
      type:      'SKILL_MIN',
      value:     'EDUCATION_CULTURE_GENERALE',
      threshold: 7,
    },
    {
      skill_id:  'MAITRISE_DE_LA_FORCE_POLARIS',
      type:      'MUTATION',
      value:     'muta_029',
      threshold: 1,
    },
    {
      skill_id:  'MAITRISE_DE_LECHO_POLARIS',
      type:      'MUTATION',
      value:     'muta_029',
      threshold: 1,
    },
    {
      skill_id:  'MUTATION_AGILITE_CAUDALE',
      type:      'MUTATION',
      value:     'muta_026',
      threshold: 1,
    },
  ]).onConflict(['skill_id', 'type', 'value']).ignore()
}

export const down = async (knex) => {
  // G — supprimer uniquement les prérequis insérés ici
  await knex('ref_skill_requirements')
    .where({ skill_id: 'CHIRURGIE', type: 'SKILL_MIN', value: 'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE' })
    .del()
  await knex('ref_skill_requirements')
    .where({ skill_id: 'FALSIFICATION', type: 'SKILL_MIN', value: 'EDUCATION_CULTURE_GENERALE' })
    .del()
  await knex('ref_skill_requirements')
    .where({ skill_id: 'MAITRISE_DE_LA_FORCE_POLARIS', type: 'MUTATION', value: 'muta_029' })
    .del()
  await knex('ref_skill_requirements')
    .where({ skill_id: 'MAITRISE_DE_LECHO_POLARIS', type: 'MUTATION', value: 'muta_029' })
    .del()
  await knex('ref_skill_requirements')
    .where({ skill_id: 'MUTATION_AGILITE_CAUDALE', type: 'MUTATION', value: 'muta_026' })
    .del()

  // F — reverser renommage (enfants d'abord)
  await knex('char_skills')
    .where('skill_id', 'ACROBATIE_EQUILIBRE')
    .update({ skill_id: 'ACCROBATIE_EQUILIBRE' })
  await knex('ref_skill_requirements')
    .where('skill_id', 'ACROBATIE_EQUILIBRE')
    .update({ skill_id: 'ACCROBATIE_EQUILIBRE' })
  await knex('ref_skill_requirements')
    .where('value', 'ACROBATIE_EQUILIBRE')
    .update({ value: 'ACCROBATIE_EQUILIBRE' })
  await knex('ref_skills')
    .where('id', 'ACROBATIE_EQUILIBRE')
    .update({ id: 'ACCROBATIE_EQUILIBRE' })

  // E
  await knex('ref_skills')
    .where('id', 'EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE')
    .update({ marker: 'S' })

  // D
  await knex('ref_skills').where('parent', 'MUTATION').update({ marker: 'S' })
  await knex('ref_skills').where('parent', 'POUVOIRS_POLARIS').update({ marker: 'S' })

  // C
  await knex('ref_skills').where('id', 'ARTS_MARTIAUX_LUTTE').update({ marker: 'S' })
  await knex('ref_skills').where('id', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES').update({ marker: 'S', label: 'Techniques défensives' })
  await knex('ref_skills').where('id', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES').update({ marker: 'S', label: 'Techniques offensives' })

  // B
  await knex('ref_skills').where('id', 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION')
    .update({ parent: 'ARMES_SPECIALES_CONTACT', label: 'Force/Coordination', marker: 'S' })
  await knex('ref_skills').where('id', 'ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION')
    .update({ parent: 'ARMES_SPECIALES_CONTACT', label: 'Coordination/Coordination', marker: 'S' })
  await knex('ref_skills').where('id', 'ARMES_SPECIALES_DISTANCE_FORCE_COORDINATION')
    .update({ parent: 'ARMES_SPECIALES_DISTANCE', label: 'Force/Coordination', marker: 'S' })
  await knex('ref_skills').where('id', 'ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION')
    .update({ parent: 'ARMES_SPECIALES_DISTANCE', label: 'Coordination/Perception', marker: 'S' })

  // A — supprimer les 11 lignes insérées (enfants mis à jour en B n'ont plus le vieux parent)
  await knex('ref_skills').whereIn('id', [
    'ARME_SPECIALE_CONTACT',
    'ARTS_MARTIAUX',
    'ARME_SPECIALE_DISTANCE',
    'EXPRESSION_ARTISTIQUE',
    'CONTROLE_DES_MUTATIONS',
    'MUTATION',
    'POUVOIRS_POLARIS',
    'COMMERCE_TRAFIC',
    'SCIENCES_CONNAISANCES_SPECIALISEES',
    'PILOTAGE',
    'GENIE_TECHNIQUE',
  ]).del()
}
