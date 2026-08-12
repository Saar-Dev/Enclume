/**
 * generate-catalog-migration.js — Détecte les corrections catalogue jamais capturées en migration
 *
 * Contexte (docs/BUGIDENTIFIE.md, "module Arme KO" 2026-08-08) : ref_equipment.location (et
 * potentiellement d'autres colonnes) est corrigé après coup, à la main, via l'éditeur catalogue GM
 * (server/src/admin/ref-equipment-tool.html, servi par GET /api/admin/tools/equipment depuis
 * PLAN_ADMIN Lot 2, PUT /equipment/:id) — jamais capturé par une migration, donc jamais propagé à
 * une instance seedée séparément (serveur distant). Ce script compare, ligne par ligne et colonne
 * par colonne, ce que le seed (STEP1_cleaned_data.js, via equipmentMapping.js — même logique que
 * 2_seed_equipment.js, pas dupliquée) produirait, contre l'état réel de la base LOCALE (considérée
 * à jour/curée). Tout écart = une correction jamais capturée.
 *
 * Règle (décision Saar 2026-08-08) : plus aucune correction via cet éditeur tant que ce générateur
 * n'a pas tourné et que son résultat n'a pas été relu et commité.
 *
 * Usage :
 *   node generate-catalog-migration.js            → rapport seul (aucun fichier écrit)
 *   node generate-catalog-migration.js --write     → écrit la migration dans server/src/db/migrations/
 *
 * Lancé depuis server/src/db/ avec DATABASE_URL dans Enclume/.env.
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'
import { validateAndMap, loadSourceRows } from './seeds/equipmentMapping.js'
import db from './knex.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

// Colonnes comparées — tout dbRow produit par equipmentMapping.js sauf les clés d'identité
// (family/category/name servent à retrouver la ligne, jamais à la corriger ici).
const IDENTITY_COLUMNS = new Set(['family', 'category', 'name'])

function normalize(value) {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function sameValue(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

async function main() {
  const source = loadSourceRows()
  const results = source.map(validateAndMap).filter(r => r.errors.length === 0)

  // dbRow "seed" par name — dernier gagne en cas de doublon source (aucun connu, cf. guard name du
  // seed, mais un script d'audit ne doit jamais planter sur une donnée surprenante).
  const seedByName = new Map(results.map(r => [r.name, r.dbRow]))
  const columns = Object.keys(results[0]?.dbRow ?? {}).filter(c => !IDENTITY_COLUMNS.has(c))

  const liveRows = await db('ref_equipment').select(['id', 'name', ...columns])

  // { name: { column: { before, after } } } — before = valeur seed, after = valeur live corrigée.
  const divergences = {}
  let rowsWithDiff = 0
  let fieldDiffs = 0
  const perColumnCount = {}
  const notInSource = []

  for (const live of liveRows) {
    const seedRow = seedByName.get(live.name)
    if (!seedRow) { notInSource.push(live.name); continue }
    let rowHasDiff = false
    for (const col of columns) {
      const seedVal = seedRow[col]
      const liveVal = live[col]
      if (sameValue(seedVal, liveVal)) continue
      // Rien à capturer si le live est aussi vide que le seed (les deux "absents").
      if ((liveVal === null || liveVal === '') && (seedVal === null || seedVal === '')) continue
      divergences[live.name] ??= {}
      divergences[live.name][col] = { before: normalize(seedVal), after: normalize(liveVal) }
      perColumnCount[col] = (perColumnCount[col] ?? 0) + 1
      fieldDiffs++
      rowHasDiff = true
    }
    if (rowHasDiff) rowsWithDiff++
  }

  console.log(`Lignes en base (ref_equipment)     : ${liveRows.length}`)
  console.log(`Lignes absentes de la source seed   : ${notInSource.length}${notInSource.length ? ' → ' + notInSource.slice(0, 5).join(', ') + (notInSource.length > 5 ? '…' : '') : ''}`)
  console.log(`Lignes avec au moins un écart        : ${rowsWithDiff}`)
  console.log(`Écarts champ par champ (total)       : ${fieldDiffs}`)
  console.log('Répartition par colonne :')
  for (const [col, count] of Object.entries(perColumnCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${col.padEnd(22)} ${count}`)
  }

  if (fieldDiffs === 0) {
    console.log('\n→ Aucun écart détecté, rien à générer.')
    await db.destroy()
    return
  }

  if (!WRITE) {
    console.log('\n→ Rapport seul (mode par défaut). Relancer avec --write pour générer la migration.')
    await db.destroy()
    return
  }

  // ── Génération du fichier de migration ──────────────────────────────────────
  const migrationsDir = resolve(__dirname, 'migrations')
  // Exclut les anciens fichiers datés (ex. 20260329_01_users.js, 20260713_154_...) — format
  // historique distinct de la numérotation séquentielle simple (1, 2, ..., 234) utilisée depuis.
  const existing = fs.readdirSync(migrationsDir)
    .map(f => f.match(/^(\d{1,4})_/)?.[1])
    .filter(Boolean)
    .map(Number)
  const nextNum = Math.max(...existing) + 1
  const filename = `${nextNum}_backfill_ref_equipment_catalog_corrections.js`
  const filepath = resolve(migrationsDir, filename)

  const body = `// ${filename}
//
// Corrections catalogue faites après coup, à la main, via l'éditeur GM
// (server/src/admin/ref-equipment-tool.html, GET /api/admin/tools/equipment, PUT /equipment/:id)
// et jamais capturées par une migration —
// donc jamais propagées à une instance seedée séparément (cause racine du bug "module Arme KO",
// docs/BUGIDENTIFIE.md, 2026-08-08). Généré MÉCANIQUEMENT par
// server/src/db/generate-catalog-migration.js depuis l'écart entre le seed (STEP1_cleaned_data.js)
// et l'état réel de l'instance locale (curation confirmée fonctionnelle) — aucune saisie manuelle.
//
// Matché par \`name\` (core.md — id non stable entre instances seedées séparément, leçon migration
// 209). Idempotent et non bloquant : n'applique le changement QUE si la valeur actuelle sur
// l'instance cible correspond encore à la valeur "avant" attendue (état seed) ; sinon (déjà
// appliqué, ou déjà corrigé différemment sur cette instance) → log, JAMAIS de throw qui bloquerait
// la chaîne de migrations suivante (leçon directe de l'incident 209).

const FIXES = ${JSON.stringify(divergences, null, 2)}

export const up = async (knex) => {
  let applied = 0, alreadyDone = 0, skippedUnexpected = 0, missing = []
  for (const [name, cols] of Object.entries(FIXES)) {
    const row = await knex('ref_equipment').where({ name }).select(['id', ...Object.keys(cols)]).first()
    if (!row) { missing.push(name); continue }
    const updates = {}
    for (const [col, { before, after }] of Object.entries(cols)) {
      const current = row[col]
      if (JSON.stringify(current) === JSON.stringify(after)) { alreadyDone++; continue }
      if (JSON.stringify(current) !== JSON.stringify(before)) {
        console.log(\`[${nextNum}] valeur inattendue, ignorée : \${name}.\${col} = \${JSON.stringify(current)} (attendu \${JSON.stringify(before)})\`)
        skippedUnexpected++
        continue
      }
      updates[col] = after
    }
    if (Object.keys(updates).length > 0) {
      await knex('ref_equipment').where({ id: row.id }).update(updates)
      applied++
    }
  }
  console.log(\`[${nextNum}] catalogue : \${applied} lignes corrigées, \${alreadyDone} déjà à jour, \${skippedUnexpected} valeurs inattendues ignorées, \${missing.length} introuvables\`)
  if (missing.length > 0) console.log(\`[${nextNum}] introuvables : \${missing.join(', ')}\`)
}

export const down = async (knex) => {
  for (const [name, cols] of Object.entries(FIXES)) {
    const row = await knex('ref_equipment').where({ name }).select(['id', ...Object.keys(cols)]).first()
    if (!row) continue
    const reverts = {}
    for (const [col, { before, after }] of Object.entries(cols)) {
      if (JSON.stringify(row[col]) === JSON.stringify(after)) reverts[col] = before
    }
    if (Object.keys(reverts).length > 0) {
      await knex('ref_equipment').where({ id: row.id }).update(reverts)
    }
  }
}
`

  fs.writeFileSync(filepath, body)
  console.log(`\n✅ Migration écrite : server/src/db/migrations/${filename}`)
  console.log('→ À relire avant commit.')

  await db.destroy()
}

main().catch(err => { console.error(err); process.exit(1) })
