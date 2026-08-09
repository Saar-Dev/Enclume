/**
 * 2_seed_equipment.js — Import STEP1_cleaned_data.js → ref_equipment
 *
 * Philosophie : KO par défaut. Tout champ non-reconnu est rejeté avec rapport.
 * Guard name : les items déjà en base (même name) sont skippés → runnables N fois.
 *
 * Usage :
 *   node 2_seed_equipment.js           → simulation (aucun INSERT)
 *   node 2_seed_equipment.js --insert  → INSERT réel
 *
 * Lancé depuis server/ avec DATABASE_URL dans Enclume/.env.
 */

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'
import { validateAndMap, loadSourceRows } from './equipmentMapping.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../../.env') })

import db from '../knex.js'

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--insert')

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN
    ? '🔍 MODE SIMULATION — aucun INSERT ne sera effectué\n'
    : '🚀 MODE INSERT\n'
  )

  const source = loadSourceRows()

  const results  = source.map(validateAndMap)
  const passed   = results.filter(r => r.errors.length === 0)
  const rejected = results.filter(r => r.errors.length > 0)

  // Guard name — actif en simulation ET en insert
  const existingNames = new Set(await db('ref_equipment').pluck('name'))
  const skipped  = passed.filter(r => existingNames.has(r.name))
  const toInsert = passed.filter(r => !existingNames.has(r.name))

  // ── Rapport rejections ────────────────────────────────────────────────────
  if (rejected.length > 0) {
    console.log('❌ REJECTIONS :\n')
    rejected.forEach(r => {
      r.errors.forEach(e => {
        console.log(`  [${r.name}]  ${e.field} = "${e.raw}"  →  ${e.reason}`)
      })
    })
    console.log()
  }

  // ── Rapport NT par défaut ─────────────────────────────────────────────────
  const ntDefaultItems = toInsert.filter(r => r.ntDefault)
  if (ntDefaultItems.length > 0) {
    console.log(`⚠️  NT manquant → tech_level=1 par défaut (${ntDefaultItems.length} items) :`)
    ntDefaultItems.forEach(r => console.log(`   - ${r.name}`))
    console.log()
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log(`Source totale   : ${source.length}`)
  console.log(`✅ Valides      : ${passed.length}`)
  console.log(`❌ Rejetés      : ${rejected.length}`)
  console.log(`⏭️  Déjà en base : ${skipped.length} (guard name)`)
  console.log(`📥 À insérer    : ${toInsert.length}`)
  if (ntDefaultItems.length > 0) console.log(`⚠️  NT=1 défaut  : ${ntDefaultItems.length} (à corriger via admin)`)

  if (DRY_RUN) {
    console.log('\n→ Simulation terminée. Relancer avec --insert pour écrire.')
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  if (!DRY_RUN && toInsert.length > 0) {
    const BATCH = 100
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH).map(r => r.dbRow)
      await db('ref_equipment').insert(batch)
      process.stdout.write(`  inserting ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}...\r`)
    }
    console.log(`\n✅ ${toInsert.length} items insérés.`)
  }

  // ── rejections.json ───────────────────────────────────────────────────────
  if (rejected.length > 0) {
    const rejPath = resolve(__dirname, 'rejections.json')
    fs.writeFileSync(rejPath, JSON.stringify(
      rejected.map(r => ({ name: r.name, errors: r.errors })),
      null, 2
    ))
    console.log(`📄 Détails → server/src/db/seeds/rejections.json`)
  }

  await db.destroy()
}

main().catch(err => { console.error(err); process.exit(1) })
