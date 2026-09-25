import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { applyWound, removeWound, clearCharacterWoundsAndStatuses } from './woundService.js'
import { resolveChanceChoice, listPendingChanceChoices } from './chanceCatastropheChoiceService.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (applyWound crée une échéance de guérison à l'insertion)

// Lancement manuel : node --env-file=../.env --test server/src/lib/woundService.test.mjs
//
// Patron fixture réelle + nettoyage explicite (chanceCatastropheChoiceService.test.mjs), PAS le
// patron rollback-trx (woundUtils.test.mjs) : applyWound (paramètre `db`) et openChanceChoice
// (module `db` importé, chanceCatastropheChoiceService.js) touchent deux connexions distinctes —
// un `trx` unique enveloppant les deux ne verrait pas les écritures de l'autre avant commit.
const skip = !process.env.DATABASE_URL

const fakeIo = { to: () => ({ emit: () => {} }) }

// `chc` : Chance de départ de la fiche (défaut de la base : 11). NO_CHANCE = 3, le plancher : rien à dépenser, donc AUCUNE
// réaction ne s'ouvre et une blessure « Mort » est posée tout de suite (tests du statut `dead`, Lot 2b).
const NO_CHANCE = { chc: 3 }

async function createFixture({ chc } = {}) {
  const [user] = await db('users')
    .insert({ email: `wound-svc-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wound-svc-test' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test woundService', invite_code: `WSVC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Perso test', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id, ...(chc != null && { chc }) }).returning('*')
  return { user, campaign, character, charSheet }
}

async function cleanup({ campaign, user }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (user) await db('users').where({ id: user.id }).del()
}

// ─── applyWound — ouvre un choix Chance dès grave+, jamais légère/moyenne ──────────────────────

test('applyWound (Blessure grave) ouvre un choix Chance avec 2 réductions (degré 1 et 2)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    const result = await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    assert.equal(result.finalSeverity, 'grave')

    const pending = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(pending.length, 1)
    assert.equal(pending[0].site, 'wound_severity')
    assert.equal(pending[0].character_id, fixture.character.id) // pj -> destinataire = lui-même
    const context = typeof pending[0].context === 'string' ? JSON.parse(pending[0].context) : pending[0].context
    assert.deepEqual(context.reductions, [
      { degree: 1, cost: 1, targetSeverity: 'moyenne' },
      { degree: 2, cost: 2, targetSeverity: 'legere' },
    ])
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Blessure moyenne) n\'ouvre aucun choix Chance (RAW : grave+ seulement)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'moyenne',
    })
    const pending = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(pending.length, 0)
  } finally {
    await cleanup(fixture)
  }
})

// ─── applyWound — recalcul base_ini (INI2, RAW REGLESYSCOMBAT.md:111) ──────────────────────────

test('applyWound recalcule base_ini pour un token en combat actif (grave = -5)', { skip }, async () => {
  const fixture = await createFixture()
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: fixture.campaign.id, name: 'BM test woundService' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: fixture.character.id, label: 'T0' })
    .returning('*')
  await db('combat_roster').insert({
    campaign_id: fixture.campaign.id, token_id: token.id, base_ini: 3, initiative: 3, status: 'active',
  })
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    await applyWound(stubIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const row = await db('combat_roster').where({ token_id: token.id }).first()
    // Aucun char_attributes en fixture -> calcAttributeNA replie sur 3 -> calcREA(3,3,0)=3 ; grave=-5 (WOUND_PENALTIES).
    assert.equal(row.base_ini, 3 + (-5))
    assert.equal(row.initiative, 3, 'initiative en direct jamais retouchée (RAW : effectif au Tour suivant)')
    assert.ok(emitted.some(e => e.event === WS.COMBAT_ROSTER_UPDATED), 'roster rediffusé')
  } finally {
    await db('combat_roster').where({ token_id: token.id }).del()
    await db('tokens').where({ id: token.id }).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await cleanup(fixture)
  }
})

test('applyWound hors combat (aucune ligne combat_roster) : no-op silencieux', { skip }, async () => {
  const fixture = await createFixture()
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    const result = await applyWound(stubIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    assert.ok(result, 'la blessure elle-même reste appliquée normalement')
    assert.ok(!emitted.some(e => e.event === WS.COMBAT_ROSTER_UPDATED), 'aucun recalcul hors combat')
  } finally {
    await cleanup(fixture)
  }
})

// ─── finishWoundSeverityChoice — dépense + réduction atomiques ─────────────────────────────────

test('resolveChanceChoice("reduce_1") dépense 1 point de Chance et réduit la Blessure d\'un degré', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 10) // 11 par défaut - 1

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'moyenne')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_2") dépense 2 points et réduit la Blessure de deux degrés', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_2' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 9) // 11 - 2

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'legere')
  } finally {
    await cleanup(fixture)
  }
})

// WOUND-HEAL-CHAIN-STOPS — la blessure réduite par la Chance « devient » une blessure plus légère (REGLE_CHANCE.md:116-121) :
// elle guérit ensuite comme si elle avait été reçue ainsi, avec sa propre échéance de guérison.
const healingEcheancesOf = (campaignId) => db('game_echeances').where({ campaign_id: campaignId, condition_type: 'wound_healing_check' })

test('resolveChanceChoice("reduce_1") : la Moyenne obtenue a sa propre échéance de guérison (3 jours)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const [moyenne] = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })
    assert.equal(moyenne.severity, 'moyenne')
    const mine = (await healingEcheancesOf(fixture.campaign.id)).filter(e => e.payload.woundId === moyenne.id)
    assert.equal(mine.length, 1)
    assert.equal(mine[0].character_id, fixture.character.id)
    assert.equal(mine[0].next_due_minutes, moyenne.occurred_at_game_minutes + 3 * 24 * 60)
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_2") sur une Mortelle : UNE seule échéance, celle de la Grave obtenue — jamais une Critique intermédiaire', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'mortelle',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_2' })

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })
    assert.deepEqual(wounds.map(w => w.severity), ['grave'])
    const woundIds = new Set(wounds.map(w => w.id))
    const alive = (await healingEcheancesOf(fixture.campaign.id)).filter(e => woundIds.has(e.payload.woundId))
    assert.equal(alive.length, 1, 'une seule échéance pour la Grave')
    // Celle de la Mortelle d\'origine n\'est plus reliée à aucune blessure (elle se termine d\'elle-même) ; aucune Critique intermédiaire n\'a existé.
    const all = await healingEcheancesOf(fixture.campaign.id)
    assert.equal(all.length, 2, 'la Mortelle d\'origine + la Grave obtenue — pas de troisième pour une Critique intermédiaire')
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice(null) (timeout) laisse la Blessure inchangée, aucune dépense', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: null })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 11, 'inchangé')

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'grave', 'inchangée')
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Grave) avec Chance au plancher (3) : aucune carte inutile ne s\'ouvre — RAW : il doit rester 3 points', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0)
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 1, 'la blessure est bien écrite')
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Grave) : seules les options PAYABLES sont proposées (Chance 4 → le 2ᵉ degré, 2 points, est refusé)', { skip }, async () => {
  const fixture = await createFixture({ chc: 4 })
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    const context = typeof pending.context === 'string' ? JSON.parse(pending.context) : pending.context
    assert.deepEqual(context.reductions, [{ degree: 1, cost: 1, targetSeverity: 'moyenne' }])
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_1") avec Chance devenue insuffisante entre l\'ouverture et la réponse : aucun effet, une ligne de chat', { skip }, async () => {
  const fixture = await createFixture()
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 3 }) // dépense concurrente : plancher RAW

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 3, 'inchangé — jamais sous le plancher')
    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'grave', 'inchangée — dépense refusée, réduction jamais appliquée')
    assert.deepEqual(noticeKeys(emitted), ['cannotSpend'])
  } finally {
    await cleanup(fixture)
  }
})

// ─── 6ᵉ ligne (mort_subite) — Lot 2a du chantier « 6ᵉ ligne du compteur de blessures » ──────────────────────

test('applyWound (Mortelle à la tête) reste une Mortelle et ouvre un choix Chance (comportement inchangé)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    const result = await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'tete', severity: 'mortelle',
    })
    assert.equal(result.finalSeverity, 'mortelle')
    assert.equal(result.promoted, false)
    assert.equal(result.shock_test_required, true)
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 1)
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound : la 2ᵉ Mortelle à la tête déborde vers mort_subite, diffusée en WOUND_ADDED, sans Test de Choc ni Chance', { skip }, async () => {
  const fixture = await createFixture()
  const emitted = []
  const stubIo = { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }
  try {
    const args = { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'tete', severity: 'mortelle' }
    await applyWound(stubIo, db, fixture.campaign.id, args)
    const second = await applyWound(stubIo, db, fixture.campaign.id, args)

    assert.equal(second.finalSeverity, 'mort_subite')
    assert.equal(second.promoted, true)
    assert.equal(second.shock_test_required, false, 'Mort subite (Tête) : aucun Test de Choc')
    assert.equal(second.worst_wound_severity, 'mort_subite')

    const added = emitted.filter(e => e.event === WS.WOUND_ADDED)
    assert.equal(added.length, 2)
    assert.equal(added[1].payload.wound.severity, 'mort_subite')
    assert.equal(added[1].payload.promoted, true)
    assert.equal(added[1].payload.worst_wound_severity, 'mort_subite')

    // Un seul choix Chance : celui de la 1ʳᵉ Mortelle. La 6ᵉ ligne venue d'un débordement n'en ouvre jamais (décision Saar 2026-09-25).
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 1)

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })
    assert.deepEqual(wounds.map(w => w.severity), ['mort_subite'])
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (mort_subite sur un bras) : Membre détruit — Test de Choc requis ; sur le même bras une 2ᵉ ne fait rien', { skip }, async () => {
  const fixture = await createFixture()
  try {
    const args = { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'bras_gauche', severity: 'mort_subite' }
    const first = await applyWound(fakeIo, db, fixture.campaign.id, args)
    assert.equal(first.finalSeverity, 'mort_subite')
    assert.equal(first.shock_test_required, true)

    const second = await applyWound(fakeIo, db, fixture.campaign.id, args)
    assert.equal(second, null, 'ligne pleine : attendu, sans erreur')
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 1)
  } finally {
    await cleanup(fixture)
  }
})

// ─── Lot 2b — la blessure « Mort » (6ᵉ ligne en Tête/Corps) pose `dead`, la retirer le retire ──────────────────
// Statut posé dans la transaction de la blessure, marqué `data.source = 'wound'` : une blessure ne retire que ce qu'elle
// a posé, jamais le `dead` du MJ (registre : setByFatalWound, statusService.js:reconcileWoundDeath).

async function addTokens(fixture, count = 1) {
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: fixture.campaign.id, name: 'BM test mort' })
    .returning('*')
  const tokens = []
  for (let i = 0; i < count; i += 1) {
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, character_id: fixture.character.id, label: `T${i}` })
      .returning('*')
    tokens.push(token)
  }
  return { battlemap, tokens, ids: tokens.map(t => t.id) }
}

async function cleanupTokens({ battlemap, ids }) {
  await db('tokens').whereIn('id', ids).del()
  await db('battlemaps').where({ id: battlemap.id }).del()
}

const statusRows = (tokenIds) => db('token_statuses').whereIn('token_id', tokenIds).orderBy('id').select('*')

function recordingIo() {
  const emitted = []
  return { emitted, io: { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) } }
}

// Clés des lignes de chat postées (COMBAT_SYSTEM_NOTICE) sous `combat:chance.notice.`, dans l'ordre d'émission.
function noticeKeys(emitted) {
  return emitted.filter(e => e.event === WS.COMBAT_SYSTEM_NOTICE).map(e => e.payload.i18nKey.replace('combat:chance.notice.', ''))
}

const woundArgs = (fixture, localisation, severity) => ({
  charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation, severity,
})

test('applyWound (Mort en Tête) pose `dead` sur TOUS les tokens du personnage, marqué « posé par une blessure », et diffuse les badges', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture, 2)
  const { io, emitted } = recordingIo()
  try {
    const result = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.equal(result.finalSeverity, 'mort_subite')

    const rows = await statusRows(tk.ids)
    assert.deepEqual(rows.map(r => r.status_code), ['dead', 'dead'])
    assert.deepEqual(new Set(rows.map(r => r.token_id)), new Set(tk.ids))
    for (const row of rows) assert.deepEqual(row.data, { source: 'wound' })

    const badges = emitted.filter(e => e.event === WS.TOKEN_STATUS_UPDATED)
    assert.deepEqual(new Set(badges.map(e => e.payload.tokenId)), new Set(tk.ids))
    assert.ok(badges.every(e => e.payload.statuses.includes('dead')))
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('applyWound : la Mort au Corps pose `dead` ; un Membre détruit (bras) et une Mortelle n\'en posent pas', { skip }, async () => {
  const corps = await createFixture(NO_CHANCE)
  const tkCorps = await addTokens(corps)
  const membre = await createFixture(NO_CHANCE)
  const tkMembre = await addTokens(membre)
  const mortelle = await createFixture(NO_CHANCE)
  const tkMortelle = await addTokens(mortelle)
  try {
    await applyWound(fakeIo, db, corps.campaign.id, woundArgs(corps, 'corps', 'mort_subite'))
    assert.deepEqual((await statusRows(tkCorps.ids)).map(r => r.status_code), ['dead'])

    await applyWound(fakeIo, db, membre.campaign.id, woundArgs(membre, 'bras_gauche', 'mort_subite'))
    assert.deepEqual(await statusRows(tkMembre.ids), [], 'Membre détruit : le personnage ne meurt pas')

    await applyWound(fakeIo, db, mortelle.campaign.id, woundArgs(mortelle, 'tete', 'mortelle'))
    assert.deepEqual(await statusRows(tkMortelle.ids), [], 'une Mortelle à la tête reste une Mortelle')
  } finally {
    await cleanupTokens(tkCorps); await cleanupTokens(tkMembre); await cleanupTokens(tkMortelle)
    await cleanup(corps); await cleanup(membre); await cleanup(mortelle)
  }
})

test('applyWound : la 2ᵉ Mortelle à la tête (débordement) pose `dead` — la Mort par cascade est traitée comme un coup ≥ 30', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mortelle'))
    assert.deepEqual(await statusRows(tk.ids), [])
    const second = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mortelle'))
    assert.equal(second.finalSeverity, 'mort_subite')
    assert.deepEqual((await statusRows(tk.ids)).map(r => r.status_code), ['dead'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('applyWound : un `dead` posé à la main par le MJ n\'est ni écrasé ni « repris » par la blessure (sa `data` reste vide), sans rejouer de badge', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await db('token_statuses').insert({ token_id: tk.ids[0], status_code: 'dead', applied_by: fixture.user.id })
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))

    const rows = await statusRows(tk.ids)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].data, null, 'la marque « posé par une blessure » n\'a pas été écrite sur le `dead` du MJ')
    assert.equal(rows[0].applied_by, fixture.user.id)
    assert.ok(!emitted.some(e => e.event === WS.TOKEN_STATUS_UPDATED), 'rien de nouveau posé : aucun badge rediffusé')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('removeWound (Mort) retire le `dead` qu\'elle avait posé, diffuse WOUND_REMOVED et le badge', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture, 2)
  const { io, emitted } = recordingIo()
  try {
    const applied = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    emitted.length = 0

    const removed = await removeWound(io, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId: applied.wound.id,
    })
    assert.equal(removed.id, applied.wound.id)
    assert.deepEqual(await statusRows(tk.ids), [])
    assert.deepEqual(await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }), [])

    const removals = emitted.filter(e => e.event === WS.WOUND_REMOVED)
    assert.equal(removals.length, 1)
    assert.equal(removals[0].payload.worst_wound_severity, null)
    const badges = emitted.filter(e => e.event === WS.TOKEN_STATUS_UPDATED)
    assert.deepEqual(new Set(badges.map(e => e.payload.tokenId)), new Set(tk.ids))
    assert.ok(badges.every(e => !e.payload.statuses.includes('dead')))
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('removeWound (Mort) ne retire PAS un `dead` posé à la main par le MJ', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    await db('token_statuses').insert({ token_id: tk.ids[0], status_code: 'dead' })
    const applied = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    await removeWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId: applied.wound.id,
    })
    assert.deepEqual((await statusRows(tk.ids)).map(r => r.status_code), ['dead'], 'le Mort du MJ survit à la blessure')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('removeWound : tant qu\'une AUTRE Mort subsiste (Tête + Corps), le `dead` reste ; il part avec la dernière', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    const tete = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const corps = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    const remove = (woundId) => removeWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId,
    })

    await remove(tete.wound.id)
    assert.deepEqual((await statusRows(tk.ids)).map(r => r.status_code), ['dead'], 'le Corps est toujours mort')
    await remove(corps.wound.id)
    assert.deepEqual(await statusRows(tk.ids), [])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('removeWound (blessure ordinaire) ne touche pas au statut ; blessure inconnue : null', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const legere = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'bras_droit', 'legere'))
    const ids = { charSheetId: fixture.charSheet.id, characterId: fixture.character.id }

    await removeWound(fakeIo, db, fixture.campaign.id, { ...ids, woundId: legere.wound.id })
    assert.deepEqual((await statusRows(tk.ids)).map(r => r.status_code), ['dead'])
    assert.equal(await removeWound(fakeIo, db, fixture.campaign.id, { ...ids, woundId: legere.wound.id }), null)
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('applyWound : le MJ qui relève le personnage à la main (retire `dead`, garde la blessure) ne le voit pas re-tué par une blessure ordinaire', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    await db('token_statuses').where({ token_id: tk.ids[0], status_code: 'dead' }).del()

    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'bras_droit', 'legere'))
    assert.deepEqual(await statusRows(tk.ids), [], 'une Légère ne rejoue pas la mort')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('applyWound (Mort) sur un personnage sans token : la blessure est écrite, sans erreur (limite connue : la mort se lit sur les tokens)', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  try {
    const result = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.equal(result.finalSeverity, 'mort_subite')
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 1)
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Mort) : en mode « appliqué » les états de corps vivant partent avec la mort ; en « icônes seules » le badge est posé mais rien n\'est retiré', { skip }, async () => {
  const enforced = await createFixture(NO_CHANCE)
  const tkEnforced = await addTokens(enforced)
  const iconOnly = await createFixture(NO_CHANCE)
  const tkIconOnly = await addTokens(iconOnly)
  try {
    await db('campaigns').where({ id: iconOnly.campaign.id }).update({ settings: JSON.stringify({ status_effects_mode: 'icon_only' }) })
    for (const tk of [tkEnforced, tkIconOnly]) {
      await db('token_statuses').insert([
        { token_id: tk.ids[0], status_code: 'stunned' },
        { token_id: tk.ids[0], status_code: 'burning' },
      ])
    }

    await applyWound(fakeIo, db, enforced.campaign.id, woundArgs(enforced, 'tete', 'mort_subite'))
    await applyWound(fakeIo, db, iconOnly.campaign.id, woundArgs(iconOnly, 'tete', 'mort_subite'))

    const codes = async (tk) => (await statusRows(tk.ids)).map(r => r.status_code).sort()
    assert.deepEqual(await codes(tkEnforced), ['burning', 'dead'], 'étourdi retiré (corps vivant), feu conservé (processus)')
    assert.deepEqual(await codes(tkIconOnly), ['burning', 'dead', 'stunned'], 'icon_only : aucun effet mécanique')
  } finally {
    await cleanupTokens(tkEnforced); await cleanupTokens(tkIconOnly)
    await cleanup(enforced); await cleanup(iconOnly)
  }
})

test('applyWound : deux Morts simultanées sur la même fiche ne créent aucun doublon de `dead` (unicité token/statut)', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const tk = await addTokens(fixture)
  try {
    await Promise.all([
      applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite')),
      applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite')),
    ])
    assert.deepEqual((await statusRows(tk.ids)).map(r => r.status_code), ['dead'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

// ─── Lot 3 — la Chance sur la 6ᵉ ligne : la mort n'est posée QU'APRÈS le choix (PLAN_CHANCE.md §8, décision Saar) ──────────
// Une Mort (Tête/Corps) écrite DIRECTEMENT par un coup ≥ 30 ouvre une réaction (3 points → Critique) tant que la Chance le
// permet (chc ≥ 6) ; tant qu'elle est ouverte le personnage vit. Fermée (dépense, « Accepter », délai) : la mort est tranchée.

const chanceOf = async (fixture) => (await db('char_sheet').where({ id: fixture.charSheet.id }).first()).chc
const deadCodes = async (tk) => (await statusRows(tk.ids)).map(r => r.status_code)
const woundSeverities = async (fixture) => (await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).orderBy('created_at')).map(w => w.severity)

test('Mort directe (≥ 30) à la tête avec Chance 11 : le personnage VIT, une réaction s\'ouvre (3 points → Critique), rien n\'est annoncé mort', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    const result = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.equal(result.finalSeverity, 'mort_subite')
    assert.equal(result.promoted, false)

    assert.deepEqual(await statusRows(tk.ids), [], 'pas de `dead` tant que le joueur n\'a pas décidé')
    assert.ok(!emitted.some(e => e.event === WS.TOKEN_STATUS_UPDATED), 'aucun badge')
    assert.deepEqual(noticeKeys(emitted), [], 'aucune ligne « meurt »')

    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    assert.equal(pending.site, 'wound_severity')
    assert.equal(pending.character_id, fixture.character.id)
    const payload = emitted.find(e => e.event === WS.CHANCE_CHOICE_PENDING).payload
    assert.equal(payload.fatal, true)
    assert.deepEqual(payload.options, [{ choice: 'reduce_1', degree: 1, cost: 3, targetSeverity: 'critique' }])
    assert.equal(payload.chcAvailable, 11)
    assert.ok(emitted.findIndex(e => e.event === WS.WOUND_ADDED) < emitted.findIndex(e => e.event === WS.CHANCE_CHOICE_PENDING), 'la blessure d\'abord, puis la réaction')

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: null }) // libère le minuteur
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe : dépenser 3 points → une Critique, le personnage n\'est JAMAIS mort, ligne de chat « la mort est évitée »', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })

    assert.equal(await chanceOf(fixture), 8, '11 − 3')
    assert.deepEqual(await woundSeverities(fixture), ['critique'])
    assert.deepEqual(await statusRows(tk.ids), [], 'jamais mort')
    assert.deepEqual(noticeKeys(emitted), ['deathAvoided'])
    const updated = emitted.find(e => e.event === WS.WOUND_UPDATED)
    assert.equal(updated.payload.wound.severity, 'critique')
    assert.equal(updated.payload.worst_wound_severity, 'critique')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe : « Accepter » (refus explicite) → la mort est posée à ce moment, badges et conséquences, deux lignes de chat', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture, 2)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    assert.deepEqual(await statusRows(tk.ids), [])

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: null, resolvedByUserId: fixture.user.id })

    const rows = await statusRows(tk.ids)
    assert.deepEqual(rows.map(r => r.status_code), ['dead', 'dead'])
    for (const row of rows) assert.deepEqual(row.data, { source: 'wound' })
    assert.equal(await chanceOf(fixture), 11, 'rien dépensé')
    assert.deepEqual(await woundSeverities(fixture), ['mort_subite'])
    assert.deepEqual(noticeKeys(emitted), ['woundAccepted', 'dies'])
    const badges = emitted.filter(e => e.event === WS.TOKEN_STATUS_UPDATED)
    assert.deepEqual(new Set(badges.map(e => e.payload.tokenId)), new Set(tk.ids))
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe : délai écoulé (choix nul, aucun utilisateur) → la mort est posée, ligne « n\'a pas répondu » puis « meurt »', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: null, resolvedByUserId: null })

    assert.deepEqual(await deadCodes(tk), ['dead'])
    assert.deepEqual(noticeKeys(emitted), ['noAnswer', 'dies'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe avec Chance 5 (il faut 6) : aucune réaction, la mort est posée tout de suite, lignes « pas assez de Chance » puis « meurt »', { skip }, async () => {
  const fixture = await createFixture({ chc: 5 })
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0)
    assert.deepEqual(await deadCodes(tk), ['dead'])
    assert.deepEqual(noticeKeys(emitted), ['deathNoChance', 'dies'])
    assert.ok(!emitted.some(e => e.event === WS.CHANCE_CHOICE_PENDING))
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe avec Chance 6 (le minimum) : la réaction s\'ouvre ; dépenser laisse 3', { skip }, async () => {
  const fixture = await createFixture({ chc: 6 })
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })
    assert.equal(await chanceOf(fixture), 3)
    assert.deepEqual(await woundSeverities(fixture), ['critique'])
    assert.deepEqual(await statusRows(tk.ids), [])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort par DÉBORDEMENT (2ᵉ Mortelle) : jamais rachetable, même avec beaucoup de Chance — morte tout de suite, ligne dédiée', { skip }, async () => {
  const fixture = await createFixture() // Chance 11
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mortelle'))
    const [firstReaction] = await listPendingChanceChoices(fixture.campaign.id) // celle de la Mortelle, pas de la Mort
    await resolveChanceChoice(io, fixture.campaign.id, firstReaction.id, { choice: null })
    emitted.length = 0

    const second = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mortelle'))
    assert.equal(second.finalSeverity, 'mort_subite')
    assert.equal(second.promoted, true)
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0, 'aucune réaction pour la 6ᵉ ligne venue d\'un débordement')
    assert.deepEqual(await deadCodes(tk), ['dead'])
    assert.deepEqual(noticeKeys(emitted), ['overflowNoRescue', 'dies'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Membre détruit direct (bras) : rachetable comme la Mort (3 points → Critique), mais le personnage ne meurt jamais', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'bras_droit', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    const payload = emitted.find(e => e.event === WS.CHANCE_CHOICE_PENDING).payload
    assert.equal(payload.fatal, false, 'un Membre détruit ne tue pas')
    assert.deepEqual(payload.options, [{ choice: 'reduce_1', degree: 1, cost: 3, targetSeverity: 'critique' }])

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })
    assert.deepEqual(await woundSeverities(fixture), ['critique'])
    assert.equal(await chanceOf(fixture), 8)
    assert.deepEqual(noticeKeys(emitted), ['limbSaved'])
    assert.deepEqual(await statusRows(tk.ids), [])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Membre détruit direct : refusé → le membre reste détruit, aucune mort, aucune ligne « meurt » ; ligne « accepte sa blessure »', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'jambe_gauche', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: null, resolvedByUserId: fixture.user.id })
    assert.deepEqual(await woundSeverities(fixture), ['mort_subite'])
    assert.deepEqual(await statusRows(tk.ids), [])
    assert.deepEqual(noticeKeys(emitted), ['woundAccepted'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Membre détruit par DÉBORDEMENT (2ᵉ Mortelle sur le bras) : pas de réaction, même règle que la Mort', { skip }, async () => {
  const fixture = await createFixture()
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'bras_gauche', 'mortelle'))
    const [firstReaction] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(io, fixture.campaign.id, firstReaction.id, { choice: null })
    emitted.length = 0

    const second = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'bras_gauche', 'mortelle'))
    assert.equal(second.finalSeverity, 'mort_subite')
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0)
    assert.deepEqual(noticeKeys(emitted), ['overflowNoRescue'])
  } finally {
    await cleanup(fixture)
  }
})

test('Critique pleine : la Mort se rachète en Grave pour 4 points (3 + 1, exception « palier plein »)', { skip }, async () => {
  const fixture = await createFixture()
  try {
    for (let i = 0; i < 2; i += 1) {
      await db('character_wounds').insert({ char_sheet_id: fixture.charSheet.id, location: 'tete', severity: 'critique', occurred_at_game_minutes: i })
    }
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    const context = typeof pending.context === 'string' ? JSON.parse(pending.context) : pending.context
    assert.deepEqual(context.reductions, [{ degree: 2, cost: 4, targetSeverity: 'grave' }])

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_2' })
    assert.equal(await chanceOf(fixture), 7, '11 − 4')
    assert.deepEqual((await woundSeverities(fixture)).sort(), ['critique', 'critique', 'grave'])
  } finally {
    await cleanup(fixture)
  }
})

test('Mort directe : Chance tombée à 4 entre l\'ouverture et la réponse → dépense refusée, la mort est posée, ligne « ne peut plus dépenser »', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 4 })

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })

    assert.equal(await chanceOf(fixture), 4, 'rien de débité')
    assert.deepEqual(await woundSeverities(fixture), ['mort_subite'])
    assert.deepEqual(await deadCodes(tk), ['dead'], 'la décision est tranchée : la réaction est fermée')
    assert.deepEqual(noticeKeys(emitted), ['cannotSpend', 'dies'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe : la Critique visée se remplit pendant l\'attente (2ᵉ blessure) → dépense refusée sans rien débiter, la mort est posée, ligne « plus de place »', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    for (let i = 0; i < 2; i += 1) {
      await db('character_wounds').insert({ char_sheet_id: fixture.charSheet.id, location: 'tete', severity: 'critique', occurred_at_game_minutes: i })
    }

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })

    assert.equal(await chanceOf(fixture), 11, 'rien de débité')
    assert.ok((await woundSeverities(fixture)).includes('mort_subite'))
    assert.deepEqual(await deadCodes(tk), ['dead'])
    assert.deepEqual(noticeKeys(emitted), ['noRoom', 'dies'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Mort directe : le MJ retire la blessure pendant l\'attente → réponse sans effet ni erreur, aucune dépense, personnage vivant', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    const applied = await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    await removeWound(io, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId: applied.wound.id })
    emitted.length = 0

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })

    assert.equal(await chanceOf(fixture), 11)
    assert.deepEqual(await woundSeverities(fixture), [])
    assert.deepEqual(await statusRows(tk.ids), [])
    assert.deepEqual(noticeKeys(emitted), [])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Deux Morts en attente : en accepter UNE tue tout de suite, et retire la carte de l\'autre (un cadavre n\'a plus de Chance)', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    const [a, b] = await listPendingChanceChoices(fixture.campaign.id)
    emitted.length = 0

    await resolveChanceChoice(io, fixture.campaign.id, a.id, { choice: null, resolvedByUserId: fixture.user.id })

    assert.deepEqual(await deadCodes(tk), ['dead'], 'A acceptée : la mort est posée, quoi que décide B')
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0, 'la réaction B est retirée')
    const withdrawn = await db('pending_chance_choices').where({ id: b.id }).first()
    assert.equal(withdrawn.choice, null)
    assert.ok(withdrawn.resolved_at, 'close sans avoir été appliquée')
    assert.equal(await chanceOf(fixture), 11, 'rien dépensé')
    assert.ok(emitted.some(e => e.event === WS.CHANCE_CHOICE_RESOLVED && e.payload.id === b.id), 'la carte B disparaît chez les clients')
    assert.deepEqual(noticeKeys(emitted), ['woundAccepted', 'dies'], 'aucune ligne parasite pour B')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Deux Morts en attente : racheter la 1ʳᵉ ne tue pas tant que la 2ᵉ décide ; l\'accepter tue', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    const [a, b] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, a.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })
    assert.deepEqual(await statusRows(tk.ids), [], 'A rachetée, B décide encore : pas mort')
    await resolveChanceChoice(fakeIo, fixture.campaign.id, b.id, { choice: null, resolvedByUserId: fixture.user.id })
    assert.deepEqual(await deadCodes(tk), ['dead'], 'B acceptée : mort')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Deux Morts en attente : racheter les deux → vivant, 6 points dépensés', { skip }, async () => {
  const fixture = await createFixture({ chc: 12 })
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))
    const [a, b] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, a.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })
    await resolveChanceChoice(fakeIo, fixture.campaign.id, b.id, { choice: 'reduce_1', resolvedByUserId: fixture.user.id })
    assert.equal(await chanceOf(fixture), 6, '12 − 3 − 3')
    assert.deepEqual(await statusRows(tk.ids), [], 'les deux rachetées : jamais mort')
    assert.deepEqual((await woundSeverities(fixture)).sort(), ['critique', 'critique'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('INVARIANT : retirer une AUTRE Mort (sans réaction) pendant une décision ne tue pas le personnage qui décide encore', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  try {
    // A (Tête) attend une décision (Chance 11) : le personnage vit.
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pendingA] = await listPendingChanceChoices(fixture.campaign.id)
    // B (Corps) : ancienne blessure mortelle écrite hors réaction (donnée du MJ), le personnage a été relevé à la main.
    const [b] = await db('character_wounds')
      .insert({ char_sheet_id: fixture.charSheet.id, location: 'corps', severity: 'mort_subite', occurred_at_game_minutes: 0 })
      .returning('*')
    assert.deepEqual(await statusRows(tk.ids), [])

    // Le MJ retire B : sans l’invariant, reconcileWoundDeath verrait A (mortelle) et tuerait avant sa décision.
    await removeWound(fakeIo, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId: b.id })
    assert.deepEqual(await statusRows(tk.ids), [], 'seule A reste, elle décide encore : vivant')
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 1, 'sa réaction est toujours ouverte')

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pendingA.id, { choice: null, resolvedByUserId: fixture.user.id })
    assert.deepEqual(await deadCodes(tk), ['dead'], 'A acceptée : la mort est posée')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Une Mort SANS réaction (Chance tombée à 3) tue tout de suite et retire la réaction ouverte d’une autre Mort', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [pendingA] = await listPendingChanceChoices(fixture.campaign.id)
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 3 }) // dépense concurrente
    emitted.length = 0

    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'mort_subite'))

    assert.deepEqual(await deadCodes(tk), ['dead'])
    assert.equal((await listPendingChanceChoices(fixture.campaign.id)).length, 0, 'la réaction de A est retirée : un cadavre n’a plus de Chance')
    assert.ok(emitted.some(e => e.event === WS.CHANCE_CHOICE_RESOLVED && e.payload.id === pendingA.id))
    assert.deepEqual(noticeKeys(emitted), ['deathNoChance', 'dies'])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('« Accepter » explicite sur une blessure ordinaire (Grave) : rien ne change, ligne « accepte sa blessure », aucun statut ; le délai écoulé ne dit rien', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  const { io, emitted } = recordingIo()
  try {
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'corps', 'grave'))
    await applyWound(io, db, fixture.campaign.id, woundArgs(fixture, 'bras_droit', 'grave'))
    const [explicit, timeout] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(io, fixture.campaign.id, explicit.id, { choice: null, resolvedByUserId: fixture.user.id })
    assert.deepEqual(noticeKeys(emitted), ['woundAccepted'])
    await resolveChanceChoice(io, fixture.campaign.id, timeout.id, { choice: null, resolvedByUserId: null })
    assert.deepEqual(noticeKeys(emitted), ['woundAccepted'], 'le délai écoulé sur une blessure ordinaire ne raconte rien')
    assert.deepEqual(await woundSeverities(fixture), ['grave', 'grave'])
    assert.deepEqual(await statusRows(tk.ids), [])
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Le MJ qui a relevé le personnage à la main n\'est pas re-tué par la fermeture d\'une réaction ordinaire (Grave)', { skip }, async () => {
  const fixture = await createFixture()
  const tk = await addTokens(fixture)
  try {
    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    const [fatalReaction] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, fatalReaction.id, { choice: null, resolvedByUserId: fixture.user.id })
    await db('token_statuses').where({ token_id: tk.ids[0], status_code: 'dead' }).del() // relevé à la main, blessure gardée

    await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'bras_droit', 'grave'))
    const [graveReaction] = await listPendingChanceChoices(fixture.campaign.id)
    await resolveChanceChoice(fakeIo, fixture.campaign.id, graveReaction.id, { choice: null, resolvedByUserId: fixture.user.id })
    assert.deepEqual(await statusRows(tk.ids), [], 'la fermeture d\'une réaction ordinaire ne rejoue pas la mort')
  } finally {
    await cleanupTokens(tk)
    await cleanup(fixture)
  }
})

test('Une panne de la réaction de Chance ne fait JAMAIS échouer la blessure (sous-transaction) : blessure écrite, aucune réaction', { skip }, async () => {
  const fixture = await createFixture()
  // Injection : une Mort directe n'a AUCUNE échéance de guérison (donc rien n'échoue avant), mais sa réaction viole la clé
  // étrangère pending_chance_choices.campaign_id (campagne inconnue) — l'échec est confiné à la sous-transaction.
  const unknownCampaignId = '00000000-0000-4000-8000-000000000000'
  const errors = []
  const originalError = console.error
  console.error = (...args) => errors.push(args.join(' '))
  try {
    const result = await applyWound(fakeIo, db, unknownCampaignId, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.ok(result, 'applyWound retourne normalement')
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 1, 'la blessure est écrite')
    assert.equal((await db('pending_chance_choices').where({ character_id: fixture.character.id })).length, 0)
    assert.ok(errors.some(e => e.includes('réaction de Chance non ouverte')), 'la panne est loguée : ' + errors.join(' | '))
  } finally {
    console.error = originalError
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })

// ─── Lot 0 (PLAN_REVUE_GUERISON) — une échéance vit et meurt avec sa case : plus d'échéance fantôme, et l'écran de revue ouvert se met à jour ──

const captureIo = () => {
  const emitted = []
  return { emitted, io: { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) } }
}
const echeanceEvents = (emitted) => emitted.filter(e => e.event === WS.GAME_ECHEANCE_RESOLVED).map(e => e.payload.echeanceId)

test('removeWound : l\'échéance de guérison de la blessure retirée est annulée, et sa ligne quitte l\'écran de revue du MJ', { skip }, async () => {
  const fixture = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const result = await applyWound(io, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'moyenne',
    })
    const [echeance] = await healingEcheancesOf(fixture.campaign.id)
    assert.equal(echeance.status, 'active')

    await removeWound(io, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, woundId: result.wound.id })

    assert.equal((await db('game_echeances').where({ id: echeance.id }).first()).status, 'cancelled')
    assert.deepEqual(echeanceEvents(emitted), [echeance.id])
  } finally {
    await cleanup(fixture)
  }
})

test('/heal (clearCharacterWoundsAndStatuses) : toutes les échéances de guérison du personnage sont annulées, aucune fantôme, une diffusion par ligne', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const { io, emitted } = captureIo()
  try {
    for (const [localisation, severity] of [['corps', 'moyenne'], ['tete', 'moyenne'], ['bras_droit', 'grave']]) {
      await applyWound(io, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation, severity })
    }
    const before = await healingEcheancesOf(fixture.campaign.id)
    assert.equal(before.length, 3)
    emitted.length = 0

    assert.equal(await clearCharacterWoundsAndStatuses(io, db, fixture.campaign.id, fixture.character.id), true)

    const after = await healingEcheancesOf(fixture.campaign.id)
    assert.deepEqual(after.map(e => e.status), ['cancelled', 'cancelled', 'cancelled'])
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 0)
    assert.deepEqual(new Set(echeanceEvents(emitted)), new Set(before.map(e => e.id)))
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound : une promotion en cascade annule les échéances des cases fusionnées et diffuse leur retrait ; la case finale a la sienne', { skip }, async () => {
  const fixture = await createFixture(NO_CHANCE)
  const { io, emitted } = captureIo()
  try {
    for (let i = 0; i < 2; i += 1) {
      await applyWound(io, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'moyenne' })
    }
    const merged = await healingEcheancesOf(fixture.campaign.id)
    assert.equal(merged.length, 2)
    emitted.length = 0

    const third = await applyWound(io, db, fixture.campaign.id, { charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'moyenne' })
    assert.equal(third.promoted, true)
    assert.equal(third.wound.severity, 'grave')

    const all = await healingEcheancesOf(fixture.campaign.id)
    const alive = all.filter(e => e.status === 'active')
    assert.equal(alive.length, 1)
    assert.equal(alive[0].payload.woundId, third.wound.id)
    assert.deepEqual(new Set(all.filter(e => e.status === 'cancelled').map(e => e.id)), new Set(merged.map(e => e.id)))
    assert.deepEqual(new Set(echeanceEvents(emitted)), new Set(merged.map(e => e.id)))
  } finally {
    await cleanup(fixture)
  }
})

test('resolveChanceChoice("reduce_1") : l\'échéance de la Grave d\'origine est annulée (et sa ligne quitte l\'écran de revue), celle de la Moyenne obtenue reste vivante', { skip }, async () => {
  const fixture = await createFixture()
  const { io, emitted } = captureIo()
  try {
    await applyWound(io, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [original] = await healingEcheancesOf(fixture.campaign.id)
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)
    emitted.length = 0

    await resolveChanceChoice(io, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    assert.equal((await db('game_echeances').where({ id: original.id }).first()).status, 'cancelled')
    const [moyenne] = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })
    assert.equal(moyenne.severity, 'moyenne')
    const alive = (await healingEcheancesOf(fixture.campaign.id)).filter(e => e.status === 'active')
    assert.deepEqual(alive.map(e => e.payload.woundId), [moyenne.id])
    assert.ok(echeanceEvents(emitted).includes(original.id))
  } finally {
    await cleanup(fixture)
  }
})
