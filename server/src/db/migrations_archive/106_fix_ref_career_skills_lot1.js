// 106_fix_ref_career_skills_lot1.js — Corrections lot 1 vs LdB (REGLE_PROFESSION.md)
// Aucune suppression sur ref_careers (id stable — évite le CASCADE sur char_careers).
// C3 (barman armes) volontairement hors scope — mécanisme "au choix" non implémenté.

const CODES = ['artisan_artiste', 'assassin', 'barman', 'chasseur_primes', 'contrebandier']

async function getCareerIds(knex) {
  const rows = await knex('ref_careers').whereIn('code', CODES).select('id', 'code')
  const map = {}
  for (const r of rows) map[r.code] = r.id
  for (const code of CODES) {
    if (!map[code]) throw new Error(`Carrière introuvable : ${code}`)
  }
  return map
}

export const up = async (knex) => {
  const ids = await getCareerIds(knex)

  // A1
  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES' })
    .update({ skill_id: 'COMMERCE_TRAFIC', conditional: true })

  // A2
  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES' })

  // B1
  await knex('ref_career_skills').where({ career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX' }).del()
  await knex('ref_career_skills').insert([
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)', conditional: false },
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)', conditional: false },
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)', conditional: false },
  ])

  // B2
  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'TIR_PRECISION' })
    .update({ skill_id: 'TIR_DE_PRECISION' })

  // B3
  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE' })

  // C1
  await knex('ref_career_skills')
    .where({ career_id: ids.barman, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION' })

  // D1
  await knex('ref_career_skills')
    .where({ career_id: ids.chasseur_primes, skill_id: 'ARTS_MARTIAUX' })
    .update({ conditional: true })

  // D2
  await knex('ref_career_skills').insert({
    career_id: ids.chasseur_primes, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage', conditional: false,
  })

  // E1
  await knex('ref_career_skills').insert({
    career_id: ids.contrebandier, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage', conditional: false,
  })
}

export const down = async (knex) => {
  const ids = await getCareerIds(knex)

  await knex('ref_career_skills').where({ career_id: ids.contrebandier, skill_id: 'PILOTAGE__NAVIRES_LEGERS' }).del()
  await knex('ref_career_skills').where({ career_id: ids.chasseur_primes, skill_id: 'PILOTAGE__NAVIRES_LEGERS' }).del()

  await knex('ref_career_skills')
    .where({ career_id: ids.chasseur_primes, skill_id: 'ARTS_MARTIAUX' })
    .update({ conditional: false })

  await knex('ref_career_skills')
    .where({ career_id: ids.barman, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'TIR_DE_PRECISION' })
    .update({ skill_id: 'TIR_PRECISION' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin })
    .whereIn('skill_id', ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'])
    .del()
  await knex('ref_career_skills').insert({
    career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX', skill_group: 'Combat (contact)', conditional: false,
  })

  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'COMMERCE_TRAFIC' })
    .update({ skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', conditional: false })
}
