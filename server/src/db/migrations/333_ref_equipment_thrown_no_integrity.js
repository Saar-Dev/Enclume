// 333_ref_equipment_thrown_no_integrity.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 curation (suite)
//
// Décision Saar 2026-09-09 : les ARMES DE JET (catégorie « Grenade » + catégorie « Armes de jet »)
// n'ont pas d'Intégrité — ce sont des consommables (grenades) ou des projectiles bon marché
// (couteaux, disques, javelots) dont l'état ne se suit pas (MANUEL_USURE.md §2.3). Toutes les
// AUTRES armes gardent leur ITG, y compris arcs/arbalètes (« Arme de trait ») et lanceurs.
//
// Le backfill 329 (branche famille « Armes » NT ≥ II) avait flaggé les 15 grenades + les 4 disques
// technologiques de « Armes de jet ». On les retire du périmètre ITG. `quality` remise à NULL
// (sans `has_integrity` elle n'a plus de sens). Toute ligne `char_inventory` de ces catégories qui
// aurait reçu une ITG (test manuel MJ pendant L4) est nettoyée — un objet non suivi ne doit pas
// porter d'`integrity_current` résiduelle (état incohérent, invisible mais parasite).
//
// Idempotent (`AND has_integrity = true`). `down()` : restaure la règle 329 pour ces catégories
// (grenades toutes tl ≥ 2 ; disques tl ≥ 3). L'ITG effacée en inventaire n'est pas restaurable
// (no-op, comme la migration 328).

const CATEGORIES = ['Grenade', 'Armes de jet']

export const up = async (knex) => {
  const { rows: [{ n }] } = await knex.raw(
    'SELECT count(*)::int AS n FROM ref_equipment WHERE category = ANY(?)', [CATEGORIES],
  )
  if (n === 0) {
    throw new Error(`333 : aucune ligne dans les catégories ${JSON.stringify(CATEGORIES)} — seed divergent`)
  }

  const { rowCount: unflagged } = await knex.raw(
    `UPDATE ref_equipment SET has_integrity = false, quality = NULL
     WHERE category = ANY(?) AND has_integrity = true`, [CATEGORIES],
  )
  const { rowCount: cleaned } = await knex.raw(
    `UPDATE char_inventory SET integrity_current = NULL, integrity_max = NULL, malfunction_severity = NULL
     WHERE equipment_id IN (SELECT id FROM ref_equipment WHERE category = ANY(?))
       AND (integrity_current IS NOT NULL OR malfunction_severity IS NOT NULL)`, [CATEGORIES],
  )
  console.log(`[333_ref_equipment_thrown_no_integrity] has_integrity retiré de ${unflagged} ligne(s) ; ${cleaned} ligne(s) char_inventory nettoyée(s)`)
}

export const down = async (knex) => {
  await knex.raw(
    `UPDATE ref_equipment SET has_integrity = true, quality = 'bonne_qualite'
     WHERE category = ANY(?) AND tech_level >= 2 AND has_integrity = false`, [CATEGORIES],
  )
}
