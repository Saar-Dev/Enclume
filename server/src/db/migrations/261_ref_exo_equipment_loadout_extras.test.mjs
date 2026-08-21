import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './261_ref_exo_equipment_loadout_extras.js'

const NEW_NAMES = [
  'Sonscan actif directionnel', 'Sonscan passif', 'Radar', 'Caméra', 'Balise de détresse',
  'Analyseur environnemental', 'Centre de commande de drones',
  'Brouilleur sonscans Actif', 'Brouilleur sonscans Passif', 'Brouilleur sonscans Actif et passif',
  'Griffe mécanique', 'Torche de forage Hydra',
  'Lance-torpilles Taille 1', 'Lance-torpilles Taille 2', 'Lance-torpilles Taille 3',
  'Lance-missiles Taille 1', 'Lance-missiles Taille 2', 'Lance-missiles Taille 3',
]

// Tourne toujours — vérifie l'état réel du catalogue (patron 253, adapté : la table a déjà 84 lignes
// avant cette migration, donc "déjà appliquée" se teste par présence d'un nom précis, pas par un total).
test('données réelles — les 18 nouvelles lignes existent avec la bonne répartition famille/catégorie', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const rows = await db('ref_exo_equipment').whereIn('name', NEW_NAMES)
  assert.equal(rows.length, 18, `18 lignes attendues, ${rows.length} trouvées`)

  const byFamily = Object.fromEntries(
    Object.entries(
      rows.reduce((acc, r) => ({ ...acc, [r.family]: (acc[r.family] || 0) + 1 }), {})
    )
  )
  assert.equal(byFamily.systeme, 10, '7 clones/centre de commande + 3 brouilleurs')
  assert.equal(byFamily.arme, 8, '2 (griffe/torche) + 6 (torpilles/missiles)')

  // Clones "portable" — description cite explicitement la source ref_equipment (mitigation dérive).
  const crysta = await db('ref_exo_equipment').where({ name: 'Sonscan actif directionnel' }).first()
  assert.equal(crysta.price, 14800)
  assert.match(crysta.description, /Crysta/)

  // Torpilles/missiles Taille 2/3 attestées, Taille 1 ajoutée par extensibilité — mêmes stats
  // torpille/missile pour une Taille donnée (confirmé Saar).
  const torpTaille2 = await db('ref_exo_equipment').where({ name: 'Lance-torpilles Taille 2' }).first()
  const missTaille2 = await db('ref_exo_equipment').where({ name: 'Lance-missiles Taille 2' }).first()
  assert.equal(torpTaille2.damage, missTaille2.damage)
  assert.equal(torpTaille2.range, missTaille2.range)
  assert.equal(torpTaille2.price, missTaille2.price)

  // Pas de doublon avec "Pince/Griffe" (migration 253) — DIS différente, objet distinct.
  const griffeMeca = await db('ref_exo_equipment').where({ name: 'Griffe mécanique' }).first()
  const pinceGriffe = await db('ref_exo_equipment').where({ name: 'Pince/Griffe' }).first()
  assert.notEqual(griffeMeca.rarity, pinceGriffe.rarity)
})

test('migration 261 ajoute les 18 lignes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db('ref_exo_equipment').where({ name: 'Centre de commande de drones' }).first()
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const rows = await trx('ref_exo_equipment').whereIn('name', NEW_NAMES)
    assert.equal(rows.length, 18)

    await down(trx)
    const afterDown = await trx('ref_exo_equipment').whereIn('name', NEW_NAMES)
    assert.equal(afterDown.length, 0)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
