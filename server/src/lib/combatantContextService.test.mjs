import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { resolveHumanoidTestContext } from './combatantContextService.js'
import { calcSkillTotal, calcEncumbrancePenalty, getModDom } from './charStats.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/combatantContextService.test.mjs
const skip = !process.env.DATABASE_URL

// PLAN_COMBATANT_CONTEXT.md Lot A — première couverture de test de la chaîne attrs/archetype/
// charSkill/refSkill/wounds/inventory/mutationEffects → calcSkillTotal/calcAttributeNA/
// calcActiveMalus/getModDom, écrite 7 fois sans jamais être testée jusqu'ici (extraction depuis
// resolveMeleeAction, socketCombatHelpers.js).

const ALL_ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

async function createFixture(attrOverrides = {}) {
  const [gm] = await db('users')
    .insert({ email: `combatant-ctx-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'combatant-ctx-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test combatantContextService', invite_code: `COMBCTX-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Personnage test', type: 'pj' })
    .returning('*')
  const [sheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  await db('char_attributes').insert(
    ALL_ATTRS.map(attr_id => ({ char_sheet_id: sheet.id, attr_id, base_level: attrOverrides[attr_id] ?? 10 }))
  )
  return { gm, campaign, character, sheet }
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

test.after(async () => { await db.destroy() })

test('resolveHumanoidTestContext — pas de char_sheet : null', { skip }, async () => {
  const [gm] = await db('users')
    .insert({ email: `combatant-ctx-nosheet-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'combatant-ctx-nosheet' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test sans fiche', invite_code: `COMBCTX-NS-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Sans fiche', type: 'pj' })
    .returning('*')
  try {
    const ctx = await resolveHumanoidTestContext(db, character, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx, null)
  } finally {
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
})

test('resolveHumanoidTestContext — skillId=null : palier NA seul, pas de skillTotal', { skip }, async () => {
  const fx = await createFixture({ FOR: 14, CON: 9, VOL: 12 })
  try {
    const ctx = await resolveHumanoidTestContext(db, fx.character, null)
    assert.deepEqual(ctx, { sheetId: fx.sheet.id, for_na: 14, con_na: 9, vol_na: 12 })
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — COMBAT_A_MAINS_NUES sans char_skills : mastery 0, skillTotal = attributs seuls', { skip }, async () => {
  const fx = await createFixture({ FOR: 14 })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
    const refSkill = await db('ref_skills').where({ id: 'COMBAT_A_MAINS_NUES' }).first()
    assert.ok(refSkill, 'COMBAT_A_MAINS_NUES doit être seedée (migration 37)')

    const ctx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx.mastery, 0)
    assert.equal(ctx.skillTotal, calcSkillTotal(attrs, undefined, refSkill, null, null))
    assert.equal(ctx.for_na, 14)
    assert.equal(ctx.modDom, getModDom(14))
    assert.equal(ctx.sheetId, fx.sheet.id)
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — compétence entraînée (mastery>0) : skillTotal inclut le bonus de maîtrise', { skip }, async () => {
  const fx = await createFixture({ FOR: 14 })
  await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 5 })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
    const refSkill = await db('ref_skills').where({ id: 'COMBAT_A_MAINS_NUES' }).first()

    const ctx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx.mastery, 5)
    assert.equal(ctx.skillTotal, calcSkillTotal(attrs, { mastery: 5 }, refSkill, null, null))
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — génotype avec modificateur FOR (ref_genotypes réel) : for_na et skillTotal reflètent le modificateur', { skip }, async () => {
  const fx = await createFixture({ FOR: 10 })
  const genotype = await db('ref_genotypes').where({ id: 'TEC_HYB' }).first()
  assert.ok(genotype, 'TEC_HYB doit être un génotype seedé')
  assert.equal(genotype.mod_for, 2, 'précondition du test — si le seed change, adapter le génotype choisi')
  await db('char_archetype').insert({ char_sheet_id: fx.sheet.id, genotype_id: genotype.id })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
    const refSkill = await db('ref_skills').where({ id: 'COMBAT_A_MAINS_NUES' }).first()

    const ctx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx.for_na, 12) // base_level 10 + mod_for 2 (TOTAL_MALUS=0)
    assert.equal(ctx.modDom, getModDom(12))
    assert.equal(ctx.skillTotal, calcSkillTotal(attrs, undefined, refSkill, genotype, null))
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — mutation active avec modificateur PRE (ref_mutations réel) : skillTotal reflète le modificateur', { skip }, async () => {
  const fx = await createFixture({ PRE: 10 })
  const mutation = await db('ref_mutations').where({ mutation_id: 30 }).first()
  assert.ok(mutation, 'mutation_id 30 (Purulence) doit être seedée')
  assert.equal(mutation.mod_PRE, -2, 'précondition du test — si le seed change, adapter la mutation choisie')
  await db('char_mutations').insert({ char_sheet_id: fx.sheet.id, mutation_id: mutation.mutation_id })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
    const refSkill = await db('ref_skills').where({ id: 'ENTREGENT_SEDUCTION' }).first()
    assert.ok(refSkill, 'ENTREGENT_SEDUCTION doit être une compétence seedée (PRE pur, attr_2 null)')
    const mutationEffects = await db('char_mutation_effects_view').where({ char_sheet_id: fx.sheet.id }).first()
    assert.ok(mutationEffects, 'char_mutation_effects_view doit produire une ligne pour ce personnage')
    assert.equal(mutationEffects.mod_PRE, -2)

    const ctx = await resolveHumanoidTestContext(db, fx.character, 'ENTREGENT_SEDUCTION')
    assert.equal(ctx.skillTotal, calcSkillTotal(attrs, undefined, refSkill, null, mutationEffects))
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — skillId absent de ref_skills : skillTotal 0, mastery 0, mais effectiveMalus/for_na/modDom restent calculés (Lot D, tireur sans compétence associée)', { skip }, async () => {
  const fx = await createFixture({ FOR: 14 })
  await db('character_wounds').insert({ char_sheet_id: fx.sheet.id, location: 'corps', severity: 'grave' })
  try {
    const ctx = await resolveHumanoidTestContext(db, fx.character, 'SKILL_INEXISTANT_TEST_XYZ')
    assert.equal(ctx.skillTotal, 0)
    assert.equal(ctx.mastery, 0)
    // Palier complet malgré l'absence de Compétence trouvée — contrairement au palier NA seul
    // (skillId=null), effectiveMalus/for_na/modDom doivent rester présents : c'est précisément ce
    // que resolveAssaultAction (Lot D) exploite quand ref_equipment_skill_assoc ne trouve pas l'arme.
    assert.equal(ctx.for_na, 14)
    assert.equal(ctx.modDom, getModDom(14))
    assert.equal(ctx.effectiveMalus, -5) // WOUND_PENALTIES.grave
    assert.equal(ctx.sheetId, fx.sheet.id)
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — blessure grave active : effectiveMalus reflète le malus de blessure', { skip }, async () => {
  const fx = await createFixture()
  await db('character_wounds').insert({ char_sheet_id: fx.sheet.id, location: 'corps', severity: 'grave' })
  try {
    const ctx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    // WOUND_PENALTIES.grave = -5 (shared/woundConstants.js) ; inventaire vide → pas d'encombrement ;
    // fatigue_enabled à false par défaut (SETTINGS_SCHEMA) → pas de contribution fatigue.
    assert.equal(ctx.effectiveMalus, -5)
  } finally {
    await cleanup(fx)
  }
})

test('resolveHumanoidTestContext — inventaire au-dessus du seuil FOR×3 : effectiveMalus reflète calcEncumbrancePenalty', { skip }, async () => {
  const fx = await createFixture({ FOR: 7 })
  const heavyItem = await db('ref_equipment').whereNotNull('weight').andWhere('weight', '>', 0).first()
  assert.ok(heavyItem, 'catalogue ref_equipment doit contenir au moins un item avec un poids défini')
  const quantity = Math.ceil(30 / heavyItem.weight)
  await db('char_inventory').insert({ character_id: fx.character.id, equipment_id: heavyItem.id, container: 'Sac', quantity })
  try {
    const ctx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    const expectedMalus = -calcEncumbrancePenalty(heavyItem.weight * quantity, 7, 3)
    assert.equal(ctx.effectiveMalus, expectedMalus)
  } finally {
    await cleanup(fx)
  }
})
