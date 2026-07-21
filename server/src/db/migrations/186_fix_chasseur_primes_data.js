// Migration 186 — chasseur_primes : deux défauts de données confirmés contre le texte RAW réel
// (fourni par Saar, comparé mot pour mot).
//
// 1) ref_career_point_categories entièrement absentes. La migration 120 affirmait ce métier
//    "correctement absent : la LdB (p.156) ne liste aucun 'Avantages professionnel'" — affirmation
//    fausse, contredite par le texte RAW : "Avantages professionnels (5 points/an) : Célébrité,
//    Relations, Matériel." `ref_careers.points_per_year = 5` (100_seed_ref_careers.js) était déjà
//    correct ; seule la table de répartition manquait. Preuve interne supplémentaire :
//    122_ref_career_random_benefits_lot1_and_points_alt.js incrémente déjà Célébrité/Relations/
//    Matériel dans ses tirages 1D10 pour ce même métier.
//
// 2) ref_career_titles — deux paliers salariaux fusionnés à tort par 100_seed_ref_careers.js :
//    RAW : 7-8 Chasseur de primes 1000/an ; 9-10 Chasseur de primes 2000/an (deux paliers)
//    Base : 7-10 Chasseur de primes 2000/an (un seul palier, absorbe 7-8 à 2000 au lieu de 1000)
//    RAW : 11-14 Chasseur de primes 6000/an ; 15-18 Chasseur de primes 8000/an (deux paliers)
//    Base : 11-18 Chasseur de primes 6000/an (un seul palier, absorbe 15-18 à 6000 au lieu de 8000)
//
// Prérequis carrière (CAR3 — "Deux ans d'expérience en tant que Mercenaire, Policier/Enquêteur,
// Soldat, Veilleur ou Criminel/Voleur") volontairement HORS PÉRIMÈTRE de cette migration :
// shared/careerEligibility.js:12-13 documente explicitement que prerequisite_logic (AND/OR) est
// ignoré et que tout prérequis est traité en AND. Insérer 5 lignes OR telles quelles rendrait ce
// métier totalement injouable (les 5 prérequis seraient exigés simultanément). Nécessite d'abord
// une vraie implémentation OR dans careerEligibility.js — décision et chantier séparés.

const CATEGORIES = ['Célébrité', 'Relations', 'Matériel']

const OLD_TITLES = [
  { min_years: 7, max_years: 10, title: 'Chasseur de primes', salary_per_year: 2000, salary_formula: null },
  { min_years: 11, max_years: 18, title: 'Chasseur de primes', salary_per_year: 6000, salary_formula: null },
]

const NEW_TITLES = [
  { min_years: 7, max_years: 8, title: 'Chasseur de primes', salary_per_year: 1000, salary_formula: null },
  { min_years: 9, max_years: 10, title: 'Chasseur de primes', salary_per_year: 2000, salary_formula: null },
  { min_years: 11, max_years: 14, title: 'Chasseur de primes', salary_per_year: 6000, salary_formula: null },
  { min_years: 15, max_years: 18, title: 'Chasseur de primes', salary_per_year: 8000, salary_formula: null },
]

async function getCareerId(knex) {
  const career = await knex('ref_careers').where({ code: 'chasseur_primes' }).first('id')
  if (!career) throw new Error('Carrière inconnue : chasseur_primes')
  return career.id
}

export async function up(knex) {
  const careerId = await getCareerId(knex)

  await knex('ref_career_point_categories').insert(
    CATEGORIES.map((category, i) => ({ career_id: careerId, sort_order: i + 1, category }))
  )

  await knex('ref_career_titles')
    .where({ career_id: careerId, min_years: 7, max_years: 10, salary_per_year: 2000 })
    .del()
  await knex('ref_career_titles')
    .where({ career_id: careerId, min_years: 11, max_years: 18, salary_per_year: 6000 })
    .del()

  await knex('ref_career_titles').insert(
    NEW_TITLES.map(t => ({ ...t, career_id: careerId }))
  )
}

export async function down(knex) {
  const careerId = await getCareerId(knex)

  await knex('ref_career_point_categories').where({ career_id: careerId }).del()

  for (const t of NEW_TITLES) {
    await knex('ref_career_titles')
      .where({ career_id: careerId, min_years: t.min_years, max_years: t.max_years, salary_per_year: t.salary_per_year })
      .del()
  }

  await knex('ref_career_titles').insert(
    OLD_TITLES.map(t => ({ ...t, career_id: careerId }))
  )
}
