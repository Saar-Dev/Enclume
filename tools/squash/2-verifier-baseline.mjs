#!/usr/bin/env node
// [SQUASH v3 — 2026-10-17] ÉTAPE 2/3 — PREUVE : rejoue UNIQUEMENT la baseline
// sur une base vierge et montre qu'elle reproduit EXACTEMENT l'état de la
// chaîne complète (compteurs + pg_dump identiques).
//
// Non mutante et relançable seule. La vérification se fait sur une COPIE de la
// baseline dans un dossier temporaire : le dépôt n'est pas touché, un échec
// n'a rien à annuler. « docker compose ... down -v » nettoie le reste.
//
// Lancement, depuis la racine du dépôt :  node tools/squash/2-verifier-baseline.mjs

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as lib from './lib.mjs'

async function main() {
  if (!existsSync(lib.SQL_PATH) || !existsSync(lib.WRAPPER_PATH)) {
    lib.die('Baseline absente (000_baseline.js / 000_baseline.sql).\nLance d\'abord : node tools/squash/1-rejouer-chaine.mjs')
  }
  const countsPath = lib.LAST_RUN_DIR + '/counts.json'
  if (!existsSync(countsPath)) {
    lib.die('Compteurs de l\'étape 1 introuvables (' + countsPath + ').\nRelance : node tools/squash/1-rejouer-chaine.mjs')
  }
  const expected = JSON.parse(readFileSync(countsPath, 'utf8'))

  lib.checkDeps()
  console.log('\n=== ÉTAPE 2/3 — Preuve : la baseline seule reproduit la chaîne ===')
  lib.resetPg()

  // COPIE de la baseline dans un dossier temporaire : le wrapper charge le
  // .sql voisin de son propre fichier — on prouve LA baseline, pas le dépôt.
  const verifyDir = mkdtempSync(tmpdir() + '/enclume-baseline-verify-')
  let db = null
  try {
    copyFileSync(lib.WRAPPER_PATH, verifyDir + '/000_baseline.js')
    copyFileSync(lib.SQL_PATH, verifyDir + '/000_baseline.sql')

    // knex chargé via un require résolu comme si on était dans server/src/db :
    // instance dédiée, connection lazy — isolée du knex de l'appli.
    const req = createRequire(pathToFileURL(lib.REPO + '/server/src/db/knex.js').href)
    const knex = req('knex')
    const NaturalMigrationSource = req('./naturalMigrationSource.cjs')

    db = knex({
      client: 'pg',
      connection: lib.DATABASE_URL,
      migrations: { migrationSource: new NaturalMigrationSource(verifyDir) },
    })
    const result = await db.migrate.latest()
    const count = result[1]
    const journal = Number((await db('knex_migrations').count('* as n').first()).n)
    const refEquipment = Number((await db('ref_equipment').count('* as n').first()).n)
    const users = Number((await db('users').count('* as n').first()).n)

    const dumpApres = lib.dumpDb()
    writeFileSync(lib.LAST_RUN_DIR + '/dump-apres.sql', dumpApres)

    if (count !== 1 || journal !== 1) {
      throw new Error('La baseline devait s\'appliquer en exactement 1 migration (appliquées=' + count + ', journal=' + journal + ').')
    }
    if (refEquipment !== expected.refEquipment || users !== expected.users) {
      throw new Error('Compteurs différents de la chaîne complète : ref_equipment ' + expected.refEquipment + '/' + refEquipment + ', users ' + expected.users + '/' + users + '.')
    }
    const normAvant = lib.normalizeDump(readFileSync(lib.LAST_RUN_DIR + '/dump-avant.sql', 'utf8'))
    const normApres = lib.normalizeDump(dumpApres)
    if (normAvant !== normApres) {
      throw new Error('Les deux dumps DIFFÈRENT — conservés dans tools/squash/last-run/ pour analyse.\nNe lance PAS 3-archiver.mjs tant que la preuve n\'est pas faite.')
    }
    lib.ok('Baseline appliquée : 1 migration, journal=1')
    lib.ok('Mêmes compteurs que la chaîne : ref_equipment=' + refEquipment + ', users=' + users)
    lib.ok('DIFF NUL — la baseline est rigoureusement identique à la chaîne complète.')
    console.log('>>> PREUVE FAITE <<<')
    console.log('\nPoursuis avec (étape MUTANTE, la seule) :  node tools/squash/3-archiver.mjs')
  } finally {
    if (db) {
      try { await db.destroy() } catch (e) { /* déjà détruite */ }
    }
    rmSync(verifyDir, { recursive: true, force: true })
  }
}

main().catch((e) => lib.die(e?.stack || e))
