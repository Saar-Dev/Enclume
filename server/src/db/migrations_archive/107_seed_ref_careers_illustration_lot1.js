// 107_seed_ref_careers_illustration_lot1.js
// Peuple ref_careers.illustration pour le lot 1 (jamais rempli par la migration 100).
// Mapping vérifié contre MinIO réel (bucket enclume-assets) — voir docs/Old/JOURNALCOUCHE4.md "Illustrations — Mapping MinIO".

const ILLUSTRATIONS = {
  artisan_artiste: 'assets/s4_artisan.webp',
  assassin: 'assets/s4_assassin.webp',
  barman: 'assets/s4_barman.webp',
  chasseur_primes: 'assets/s4_chasseurprime.webp',
  contrebandier: 'assets/s4_contrebandier.webp',
}

export const up = async (knex) => {
  for (const [code, illustration] of Object.entries(ILLUSTRATIONS)) {
    const updated = await knex('ref_careers').where({ code }).update({ illustration })
    if (updated !== 1) throw new Error(`Carrière introuvable ou dupliquée : ${code}`)
  }
}

export const down = async (knex) => {
  await knex('ref_careers').whereIn('code', Object.keys(ILLUSTRATIONS)).update({ illustration: null })
}
