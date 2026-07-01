// 100_seed_ref_careers.js — Seed initial des 5 carrières Polaris (COUCHE 4b)

const CAREERS = [
  {
    code: 'artisan_artiste',
    name: 'Artisan/Artiste',
    description: "Les artisans fabriquent les produits qu'ils vendent ou rendent divers services. Les artistes produisent eux des œuvres d'art.",
    points_per_year: 5,
    restricted_geographic_origin: true,
    geographic_origin_details: "Très peu dans l'Alliance polaire ou les Royaumes pirates. Artistes uniquement dans les grandes cités.",
    skills: [
      { skill_id: 'COMBAT_ARME',                                          skill_group: 'Combat (contact)',               conditional: false },
      { skill_id: 'ENSEIGNEMENT',                                          skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ELOQUENCE_PERSUASION',                                  skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ENTREGENT_SEDUCTION',                                   skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES',                 skill_group: 'Connaissances',                 conditional: false },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',                skill_group: 'Connaissances',                 conditional: false },
      { skill_id: 'EDUCATION_CULTURE_GENERALE',                            skill_group: 'Connaissances',                 conditional: false },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances',              conditional: true  },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN',                           skill_group: 'Langues',                       conditional: false },
      { skill_id: 'OBSERVATION',                                            skill_group: 'Survie/Extérieur',              conditional: false },
      { skill_id: 'ART_ARTISANAT',                                         skill_group: 'Techniques',                    conditional: false },
    ],
    titles: [
      { min_years: 1,  max_years: 2,    title: 'Apprenti',        salary_per_year: 50,    salary_formula: null },
      { min_years: 3,  max_years: 6,    title: 'Compagnon',       salary_per_year: 1500,  salary_formula: null },
      { min_years: 7,  max_years: 12,   title: 'Artisan/Artiste', salary_per_year: 15000, salary_formula: null },
      { min_years: 13, max_years: null, title: 'Maître',          salary_per_year: 30000, salary_formula: null },
    ],
  },
  {
    code: 'assassin',
    name: 'Assassin',
    description: "Les assassins sont des tueurs professionnels de haut niveau, payés pour faire le sale boulot… plus ou moins discrètement.",
    points_per_year: 5,
    restricted_geographic_origin: false,
    geographic_origin_details: null,
    skills: [
      { skill_id: 'ACROBATIE_EQUILIBRE',                                    skill_group: 'Aptitudes physiques',           conditional: false },
      { skill_id: 'ATHLETISME',                                             skill_group: 'Aptitudes physiques',           conditional: false },
      { skill_id: 'ENDURANCE',                                              skill_group: 'Aptitudes physiques',           conditional: false },
      { skill_id: 'ESCALADE',                                               skill_group: 'Aptitudes physiques',           conditional: false },
      { skill_id: 'ARTS_MARTIAUX',                                          skill_group: 'Combat (contact)',              conditional: false },
      { skill_id: 'COMBAT_ARME',                                            skill_group: 'Combat (contact)',              conditional: false },
      { skill_id: 'COMBAT_A_MAINS_NUES',                                    skill_group: 'Combat (contact)',              conditional: false },
      { skill_id: 'ARMES_DE_POING',                                         skill_group: 'Combat (tir)',                  conditional: false },
      { skill_id: 'FUSIL_ARMES_DEPAULES',                                   skill_group: 'Combat (tir)',                  conditional: false },
      { skill_id: 'TIR_PRECISION',                                          skill_group: 'Combat (tir)',                  conditional: false },
      { skill_id: 'ANALYSE_EMPATHIQUE',                                     skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ELOQUENCE_PERSUASION',                                   skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'INTIMIDATION',                                           skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',                 skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'RECHERCHE_DINFORMATIONS',                                skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances',              conditional: false },
      { skill_id: 'DEGUISEMENT_IMITATION',                                  skill_group: 'Furtivité/Subterfuge',          conditional: false },
      { skill_id: 'DISCRETION_FILATURE',                                    skill_group: 'Furtivité/Subterfuge',          conditional: false },
      { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX',                       skill_group: 'Furtivité/Subterfuge',          conditional: false },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN',                            skill_group: 'Langues',                      conditional: false },
      { skill_id: 'OBSERVATION',                                            skill_group: 'Survie/Extérieur',              conditional: false },
      { skill_id: 'ESPIONNAGE_SURVEILLANCE',                                skill_group: 'Techniques',                   conditional: false },
      { skill_id: 'PIEGES',                                                 skill_group: 'Techniques',                   conditional: false },
      { skill_id: 'SYSTEMES_DE_SECURITE',                                   skill_group: 'Techniques',                   conditional: false },
    ],
    titles: [
      { min_years: 1,  max_years: 3,    title: 'Tueur à gages', salary_per_year: 500,  salary_formula: null },
      { min_years: 4,  max_years: 9,    title: 'Assassin',      salary_per_year: 1000, salary_formula: null },
      { min_years: 10, max_years: 12,   title: 'Assassin',      salary_per_year: 4000, salary_formula: null },
      { min_years: 13, max_years: null, title: 'Nettoyeur',     salary_per_year: 6000, salary_formula: null },
    ],
  },
  {
    code: 'barman',
    name: 'Barman',
    description: "Ils sont les confidents de la plupart des marins et connaissent beaucoup de monde.",
    points_per_year: 5,
    restricted_geographic_origin: true,
    geographic_origin_details: 'Communautés suffisamment importantes',
    skills: [
      { skill_id: 'ANALYSE_EMPATHIQUE',                                     skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ELOQUENCE_PERSUASION',                                   skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ENTREGENT_SEDUCTION',                                    skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'INTIMIDATION',                                           skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',                 skill_group: 'Connaissances',                 conditional: false },
      { skill_id: 'JEU',                                                    skill_group: 'Connaissances',                 conditional: false },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances',              conditional: false },
      { skill_id: 'COMBAT_ARME',                                            skill_group: 'Combat (contact)',              conditional: false },
      { skill_id: 'COMBAT_A_MAINS_NUES',                                    skill_group: 'Combat (contact)',              conditional: false },
      { skill_id: 'ARMES_DE_POING',                                         skill_group: 'Combat (tir)',                  conditional: false },
      { skill_id: 'FUSIL_ARMES_DEPAULES',                                   skill_group: 'Combat (tir)',                  conditional: true  },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN',                            skill_group: 'Langues',                      conditional: false },
    ],
    titles: [
      { min_years: 1,  max_years: 2,    title: 'Apprenti', salary_per_year: 400,  salary_formula: null       },
      { min_years: 3,  max_years: 6,    title: 'Barman',   salary_per_year: 800,  salary_formula: null       },
      { min_years: 7,  max_years: 14,   title: 'Barman',   salary_per_year: null, salary_formula: '1D100*20' },
      { min_years: 15, max_years: null, title: 'Barman',   salary_per_year: null, salary_formula: '1D100*100' },
    ],
  },
  {
    code: 'chasseur_primes',
    name: 'Chasseur de primes',
    description: "Les Chasseurs de primes passent la plus grande partie de leur temps à courir après des criminels, des pirates, des contrebandiers ou des fugitifs.",
    points_per_year: 5,
    restricted_geographic_origin: false,
    geographic_origin_details: null,
    skills: [
      { skill_id: 'ATHLETISME',                                             skill_group: 'Aptitudes physiques',          conditional: false },
      { skill_id: 'ENDURANCE',                                              skill_group: 'Aptitudes physiques',          conditional: false },
      { skill_id: 'MANOEUVRES_SOUS_MARINES',                                skill_group: 'Aptitudes physiques',          conditional: false },
      { skill_id: 'ARTS_MARTIAUX',                                          skill_group: 'Combat (contact)',             conditional: false },
      { skill_id: 'COMBAT_ARME',                                            skill_group: 'Combat (contact)',             conditional: false },
      { skill_id: 'COMBAT_A_MAINS_NUES',                                    skill_group: 'Combat (contact)',             conditional: false },
      { skill_id: 'ARMES_DE_POING',                                         skill_group: 'Combat (tir)',                 conditional: false },
      { skill_id: 'ARMES_SOUS_MARINES',                                     skill_group: 'Combat (tir)',                 conditional: false },
      { skill_id: 'FUSIL_ARMES_DEPAULES',                                   skill_group: 'Combat (tir)',                 conditional: false },
      { skill_id: 'ANALYSE_EMPATHIQUE',                                     skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'ELOQUENCE_PERSUASION',                                   skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'INTIMIDATION',                                           skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'BUREAUCRATIE',                                           skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',                 skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'NAVIGATION',                                             skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'RECHERCHE_DINFORMATIONS',                                skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX',                       skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'DEGUISEMENT_IMITATION',                                  skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'DISCRETION_FILATURE',                                    skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'ESPIONNAGE_SURVEILLANCE',                                skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'SYSTEMES_DE_SECURITE',                                   skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN',                            skill_group: 'Langues',                      conditional: false },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES',                skill_group: 'Pilotage',                     conditional: false },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS',                         skill_group: 'Pilotage',                     conditional: false },
      { skill_id: 'OBSERVATION',                                            skill_group: 'Survie/Extérieur',             conditional: false },
      { skill_id: 'ANALYSES_SONSCANS',                                      skill_group: 'Techniques',                   conditional: false },
      { skill_id: 'PREMIER_SOINS',                                          skill_group: 'Techniques',                   conditional: false },
    ],
    titles: [
      { min_years: 1,  max_years: 6,    title: 'Apprenti',            salary_per_year: 500,   salary_formula: null },
      { min_years: 7,  max_years: 10,   title: 'Chasseur de primes',  salary_per_year: 2000,  salary_formula: null },
      { min_years: 11, max_years: 18,   title: 'Chasseur de primes',  salary_per_year: 6000,  salary_formula: null },
      { min_years: 19, max_years: null, title: 'Chasseur de primes',  salary_per_year: 12000, salary_formula: null },
    ],
  },
  {
    code: 'contrebandier',
    name: 'Contrebandier',
    description: "Spécialisés dans le trafic des marchandises en tout genre, les contrebandiers sont indispensables à la survie du marché noir.",
    points_per_year: 5,
    restricted_geographic_origin: false,
    geographic_origin_details: null,
    skills: [
      { skill_id: 'COMBAT_ARME',                                            skill_group: 'Combat (contact)',             conditional: false },
      { skill_id: 'COMBAT_A_MAINS_NUES',                                    skill_group: 'Combat (contact)',             conditional: false },
      { skill_id: 'ARMES_DE_POING',                                         skill_group: 'Combat (tir)',                 conditional: false },
      { skill_id: 'FUSIL_ARMES_DEPAULES',                                   skill_group: 'Combat (tir)',                 conditional: false },
      { skill_id: 'ELOQUENCE_PERSUASION',                                   skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'INTIMIDATION',                                           skill_group: 'Communication/Relations sociales', conditional: false },
      { skill_id: 'BUREAUCRATIE',                                           skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS',                 skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'COMMERCE_TRAFIC__ARMES',                                 skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'NAVIGATION',                                             skill_group: 'Connaissances',                conditional: false },
      { skill_id: 'CAMOUFLAGE_DISSIMULATION',                               skill_group: 'Furtivité/Subterfuge',         conditional: false },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN',                            skill_group: 'Langues',                      conditional: false },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS',                         skill_group: 'Pilotage',                     conditional: false },
      { skill_id: 'ANALYSES_SONSCANS',                                      skill_group: 'Techniques',                   conditional: false },
      { skill_id: 'FALSIFICATION',                                          skill_group: 'Techniques',                   conditional: false },
    ],
    titles: [
      { min_years: 1, max_years: 6,    title: 'Contrebandier', salary_per_year: null, salary_formula: '1D6*100'   },
      { min_years: 7, max_years: null, title: 'Contrebandier', salary_per_year: null, salary_formula: '1D100*100' },
    ],
  },
]

export const up = async (knex) => {
  for (const career of CAREERS) {
    const [{ id: careerId }] = await knex('ref_careers')
      .insert({
        code:                         career.code,
        name:                         career.name,
        description:                  career.description,
        points_per_year:              career.points_per_year,
        restricted_geographic_origin: career.restricted_geographic_origin,
        geographic_origin_details:    career.geographic_origin_details,
      })
      .returning('id')

    await knex('ref_career_skills').insert(
      career.skills.map(s => ({
        career_id:  careerId,
        skill_id:   s.skill_id,
        skill_group: s.skill_group,
        conditional: s.conditional,
      }))
    )

    await knex('ref_career_titles').insert(
      career.titles.map(t => ({
        career_id:      careerId,
        min_years:      t.min_years,
        max_years:      t.max_years,
        title:          t.title,
        salary_per_year: t.salary_per_year,
        salary_formula: t.salary_formula,
      }))
    )
  }
}

export const down = async (knex) => {
  const codes = CAREERS.map(c => c.code)
  // CASCADE supprime ref_career_skills et ref_career_titles
  await knex('ref_careers').whereIn('code', codes).delete()
}
