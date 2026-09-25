// 364_ref_equipment_grenade_weight.js — PLAN_PRISE_EN_MAIN.md Lot 0 (poids des grenades)
//
// Les grenades du catalogue (`category = 'Grenade'`, 15 lignes) n'ont aucun poids (`weight` NULL) : le poids porté
// (`shared/inventoryMath.js#computeTotalWeight`, qui compte 0 un poids absent) les ignore, et la règle de capacité des
// conteneurs de « Permuter » (PLAN_PRISE_EN_MAIN.md, R5) aussi.
// Décision Saar (2026-09-24) : 300 g (0,3 kg) par grenade. `weight` est en kilogrammes (`real`, migration 65).
//
// - Matché par `category` (clé métier du catalogue), jamais par `id` : les seeds ne garantissent que la clé métier, deux
//   instances seedées séparément ont des `id` différents (.claude/rules/core.md, leçon de la migration 209).
// - Idempotent et non bloquant (même leçon) : n'écrit QUE là où `weight` est NULL — jamais un poids déjà curé sur l'instance —
//   et ne lève rien si aucune ligne ne correspond.
// - ⚠ EFFET runtime : le poids porté de tout personnage qui possède des grenades augmente de 0,3 kg par grenade
//   (encombrement, `char_sheet` → `calcEncumbrancePenalty`). Voulu : les grenades pèsent.
// - ⚠ PIÈGE PostgreSQL : `weight` est un `real` ; `real = numeric` est FAUX (0.3::real vaut 0.30000001192…). Le `down` compare
//   donc en `::real`, jamais à un littéral numérique.
// - Le générateur `server/src/db/generate-catalog-migration.js` compare le seed à la base locale : il signalera ces poids comme
//   « écart » ; son backfill est idempotent (il n'écrit que si la valeur actuelle est encore celle du seed) — sans effet ici.

const GRENADE_WEIGHT_KG = 0.3

export const up = async (knex) => {
  const updated = await knex('ref_equipment')
    .where({ category: 'Grenade' })
    .whereNull('weight')
    .update({ weight: GRENADE_WEIGHT_KG })
  console.log(`[364] poids des grenades : ${updated} ligne(s) du catalogue mise(s) à ${GRENADE_WEIGHT_KG} kg`)
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .where({ category: 'Grenade' })
    .whereRaw('weight = ?::real', [GRENADE_WEIGHT_KG])
    .update({ weight: null })
}
