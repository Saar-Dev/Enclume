const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const MIGRATION_EXTENSION = /\.(?:js|cjs|mjs)$/i
const MIGRATION_TEST = /\.test\.(?:js|cjs|mjs)$/i
const TIMESTAMPED_NUMBERED_MIGRATION = /^20\d{6}[_ ]+(\d+)[_ ]/i
const NUMBERED_MIGRATION = /^(\d+)([a-z]*)[_ ]/i

function migrationOrder(file) {
  // Les migrations datees conservent leur nom historique, mais leur nombre
  // interne reste la source de verite pour l'ordre : 20260330_13 avant 21,
  // 20260713_154 apres 153.
  const timestampedMatch = file.match(TIMESTAMPED_NUMBERED_MIGRATION)
  if (timestampedMatch) return [1, Number(timestampedMatch[1]), '', file]

  const match = file.match(NUMBERED_MIGRATION)
  if (match) {
    return [1, Number(match[1]), match[2].toLowerCase(), file]
  }

  // Un fichier futur sans prefixe connu reste charge apres l'historique
  // numerote afin de ne jamais devancer une migration de schema.
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
      .filter(file => MIGRATION_EXTENSION.test(file) && !MIGRATION_TEST.test(file))
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
