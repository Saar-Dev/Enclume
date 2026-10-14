// socketCombatHelpers.multiAdversary.test.mjs — resolveMultiAdversaryMalus (EXOARM-MULTIADV1).
//
// Avant ce correctif, deux copies quasi identiques (une côté attaquant dans resolveMeleeAction, une
// côté défenseur dans finalizeMeleeAttack) lisaient `characters.type` brut pour décider qui compte
// comme un "ennemi" — une exo-armure (`type='exo'`) ne matchait donc jamais ni 'pj' ni 'pnj', des
// deux côtés de la comparaison : invisible au décompte multi-adversaires, quelle que soit
// l'allégeance réelle de son pilote. Ce fichier couvre l'autorité unique qui les remplace :
// le type effectif (celui du pilote pour une exo, repli 'pnj' sans pilote — même sémantique que
// resolveCombatantIdentity, combatantContextService.js) est résolu pour le combattant courant ET
// pour chaque token du roster compté en face.
//
// Patron fixture réelle + nettoyage explicite (woundReviewService.test.mjs), pas le patron
// rollback-trx : resolveMultiAdversaryMalus touche le module `db` importé, pas un trx reçu en
// paramètre — un trx de test ne verrait pas ses propres écritures avant commit.
//
// Lancement manuel (depuis la racine) : node --env-file=.env --test server/src/socket/socketCombatHelpers.multiAdversary.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { resolveMultiAdversaryMalus } from './socketCombatHelpers.js'

const skip = !process.env.DATABASE_URL

// Même metrics que worldSpatialQueryService.test.mjs : échelle uniforme 1,5 m/unité-monde sur les
// 3 axes — un écart de pos_x de 1 unité-monde vaut 1,5 m, largement sous le seuil de 3 m (sans arme
// de contact équipée, max_allonge = 0).
const METRICS = {
  metersPerCell: 1.5, worldUnitsPerCell: 1, storyHeightWorld: 2.5, metersPerWorldUnit: 1.5, storyHeightM: 3.75,
}

async function makeCampaign() {
  const [gm] = await db('users')
    .insert({ email: `multiadv-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'multiadv-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test multi-adversaires', invite_code: `MULTIADV-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Carte test' }).returning('*')
  return { gm, campaign, battlemap }
}

// posX : position sur l'axe x seulement (y/z à 0) — 1 unité-monde = 1,5 m avec METRICS ci-dessus.
async function putInRoster({ campaignId, battlemapId, type, posX, pilotCharacterId = null }) {
  const [character] = await db('characters')
    .insert({ campaign_id: campaignId, name: `Perso ${type} ${posX}`, type })
    .returning('*')
  if (type === 'exo') {
    await db('exo_sheet').insert({ character_id: character.id, pilot_character_id: pilotCharacterId })
  }
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemapId, character_id: character.id, pos_x: posX, pos_y: 0, pos_z: 0 })
    .returning('*')
  await db('combat_roster').insert({ campaign_id: campaignId, token_id: token.id })
  return { character, token }
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del() // cascade battlemaps/tokens/combat_roster/characters/exo_sheet
  await db('users').where({ id: gm.id }).del()
}

test('resolveMultiAdversaryMalus — attaquant PJ : compte PNJ + exo pilotée par un PNJ + exo sans pilote (repli PNJ), pas les alliés PJ', { skip }, async () => {
  const { gm, campaign, battlemap } = await makeCampaign()
  try {
    const base = { campaignId: campaign.id, battlemapId: battlemap.id }
    const attacker = await putInRoster({ ...base, type: 'pj', posX: 0 })
    // Ennemis attendus (comptés) — 4 au total :
    await putInRoster({ ...base, type: 'pnj', posX: 1 })
    await putInRoster({ ...base, type: 'pnj', posX: -1 })
    const { character: pnjPilot } = await putInRoster({ ...base, type: 'pnj', posX: 100 }) // hors portée, juste comme pilote
    await putInRoster({ ...base, type: 'exo', posX: 1.5, pilotCharacterId: pnjPilot.id })
    await putInRoster({ ...base, type: 'exo', posX: -1.5 }) // sans pilote -> repli 'pnj'
    // Non comptés : allié PJ, et exo pilotée par un PJ.
    await putInRoster({ ...base, type: 'pj', posX: 2 })
    const { character: pjPilot } = await putInRoster({ ...base, type: 'pj', posX: 100 })
    await putInRoster({ ...base, type: 'exo', posX: 2.5, pilotCharacterId: pjPilot.id })
    // Hors portée (15 m) : ne doit jamais compter même si le type matcherait.
    await putInRoster({ ...base, type: 'pnj', posX: 10 })

    const malus = await resolveMultiAdversaryMalus(campaign.id, {
      character: attacker.character,
      tokenPos: { position_space: 'world-feet', pos_x: 0, pos_y: 0, pos_z: 0 },
      excludeTokenId: attacker.token.id,
      metrics: METRICS,
    })
    assert.equal(malus, -10, '4 ennemis à portée (2 PNJ + 1 exo/pilote PNJ + 1 exo sans pilote) -> malus plafond')
  } finally {
    await cleanup({ campaign, gm })
  }
})

test('resolveMultiAdversaryMalus — défenseur PNJ : une exo pilotée par un PJ compte comme ennemie (invisible avant le correctif)', { skip }, async () => {
  const { gm, campaign, battlemap } = await makeCampaign()
  try {
    const base = { campaignId: campaign.id, battlemapId: battlemap.id }
    const defender = await putInRoster({ ...base, type: 'pnj', posX: 0 })
    const { character: pjPilot } = await putInRoster({ ...base, type: 'pj', posX: 100 })
    await putInRoster({ ...base, type: 'exo', posX: 1, pilotCharacterId: pjPilot.id })
    await putInRoster({ ...base, type: 'pj', posX: -1 })

    const malus = await resolveMultiAdversaryMalus(campaign.id, {
      character: defender.character,
      tokenPos: { position_space: 'world-feet', pos_x: 0, pos_y: 0, pos_z: 0 },
      excludeTokenId: defender.token.id,
      metrics: METRICS,
    })
    assert.equal(malus, -5, '2 ennemis PJ à portée (1 humain + 1 exo pilotée par un PJ)')
  } finally {
    await cleanup({ campaign, gm })
  }
})
