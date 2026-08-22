import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './252_seed_ref_exo_templates.js'

const NAMES = [
  'Explora', 'Typhon', 'Nymph 1-A', 'Série A', 'Vanguard', 'Sylph 56', 'Vauban', 'Condor',
  'Cougar', 'Mentor', 'Heimdall-Pyrelia', 'Ouraken', 'Odin', 'Vulcain', 'Moloch', 'Orka',
]

// Tourne toujours (contrairement au test transactionnel ci-dessous, sauté dès que la migration a
// déjà tourné en dev) — vérifie l'état réel des 16 armures RAW contre docs/REGLES/SEEDEXO.md,
// pas seulement que la migration "a dû s'exécuter sans erreur".
test('données réelles — les 16 armures RAW sont présentes dans ref_exo_templates avec leurs stats exactes', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const rows = await db('ref_exo_templates').whereIn('name', NAMES)
  assert.equal(rows.length, 16, 'les 16 armures RAW doivent être présentes')

  const byName = Object.fromEntries(rows.map((r) => [r.name, r]))

  // Explora (exo-alpha, hybride) — vitesse à terre pilotée par le personnage (pas de valeur propre)
  assert.equal(byName['Explora'].base_exoforce, 25)
  assert.equal(byName['Explora'].base_blindage, 15)
  assert.equal(byName['Explora'].surface_movement_mode, 'pilot')
  assert.equal(byName['Explora'].base_speed_surface, null)

  // Vulcain (exo-3, sous-marine) — incapable de se déplacer à terre
  assert.equal(byName['Vulcain'].base_exoforce, 62)
  assert.equal(byName['Vulcain'].surface_movement_mode, 'blocked')
  assert.equal(byName['Vulcain'].base_speed_surface, null)
  assert.equal(byName['Vulcain'].malus_init_underwater, -5)
  assert.equal(byName['Vulcain'].malus_init_surface, -10)

  // Vauban (exo-1, externe/surface) — aucune donnée de profondeur
  assert.equal(byName['Vauban'].environment, 'surface')
  assert.equal(byName['Vauban'].depth_operational, null)
  assert.equal(byName['Vauban'].depth_limit, null)
  assert.equal(byName['Vauban'].depth_crush, null)

  // Orka (exo-4, sous-marine) — la plus lourde des 16, EXF/Blindage max du catalogue
  assert.equal(byName['Orka'].base_exoforce, 68)
  assert.equal(byName['Orka'].base_blindage, 34)
  assert.equal(byName['Orka'].depth_operational, 20000)

  // Typhon (exo-alpha, hybride) — vitesse secondaire (propulseur) en speeds_extra, pas dans base_speed
  assert.equal(byName['Typhon'].base_speed_underwater, 10)
  assert.deepEqual(byName['Typhon'].speeds_extra, [{ mode: 'propulseur', environment: 'underwater', value: 20 }])

  // category/environment respectent les CHECK de la migration 233 (aucune ligne rejetée silencieusement)
  const categories = new Set(rows.map((r) => r.category))
  const environments = new Set(rows.map((r) => r.environment))
  for (const c of categories) {
    assert.ok(['exo-alpha', 'exo-0', 'exo-1', 'exo-2', 'exo-3', 'exo-4'].includes(c), `catégorie inattendue : ${c}`)
  }
  for (const e of environments) {
    assert.ok(['submarine', 'surface', 'hybrid'].includes(e), `environment inattendu : ${e}`)
  }
})

test('migration 252 seede les 16 armures et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = (await db('ref_exo_templates').whereIn('name', NAMES).count('id'))[0].count > 0
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const rows = await trx('ref_exo_templates').whereIn('name', NAMES)
    assert.equal(rows.length, 16)

    await down(trx)
    const afterDown = await trx('ref_exo_templates').whereIn('name', NAMES)
    assert.equal(afterDown.length, 0)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
