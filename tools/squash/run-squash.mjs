#!/usr/bin/env node
// tools/squash/run-squash.mjs — Squash des migrations Enclume : baseline unique.
//
// Ce script fait TOUT le travail du refactor approuvé le 17/10/2026 :
//   PHASE 1 — Lance une PostgreSQL 16 jetable dans Docker (port 127.0.0.1:55432)
//   PHASE 2 — Joue la chaîne COMPLETE des migrations actuelles sur cette base vierge
//             (= le test base vierge §6.1 du rapport d'audit, industrialisé)
//   PHASE 3 — pg_dump cette base validée -> server/src/db/migrations/000_baseline.sql
//             (schéma + données de référence, sans la table knex_migrations)
//   PHASE 4 — Déplace toutes les autres migrations vers migrations-archive/ (via git mv)
//   PHASE 5 — Rejoue la chaîne squashed (000_baseline seule) sur une 2e base jetable
//   PHASE 6 — Compare les deux pg_dump mot à mot : diff nul = preuve d'équivalence
//   PHASE 7 — Nettoie les conteneurs et affiche les commandes Git à suivre
//
// Prérequis : Docker (Desktop) lancé, Node 20+, git, et `npm install` fait dans server/.
// Fenêtre de sécurité : le script refuse de démarrer si le dépôt a des modifications
// non commitées (rollback propre garanti en cas d'échec).
//
// En cas d'échec de la PHASE 6, le script annule automatiquement les déplacements
// (git reset --hard + git rm du wrapper) : on revient à l'état initial.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MIGRATIONS_DIR = path.join(REPO, 'server/src/db/migrations')
const ARCHIVE_DIR = path.join(REPO, 'server/src/db/migrations-archive')
const LAST_RUN_DIR = path.join(REPO, 'tools/squash/last-run')

const PG = {
  image: 'postgres:16-alpine',
  user: 'enclume',
  pass: 'squashpass',
  db: 'enclume_squash',
  container1: 'enclume-squash-pg',
  container2: 'enclume-squash-pg2',
  port1: 55432,
  port2: 55433,
}

const step = (m) => console.log('\n=== ' + m + ' ===')
const ok = (m) => console.log('[OK] ' + m)
const die = (m) => { console.error('\n[ÉCHEC] ' + m); process.exit(1) }

async function run(cmd, args, opts = {}) {
  try {
    const { stdout } = await execFileP(cmd, args, {
      maxBuffer: 512 * 1024 * 1024,
      cwd: REPO,
      ...opts,
    })
    return { ok: true, stdout }
  } catch (e) {
    return { ok: false, error: e }
  }
}

async function startPg(container, port) {
  await run('docker', ['rm', '-f', container])
  const started = await run('docker', [
    'run', '-d', '--name', container,
    '-e', 'POSTGRES_USER=' + PG.user,
    '-e', 'POSTGRES_PASSWORD=' + PG.pass,
    '-e', 'POSTGRES_DB=' + PG.db,
    '-p', '127.0.0.1:' + port + ':5432',
    PG.image,
  ])
  if (!started.ok) die('docker run a échoué : ' + (started.error?.message || started.error))
  for (let i = 0; i < 30; i++) {
    const ready = await run('docker', ['exec', container, 'pg_isready', '-U', PG.user, '-d', PG.db])
    if (ready.ok) return
    await new Promise(r => setTimeout(r, 2000))
  }
  die('PostgreSQL (' + container + ') ne répond pas après 60 s')
}

async function dump(container) {
  const r = await run('docker', [
    'exec', container, 'pg_dump',
    '-U', PG.user,
    '--inserts', '--no-owner', '--no-privileges',
    '--exclude-table=knex_migrations',
    '--exclude-table-data=knex_migrations',
    PG.db,
  ])
  if (!r.ok) die('pg_dump a échoué : ' + (r.error?.message || r.error))
  return r.stdout
}

async function migrateChain(url) {
  process.env.DATABASE_URL = url
  const dbPath = pathToFileURL(path.join(REPO, 'server/src/db/knex.js')).href
  const { default: db } = await import(dbPath)
  const [batch, count] = await db.migrate.latest()
  const journal = await db('knex_migrations').count('* as n').first()
  const refEquipment = await db('ref_equipment').count('* as n').first()
  const users = await db('users').count('* as n').first()
  await db.destroy()
  return {
    batch, count,
    journal: Number(journal.n),
    refEquipment: Number(refEquipment.n),
    users: Number(users.n),
  }
}

async function listMigrations() {
  const srcPath = pathToFileURL(path.join(REPO, 'server/src/db/naturalMigrationSource.cjs')).href
  const { default: NaturalMigrationSource } = await import(srcPath)
  const source = new NaturalMigrationSource(MIGRATIONS_DIR)
  return source.getMigrations()
}

async function main() {
  const keep = process.argv.includes('--keep')

  // ---------- PHASE 0 : vérifications ----------
  step('PHASE 0 — Vérifications préalables')
  const dockerOk = await run('docker', ['info'])
  if (!dockerOk.ok) die('Docker ne répond pas. Lance Docker Desktop et relance.')
  const status = await run('git', ['status', '--porcelain'])
  if (!status.ok) die('git est absent ou le dossier n\'est pas un dépôt.')
  if (status.stdout.trim()) {
    die('Le dépôt a des modifications non commitées.\n' +
        'Committe-les (ou stash) avant de lancer le squash — c\'est la garantie du retour arrière propre.')
  }
  if (!fs.existsSync(path.join(REPO, 'server/node_modules/knex'))) {
    die('server/node_modules est absent. Lance d\'abord : cd server && npm install')
  }
  ok('Docker, git, arbre propre, dépendances installées')

  // ---------- PHASE 1 : base jetable n°1 ----------
  step('PHASE 1 — PostgreSQL 16 jetable (port 127.0.0.1:' + PG.port1 + ')')
  await startPg(PG.container1, PG.port1)
  ok('Base jetable en ligne')

  // ---------- PHASE 2 : chaîne complète sur base vierge ----------
  step('PHASE 2 — Chaîne COMPLETE des migrations sur base vierge')
  const files = await listMigrations()
  console.log('Migrations détectées dans la chaîne : ' + files.length)
  const run1 = await migrateChain(
    'postgresql://' + PG.user + ':' + PG.pass + '@127.0.0.1:' + PG.port1 + '/' + PG.db
  )
  if (run1.count !== files.length) {
    die('Migrations appliquées (' + run1.count + ') != fichiers détectés (' + files.length + ')')
  }
  ok('Migrations appliquées : ' + run1.count + ' — journal : ' + run1.journal)
  if (run1.refEquipment < 100) die('ref_equipment anormalement vide (' + run1.refEquipment + ')')
  if (run1.users < 1) die('La table users est vide — la chaîne devrait semer le compte admin.')
  ok('Sanity : ref_equipment=' + run1.refEquipment + ', users=' + run1.users)
  console.log('\n>>> Le test base vierge (rapport d\'audit, §6.1) est RÉUSSI <<<')

  // ---------- PHASE 3 : génération de la baseline ----------
  step('PHASE 3 — Génération de 000_baseline.sql (pg_dump)')
  const dump1 = await dump(PG.container1)
  const sqlHeader =
    '-- 000_baseline.sql — GÉNÉRÉ automatiquement par tools/squash/run-squash.mjs\n' +
    '-- le ' + new Date().toISOString() + ' depuis la chaîne de ' + run1.count + ' migrations.\n' +
    '-- NE JAMAIS ÉDITER À LA MAIN. Les corrections vont dans de NOUVELLES migrations (001_...).\n'
  const sqlPath = path.join(MIGRATIONS_DIR, '000_baseline.sql')
  fs.writeFileSync(sqlPath, sqlHeader + dump1)
  ok('000_baseline.sql écrit (' + Math.round(dump1.length / 1024) + ' Kio)')

  const wrapperPath = path.join(MIGRATIONS_DIR, '000_baseline.js')
  if (!fs.existsSync(wrapperPath)) {
    fs.writeFileSync(wrapperPath, WRAPPER_SOURCE)
    ok('000_baseline.js écrit (wrapper)')
  } else {
    ok('000_baseline.js déjà présent')
  }

  // ---------- PHASE 4 : archivage de la chaîne historique ----------
  step('PHASE 4 — Archivage des ' + files.length + ' migrations historiques')
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
  let moved = 0
  for (const file of fs.readdirSync(MIGRATIONS_DIR)) {
    if (file === '000_baseline.js' || file === '000_baseline.sql') continue
    const mv = await run('git', ['mv', path.join('server/src/db/migrations', file), path.join('server/src/db/migrations-archive', file)])
    if (!mv.ok) die('git mv a échoué pour ' + file + ' : ' + (mv.error?.message || mv.error))
    moved++
  }
  ok(moved + ' fichiers déplacés vers migrations-archive/')

  // ---------- PHASE 5 : chaîne squashed sur base vierge n°2 ----------
  step('PHASE 5 — Chaîne SQUASHED (baseline seule) sur base vierge n°2')
  await startPg(PG.container2, PG.port2)
  const run2 = await migrateChain(
    'postgresql://' + PG.user + ':' + PG.pass + '@127.0.0.1:' + PG.port2 + '/' + PG.db
  )
  if (run2.count !== 1 || run2.journal !== 1) {
    die('La chaîne squashed devrait appliquer exactement 1 migration (reçues : ' + run2.count + ')')
  }
  if (run2.refEquipment !== run1.refEquipment || run2.users !== run1.users) {
    die('Compteurs incohérents : ref_equipment ' + run1.refEquipment + '/' + run2.refEquipment +
        ', users ' + run1.users + '/' + run2.users)
  }
  ok('Baseline appliquée — mêmes compteurs')

  // ---------- PHASE 6 : preuve d'équivalence ----------
  step('PHASE 6 — Preuve d\'équivalence (diff des deux pg_dump)')
  const dump2 = await dump(PG.container2)
  if (dump1 === dump2) {
    ok('DIFF NUL — la baseline est rigoureusement identique à la chaîne complète.')
  } else {
    fs.mkdirSync(LAST_RUN_DIR, { recursive: true })
    fs.writeFileSync(path.join(LAST_RUN_DIR, 'dump-avant-squash.sql'), dump1)
    fs.writeFileSync(path.join(LAST_RUN_DIR, 'dump-apres-squash.sql'), dump2)
    // Rollback automatique : on rend le dépôt à son état initial
    await run('git', ['reset', '--hard'])
    try { fs.rmSync(sqlPath) } catch {}
    try { fs.rmSync(ARCHIVE_DIR, { recursive: true, force: true }) } catch {}
    await run('git', ['rm', '-f', 'server/src/db/migrations/000_baseline.js'])
    await run('docker', ['rm', '-f', PG.container1])
    await run('docker', ['rm', '-f', PG.container2])
    die('Les deux états DIFFÈRENT. Rollback automatique effectué (migrations restaurées, ' +
        'baseline retirée de la branche — committe ce retour arrière). Dumps conservés ' +
        'dans tools/squash/last-run/ pour analyse. Ne merge rien.')
  }

  // ---------- PHASE 7 : nettoyage + prochaines étapes ----------
  step('PHASE 7 — Nettoyage et prochaines étapes')
  if (!keep) {
    await run('docker', ['rm', '-f', PG.container1])
    await run('docker', ['rm', '-f', PG.container2])
    ok('Conteneurs jetables supprimés')
  } else {
    ok('Conteneurs conservés (--keep) : ' + PG.container1 + ', ' + PG.container2)
  }
  console.log(`
Le refactor est prêt. Commandes à exécuter maintenant :

  git add -A
  git commit -m "Squash migrations: baseline 000 générée + archivage de la chaîne historique"
  git push

Rappels importants :
  - La numérotation des NOUVELLES migrations repart de 001_.
  - Ta base de dev locale : docker compose down -v && docker compose up -d
    puis relance le backend (il appliquera la baseline sur la base vide).
    (Sauvegarde d'abord tes données si tu veux les garder.)
  - La PR doit être relue (diff complet) avant fusion dans dev/Saar.
`)
}

const WRAPPER_SOURCE = `// 000_baseline.js — Migration de référence unique (squash du 2026-10-17).
// L'état complet (schéma + données de référence) vit dans 000_baseline.sql,
// généré mécaniquement par tools/squash/run-squash.mjs. NE JAMAIS éditer le .sql
// à la main : les évolutions vont dans de NOUVELLES migrations (001_, 002_...).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sqlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '000_baseline.sql')

export const up = async (knex) => {
  if (!fs.existsSync(sqlPath)) {
    throw new Error('000_baseline.sql introuvable — le générer avec : node tools/squash/run-squash.mjs')
  }
  const raw = fs.readFileSync(sqlPath, 'utf8')
  // pg_dump >= 16 émet des méta-commandes psql (\restrict, \unrestrict...) : on les retire.
  const sql = raw.split('\n').filter((line) => !/^\s*\\/.test(line)).join('\n')
  await knex.raw(sql)
}

export const down = async () => {
  throw new Error('Le down de la baseline n\'est pas fourni — retour arrière via Git (branche d\'avant le squash).')
}
`

main().catch((e) => die(e?.stack || String(e)))
