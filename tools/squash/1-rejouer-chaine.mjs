#!/usr/bin/env node
// [SQUASH v3 — 2026-10-17] ÉTAPE 1/3 — Rejoue la chaîne COMPLETE des migrations
// sur une base vierge (le test « base vierge » de l'audit, §6.1), puis en
// extrait la baseline : 000_baseline.sql (dump complet) + 000_baseline.js.
//
// Étape NON MUTANTE : elle n'écrit que des fichiers non suivis par git
// (000_baseline.js, 000_baseline.sql, tools/squash/last-run/). Un échec ne
// casse rien : relance-la, elle repart de zéro. Base jetable, pour tout jeter :
//   docker compose -f tools/squash/docker-compose.yml -p enclume-squash down -v
//
// Lancement, depuis la racine du dépôt :  node tools/squash/1-rejouer-chaine.mjs

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import * as lib from './lib.mjs'

// Le wrapper ne doit PAS être suivi par git : committé, NaturalMigrationSource
// le trierait en tête de chaîne (préfixe 000) et son up() échouerait faute du
// .sql que cette étape génère précisément.
function assertWrapperNotTracked() {
  let tracked = ''
  try {
    tracked = execFileSync('git', ['ls-files', '--', lib.WRAPPER_PATH], { cwd: lib.REPO }).toString('utf8')
  } catch (e) {
    lib.die('git est absent ou le dossier n\'est pas un dépôt.')
  }
  if (tracked.trim() !== '') {
    lib.die('000_baseline.js est encore suivi par git (la pose devait le retirer).\nVérifie l\'étape de pose, puis relance.')
  }
}

// Wrapper régénéré — IDENTIQUE à l'octet près à la version audité du 17/10/2026
// (lignes JSON.stringify : aucun template literal, aucun backtick).
const WRAPPER_SOURCE = [
  "// 000_baseline.js — Migration de référence unique (squash du 2026-10-17).",
  "// L'état complet (schéma + données de référence) vit dans 000_baseline.sql,",
  "// généré mécaniquement par tools/squash/run-squash.mjs. NE JAMAIS éditer le .sql",
  "// à la main : les évolutions vont dans de NOUVELLES migrations (001_, 002_...).",
  "// Les migrations historiques sont archivées dans ../migrations-archive/.",
  "import fs from 'node:fs'",
  "import path from 'node:path'",
  "import { fileURLToPath } from 'node:url'",
  "",
  "const sqlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '000_baseline.sql')",
  "",
  "export const up = async (knex) => {",
  "  if (!fs.existsSync(sqlPath)) {",
  "    throw new Error('000_baseline.sql introuvable — le générer avec : node tools/squash/run-squash.mjs')",
  "  }",
  "  const raw = fs.readFileSync(sqlPath, 'utf8')",
  "  // pg_dump >= 16 émet des méta-commandes psql (\\restrict, \\unrestrict...) : on les retire.",
  "  const sql = raw.split('\\n').filter((line) => !/^\\s*\\\\/.test(line)).join('\\n')",
  "  await knex.raw(sql)",
  "}",
  "",
  "export const down = async () => {",
  "  throw new Error('Le down de la baseline n\\'est pas fourni — retour arrière via Git (branche d\\'avant le squash).')",
  "}",
  "",
].join('\n')

async function main() {
  assertWrapperNotTracked()
  lib.checkDeps()
  console.log('\n=== ÉTAPE 1/3 — Chaîne complète des migrations sur base vierge ===')

  // Une baseline d'un run précédent (non suivie) serait triée EN TÊTE de la
  // chaîne : on la retire pour rejouer la chaîne historique pure.
  rmSync(lib.SQL_PATH, { force: true })
  rmSync(lib.WRAPPER_PATH, { force: true })

  lib.resetPg()

  // Rejeu via le VRAI knex de l'appli. Cette étape est son propre process :
  // le cache de modules ESM ne peut pas renvoyer une instance détruite.
  process.env.DATABASE_URL = lib.DATABASE_URL
  const dbUrl = pathToFileURL(lib.REPO + '/server/src/db/knex.js').href
  const { default: db } = await import(dbUrl)
  const nmsUrl = pathToFileURL(lib.REPO + '/server/src/db/naturalMigrationSource.cjs').href
  const { default: NaturalMigrationSource } = await import(nmsUrl)
  const detected = await new NaturalMigrationSource(lib.MIGRATIONS_DIR).getMigrations()
  console.log('Migrations détectées dans la chaîne : ' + detected.length)
  console.log('(Plusieurs minutes possibles sans affichage — patience.)')

  const result = await db.migrate.latest()
  const count = result[1]
  const journal = Number((await db('knex_migrations').count('* as n').first()).n)
  const refEquipment = Number((await db('ref_equipment').count('* as n').first()).n)
  const users = Number((await db('users').count('* as n').first()).n)
  await db.destroy()

  if (count !== detected.length) {
    lib.die('Migrations appliquées (' + count + ') != détectées (' + detected.length + ').')
  }
  if (refEquipment < 100) {
    lib.die('ref_equipment anormalement vide (' + refEquipment + ') — la chaîne n\'a pas joué correctement.')
  }
  if (users < 1) {
    lib.die('La table users est vide — la chaîne doit semer le compte admin.')
  }
  lib.ok(count + ' migrations appliquées — journal : ' + journal)
  lib.ok('Sanity : ref_equipment=' + refEquipment + ', users=' + users)
  console.log('>>> Le test base vierge (audit, §6.1) est RÉUSSI <<<')

  // Extraction de la baseline depuis l'état qui vient d'être prouvé jouable.
  const dump = lib.dumpDb()
  mkdirSync(lib.LAST_RUN_DIR, { recursive: true })
  writeFileSync(lib.LAST_RUN_DIR + '/dump-avant.sql', dump)
  writeFileSync(lib.LAST_RUN_DIR + '/counts.json', JSON.stringify({ count, journal, refEquipment, users }, null, 2) + '\n')

  const header =
    '-- 000_baseline.sql — GÉNÉRÉ automatiquement par tools/squash/1-rejouer-chaine.mjs\n' +
    '-- le ' + new Date().toISOString() + ' depuis la chaîne de ' + count + ' migrations.\n' +
    '-- NE JAMAIS ÉDITER À LA MAIN. Les évolutions vont dans de NOUVELLES migrations (001_...).\n'
  writeFileSync(lib.SQL_PATH, header + dump)
  writeFileSync(lib.WRAPPER_PATH, WRAPPER_SOURCE)
  try {
    execFileSync(process.execPath, ['--check', lib.WRAPPER_PATH], { stdio: 'ignore' })
  } catch (e) {
    lib.die('node --check rejette le wrapper régénéré (ne devrait jamais arriver).')
  }
  lib.ok('Baseline écrite : 000_baseline.sql (' + Math.round(dump.length / 1024) + ' Kio) + 000_baseline.js (syntaxe validée)')
  console.log('\nÉtape 1 terminée. Poursuis avec :  node tools/squash/2-verifier-baseline.mjs')
}

main().catch((e) => lib.die(e?.stack || e))
