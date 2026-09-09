// 332_ref_equipment_pharma_no_integrity.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 curation
//
// Le backfill de la migration 329 (branche « matériel rare NT ≥ IV ») a flaggé `has_integrity`
// sur 7 lignes de la catégorie « Traitements, patchs et produits pharmaceutiques » (drogues,
// nano-sondes, altérateurs biologiques…). Ce sont des CONSOMMABLES à usage unique : le RAW
// (`MANUEL_USURE.md` §2.3) exclut explicitement le suivi d'état des objets les plus simples, et
// L1 (`canStack`) les rendait non-stackables à tort. On les remet hors périmètre ITG.
//
// Décision Saar 2026-09-09 : SEULE cette catégorie est touchée — les « Implants cybernétiques et
// biologiques » (14 lignes) gardent `has_integrity` (augmentations durables qui peuvent tomber en
// panne). Grenades / armes de jet : gardées aussi (chemin de résolution distinct, à revoir à L5).
//
// Aucune ligne `char_inventory` ne référence cette catégorie (vérifié) → aucun stack legacy, aucun
// recalcul. `quality` (posée à `bonne_qualite` par 329) est remise à NULL : sans `has_integrity`
// elle n'a plus de sens (CHECK `chk_ref_equipment_quality` autorise NULL).
//
// Idempotent (`AND has_integrity = true`). `down()` : restaure la règle 329 pour cette catégorie
// (les 7 lignes sont toutes tech_level >= 4).

const CATEGORY = 'Traitements, patchs et produits pharmaceutiques'

export const up = async (knex) => {
  const { rows: [{ n }] } = await knex.raw(
    'SELECT count(*)::int AS n FROM ref_equipment WHERE category = ?', [CATEGORY],
  )
  if (n === 0) {
    throw new Error(`332 : catégorie "${CATEGORY}" absente du catalogue — seed divergent, vérifier avant de figer`)
  }
  const { rowCount } = await knex.raw(
    `UPDATE ref_equipment SET has_integrity = false, quality = NULL
     WHERE category = ? AND has_integrity = true`, [CATEGORY],
  )
  console.log(`[332_ref_equipment_pharma_no_integrity] has_integrity retiré de ${rowCount} ligne(s) (${CATEGORY})`)
}

export const down = async (knex) => {
  await knex.raw(
    `UPDATE ref_equipment SET has_integrity = true, quality = 'bonne_qualite'
     WHERE category = ? AND tech_level >= 4 AND has_integrity = false`, [CATEGORY],
  )
}
