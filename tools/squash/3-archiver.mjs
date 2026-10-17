#!/usr/bin/env node
// [SQUASH v3 — 2026-10-17] ÉTAPE 3/3 — ARCHIVAGE : la SEULE étape qui modifie
// le dépôt. Elle ne s'exécute qu'après la preuve de l'étape 2, et re-vérifie
// cette preuve SANS Docker (les deux dumps enregistrés doivent être égaux).
// Elle refuse aussi de partir si l'arbre n'est pas exactement dans l'attendu.
//
// En cas d'échec : git reset --hard + suppression du dossier d'archivage —
// le dépôt revient à l'état d'avant l'étape, rien n'est perdu.
//
// Lancement, depuis la racine du dépôt :  node tools/squash/3-archiver.mjs

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import * as lib from './lib.mjs'

function git(args, opts) {
  return execFileSync('git', args, Object.assign({ cwd: lib.REPO, maxBuffer: 512 * 1024 * 1024 }, opts || {}))
}

function undoArchive() {
  try { git(['reset', '--hard'], { stdio: 'ignore' }) } catch (e) { /* rien */ }
  rmSync(lib.ARCHIVE_DIR, { recursive: true, force: true })
}

function main() {
  console.log('\n=== ÉTAPE 3/3 — Archivage de la chaîne historique ===')

  // --- preuve re-vérifiée SANS Docker : les dumps enregistrés doivent exister
  // et être identiques (ceux de l'étape 2, relançable seule).
  const dumpAvant = lib.LAST_RUN_DIR + '/dump-avant.sql'
  const dumpApres = lib.LAST_RUN_DIR + '/dump-apres.sql'
  for (const p of [dumpAvant, dumpApres]) {
    if (!existsSync(p)) {
      lib.die('Preuve absente : ' + p + ' manquant.\nLance dans l\'ordre :\n  node tools/squash/1-rejouer-chaine.mjs\n  node tools/squash/2-verifier-baseline.mjs')
    }
  }
  if (lib.normalizeDump(readFileSync(dumpAvant, 'utf8')) !== lib.normalizeDump(readFileSync(dumpApres, 'utf8'))) {
    lib.die('Les dumps enregistrés ne sont PAS identiques — la preuve de l\'étape 2 n\'est pas faite.\nRien n\'est archivé. Relance l\'étape 2 et analyse tools/squash/last-run/.')
  }
  console.log('[OK] Preuve re-vérifiée : dumps avant/après identiques')

  // --- garde : l'arbre doit être EXACTEMENT l'attendu (rien d'autre ne bouge)
  const ALLOWED = [
    '?? server/src/db/migrations/000_baseline.js',
    '?? server/src/db/migrations/000_baseline.sql',
    '?? tools/squash/last-run/',
  ]
  const porcelain = git(['status', '--porcelain']).toString('utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  const unexpected = porcelain.filter((l) => ALLOWED.indexOf(l) === -1)
  if (unexpected.length > 0) {
    lib.die('L\'arbre n\'est pas dans l\'état attendu — je ne touche à rien. En trop ou modifié :\n  ' + unexpected.slice(0, 10).join('\n  ') + '\nCommite ou remets ces fichiers, puis relance.')
  }
  console.log('[OK] Arbre dans l\'état attendu (baseline + preuve non suivies, rien d\'autre)')

  // --- archivage par lots de 25 (git mv)
  mkdirSync(lib.ARCHIVE_DIR, { recursive: true })
  const toArchive = readdirSync(lib.MIGRATIONS_DIR).filter((f) => f !== '000_baseline.js' && f !== '000_baseline.sql')
  if (toArchive.length === 0) {
    lib.die('Rien à archiver — la chaîne historique a déjà été déplacée ?')
  }
  for (let i = 0; i < toArchive.length; i += 25) {
    const chunk = toArchive.slice(i, i + 25)
    try {
      git(['mv'].concat(chunk.map((f) => lib.MIGRATIONS_REL + '/' + f)).concat([lib.ARCHIVE_REL]), { stdio: 'ignore' })
    } catch (e) {
      undoArchive()
      lib.die('git mv a échoué (' + chunk[0] + '...) — dépôt remis à zéro, rien n\'est perdu.')
    }
  }
  const restants = readdirSync(lib.MIGRATIONS_DIR)
  if (restants.length !== 2 || restants.indexOf('000_baseline.js') === -1 || restants.indexOf('000_baseline.sql') === -1) {
    undoArchive()
    lib.die('État final inattendu de migrations/ — dépôt remis à zéro, rien n\'est perdu.')
  }
  console.log('[OK] ' + toArchive.length + ' migrations archivées dans server/src/db/migrations-archive/')
  console.log('[OK] server/src/db/migrations/ contient exactement la baseline (2 fichiers)')

  // --- prochaines étapes
  console.log('')
  console.log('Le refactor est prêt. Commandes à exécuter maintenant (PowerShell) :')
  console.log('')
  console.log('  git add -A')
  console.log('  git commit -m "Squash migrations: baseline 000 + archivage de la chaîne historique"')
  console.log('  git push')
  console.log('  docker compose -f tools/squash/docker-compose.yml -p enclume-squash down -v')
  console.log('')
  console.log('Rappels importants :')
  console.log('  - La numérotation des NOUVELLES migrations repart de 001_.')
  console.log('  - Garde-fou avant chaque commit : node tools/check-migration-duplicates.mjs')
  console.log('  - Ta base de dev locale : recrée-la (docker compose down -v && docker compose up -d,')
  console.log('    côté app), puis relance le backend — il appliquera la baseline sur la base vide.')
  console.log('  - La PR doit être relue (diff complet) avant fusion dans dev/Saar.')
}

main().catch((e) => lib.die(e?.stack || e))
