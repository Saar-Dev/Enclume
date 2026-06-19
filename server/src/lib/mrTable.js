import db from '../db/knex.js'

// Singleton-promise pattern : cache la promesse, pas le résultat.
// Garantit un seul appel DB même sous concurrence (deux handlers simultanés
// voient la même promesse en cours de résolution).
// ⚠️ .then(r => r) obligatoire — convertit le QueryBuilder Knex en Promise native.
// Sans ce call, chaque await re-exécute une requête SQL (QueryBuilder Knex non réentrant).
let mrTablePromise = null
export function getMrTable() {
  if (!mrTablePromise)
    mrTablePromise = db('polaris_mr').orderBy('mr_min').then(r => r)
  return mrTablePromise
}

// Source de vérité : LdB Polaris p.209 — migration 46.
// Format DB : [{ mr_min, mr_max, modifier }]  ← "modifier", pas "dmax"
// dmax = isSuccess ? modifier + 1 : 0  — calculé dans le handler appelant.
// ⚠️ Limitation connue (A13) : si la première requête DB échoue, mrTablePromise cache une Promise
// rejetée → tous les appels suivants reçoivent la même rejection. Comportement identique à
// l'original — pas de régression. Reset possible : mrTablePromise = null (hors périmètre REWORK-08).
export function getModifier(mrTable, mr) {
  const row = mrTable.find(r =>
    mr >= r.mr_min && (r.mr_max === null || mr <= r.mr_max)
  )
  return row?.modifier ?? 0
}
