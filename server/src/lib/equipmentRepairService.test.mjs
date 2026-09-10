import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { ECHEANCE_TYPE_REGISTRY } from '../../../shared/echeanceTypeRegistry.js'
import { createEcheance, resolveEcheanceNow } from './echeanceService.js'
import { equipmentRepairHandler } from './equipmentRepairService.js'
import { getRepairRequestsForGm, getRepairRollsForPlayer } from './equipmentRepairReviewService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/equipmentRepairService.test.mjs
// Les fonctions de revue lisent via `db` → patron "committe puis nettoie", pas le rollback.
const skip = !process.env.DATABASE_URL

// Le registre est vide dans le process de test (echeanceHandlerRegistrations.js n'est importé que par
// index.js). On enregistre à la main l'entrée nécessaire à createEcheance / resolveEcheanceNow.
ECHEANCE_TYPE_REGISTRY.push({ key: 'equipment_repair', interactive: true, advanceDriven: false, handler: equipmentRepairHandler })

async function createRealFixture({ current = 10, max = 15, malfunction = null } = {}) {
  const [gm] = await db('users')
    .insert({ email: `ers-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'ers-gm' })
    .returning('*')
  const [player] = await db('users')
    .insert({ email: `ers-pl-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'ers-pl' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test réparation', invite_code: `ERS-${Date.now()}-${Math.random()}` })
    .returning('*')
  await db('campaign_members').insert([
    { campaign_id: campaign.id, user_id: gm.id, role: 'gm' },
    { campaign_id: campaign.id, user_id: player.id, role: 'player' },
  ])
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: player.id, name: 'Perso test réparation', type: 'pj' })
    .returning('*')
  await db('char_sheet').insert({ character_id: character.id })
  const ref = await db('ref_equipment').where({ has_integrity: true }).whereNull('location').first()
  const [item] = await db('char_inventory')
    .insert({ character_id: character.id, equipment_id: ref.id, container: 'Coffre', quantity: 1, integrity_current: current, integrity_max: max, malfunction_severity: malfunction })
    .returning('*')
  return { gm, player, campaign, character, item }
}

async function cleanup({ campaign, gm, player }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
  if (player) await db('users').where({ id: player.id }).del()
}

async function makeEcheance(fx, { status = 'awaiting_player_roll', payloadExtra = {} } = {}) {
  return db.transaction((trx) => createEcheance(trx, {
    campaignId: fx.campaign.id, characterId: fx.character.id, conditionType: 'equipment_repair',
    payload: { itemId: fx.item.id, itemName: 'Objet test', skillId: 'ARMURERIE', ntMalus: 0, ...payloadExtra },
    nextDueMinutes: 0, status,
  }))
}

// ── equipmentRepairHandler ──────────────────────────────────────────────────

test('equipmentRepairHandler — { resolved: false } tant que payload.rollResult est absent', { skip }, async () => {
  const fx = await createRealFixture()
  try {
    const e = await makeEcheance(fx)
    const r = await db.transaction((trx) => equipmentRepairHandler(trx, e))
    assert.deepEqual(r, { resolved: false })
  } finally { await cleanup(fx) }
})

test('equipmentRepairHandler — réussite : ITG courante += MR, panne simple levée, échéance completed', { skip }, async () => {
  const fx = await createRealFixture({ current: 8, max: 15, malfunction: 'simple' })
  try {
    const e = await makeEcheance(fx)
    await db('game_echeances').where({ id: e.id })
      .update({ payload: db.raw('payload || ?::jsonb', [JSON.stringify({ rollResult: { isSuccess: true, mr: 4, roll: 6, threshold: 10, seed: 's' } })]) })
    const res = await db.transaction((trx) => resolveEcheanceNow(trx, e.id))
    assert.equal(res.resolved, true)
    const item = await db('char_inventory').where({ id: fx.item.id }).first()
    assert.equal(item.integrity_current, 12)
    assert.equal(item.malfunction_severity, null)
    assert.equal((await db('game_echeances').where({ id: e.id }).first()).status, 'completed')
  } finally { await cleanup(fx) }
})

test('equipmentRepairHandler — Catastrophe : -1 ITG max, jamais dans pending_advance_undo_log (advance_driven: false)', { skip }, async () => {
  const fx = await createRealFixture({ current: 15, max: 15, malfunction: 'simple' })
  try {
    const e = await makeEcheance(fx)
    await db('game_echeances').where({ id: e.id })
      .update({ payload: db.raw('payload || ?::jsonb', [JSON.stringify({ rollResult: { isSuccess: false, catastropheRisk: true } })]) })
    await db.transaction((trx) => resolveEcheanceNow(trx, e.id))
    const item = await db('char_inventory').where({ id: fx.item.id }).first()
    assert.equal(item.integrity_max, 14)
    assert.equal(item.integrity_current, 14)
    assert.equal(item.malfunction_severity, 'simple', 'RAW : reste en panne')
    assert.equal((await db('campaigns').where({ id: fx.campaign.id }).first()).pending_advance_undo_log, null)
  } finally { await cleanup(fx) }
})

test('equipmentRepairHandler — objet supprimé entre la demande et le jet → resolved, no-op', { skip }, async () => {
  const fx = await createRealFixture()
  try {
    const e = await makeEcheance(fx, { payloadExtra: { rollResult: { isSuccess: true, mr: 3 } } })
    await db('char_inventory').where({ id: fx.item.id }).del()
    const r = await db.transaction((trx) => equipmentRepairHandler(trx, { ...e, payload: { ...e.payload, rollResult: { isSuccess: true, mr: 3 } } }))
    assert.equal(r.resolved, true)
  } finally { await cleanup(fx) }
})

// ── equipmentRepairReviewService ────────────────────────────────────────────

test('getRepairRequestsForGm — enrichit personnage + objet (ITG fraîche) + compétence, filtre statut', { skip }, async () => {
  const fx = await createRealFixture({ current: 4, max: 15 })
  try {
    const e = await makeEcheance(fx, { status: 'pending_mj_review' })
    // bruit : une réparation déjà résolue ne doit pas apparaître
    await makeEcheance(fx, { status: 'completed' })

    const rows = await getRepairRequestsForGm(fx.campaign.id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, e.id)
    assert.equal(rows[0].characterName, 'Perso test réparation')
    assert.equal(rows[0].item.integrityCurrent, 4)
    assert.equal(rows[0].item.integrityMax, 15)
    assert.equal(rows[0].suggestedSkillId, 'ARMURERIE')
    assert.equal(rows[0].suggestedSkillLabel, 'Armurerie')
    assert.equal(rows[0].ntMalus, 0)
  } finally { await cleanup(fx) }
})

test('getRepairRollsForPlayer — un joueur ne voit que ses jets, un GM voit tout', { skip }, async () => {
  const fx = await createRealFixture()
  try {
    const e = await makeEcheance(fx, { status: 'awaiting_player_roll' })

    const asPlayer = await getRepairRollsForPlayer(fx.campaign.id, fx.player.id, { isGm: false })
    assert.equal(asPlayer.length, 1)
    assert.equal(asPlayer[0].id, e.id)

    const asStranger = await getRepairRollsForPlayer(fx.campaign.id, fx.gm.id, { isGm: false })
    assert.equal(asStranger.length, 0, 'le GM en tant que simple utilisateur ne voit pas le perso du joueur')

    const asGm = await getRepairRollsForPlayer(fx.campaign.id, fx.gm.id, { isGm: true })
    assert.equal(asGm.length, 1, 'le GM voit tous les jets en attente')
  } finally { await cleanup(fx) }
})

test.after(async () => { await db.destroy() })
