const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const MIGRATION_EXTENSION = /\.(?:js|cjs|mjs)$/i
const LEGACY_TIMESTAMP = /^20\d{6}[_ ]/
const NUMBERED_MIGRATION = /^(\d+)([a-z]*)[_ ]/i

function migrationOrder(file) {
  // Les migrations datees 20260329... constituent le socle historique et
  // doivent toujours preceder la serie courte 21_..., 22_..., etc.
  if (LEGACY_TIMESTAMP.test(file)) return [0, file]

  const match = file.match(NUMBERED_MIGRATION)
  if (match) {
    return [1, Number(match[1]), match[2].toLowerCase(), file]
  }

  // Un fichier futur sans prefixe connu reste charge, mais apres l'historique
  // explicite afin de ne jamais devancer une migration numerotee.
  return [2, file]
}

function compareParts(left, right) {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? ''
    const b = right[index] ?? ''
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), 'en')
  }
  return 0
}

class NaturalMigrationSource {
  constructor(directory) {
    this.directory = path.resolve(directory)
  }

  async getMigrations() {
    const files = await fs.readdir(this.directory)
    return files
      .filter(file => MIGRATION_EXTENSION.test(file))
      .sort((left, right) => compareParts(migrationOrder(left), migrationOrder(right)))
  }

  getMigrationName(file) {
    return file
  }

  getMigration(file) {
    return import(pathToFileURL(path.join(this.directory, file)).href)
  }
}

module.exports = NaturalMigrationSource
