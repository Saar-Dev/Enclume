import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { assertRegistryUpToDate } from './vaultService.js'

// Garde contre la dérive silencieuse du Coffre : si une migration ajoute une FK vers characters/char_sheet
// sans l'enregistrer dans COMPANION_REGISTRY ni EXCLUDED_TABLES (vaultService.js), ce test échoue ici —
// au lieu de planter en 500 au premier clonage réel (vécu : pending_chance_choices, migration 338,
// 2026-09-11, resté invisible ~3 semaines faute de couverture). Lecture seule (information_schema),
// aucune fixture à nettoyer.
//   node --env-file=.env --test server/src/services/vaultService.test.mjs

after(() => db.destroy())

test('assertRegistryUpToDate : aucune table liée à characters/char_sheet non couverte', async () => {
  await assert.doesNotReject(assertRegistryUpToDate(db))
})
