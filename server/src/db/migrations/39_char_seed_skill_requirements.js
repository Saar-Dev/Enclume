/**
 * Migration 39 — char : seed ref_skill_requirements
 *
 * Insère les 88 prérequis de compétences dans ref_skill_requirements.
 * Source de vérité : ExtractSKILL.xlsx colonne F (prérequis officiels Polaris).
 *
 * Types présents :
 *   'SKILL_MIN' — score minimum requis dans une autre compétence
 *   'MUTATION'  — possession d'une mutation requise (valeur = muta_numero)
 *
 * Note : prérequis GENOTYPE absents du catalogue V1 (aucun cas identifié).
 *
 * Note : Cryptographie requiert 'Informatique 10' en V1.
 *   Le prérequis alternatif 'Mathématiques 10' (règle OU du livre de base)
 *   n'est pas implémenté — le schéma ET uniquement ne supporte pas le OU en V1.
 *   Documenté comme dette technique UX8 dans ROADMAP_CHARACTER.md.
 *
 * down : supprime toutes les lignes (pas la table — créée en 35).
 */

const REQUIREMENTS = [
  {
    "skill_id": "BUREAUCRATIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "CARTOGRAPHIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "COMMERCE_TRAFIC__ARMES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__DENREES_ALIMENTAIRES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__DROGUES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__INFORMATIONS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__MATERIEL_MEDICAL",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__MATIERES_PREMIERES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "COMMERCE_TRAFIC__VEHICULES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 5
  },
  {
    "skill_id": "CRYPTOGRAPHIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "NAVIGATION",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "RECHERCHE_DINFORMATIONS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 7
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_CRIMINALISTIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_FINANCES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE",
    "threshold": 5
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 7
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 5
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE",
    "threshold": 5
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE",
    "threshold": 7
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE",
    "threshold": 5
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 7
  },
  {
    "skill_id": "SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "STRATEGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "PILOTAGE__CHASSEURS_SOUS_MARINS",
    "type": "SKILL_MIN",
    "value": "ATHLETISME",
    "threshold": 10
  },
  {
    "skill_id": "PILOTAGE__CHASSEURS_SOUS_MARINS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "PILOTAGE__CHASSEURS_SOUS_MARINS",
    "type": "SKILL_MIN",
    "value": "PILOTAGE_NAVIRES_LEGERS",
    "threshold": 10
  },
  {
    "skill_id": "MECANIQUE_CHASSEURS_ATMOSPHERIQUES",
    "type": "SKILL_MIN",
    "value": "ATHLETISME",
    "threshold": 10
  },
  {
    "skill_id": "MECANIQUE_CHASSEURS_ATMOSPHERIQUES",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "PILOTAGE__NAVIRES_LEGERS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 7
  },
  {
    "skill_id": "PILOTAGE__NAVIRES_LOURDS",
    "type": "SKILL_MIN",
    "value": "PILOTAGE_NAVIRES_LEGERS",
    "threshold": 10
  },
  {
    "skill_id": "PILOTAGE__ENGINS_SPATIAUX",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "ELECTRONIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "ESPIONNAGE_SURVEILLANCE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "ESPIONNAGE_SURVEILLANCE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 3
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ARCHITECTURE_NAVALE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE",
    "type": "SKILL_MIN",
    "value": "INFORMATIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_LOGICIELS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_LOGICIELS",
    "type": "SKILL_MIN",
    "value": "INFORMATIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_NANOTECHNOLOGIE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_NANOTECHNOLOGIE",
    "type": "SKILL_MIN",
    "value": "SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ROBOTIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ROBOTIQUE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_ROBOTIQUE",
    "type": "SKILL_MIN",
    "value": "INFORMATIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_TELECOMMUNICATIONS",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_TELECOMMUNICATIONS",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 10
  },
  {
    "skill_id": "GENIE_TECHNIQUE_TELECOMMUNICATIONS",
    "type": "SKILL_MIN",
    "value": "INFORMATIQUE",
    "threshold": 10
  },
  {
    "skill_id": "INFORMATIQUE",
    "type": "SKILL_MIN",
    "value": "EDUCATION_CULTURE_GENERALE",
    "threshold": 10
  },
  {
    "skill_id": "MECANIQUE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_EXO_ARMURES",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_CHASSEURS_ATMOSPHERIQUES",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_VEHICULES_SOUTERRAINS",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_VEHICULES_DE_SOL",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "PIRATAGE_INFORMATIQUE",
    "type": "SKILL_MIN",
    "value": "INFORMATIQUE",
    "threshold": 10
  },
  {
    "skill_id": "SYSTEMES_DE_SECURITE",
    "type": "SKILL_MIN",
    "value": "ELECTRONIQUE",
    "threshold": 5
  },
  {
    "skill_id": "MUTATION_CONTAGION",
    "type": "MUTATION",
    "value": "muta_011",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_CONTROLE_MOLECULAIRE",
    "type": "MUTATION",
    "value": "muta_019",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_EMPATHIE",
    "type": "MUTATION",
    "value": "muta_016",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_METAMORPHOSE",
    "type": "MUTATION",
    "value": "muta_020",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_PURULENCE",
    "type": "MUTATION",
    "value": "muta_025",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_RADIATIONS",
    "type": "MUTATION",
    "value": "muta_033",
    "threshold": 1
  },
  {
    "skill_id": "MUTATION_SONAR",
    "type": "MUTATION",
    "value": "muta_031",
    "threshold": 1
  }
];

export const up = async (knex) => {
  await knex('ref_skill_requirements').insert(REQUIREMENTS)
}

export const down = async (knex) => {
  await knex('ref_skill_requirements').del()
}
