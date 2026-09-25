import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { applyWound, removeWound } from './woundService.js'
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

async function createFixture() {
  const [user] = await db('users')
    .insert({ email: `wound-svc-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wound-svc-test' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test woundService', invite_code: `WSVC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Perso test', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
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
      { degree: 1, targetSeverity: 'moyenne' },
      { degree: 2, targetSeverity: 'legere' },
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

test('resolveChanceChoice("reduce_1") avec Chance insuffisante : aucun effet, transaction atomique', { skip }, async () => {
  const fixture = await createFixture()
  try {
    await db('char_sheet').where({ id: fixture.charSheet.id }).update({ chc: 3 }) // plancher RAW
    await applyWound(fakeIo, db, fixture.campaign.id, {
      charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation: 'corps', severity: 'grave',
    })
    const [pending] = await listPendingChanceChoices(fixture.campaign.id)

    await resolveChanceChoice(fakeIo, fixture.campaign.id, pending.id, { choice: 'reduce_1' })

    const sheet = await db('char_sheet').where({ id: fixture.charSheet.id }).first()
    assert.equal(sheet.chc, 3, 'inchangé — jamais sous le plancher')

    const wounds = await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id }).select('*')
    assert.equal(wounds.length, 1)
    assert.equal(wounds[0].severity, 'grave', 'inchangée — dépense refusée, réduction jamais appliquée')
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

    // Un seul choix Chance : celui de la 1ʳᵉ Mortelle. La 6ᵉ ligne n'en ouvre aucun avant le Lot 3.
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

const woundArgs = (fixture, localisation, severity) => ({
  charSheetId: fixture.charSheet.id, characterId: fixture.character.id, localisation, severity,
})

test('applyWound (Mort en Tête) pose `dead` sur TOUS les tokens du personnage, marqué « posé par une blessure », et diffuse les badges', { skip }, async () => {
  const fixture = await createFixture()
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
  const corps = await createFixture()
  const tkCorps = await addTokens(corps)
  const membre = await createFixture()
  const tkMembre = await addTokens(membre)
  const mortelle = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
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
  const fixture = await createFixture()
  try {
    const result = await applyWound(fakeIo, db, fixture.campaign.id, woundArgs(fixture, 'tete', 'mort_subite'))
    assert.equal(result.finalSeverity, 'mort_subite')
    assert.equal((await db('character_wounds').where({ char_sheet_id: fixture.charSheet.id })).length, 1)
  } finally {
    await cleanup(fixture)
  }
})

test('applyWound (Mort) : en mode « appliqué » les états de corps vivant partent avec la mort ; en « icônes seules » le badge est posé mais rien n\'est retiré', { skip }, async () => {
  const enforced = await createFixture()
  const tkEnforced = await addTokens(enforced)
  const iconOnly = await createFixture()
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
  const fixture = await createFixture()
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

test.after(async () => { await db.destroy() })
