import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { resolveDamageLine, resolveActiveEffects, findEffectLineResolver, sweepZoneExposure } from './effectLineResolverService.js'
import { createWorldEffectInstance } from './worldEffectService.js'
import { getDangerDefinition } from '../../../shared/world/dangerCatalog.js'
import { SLOT_TO_WOUND_LOCATION } from '../../../shared/armorConstants.js'
import '../lib/echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (applyWound crée une échéance de guérison à l'insertion)

// Lancement (depuis la racine) : node --env-file=.env --test server/src/services/effectLineResolverService.test.mjs
// Écrit puis supprime des lignes dans la base locale — sans DATABASE_URL, tout est ignoré.
const skip = !process.env.DATABASE_URL

test.after(async () => { await db.destroy() })

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
// Seul COMBAT_ATTACK_RESULT nous intéresse — resolveTargetHit/applyWound émettent aussi d'autres
// événements (ex. résolution de Choc) sur le même io, jamais comptés ici.
const fakeIo = { to: () => ({ emit: (event, payload) => { if (event === WS.COMBAT_ATTACK_RESULT) events.push(payload) } }) }
let events = []

// chc:3 (plancher) — aucune Chance à dépenser, donc applyWound (appelé par resolveTargetHit) ne
// jamais ouvrir de choix Chance interactif : patron woundService.test.mjs (NO_CHANCE).
async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `elrs-${uniq()}@test.local`, password_hash: 'x', username: 'elrs-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test effectLineResolver', invite_code: `ELRS-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'BM test' }).returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Cible test', type: 'pj' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: character.id, label: 'Cible' })
    .returning('*')
  await db('char_sheet').insert({ character_id: character.id, chc: 3 })
  return { gm, campaign, battlemap, character, token }
}

async function cleanup({ campaign, gm, character, token }) {
  await db('token_statuses').where({ token_id: token.id }).del()
  await db('character_wounds').whereIn('char_sheet_id', db('char_sheet').where({ character_id: character.id }).select('id')).del()
  await db('char_sheet').where({ character_id: character.id }).del()
  await db('tokens').where({ id: token.id }).del()
  await db('characters').where({ id: character.id }).del()
  await db('battlemaps').where({ campaign_id: campaign.id }).del()
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

test('findEffectLineResolver — expose damage, undefined pour un type inconnu (jamais un throw)', () => {
  assert.equal(typeof findEffectLineResolver('damage'), 'function')
  assert.equal(findEffectLineResolver('chain'), undefined)
  assert.equal(findEffectLineResolver('bogus'), undefined)
})

test('resolveDamageLine — locationMode:\'exposed\' + forcedLocation d\'instance : 1 hit à la Localisation choisie', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const line = getDangerDefinition('feu:petit').effects[0]
    const result = await resolveDamageLine(fakeIo, db, fx.campaign.id, {
      line, instanceForcedLocation: 'corps', sourceCode: 'burning', tokenId: fx.token.id,
    })
    assert.equal(result.locationsCount, 1)
    assert.equal(result.hits.length, 1)
    assert.equal(result.hits[0].localisation, 'corps')
    assert.equal(events.length, 1)
    assert.equal(events[0].isPnj, true)
    assert.equal(events[0].sourceCode, 'burning')
    assert.equal(events[0].cibleId, fx.token.id)

    const wounds = await db('character_wounds').where({ char_sheet_id: (await db('char_sheet').where({ character_id: fx.character.id }).first()).id })
    assert.ok(wounds.length >= 1, 'un dégât suffisant doit poser une blessure au Corps')
    assert.equal(wounds[0].location, 'corps')
  } finally {
    await cleanup(fx)
  }
})

test('resolveDamageLine — locationMode:\'all\' (feu:brasier) : une frappe par Localisation, toutes distinctes, locations ignoré', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const line = getDangerDefinition('feu:brasier').effects[0]
    assert.equal(line.locationMode, 'all')
    assert.equal(line.locations, null)

    const result = await resolveDamageLine(fakeIo, db, fx.campaign.id, {
      line, sourceCode: 'burning', tokenId: fx.token.id,
    })
    assert.equal(result.locationsCount, 6, 'les 6 Localisations RAW, pas une lecture de line.locations (null)')
    assert.equal(result.hits.length, 6)
    assert.deepEqual(
      [...new Set(result.hits.map(h => h.localisation))].sort(),
      Object.values(SLOT_TO_WOUND_LOCATION).sort(),
      'chaque Localisation touchée exactement une fois',
    )
    assert.equal(events.length, 6)
  } finally {
    await cleanup(fx)
  }
})

test('resolveDamageLine — definitionForcedLocation (decompression) prime sur locationMode de la ligne', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const definition = getDangerDefinition('decompression')
    const result = await resolveDamageLine(fakeIo, db, fx.campaign.id, {
      line: definition.effects[0], definitionForcedLocation: definition.forcedLocation,
      sourceCode: 'decompression', tokenId: fx.token.id,
    })
    assert.equal(result.hits.length, 1)
    assert.equal(result.hits[0].localisation, 'corps')
  } finally {
    await cleanup(fx)
  }
})

test('resolveDamageLine — token sans personnage : neutre, aucun jet ni émission (patron ancien resolveEnvironmentalHazardTicks)', { skip }, async () => {
  const fx = await createFixture()
  const [orphanToken] = await db('tokens').insert({ battlemap_id: fx.battlemap.id, label: 'sans-personnage' }).returning('*')
  events = []
  try {
    const line = getDangerDefinition('feu:petit').effects[0]
    const result = await resolveDamageLine(fakeIo, db, fx.campaign.id, {
      line, sourceCode: 'burning', tokenId: orphanToken.id,
    })
    assert.deepEqual(result.hits, [])
    assert.equal(events.length, 0)
  } finally {
    await db('tokens').where({ id: orphanToken.id }).del()
    await cleanup(fx)
  }
})

// ─── resolveActiveEffects (Z1.2 — remplace resolveEnvironmentalHazardTicks dans combatTurnEngine.js) ───
// Ces lignes reproduisent la FORME exacte de token_statuses.data posée par exposeToHazard (jamais le
// catalogue) : c'est la non-régression que Z1.2 doit garantir.

test('resolveActiveEffects — burning sans forcedLocation posé : 1 hit aléatoire, même précédence qu’avant', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const rows = [{ token_id: fx.token.id, status_code: 'burning', data: { formula: '1d6', locations: 1 } }]
    const results = await resolveActiveEffects(fakeIo, db, fx.campaign.id, rows)
    assert.equal(results.length, 1)
    assert.equal(results[0].hits.length, 1)
    assert.equal(events.length, 1)
    assert.equal(events[0].sourceCode, 'burning')
  } finally {
    await cleanup(fx)
  }
})

test('resolveActiveEffects — decompression : le registre (entry.forcedLocation) prime toujours sur data', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const rows = [{ token_id: fx.token.id, status_code: 'decompression', data: { formula: '1d10', locations: 1, forcedLocation: 'tete' } }]
    const results = await resolveActiveEffects(fakeIo, db, fx.campaign.id, rows)
    assert.equal(results[0].hits[0].localisation, 'corps', 'entry.forcedLocation (corps) prime sur data.forcedLocation (tete), comme avant')
  } finally {
    await cleanup(fx)
  }
})

test('resolveActiveEffects — data.forcedLocation posé par le MJ (Acide) est toujours honoré (aucune régression)', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const rows = [{ token_id: fx.token.id, status_code: 'acid', data: { formula: '1d10', locations: 1, forcedLocation: 'bras_gauche' } }]
    const results = await resolveActiveEffects(fakeIo, db, fx.campaign.id, rows)
    assert.equal(results[0].hits[0].localisation, 'bras_gauche')
  } finally {
    await cleanup(fx)
  }
})

test('resolveActiveEffects — status_code hors registre ou data.formula absente : neutre, jamais un throw', { skip }, async () => {
  const fx = await createFixture()
  events = []
  try {
    const rows = [
      { token_id: fx.token.id, status_code: 'grappled', data: { formula: '1d6', locations: 1 } }, // hors registre hazard
      { token_id: fx.token.id, status_code: 'burning', data: {} }, // formula absente (legacy/manuel)
    ]
    const results = await resolveActiveEffects(fakeIo, db, fx.campaign.id, rows)
    assert.deepEqual(results, [])
    assert.equal(events.length, 0)
  } finally {
    await cleanup(fx)
  }
})

// ─── sweepZoneExposure (Z2 étape 2 — PLAN_ZONES_DANGER.md §2.H point 1) ───
// Preuve du plan (§9 tableau, ligne Z2) : « insert manuel zone feu:grand → un token dedans brûle
// chaque Tour + s'éteint en sortant ». `createWorldEffectInstance` exerce aussi la réconciliation
// (worldEffectService.js:loadWorldEffectDefinitions) : sans elle, 'feu:grand'/'acide:capsule' ne
// seraient pas des clés connues et cet insert échouerait avec « Définition d'effet inconnue ».
const VOLUME_AROUND_ORIGIN = { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } }

test('sweepZoneExposure — zone feu:grand : un token dedans reçoit burning, s\'éteint en sortant (remanence:none)', { skip }, async () => {
  const fx = await createFixture()
  events = []
  let instanceId = null
  try {
    await db('combat_roster').insert({ campaign_id: fx.campaign.id, token_id: fx.token.id, status: 'active' })
    const created = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:grand', targetKind: 'volume', volume: VOLUME_AROUND_ORIGIN },
    })
    instanceId = created.instance.id

    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    let status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'burning' }).first()
    assert.ok(status, 'le token dans la zone doit porter la condition burning')
    assert.equal(status.data.zoneInstanceId, instanceId)
    assert.equal(status.data.formula, '2d10')
    assert.equal(status.expires_at_turn, null, 'exposition zone-driven : pas d\'expiry propre, pilotée par la présence')

    // Le token quitte le volume (déplacement hors combat, suffisant pour ce test du balayage seul).
    await db('tokens').where({ id: fx.token.id }).update({ pos_x: 100 })
    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'burning' }).first()
    assert.equal(status, undefined, 'remanence:none => clearHazard immédiat à la sortie')
  } finally {
    if (instanceId) await db('world_effect_instances').where({ id: instanceId }).del()
    await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: fx.token.id }).del()
    await cleanup(fx)
  }
})

test('sweepZoneExposure — zone acide (remanence:fixed) : la sortie de zone persiste (linger), ne supprime pas tout de suite', { skip }, async () => {
  const fx = await createFixture()
  events = []
  let instanceId = null
  try {
    await db('combat_roster').insert({ campaign_id: fx.campaign.id, token_id: fx.token.id, status: 'active' })
    const created = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'acide:capsule', targetKind: 'volume', volume: VOLUME_AROUND_ORIGIN },
    })
    instanceId = created.instance.id

    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    let status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'acid' }).first()
    assert.ok(status)

    await db('tokens').where({ id: fx.token.id }).update({ pos_x: 100 })
    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'acid' }).first()
    assert.ok(status, 'remanence:fixed => linger : la ligne reste, expiration différée (1d6 Tours), pas une suppression immédiate')
    assert.ok(status.expires_at_turn > 0)
  } finally {
    if (instanceId) await db('world_effect_instances').where({ id: instanceId }).del()
    await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: fx.token.id }).del()
    await cleanup(fx)
  }
})

test('sweepZoneExposure + resolveActiveEffects — puissance de l\'instance s\'ajoute au jet de dégâts (§2.E)', { skip }, async () => {
  const fx = await createFixture()
  events = []
  let instanceId = null
  try {
    await db('combat_roster').insert({ campaign_id: fx.campaign.id, token_id: fx.token.id, status: 'active' })
    const created = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'feu:petit', targetKind: 'volume', volume: VOLUME_AROUND_ORIGIN, puissance: 100 },
    })
    instanceId = created.instance.id

    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    const status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'burning' }).first()
    assert.equal(status.data.puissance, 100, 'posée par le balayage, pas par un chemin MJ-manuel')

    // Même jointure que startResolutionPhase (combatTurnEngine.js) : sweep, puis résolution du tick.
    const rows = [{ token_id: fx.token.id, status_code: status.status_code, data: status.data }]
    await resolveActiveEffects(fakeIo, db, fx.campaign.id, rows)
    assert.equal(events.length, 1)
    assert.ok(
      events[0].degautsBruts >= 101,
      `feu:petit = 1d6 (1 à 6) + puissance 100 : attendu ≥ 101, obtenu ${events[0].degautsBruts}`,
    )
  } finally {
    if (instanceId) await db('world_effect_instances').where({ id: instanceId }).del()
    await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: fx.token.id }).del()
    await cleanup(fx)
  }
})

// ─── sweepZoneExposure — ligne `modifier` (Z4, docs/PLANS/PLAN_ZONES_DANGER.md §6) ───
// gaz:irritant est la seule définition du catalogue avec une ligne `modifier` de phase 'onTurn' non
// imbriquée (la 2ᵉ ligne, test.onFail, est v2/no-op) : hazardCode:null par construction (Z0), donc
// AUCUNE des assertions ci-dessous ne peut passer par exposeToHazard/hazardCode — c'est exactement la
// non-couverture que Z4 corrige.

test('sweepZoneExposure — zone gaz:irritant (type:modifier) : malus posé sans hazardCode, persiste (decay) à la sortie', { skip }, async () => {
  const fx = await createFixture()
  let instanceId = null
  try {
    await db('combat_roster').insert({ campaign_id: fx.campaign.id, token_id: fx.token.id, status: 'active' })
    const created = await createWorldEffectInstance({
      battlemapId: fx.battlemap.id,
      input: { definitionKey: 'gaz:irritant', targetKind: 'volume', volume: VOLUME_AROUND_ORIGIN },
    })
    instanceId = created.instance.id

    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id, 1)
    let status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.ok(status, 'aucun hazardCode pour gaz:irritant : ce statut ne peut venir que du nouveau chemin modifier')
    assert.equal(status.data.kind, 'zoneModifier')
    assert.equal(status.data.target, 'actions')
    assert.equal(status.data.value, -3)
    assert.equal(status.data.remanence, 'decay')
    assert.equal(status.data.lastRefreshedTurn, 1)

    // Le token quitte le volume — remanence:'decay' : la ligne persiste (décroissance pilotée
    // ailleurs par resolveZoneModifierTicks, jamais par sweepZoneExposure lui-même).
    await db('tokens').where({ id: fx.token.id }).update({ pos_x: 100 })
    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id, 2)
    status = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.ok(status, 'remanence:decay => la ligne reste après la sortie, pas un clear immédiat')
    assert.equal(status.data.value, -3, 'sweepZoneExposure ne fait pas décroître lui-même — resolveZoneModifierTicks seul')
  } finally {
    if (instanceId) await db('world_effect_instances').where({ id: instanceId }).del()
    await db('combat_roster').where({ campaign_id: fx.campaign.id, token_id: fx.token.id }).del()
    await cleanup(fx)
  }
})

test('sweepZoneExposure — aucune zone, aucun roster, campagne sans battlemap : ne fait rien, jamais un throw', { skip }, async () => {
  const fx = await createFixture()
  try {
    await sweepZoneExposure(fakeIo, db, fx.campaign.id, fx.battlemap.id)
    await sweepZoneExposure(fakeIo, db, fx.campaign.id, null)
    assert.ok(true, 'aucune exception levée')
  } finally {
    await cleanup(fx)
  }
})
