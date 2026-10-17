#!/usr/bin/env node
// tools/check-migration-duplicates.mjs — Lint : détecte les collisions de numéros
// de migrations dans la chaîne ACTIVE (server/src/db/migrations).
//
// Le dossier migrations-archive/ n'est pas vérifié : la chaîne historique est figée.
//
// Usage : node tools/check-migration-duplicates.mjs
// Code retour 0 = OK, 1 = collision détectée.
// (À brancher plus tard dans une CI ou un hook pre-commit si souhaité.)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server/src/db/migrations')

const EXTENSION = /\.(?:js|cjs|mjs)$/i
const TEST_FILE = /\.test\.(?:js|cjs|mjs)$/i
const NUMBERED = /^(\d+)([a-z]*)[_ ]/i
const TIMESTAMPED = /^20\d{6}[_ ]+(\d+)[_ ]/i

if (!fs.existsSync(DIR)) {
  console.error('Dossier introuvable : ' + DIR)
  process.exit(1)
}

const files = fs.readdirSync(DIR).filter((f) => EXTENSION.test(f) && !TEST_FILE.test(f))
const byKey = new Map()

for (const file of files) {
  const ts = file.match(TIMESTAMPED)
  const num = file.match(NUMBERED)
  const key = ts ? 'TS-' + ts[1] : num ? num[1] + (num[2] || '').toLowerCase() : 'SANS-PREFIXE:' + file
  if (!byKey.has(key)) byKey.set(key, [])
  byKey.get(key).push(file)
}

let collisions = 0
for (const [key, group] of byKey) {
  if (group.length > 1) {
    collisions++
    console.error('COLLISION [' + key + '] :')
    for (const f of group) console.error('  - ' + f)
    console.error('  → Les migrations d\'un même numéro s\'exécutent dans l\'ordre alphabétique du nom ;')
    console.error('    renomme la plus récente avec un numéro inutilisé AVANT de committer.')
  }
}

if (collisions > 0) {
  console.error('\n' + collisions + ' collision(s) détectée(s). Corrige avant d\'ajouter la migration.')
  process.exit(1)
}

console.log('OK — ' + files.length + ' migrations actives, aucune collision de numéros.')
