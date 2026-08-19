import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './250_battlemaps_voxel_data_drop_default.js'
import { assertColumnDefault } from './testHelpers/schemaAssertions.mjs'

// Lancement manuel : node --env-file=../.env --test server/src/db/migrations/250_battlemaps_voxel_data_drop_default.test.mjs
const skip = !process.env.DATABASE_URL

// Tourne toujours (même patron que 242_char_gauges.test.mjs) — détecte une dérive entre ce fichier
// et le schéma réel (SCHEMADRIFT-BATTLEMAPSVOXEL1, docs/JOURNAL8.md 2026-08-19).
test('schéma réel — battlemaps.voxel_data n\'a plus de défaut', { skip }, async () => {
  await assertColumnDefault(db, 'battlemaps', 'voxel_data', null)
})

test('migration 250 : up() retire le défaut, down() restaure \'[]\'::jsonb', { skip }, async () => {
  const { rows } = await db.raw(
    `SELECT column_default FROM information_schema.columns WHERE table_name = 'battlemaps' AND column_name = 'voxel_data'`,
  )
  // nodemon (P53, docs/SYSTEME/CORE.md) a déjà appliqué cette migration dès l'écriture du fichier —
  // le défaut est déjà absent, rejouer up()/down() ici testerait un état qui n'est plus le point de
  // départ réel.
  if (rows[0]?.column_default == null) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    await assertColumnDefault(trx, 'battlemaps', 'voxel_data', null)

    await down(trx)
    await assertColumnDefault(trx, 'battlemaps', 'voxel_data', "'[]'::jsonb")

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
