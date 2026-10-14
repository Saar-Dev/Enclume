import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  normalizeMovementGait, selectMovementBudget, buildDroneAllures, MovementBudgetError,
  getCharacterMovementBudget,
} from './movementBudgetService.js'

// Lancement manuel : node --env-file=.env --test server/src/services/movementBudgetService.test.mjs
const skip = !process.env.DATABASE_URL

test('les alias d’allure sont normalisés sans laisser le client choisir un nombre libre', () => {
  assert.equal(normalizeMovementGait('normal'), 'moyenne')
  assert.equal(normalizeMovementGait('run'), 'rapide')
  assert.throws(() => normalizeMovementGait('teleport'))
})

test('le budget est sélectionné dans les allures calculées côté serveur', () => {
  assert.deepEqual(
    selectMovementBudget({ lente: 7.5, moyenne: 15, rapide: 30, max: 40 }, 'run'),
    { gait: 'rapide', budgetM: 30 },
  )
})

test('un drone n’a qu’une allure : sa Vitesse (m/Tour) répliquée sur les 4 paliers', () => {
  assert.deepEqual(buildDroneAllures(30), { lente: 30, moyenne: 30, rapide: 30, max: 30 })
  // Vitesse en chaîne (payload/DB) — normalisée, jamais rejetée pour le type seul
  assert.deepEqual(buildDroneAllures('12'), { lente: 12, moyenne: 12, rapide: 12, max: 12 })
  // Drone explicitement immobile (RAW « Déplacement : - ») — 0 est valide, aucun déplacement ne sera
  // sélectionnable (selectCombatMovementForCost) mais pas une erreur de configuration
  assert.deepEqual(buildDroneAllures(0), { lente: 0, moyenne: 0, rapide: 0, max: 0 })
})

test('une Vitesse de drone non renseignée lève une MovementBudgetError avec un message clair', () => {
  for (const bad of [null, undefined, NaN, '', 'abc', -5]) {
    assert.throws(() => buildDroneAllures(bad), (err) => {
      assert.ok(err instanceof MovementBudgetError)
      assert.match(err.message, /Vitesse/)
      return true
    }, `attendu MovementBudgetError pour ${JSON.stringify(bad)}`)
  }
})

// EXOARM-VIT-PALIERS1 — getExoMovementBudget (non exportée, testée via getCharacterMovementBudget
// comme le fait la route réelle GET /:characterId/exo/movement, char-sheet.js:2750) doit réduire les
// Allures selon le palier d'Intégrité Exosquelette (REGLEARMURE.md:566-568), jamais appliqué avant ce
// correctif. Fixture minimale : pas de ref_exo_templates (Lot B, exo_sheet porte sa propre base
// éditable), pas de pilote (mode 'pilot' hors scope de ce correctif).
// base_speed_surface=15 -> calcAllureMoy(15)=10 -> allures pleines {lente:5, moyenne:10, rapide:20, max:40}.
async function createExoFixture(itgExosquelette) {
  const [gm] = await db('users')
    .insert({ email: `movbudget-exo-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'movbudget-exo-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test movementBudgetService', invite_code: `MOVBUDGET-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test mouvement', type: 'exo' })
    .returning('*')
  await db('exo_sheet').insert({
    character_id: exoCharacter.id,
    category: 'exo-1',
    base_speed_surface: 15,
    surface_movement_mode: 'vit',
    underwater_movement_mode: 'blocked',
    itg_exosquelette_current: itgExosquelette,
  })
  return { gm, campaign, exoCharacter }
}

async function cleanupExoFixture({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()  // cascade characters/exo_sheet
  await db('users').where({ id: gm.id }).del()
}

test('getExoMovementBudget — Intégrité Exosquelette 11+ : Allures inchangées', { skip }, async () => {
  const fx = await createExoFixture(11)
  try {
    const budget = await getCharacterMovementBudget(fx.exoCharacter.id, 'moyenne')
    assert.deepEqual(budget.allures, { lente: 5, moyenne: 10, rapide: 20, max: 40 })
  } finally {
    await cleanupExoFixture(fx)
  }
})

test('getExoMovementBudget — Intégrité Exosquelette 6-10 : Allures x2/3 floor', { skip }, async () => {
  const fx = await createExoFixture(8)
  try {
    const budget = await getCharacterMovementBudget(fx.exoCharacter.id, 'moyenne')
    assert.deepEqual(budget.allures, { lente: 3, moyenne: 6, rapide: 13, max: 26 })
  } finally {
    await cleanupExoFixture(fx)
  }
})

test('getExoMovementBudget — Intégrité Exosquelette 1-5 : Allures /2 floor', { skip }, async () => {
  const fx = await createExoFixture(3)
  try {
    const budget = await getCharacterMovementBudget(fx.exoCharacter.id, 'moyenne')
    assert.deepEqual(budget.allures, { lente: 2, moyenne: 5, rapide: 10, max: 20 })
  } finally {
    await cleanupExoFixture(fx)
  }
})

// Exosquelette détruit : 0 est une Allure valide (même doctrine que le drone sans Vitesse ci-dessus),
// pas une MovementBudgetError — l'armure est immobile, pas mal configurée.
test('getExoMovementBudget — Intégrité Exosquelette détruite (<=0) : Allures à 0, pas une erreur', { skip }, async () => {
  const fx = await createExoFixture(0)
  try {
    const budget = await getCharacterMovementBudget(fx.exoCharacter.id, 'lente')
    assert.deepEqual(budget.allures, { lente: 0, moyenne: 0, rapide: 0, max: 0 })
    assert.equal(budget.budgetM, 0)
  } finally {
    await cleanupExoFixture(fx)
  }
})

test.after(async () => { await db.destroy() })
