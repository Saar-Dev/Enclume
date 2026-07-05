// 109_seed_ref_careers_illustration_lot2.js
// Peuple ref_careers.illustration pour le lot 2 (absent de la migration 108).
// Mapping vérifié contre MinIO réel (bucket enclume-assets) — voir docs/Old/JOURNALCOUCHE4.md "Illustrations — Mapping MinIO".

const ILLUSTRATIONS = {
  cultivateur_eleveur: 'assets/s4_eleveur.webp',
  diplomate: 'assets/s4_diplomate.webp',
  erudit_archeologue: 'assets/s4_archeologue.webp',
  espion: 'assets/s4_espion.webp',
  hybride_trident: 'assets/s4_hybride.webp',
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
