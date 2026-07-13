require('dotenv').config({ path: '../.env' })
const path = require('node:path')
const NaturalMigrationSource = require('./src/db/naturalMigrationSource.cjs')

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      migrationSource: new NaturalMigrationSource(path.join(__dirname, 'src/db/migrations')),
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
}
