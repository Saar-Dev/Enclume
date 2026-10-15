// audit_stale_tickets.mjs — LECTURE SEULE, aucune écriture en base. À lancer avant de choisir un
// ticket à traiter (AGENTS.md § Commandes) : détecte les tickets déjà corrigés en code mais jamais
// reflétés dans `bug_tickets`, pour ne jamais rediagnostiquer un bug déjà réglé.
//
// Né du constat du 2026-10-15 : des dizaines de scripts `note_ticket*`/`resolve_ticket*` écrits,
// committés, jamais exécutés — chaque nouvel agent retrouvait le ticket "ouvert" et recommençait le
// diagnostic depuis zéro. Deux volets :
//   1. Pour chaque script de clôture déjà écrit, le ticket qu'il vise a-t-il bien reçu son MARKER ?
//      Sinon : script jamais exécuté, à lancer (pas à re-diagnostiquer).
//   2. Pour chaque ticket ouvert/en cours SANS note, son code apparaît-il dans un commit `git log` ?
//      Si oui : corrigé en code, mais aucun script de clôture n'a jamais été écrit pour lui.
//
// Lancement manuel, local, depuis la racine (lecture seule — l'agent le lance lui-même) :
//   node --env-file=.env server/src/scripts/audit_stale_tickets.mjs

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import db from '../db/knex.js'

const SCRIPTS_DIR = path.resolve(import.meta.dirname)
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..', '..', '..')

// ── Volet 1 : scripts de clôture déjà écrits, jamais exécutés ──────────────────────────────────

function extractCodes(src) {
  const m = src.match(/'[A-Z][A-Z0-9_]*(-[A-Z0-9_]+)*'/g) || []
  const bad = new Set(['OK', 'SKIP', 'TODO', 'MARKER'])
  return [...new Set(m.map(s => s.slice(1, -1)).filter(c => !bad.has(c) && c.length >= 3))]
}

function extractMarker(src) {
  const m = src.match(/const\s+MARKER\s*=\s*'([^']+)'/)
  return m ? m[1] : null
}

function extractTitleLookup(src) {
  if (!/\.where\(\{\s*title\s*\}\)|\.where\(\{\s*title:/.test(src)) return null
  const m = src.match(/const\s+title\s*=\s*\n?\s*'((?:[^'\\]|\\.)*)'/)
    || src.match(/const\s+TITLE\s*=\s*\n?\s*'((?:[^'\\]|\\.)*)'/)
  return m ? m[1].replace(/\\'/g, "'") : null
}

function extractIdLookup(src) {
  const m = src.match(/\.where\(\{\s*id:\s*(ID|TICKET_ID)\s*\}\)/)
  if (!m) return null
  const re = new RegExp(`const\\s+${m[1]}\\s*=\\s*'([0-9a-f-]+)'`)
  const idMatch = src.match(re)
  return idMatch ? idMatch[1] : null
}

function extractClusterLookup(src) {
  if (!/\.where\(\{\s*cluster_label:/.test(src)) return null
  const m = src.match(/const\s+CLUSTER\s*=\s*'([^']+)'/)
  return m ? m[1] : null
}

async function auditClosureScripts() {
  const files = fs.readdirSync(SCRIPTS_DIR).filter(f => /^(note_tickets?|resolve_tickets?)_.*\.js$/.test(f))
  const neverExecuted = []
  const unresolved = []

  for (const f of files) {
    const src = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8')
    const marker = extractMarker(src)
    let codes = extractCodes(src)

    const checks = []
    if (codes.length > 0) {
      for (const code of codes) checks.push({ mode: 'code', value: code })
    } else {
      const title = extractTitleLookup(src)
      const id = extractIdLookup(src)
      const cluster = extractClusterLookup(src)
      if (title) checks.push({ mode: 'title', value: title })
      else if (id) checks.push({ mode: 'id', value: id })
      else if (cluster) checks.push({ mode: 'cluster', value: cluster })
      else { unresolved.push(f); continue }
    }

    for (const check of checks) {
      let ticket
      if (check.mode === 'code') ticket = await db('bug_tickets').where({ linked_bug_code: check.value }).first()
      else if (check.mode === 'title') ticket = await db('bug_tickets').where({ title: check.value }).first()
      else if (check.mode === 'id') ticket = await db('bug_tickets').where({ id: check.value }).first()
      else if (check.mode === 'cluster') ticket = await db('bug_tickets').where({ cluster_label: check.value }).first()

      if (!ticket) continue // titre/id introuvable : probablement un script de CRÉATION déjà passé, pas une clôture en attente
      const notes = ticket.admin_notes || ''
      const already = marker ? notes.includes(marker) : notes.trim().length > 0
      if (!already) {
        neverExecuted.push({ file: f, mode: check.mode, value: check.value, status: ticket.status })
      }
    }
  }

  return { neverExecuted, unresolved }
}

// ── Volet 2 : tickets ouverts sans note dont le code apparaît déjà dans git log ─────────────────

async function auditGitLogVsOpenTickets() {
  let log
  try {
    log = execSync('git log --all --oneline', { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString()
  } catch (err) {
    return { error: `git log a échoué : ${err.message}`, hits: [] }
  }

  const rows = await db('bug_tickets')
    .whereIn('status', ['new', 'in_progress'])
    .andWhere(q => q.whereNull('admin_notes').orWhere('admin_notes', ''))
    .whereNotNull('linked_bug_code')
    .select('linked_bug_code', 'title', 'status')

  const hits = []
  for (const r of rows) {
    // Mot entier seulement (évite un faux positif sur un code court contenu dans un autre mot).
    const re = new RegExp(`(^|[^A-Za-z0-9_-])${r.linked_bug_code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_-]|$)`, 'i')
    if (re.test(log)) hits.push(r)
  }
  return { hits }
}

async function run() {
  const { neverExecuted, unresolved } = await auditClosureScripts()
  const { hits, error } = await auditGitLogVsOpenTickets()

  console.log('=== Scripts de clôture écrits mais JAMAIS EXÉCUTÉS ===')
  if (neverExecuted.length === 0) console.log('(aucun)')
  for (const r of neverExecuted) console.log(`${r.file} :: ${r.mode}=${r.value} :: statut actuel=${r.status}`)

  console.log('\n=== Tickets ouverts/en cours, SANS NOTE, dont le code apparaît déjà dans git log ===')
  console.log('(corrigé en code — probablement — mais AUCUN script de clôture n\'a jamais été écrit ; vérifier le commit avant de conclure, un faux positif reste possible)')
  if (error) console.log('[ERREUR]', error)
  if (hits.length === 0 && !error) console.log('(aucun)')
  for (const r of hits) console.log(`${r.linked_bug_code} :: ${r.status} :: ${r.title}`)

  console.log('\n=== Scripts au format non reconnu par cet audit (lecture manuelle requise) ===')
  if (unresolved.length === 0) console.log('(aucun)')
  for (const f of unresolved) console.log(f)

  console.log(`\n=== BILAN === jamaisExecutes=${neverExecuted.length} ouvertsAvecCommit=${hits.length} nonReconnus=${unresolved.length}`)

  await db.destroy()
}

run().catch(err => { console.error(err); process.exit(1) })
