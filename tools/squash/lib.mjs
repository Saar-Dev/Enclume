// [SQUASH v3 — 2026-10-17] Bibliothèque commune du pipeline squash.
// AUCUNE commande git ici : les étapes 1 et 2 ne mutent jamais le dépôt.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export const MARKER = '[SQUASH v3 — 2026-10-17]'
export const REPO = process.cwd()
export const COMPOSE_REL = 'tools/squash/docker-compose.yml'
export const COMPOSE_PROJECT = 'enclume-squash'
export const MIGRATIONS_REL = 'server/src/db/migrations'
export const MIGRATIONS_DIR = REPO + '/' + MIGRATIONS_REL
export const ARCHIVE_REL = 'server/src/db/migrations-archive'
export const ARCHIVE_DIR = REPO + '/' + ARCHIVE_REL
export const LAST_RUN_DIR = REPO + '/tools/squash/last-run'
export const SQL_PATH = MIGRATIONS_DIR + '/000_baseline.sql'
export const WRAPPER_PATH = MIGRATIONS_DIR + '/000_baseline.js'
export const DATABASE_URL = 'postgresql://enclume:squashpass@127.0.0.1:55432/enclume_squash'

export function die(msg) {
  console.error('\n[ÉCHEC] ' + msg)
  process.exit(1)
}

export function ok(msg) {
  console.log('[OK] ' + msg)
}

// Toute commande Docker passe par la MÊME compose déclarative (même fichier,
// même projet) : aucun état Docker n'échappe au pipeline.
export function compose(args, opts) {
  return execFileSync(
    'docker',
    ['compose', '-f', COMPOSE_REL, '-p', COMPOSE_PROJECT].concat(args),
    Object.assign({ cwd: REPO, maxBuffer: 512 * 1024 * 1024 }, opts || {})
  )
}

export function checkDeps() {
  if (!existsSync(MIGRATIONS_DIR)) {
    die('server/src/db/migrations introuvable — lance les étapes depuis la racine du dépôt :\n  node tools/squash/1-rejouer-chaine.mjs')
  }
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' })
  } catch (e) {
    die('Docker ne répond pas. Lance Docker Desktop puis relance.')
  }
  try {
    compose(['version'], { stdio: 'ignore' })
  } catch (e) {
    die('Le plugin docker compose est indisponible.')
  }
  if (!existsSync(REPO + '/server/node_modules/knex') || !existsSync(REPO + '/server/node_modules/pg')) {
    die('server/node_modules est incomplet. Lance d\'abord, dans server/ : npm install')
  }
}

// Attente bloquante sans dépendance externe (Atomics.wait est légal dans Node).
export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function ensurePg() {
  compose(['up', '-d'], { stdio: 'inherit' })
  for (let i = 0; i < 90; i++) {
    try {
      compose(['exec', '-T', 'pg', 'pg_isready', '-U', 'enclume', '-d', 'enclume_squash'], { stdio: 'ignore' })
      return
    } catch (e) {
      sleep(2000)
    }
  }
  die('PostgreSQL ne répond pas après 180 s (premier téléchargement de l\'image compris).')
}

// Base VIERGE garantie : down -v détruit le volume, up recrée un état neuf.
export function resetPg() {
  try {
    compose(['down', '-v'], { stdio: 'inherit' })
  } catch (e) { /* rien à nettoyer la première fois */ }
  ensurePg()
}

export function dumpDb() {
  // knex_migrations ET knex_migrations_lock sont des tables OUTIL de knex :
  // knex les recrée lui-même sur toute base neuve, elles n'appartiennent pas
  // à la baseline (sinon collision au rejeu de la baseline seule).
  return compose([
    'exec', '-T', 'pg', 'pg_dump', '-U', 'enclume',
    '--inserts', '--no-owner', '--no-privileges',
    '--exclude-table=knex_migrations', '--exclude-table-data=knex_migrations',
    '--exclude-table=knex_migrations_lock', '--exclude-table-data=knex_migrations_lock',
    'enclume_squash',
  ]).toString('utf8')
}

// pg_dump >= 16.4 émet \restrict <jeton aléatoire> / \unrestrict <jeton> autour
// des fonctions SECURITY DEFINER : le jeton change à chaque dump. On retire ces
// lignes AVANT toute comparaison (le wrapper, lui, retire toute méta-commande
// au moment d'exécuter la baseline).
export function normalizeDump(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*\\(unrestrict|restrict)\b/.test(line))
    .join('\n')
}
