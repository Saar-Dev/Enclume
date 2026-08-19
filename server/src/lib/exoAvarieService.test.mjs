import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { severityForExoDamage, applyExoAvarie, resolveExoDamage } from './exoAvarieService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/exoAvarieService.test.mjs
const skip = !process.env.DATABASE_URL

// PLAN_EXOARMURE.md §11 — fixture minimale (pas de pilote/char_sheet, applyExoAvarie ne les touche
// jamais), même patron que createExoFixture (combatantContextService.test.mjs) mais réduit à ce dont
// ce fichier a besoin. `withTemplate` : nécessaire pour resolveExoDamage (calcExoDegatsNets exige un
// template assigné, BLD/RD sinon incalculables).
async function createExoFixture({ integrityOverrides = {}, withTemplate = false, templateFields = {} } = {}) {
  const [gm] = await db('users')
    .insert({ email: `exo-avarie-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'exo-avarie-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test exoAvarieService', invite_code: `EXOAV-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test avaries', type: 'exo' })
    .returning('*')
  let template = null
  if (withTemplate) {
    [template] = await db('ref_exo_templates')
      .insert({
        name: 'Modèle test avaries', category: 'exo-1', environment: 'surface',
        base_exoforce: 68, base_blindage: 34,
        ...templateFields,
      })
      .returning('*')
  }
  const [exoSheet] = await db('exo_sheet')
    .insert({
      character_id: exoCharacter.id,
      template_id: template?.id ?? null,
      itg_structure_current: integrityOverrides.structure ?? 20,
      itg_exosquelette_current: integrityOverrides.exosquelette ?? 20,
      itg_generator_current: integrityOverrides.generator ?? 20,
    })
    .returning('*')
  return { gm, campaign, exoCharacter, exoSheet, template }
}

async function cleanup({ campaign, gm, template }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
  if (template) await db('ref_exo_templates').where({ id: template.id }).del()
}

// Faux objet io — seule méthode utilisée par applyExoAvarie est io.to(campaignId).emit(...).
function createFakeIo() {
  const emitted = []
  return {
    emitted,
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  }
}

test.after(async () => { await db.destroy() })

// ─── severityForExoDamage — pure, seuils REGLEARMURE.md p.326 ───────────────────────────────────────

test('severityForExoDamage — valeurs sous 5 : null (pas d\'Avarie)', () => {
  assert.equal(severityForExoDamage(0), null)
  assert.equal(severityForExoDamage(4), null)
})

test('severityForExoDamage — seuils exacts et valeurs immédiatement sous', () => {
  assert.equal(severityForExoDamage(5),  'legere')
  assert.equal(severityForExoDamage(9),  'legere')
  assert.equal(severityForExoDamage(10), 'moyenne')
  assert.equal(severityForExoDamage(14), 'moyenne')
  assert.equal(severityForExoDamage(15), 'grave')
  assert.equal(severityForExoDamage(19), 'grave')
  assert.equal(severityForExoDamage(20), 'critique')
  assert.equal(severityForExoDamage(24), 'critique')
  assert.equal(severityForExoDamage(25), 'catastrophique')
  assert.equal(severityForExoDamage(29), 'catastrophique')
  assert.equal(severityForExoDamage(30), 'destruction')
  assert.equal(severityForExoDamage(45), 'destruction')
})

// ─── applyExoAvarie — cascade, promotion, perte d'ITG ────────────────────────────────────────────────

test('applyExoAvarie — première Avarie légère : compteur à 1, aucune perte d\'ITG', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    const result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'legere' })
    assert.equal(result.exoSheet.avaries_legeres, 1)
    assert.equal(result.exoSheet.itg_structure_current, 20)
    assert.equal(result.destroyed, false)
    assert.equal(result.itgLoss, 0)
    assert.equal(io.emitted.length, 1)
    assert.equal(io.emitted[0].event, WS.EXO_AVARIE_UPDATED)
    assert.equal(io.emitted[0].room, fx.campaign.id)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — 4 Avaries légères successives : simple incrément, pas de promotion (maxCount=5)', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    let result
    for (let i = 0; i < 4; i++) {
      result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'legere' })
    }
    assert.equal(result.exoSheet.avaries_legeres, 4)
    assert.equal(result.exoSheet.avaries_moyennes, 0)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — 5e Avarie légère : promotion — légère effacée, moyenne à 1', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    let result
    for (let i = 0; i < 5; i++) {
      result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'legere' })
    }
    assert.equal(result.exoSheet.avaries_legeres, 0)
    assert.equal(result.exoSheet.avaries_moyennes, 1)
    assert.equal(result.finalSeverity, 'moyenne')
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — première Avarie critique : perte d\'1 point d\'ITG Structure', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    const result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'critique' })
    assert.equal(result.exoSheet.avaries_critiques, 1)
    assert.equal(result.exoSheet.itg_structure_current, 19)
    assert.equal(result.itgLoss, 1)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — deuxième Avarie critique : aucune perte d\'ITG supplémentaire', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'critique' })
    const result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'critique' })
    assert.equal(result.exoSheet.avaries_critiques, 2)
    assert.equal(result.exoSheet.itg_structure_current, 19)  // toujours -1, pas -2
    assert.equal(result.itgLoss, 0)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — débordement Catastrophique (maxCount=2) : cascade vers Destruction', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    // 1re Avarie catastrophique : perte -1 ITG (19), compteur à 1.
    const r1 = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'catastrophique' })
    assert.equal(r1.exoSheet.avaries_catastrophiques, 1)
    assert.equal(r1.exoSheet.itg_structure_current, 19)
    // 2e Avarie catastrophique : maxCount-1=1 déjà atteint → cette Avarie COMPLÉTERAIT la ligne →
    // cascade vers Destruction (pas de compteur), perte -2 ITG (17, pas -1), ligne catastrophique
    // effacée.
    const r2 = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'catastrophique' })
    assert.equal(r2.exoSheet.avaries_catastrophiques, 0)
    assert.equal(r2.exoSheet.itg_structure_current, 17)
    assert.equal(r2.finalSeverity, 'destruction')
    assert.equal(r2.destroyed, true)
    assert.equal(r2.itgLoss, 2)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — Destruction directe (net ≥ 30) : perte -2 ITG inconditionnelle, aucun compteur touché', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    const r1 = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'destruction' })
    assert.equal(r1.exoSheet.itg_structure_current, 18)
    assert.equal(r1.destroyed, true)
    // Une 2e Destruction coûte encore un point — inconditionnel, contrairement à critique/catastrophique
    // (REGLEARMURE.md:351-353).
    const r2 = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'destruction' })
    assert.equal(r2.exoSheet.itg_structure_current, 16)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — itg_structure_current ne descend jamais sous 0', { skip }, async () => {
  const fx = await createExoFixture({ integrityOverrides: { structure: 1 } })
  try {
    const io = createFakeIo()
    const result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: 'destruction' })
    assert.equal(result.exoSheet.itg_structure_current, 0)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — severity absente : retourne null, aucune émission', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const io = createFakeIo()
    const result = await applyExoAvarie(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, severity: null })
    assert.equal(result, null)
    assert.equal(io.emitted.length, 0)
  } finally { await cleanup(fx) }
})

test('applyExoAvarie — exo_sheet introuvable : retourne null', { skip }, async () => {
  const io = createFakeIo()
  const result = await applyExoAvarie(io, db, 'campaign-inexistante', { characterId: '00000000-0000-0000-0000-000000000000', severity: 'legere' })
  assert.equal(result, null)
})

// ─── resolveExoDamage — orchestrateur complet (contexte → BLD/RD → sévérité → Avarie) ────────────────
// Template test : category exo-1 (RD=-2, exoConstants.js), base_blindage=34 → BLD=34 à Intégrité pleine
// (integrityFactor=1, exoStats.js). degatsNets = degautsBruts - 34 + (-2) = degautsBruts - 36.

test('resolveExoDamage — dégâts sous le seuil (degatsNets < 5) : aucune Avarie, compteur intact', { skip }, async () => {
  const fx = await createExoFixture({ withTemplate: true })
  try {
    const io = createFakeIo()
    // degautsBruts=36 → degatsNets=0
    const result = await resolveExoDamage(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, degautsBruts: 36 })
    assert.equal(result.degatsNets, 0)
    assert.equal(result.bld, 34)
    assert.equal(result.rd, -2)
    assert.equal(result.severity, null)
    assert.equal(result.destroyed, false)
    assert.equal(result.itgLoss, 0)
    assert.equal(io.emitted.length, 0)  // pas d'applyExoAvarie appelé, pas d'émission
    const reread = await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).first()
    assert.equal(reread.avaries_legeres, 0)
  } finally { await cleanup(fx) }
})

test('resolveExoDamage — dégâts au-dessus du seuil : calcule BLD/RD, applique l\'Avarie correspondante', { skip }, async () => {
  const fx = await createExoFixture({ withTemplate: true })
  try {
    const io = createFakeIo()
    // degautsBruts=51 → degatsNets=15 → 'grave'
    const result = await resolveExoDamage(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, degautsBruts: 51 })
    assert.equal(result.degatsNets, 15)
    assert.equal(result.severity, 'grave')
    assert.equal(result.itgLoss, 0)  // grave n'a pas de perte d'ITG (EXO_AVARIE_TABLE)
    assert.equal(io.emitted.length, 1)
    assert.equal(io.emitted[0].event, WS.EXO_AVARIE_UPDATED)
    const reread = await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).first()
    assert.equal(reread.avaries_graves, 1)
  } finally { await cleanup(fx) }
})

test('resolveExoDamage — aucun template assigné : retourne null (aucune stat effective calculable)', { skip }, async () => {
  const fx = await createExoFixture({ withTemplate: false })
  try {
    const io = createFakeIo()
    const result = await resolveExoDamage(io, db, fx.campaign.id, { characterId: fx.exoCharacter.id, degautsBruts: 100 })
    assert.equal(result, null)
    assert.equal(io.emitted.length, 0)
  } finally { await cleanup(fx) }
})
