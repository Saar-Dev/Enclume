import knex from 'knex'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import NaturalMigrationSource from './naturalMigrationSource.cjs'

const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

const db = knex({
  client: 'pg',
  connection: () => process.env.DATABASE_URL,
  migrations: {
    migrationSource: new NaturalMigrationSource(migrationDirectory),
  },
  seeds: {
    directory: './src/db/seeds',
  },
})

export default db
