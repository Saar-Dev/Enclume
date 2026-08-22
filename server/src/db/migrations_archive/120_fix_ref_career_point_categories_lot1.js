// Migration 120 — 4 des 5 carrières du Lot 1 (artisan_artiste, assassin, barman, contrebandier)
// n'ont jamais eu leurs lignes ref_career_point_categories insérées (100_seed_ref_careers.js
// n'a aucun insert sur cette table) — même angle mort que la migration 106 (ref_career_skills),
// mais jamais corrigé pour cette table. chasseur_primes est correctement absent : la LdB (p.156)
// ne liste aucun "Avantages professionnels" pour cette profession.
// Valeurs cross-vérifiées contre docs/Character/Creation/REGLE_PROFESSION.md (lignes 96, 157-158,
// 207, 319-320) — mot pour mot, même ordre.

const CATEGORIES = {
  artisan_artiste: ['Étal/Boutique', 'Art/Artisanat', 'Célébrité', 'Relations', 'Matériel'],
  assassin: ['Corruption/Chantage', 'Falsification', 'Fausse identité', 'Planque/Cache', 'Célébrité', 'Relations', 'Matériel'],
  barman: ['Bar', 'Stock de marchandises', 'Célébrité', 'Relations', 'Matériel'],
  contrebandier: ['Célébrité', 'Relations', 'Falsification', 'Réseau de contrebande', 'Cache à marchandises', 'Planque/Cache', 'Stock de marchandises', 'Corruption/Chantage', 'Matériel'],
}

export async function up(knex) {
  const codes = Object.keys(CATEGORIES)
  const careers = await knex('ref_careers').whereIn('code', codes).select('id', 'code')
  const careerIdByCode = new Map(careers.map(c => [c.code, c.id]))

  const rows = []
  for (const code of codes) {
    const careerId = careerIdByCode.get(code)
    if (!careerId) throw new Error(`Carrière inconnue : ${code}`)
    CATEGORIES[code].forEach((category, i) => {
      rows.push({ career_id: careerId, sort_order: i + 1, category })
    })
  }

  await knex('ref_career_point_categories').insert(rows)
}

export async function down(knex) {
  const codes = Object.keys(CATEGORIES)
  const careerIds = await knex('ref_careers').whereIn('code', codes).pluck('id')
  await knex('ref_career_point_categories').whereIn('career_id', careerIds).del()
}
