// Migration 121 — ref_career_skills.choice_group (Lot 5 "au choix", PLAN_REWORKFINAL.md §7)
// Audit exhaustif des 44 lignes conditional=true croisé avec REGLE_PROFESSION.md (§7.1) + vérifié
// contre la base réelle avant codage (session de développement, docs/JOURNAL6.md "Lot 5") :
// - 24 lignes T3 (catégorie ou enfant-proxy) → remplacées par les vrais enfants ref_skills.parent,
//   choice_group partagé (radio, exclusif par carrière). Groupes filtrés par cohérence métier, pas
//   par inclusion mécanique de toute la famille (justifications détaillées PLAN_REWORKFINAL §7.4).
// - 4 lignes anomalie (doublons inertes) : Diplomate ×3 + Espion ×1, CONNAISSANCE_DES_NATIONS_
//   ORGANISATIONS déjà rendue professionnelle par une ligne conditional=false du même métier.
// - 4 lignes anomalie (flag erroné) : Soldat d'élite ×4 variantes, ARMES_SPECIALES_CONTACT_FORCE_
//   COORDINATION marqué conditional=true alors que le texte ne dit PAS "(au choix)" pour ce métier
//   (contrairement à Soldat/Milicien qui l'a) — repassé conditional=false (compétence automatique).
// - 10 lignes T1 (case à cocher isolée) : aucune opération, choice_group reste NULL.

const T3_REPLACEMENTS = [
  {
    code: 'chasseur_primes', oldSkillId: 'ARTS_MARTIAUX', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'soldat_milicien', oldSkillId: 'ARTS_MARTIAUX_LUTTE', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'soldat_elite_commando_surface', oldSkillId: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'soldat_elite_commando_marin', oldSkillId: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'soldat_elite_commando_souterrain', oldSkillId: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'soldat_elite_forces_speciales', oldSkillId: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', choiceGroup: 'arts_martiaux_choice',
    newSkillIds: ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'],
  },
  {
    code: 'officier_militaire_souterrain', oldSkillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', choiceGroup: 'armes_speciales_choice',
    newSkillIds: ['ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', 'ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION'],
  },
  {
    code: 'officier_militaire_surface', oldSkillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', choiceGroup: 'armes_speciales_choice',
    newSkillIds: ['ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', 'ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION'],
  },
  {
    code: 'soldat_milicien', oldSkillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', choiceGroup: 'armes_speciales_choice',
    newSkillIds: ['ARMES_SPECIALES_CONTACT_FORCE_COORDINATION', 'ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION'],
  },
  {
    code: 'artisan_artiste', oldSkillId: 'COMMERCE_TRAFIC', choiceGroup: 'commerce_choice',
    newSkillIds: ['COMMERCE_TRAFIC__ARMES', 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', 'COMMERCE_TRAFIC__DROGUES', 'COMMERCE_TRAFIC__INFORMATIONS', 'COMMERCE_TRAFIC__MATERIEL_MEDICAL', 'COMMERCE_TRAFIC__MATIERES_PREMIERES', 'COMMERCE_TRAFIC__VEHICULES'],
  },
  {
    code: 'marchand', oldSkillId: 'COMMERCE_TRAFIC', choiceGroup: 'commerce_choice',
    newSkillIds: ['COMMERCE_TRAFIC__ARMES', 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', 'COMMERCE_TRAFIC__DROGUES', 'COMMERCE_TRAFIC__INFORMATIONS', 'COMMERCE_TRAFIC__MATERIEL_MEDICAL', 'COMMERCE_TRAFIC__MATIERES_PREMIERES', 'COMMERCE_TRAFIC__VEHICULES'],
  },
  {
    code: 'marchand_itinerant', oldSkillId: 'COMMERCE_TRAFIC', choiceGroup: 'commerce_choice',
    newSkillIds: ['COMMERCE_TRAFIC__ARMES', 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', 'COMMERCE_TRAFIC__DROGUES', 'COMMERCE_TRAFIC__INFORMATIONS', 'COMMERCE_TRAFIC__MATERIEL_MEDICAL', 'COMMERCE_TRAFIC__MATIERES_PREMIERES', 'COMMERCE_TRAFIC__VEHICULES'],
  },
  {
    code: 'marchand_itinerant', oldSkillId: 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', choiceGroup: 'expression_choice',
    newSkillIds: ['EXPRESSION_ARTISTIQUE_CHANT', 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', 'EXPRESSION_ARTISTIQUE_DANSE', 'EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE'],
  },
  {
    code: 'prostitue', oldSkillId: 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', choiceGroup: 'expression_choice',
    newSkillIds: ['EXPRESSION_ARTISTIQUE_CHANT', 'EXPRESSION_ARTISTIQUE_COMEDIE_CONTE', 'EXPRESSION_ARTISTIQUE_DANSE', 'EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE'],
  },
  {
    code: 'ouvrier_docker', oldSkillId: 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE', choiceGroup: 'mecanique_choice',
    newSkillIds: ['MECANIQUE_CHASSEURS_ATMOSPHERIQUES', 'MECANIQUE_EXO_ARMURES', 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE', 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', 'MECANIQUE_VEHICULES_DE_SOL', 'MECANIQUE_VEHICULES_SOUTERRAINS'],
  },
  {
    code: 'technicien_mecanicien', oldSkillId: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', choiceGroup: 'mecanique_choice',
    newSkillIds: ['MECANIQUE_CHASSEURS_ATMOSPHERIQUES', 'MECANIQUE_EXO_ARMURES', 'MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE', 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', 'MECANIQUE_VEHICULES_DE_SOL', 'MECANIQUE_VEHICULES_SOUTERRAINS'],
  },
  {
    code: 'scientifique_ingenieur', oldSkillId: 'GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE', choiceGroup: 'genie_technique_choice',
    newSkillIds: ['GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL', 'GENIE_TECHNIQUE_ARCHITECTURE_NAVALE', 'GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE', 'GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE', 'GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE', 'GENIE_TECHNIQUE_LOGICIELS', 'GENIE_TECHNIQUE_NANOTECHNOLOGIE', 'GENIE_TECHNIQUE_ROBOTIQUE', 'GENIE_TECHNIQUE_TELECOMMUNICATIONS'],
  },
  {
    code: 'pretre_trident', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', 'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES'],
  },
  {
    code: 'artisan_artiste', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES', choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE'],
  },
  {
    code: 'medecin_chirurgien', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES', choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE', 'GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE', 'GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE'],
  },
  {
    code: 'erudit_archeologue', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES', choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE'],
  },
  {
    code: 'scientifique_ingenieur', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT', 'SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE', 'SCIENCES_CONNAISANCES_SPECIALISEES_CRIMINALISTIQUE', 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE'],
  },
  {
    // Fusion des 2 lignes existantes (_GEOLOGIE + _PHYSIQUE_CHIMIE) en un seul choice_group.
    code: 'technicien_mecanicien', oldSkillId: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', extraOldSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE'], choiceGroup: 'sciences_choice',
    newSkillIds: ['SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE', 'SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT'],
  },
]

// Doublons inertes (isProSkill déjà vrai via une ligne conditional=false du même métier/skill_id) —
// supprimés, pas de choice_group possible (le schéma ne trace pas de sous-type "nation").
const ANOMALY_DUPLICATES = [
  { code: 'diplomate', skillId: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', count: 3 },
  { code: 'espion', skillId: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', count: 1 },
]

// Flag conditional erroné : le texte source ne dit PAS "(au choix)" pour Soldat d'élite (contrairement
// à Soldat/Milicien) — compétence automatique, pas un choix.
const ANOMALY_FLAG_FIX = [
  { code: 'soldat_elite_commando_surface', skillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION' },
  { code: 'soldat_elite_commando_marin', skillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION' },
  { code: 'soldat_elite_commando_souterrain', skillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION' },
  { code: 'soldat_elite_forces_speciales', skillId: 'ARMES_SPECIALES_CONTACT_FORCE_COORDINATION' },
]

function allCodes() {
  const codes = new Set()
  for (const r of T3_REPLACEMENTS) codes.add(r.code)
  for (const a of ANOMALY_DUPLICATES) codes.add(a.code)
  for (const a of ANOMALY_FLAG_FIX) codes.add(a.code)
  return Array.from(codes)
}

async function getCareerIds(knex) {
  const codes = allCodes()
  const rows = await knex('ref_careers').whereIn('code', codes).select('id', 'code')
  const map = {}
  for (const r of rows) map[r.code] = r.id
  for (const code of codes) {
    if (!map[code]) throw new Error(`Carrière introuvable : ${code}`)
  }
  return map
}

export async function up(knex) {
  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.text('choice_group').defaultTo(null)
  })

  const ids = await getCareerIds(knex)

  for (const r of T3_REPLACEMENTS) {
    const careerId = ids[r.code]
    const oldIds = [r.oldSkillId, ...(r.extraOldSkillIds || [])]
    await knex('ref_career_skills').where({ career_id: careerId }).whereIn('skill_id', oldIds).del()
    await knex('ref_career_skills').insert(
      r.newSkillIds.map((skillId) => ({
        career_id: careerId, skill_id: skillId, conditional: true, choice_group: r.choiceGroup,
      }))
    )
  }

  for (const a of ANOMALY_DUPLICATES) {
    await knex('ref_career_skills')
      .where({ career_id: ids[a.code], skill_id: a.skillId, conditional: true })
      .del()
  }

  for (const a of ANOMALY_FLAG_FIX) {
    await knex('ref_career_skills')
      .where({ career_id: ids[a.code], skill_id: a.skillId })
      .update({ conditional: false })
  }
}

export async function down(knex) {
  const ids = await getCareerIds(knex)

  for (const a of ANOMALY_FLAG_FIX) {
    await knex('ref_career_skills')
      .where({ career_id: ids[a.code], skill_id: a.skillId })
      .update({ conditional: true })
  }

  for (const a of ANOMALY_DUPLICATES) {
    const rows = Array.from({ length: a.count }, () => ({
      career_id: ids[a.code], skill_id: a.skillId, conditional: true, choice_group: null,
    }))
    await knex('ref_career_skills').insert(rows)
  }

  for (const r of T3_REPLACEMENTS) {
    const careerId = ids[r.code]
    await knex('ref_career_skills').where({ career_id: careerId, choice_group: r.choiceGroup }).whereIn('skill_id', r.newSkillIds).del()
    const oldIds = [r.oldSkillId, ...(r.extraOldSkillIds || [])]
    await knex('ref_career_skills').insert(
      oldIds.map((skillId) => ({ career_id: careerId, skill_id: skillId, conditional: true, choice_group: null }))
    )
  }

  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.dropColumn('choice_group')
  })
}
