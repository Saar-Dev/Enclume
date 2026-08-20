import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  resolveHumanoidTestContext, resolveCombatantTestContext, resolveCombatantIdentity,
  resolveExoContext, resolveManeuverSkillId, isExoActorAuthorized,
} from './combatantContextService.js'
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

// PLAN_COMBATANT_CONTEXT.md Lot G — fixture pilote (char_sheet réel, réutilise createFixture) + exo
// (exo_sheet + ref_exo_templates réels, character_id distinct du pilote — MANUEL_EXOARMURE.md §3.1,
// deux personnages jamais fusionnés). `templateOverrides` permet de forcer une exo "non configurée"
// (template_id null) ou sans pilote assigné, cas de repli §6.5/§7.1.
// `pilotType` (PLAN_EXOARMURE.md Lot 2 §7.7) : createFixture crée toujours un pilote 'pj' — bascule
// le type après coup pour les tests de routage de la confirmation de défense (pilote PNJ). `exoOwnerId`
// : par défaut le même utilisateur que le pilote (comportement historique de cette fixture, préservé
// pour ne pas casser les tests existants) — les tests §7.7 le forcent à un utilisateur distinct pour
// vérifier que resolveCombatantIdentity suit le PILOTE, jamais le propriétaire brut de la fiche exo.
async function createExoFixture({ withPilot = true, withTemplate = true, pilotAttrOverrides = {}, integrityOverrides = {}, templateFields = {}, pilotType = null, exoOwnerId = null } = {}) {
  const pilotFx = await createFixture(pilotAttrOverrides)
  if (pilotType) {
    await db('characters').where({ id: pilotFx.character.id }).update({ type: pilotType })
    pilotFx.character.type = pilotType
  }
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: pilotFx.campaign.id, user_id: exoOwnerId ?? pilotFx.gm.id, name: 'Exo test', type: 'exo' })
    .returning('*')
  // Lot B (PLAN_EXOARMURE.md §13.3, 2026-08-20) — exo_sheet porte désormais sa propre base éditable
  // (copiée depuis le template par applyExoTemplate en usage réel) : cette fixture simule cette copie
  // directement à l'insertion, `ref_exo_templates` reste créée en plus pour le lien `template_id`
  // (encore lu par certains tests via `fx.template`) mais n'est plus la source lue par
  // computeExoStats/resolveManeuverSkillId.
  const templateData = { category: 'exo-1', environment: 'surface', base_exoforce: 68, base_blindage: 34, ...templateFields }
  let template = null
  if (withTemplate) {
    [template] = await db('ref_exo_templates')
      .insert({ name: 'Modèle test', ...templateData })
      .returning('*')
  }
  const [exoSheet] = await db('exo_sheet')
    .insert({
      character_id: exoCharacter.id,
      template_id: template?.id ?? null,
      pilot_character_id: withPilot ? pilotFx.character.id : null,
      itg_structure_current: integrityOverrides.structure ?? 20,
      itg_exosquelette_current: integrityOverrides.exosquelette ?? 20,
      itg_generator_current: integrityOverrides.generator ?? 20,
      ...(withTemplate ? templateData : {}),
    })
    .returning('*')
  return { ...pilotFx, exoCharacter, exoSheet, template }
}

async function cleanupExo(fx) {
  await cleanup(fx)  // cascade characters/char_sheet/exo_sheet via campaign_id/character_id
  if (fx.template) await db('ref_exo_templates').where({ id: fx.template.id }).del()
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

// PLAN_COMBATANT_CONTEXT.md Lot G — resolveCombatantTestContext (dispatcher) + branche exo.

test('resolveCombatantTestContext — exo avec pilote+template : for_na/modDom viennent de l\'EXF, skillTotal/con_na/vol_na du pilote', { skip }, async () => {
  const fx = await createExoFixture({ pilotAttrOverrides: { FOR: 14, CON: 9, VOL: 12 } })
  try {
    const pilotCtx = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES')
    assert.ok(ctx, 'contexte exo attendu (pilote + template présents)')
    // itg_* par défaut à 20 (>= 11) → integrityFactor=1 des deux côtés → EXF = base_exoforce brut.
    assert.equal(ctx.for_na, fx.template.base_exoforce)
    assert.equal(ctx.modDom, getModDom(fx.template.base_exoforce))
    // Tout le reste vient du pilote, inchangé — la FOR du pilote (14) n'apparaît nulle part ici,
    // seule l'EXF (68) compte pour for_na/modDom (MANUEL_EXOARMURE.md §4.1).
    assert.equal(ctx.skillTotal, pilotCtx.skillTotal)
    assert.equal(ctx.con_na, 9)
    assert.equal(ctx.vol_na, 12)
    assert.equal(ctx.sheetId, fx.sheet.id)
    assert.equal(ctx.mastery, pilotCtx.mastery)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — exo, skillId=null (palier NA seul) : for_na=EXF, pas de modDom', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, null)
    assert.deepEqual(ctx, { sheetId: fx.sheet.id, for_na: fx.template.base_exoforce, con_na: 10, vol_na: 10 })
    assert.ok(!('modDom' in ctx), 'palier NA seul : pas de modDom, ni pour un humain ni pour un exo')
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — Intégrité Exosquelette/Générateur dégradées : EXF reflète les paliers (MANUEL_EXOARMURE.md §4.8.2)', { skip }, async () => {
  // Exosquelette à 8 (palier 6-10, ×2/3) et Générateur à 3 (palier 1-5, ×1/2) — cumulatifs, un seul
  // floor (décision Saar, shared/exoStats.js). base_exoforce=68 → 68×2/3×1/2 = 22,67 → floor 22.
  const fx = await createExoFixture({ integrityOverrides: { exosquelette: 8, generator: 3 } })
  try {
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx.for_na, 22)
    assert.equal(ctx.modDom, getModDom(22))
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — exo sans pilote assigné : null', { skip }, async () => {
  const fx = await createExoFixture({ withPilot: false })
  try {
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx, null)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — exo sans template ("non configurée", PLAN_EXOARMURE.md §6.5) : null, jamais les stats nues du pilote', { skip }, async () => {
  const fx = await createExoFixture({ withTemplate: false })
  try {
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx, null)
  } finally {
    await cleanupExo(fx)
  }
})

// PLAN_EXOARMURE.md Lot 2 — plafond de Compétence par Manœuvre d'armure (REGLECOMPETENCE.md:29-34
// "Compétence limitative", REGLEARMURE.md p.325). Testé au contact seul (`meleeSkillCap: true`,
// jamais activé par défaut — le tir et l'Acrobatie/Équilibre restent hors périmètre de ce Lot).

test('resolveCombatantTestContext — meleeSkillCap: le plafond mord si le pilote n\'est pas formé à la spécialité (surface → Armures externes)', { skip }, async () => {
  const fx = await createExoFixture({ pilotAttrOverrides: { FOR: 16, COO: 16, ADA: 6 } })
  // Pilote très formé en CaC mais jamais en Manœuvre d'armure : le plafond doit mordre.
  await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 10 })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
    const refCombat = await db('ref_skills').where({ id: 'COMBAT_A_MAINS_NUES' }).first()
    const refManeuver = await db('ref_skills').where({ id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES' }).first()
    assert.ok(refManeuver, 'MANOEUVRE_DARMURE__ARMURES_EXTERNES doit être seedée (migration 37)')
    const uncapped = calcSkillTotal(attrs, { mastery: 10 }, refCombat, null, null)
    const maneuverTotal = calcSkillTotal(attrs, undefined, refManeuver, null, null)
    assert.ok(maneuverTotal < uncapped, 'précondition du test — le plafond doit réellement mordre')

    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true })
    assert.equal(ctx.skillTotal, maneuverTotal)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — meleeSkillCap: pas d\'effet si la Manœuvre d\'armure du pilote dépasse déjà la Compétence testée', { skip }, async () => {
  const fx = await createExoFixture({ pilotAttrOverrides: { FOR: 9, COO: 16, ADA: 14 } })
  await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 1 })
  await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES', mastery: 15 })
  try {
    const uncapped = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true })
    assert.equal(ctx.skillTotal, uncapped.skillTotal)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — meleeSkillCap absent (défaut) : jamais de plafond, même si la Manœuvre d\'armure serait plus basse (tir/Acrobatie, hors périmètre)', { skip }, async () => {
  const fx = await createExoFixture({ pilotAttrOverrides: { FOR: 16, COO: 16, ADA: 6 } })
  await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 10 })
  try {
    const uncapped = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES')
    assert.equal(ctx.skillTotal, uncapped.skillTotal)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — meleeSkillCap: mapping direct submarine/atmospheric/spatial vers la bonne spécialité', { skip }, async () => {
  const mapping = [
    ['submarine', 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES'],
    ['atmospheric', 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES'],
    ['spatial', 'MANOEUVRE_DARMURE__ARMURES_SPATIALES'],
  ]
  for (const [environment, expectedSkillId] of mapping) {
    const fx = await createExoFixture({
      pilotAttrOverrides: { FOR: 16, COO: 16, ADA: 6 },
      templateFields: { environment },
    })
    await db('char_skills').insert({ char_sheet_id: fx.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 10 })
    try {
      const attrs = await db('char_attributes').where({ char_sheet_id: fx.sheet.id })
      const refManeuver = await db('ref_skills').where({ id: expectedSkillId }).first()
      assert.ok(refManeuver, `${expectedSkillId} doit être seedée`)
      const expectedCap = calcSkillTotal(attrs, undefined, refManeuver, null, null)

      const ctx = await resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true })
      assert.equal(ctx.skillTotal, expectedCap, `environment=${environment} doit plafonner via ${expectedSkillId}`)
    } finally {
      await cleanupExo(fx)
    }
  }
})

test('resolveCombatantTestContext — meleeSkillCap: hybrid utilise Armures externes sauf si la Surface est explicitement bloquée (EAU1, même signal que getExoMovementBudget)', { skip }, async () => {
  const fxExterne = await createExoFixture({
    pilotAttrOverrides: { FOR: 16, COO: 16, ADA: 6 },
    templateFields: { environment: 'hybrid' },  // surface_movement_mode par défaut : 'vit', pas bloqué
  })
  await db('char_skills').insert({ char_sheet_id: fxExterne.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 10 })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fxExterne.sheet.id })
    const refExternes = await db('ref_skills').where({ id: 'MANOEUVRE_DARMURE__ARMURES_EXTERNES' }).first()
    const expectedCap = calcSkillTotal(attrs, undefined, refExternes, null, null)
    const ctx = await resolveCombatantTestContext(db, fxExterne.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true })
    assert.equal(ctx.skillTotal, expectedCap)
  } finally {
    await cleanupExo(fxExterne)
  }

  const fxSousMarine = await createExoFixture({
    pilotAttrOverrides: { FOR: 16, COO: 16, ADA: 6 },
    templateFields: { environment: 'hybrid', surface_movement_mode: 'blocked' },
  })
  await db('char_skills').insert({ char_sheet_id: fxSousMarine.sheet.id, skill_id: 'COMBAT_A_MAINS_NUES', mastery: 10 })
  try {
    const attrs = await db('char_attributes').where({ char_sheet_id: fxSousMarine.sheet.id })
    const refSousMarine = await db('ref_skills').where({ id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES' }).first()
    const expectedCap = calcSkillTotal(attrs, undefined, refSousMarine, null, null)
    const ctx = await resolveCombatantTestContext(db, fxSousMarine.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true })
    assert.equal(ctx.skillTotal, expectedCap)
  } finally {
    await cleanupExo(fxSousMarine)
  }
})

test('resolveCombatantTestContext — meleeSkillCap: environment=industrial rejette explicitement (décision Saar 2026-08-15, en suspens)', { skip }, async () => {
  const fx = await createExoFixture({ templateFields: { environment: 'industrial' } })
  try {
    await assert.rejects(
      () => resolveCombatantTestContext(db, fx.exoCharacter, 'COMBAT_A_MAINS_NUES', { meleeSkillCap: true }),
      /industrial/
    )
  } finally {
    await cleanupExo(fx)
  }
})

// PLAN_EXOARMURE.md Lot 2bis §9.3 (analyse à charge 2026-08-18) — resolveExoContext extraite de
// resolveExoTestContext pour être réutilisable par resolveExoStandUpAction (Lot 2bis) sans dupliquer
// le fetch pilote+template. Ces tests vérifient la fonction isolément ET la non-régression de
// resolveExoTestContext après le refactor (déjà couverte au-dessus par les tests
// resolveCombatantTestContext existants, tous verts après le refactor — pas répétée ici).
test('resolveExoContext — exo avec pilote+template : pilot/exoSheet résolus correctement (Lot B : plus de template joint, exoSheet porte déjà category/base_exoforce)', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    const { pilot, exoSheet } = await resolveExoContext(db, fx.exoCharacter)
    assert.equal(pilot.id, fx.character.id)
    assert.equal(exoSheet.character_id, fx.exoCharacter.id)
    assert.equal(exoSheet.category, fx.template.category)
    assert.equal(exoSheet.base_exoforce, fx.template.base_exoforce)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveExoContext — exo sans pilote assigné : pilot null, exoSheet quand même résolu (indépendant du pilote)', { skip }, async () => {
  const fx = await createExoFixture({ withPilot: false })
  try {
    const { pilot, exoSheet } = await resolveExoContext(db, fx.exoCharacter)
    assert.equal(pilot, null)
    assert.equal(exoSheet.category, fx.template.category)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveExoContext — exo sans template assigné ("non configurée") : exoSheet.category null, pilot quand même résolu', { skip }, async () => {
  const fx = await createExoFixture({ withTemplate: false })
  try {
    const { pilot, exoSheet } = await resolveExoContext(db, fx.exoCharacter)
    assert.equal(pilot.id, fx.character.id)
    assert.equal(exoSheet.category, null)
  } finally {
    await cleanupExo(fx)
  }
})

// resolveManeuverSkillId — fonction pure (pas de DB), déjà exercée indirectement par les tests
// meleeSkillCap ci-dessus ; testée ici directement maintenant qu'elle est exportée (Lot 2bis).
test('resolveManeuverSkillId — mapping direct par environment, industrial rejette', () => {
  assert.equal(resolveManeuverSkillId({ environment: 'submarine' }), 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES')
  assert.equal(resolveManeuverSkillId({ environment: 'surface' }), 'MANOEUVRE_DARMURE__ARMURES_EXTERNES')
  assert.equal(resolveManeuverSkillId({ environment: 'atmospheric' }), 'MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES')
  assert.equal(resolveManeuverSkillId({ environment: 'spatial' }), 'MANOEUVRE_DARMURE__ARMURES_SPATIALES')
  assert.equal(resolveManeuverSkillId({ environment: 'hybrid', surface_movement_mode: 'vit' }), 'MANOEUVRE_DARMURE__ARMURES_EXTERNES')
  assert.equal(resolveManeuverSkillId({ environment: 'hybrid', surface_movement_mode: 'blocked' }), 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES')
  assert.throws(() => resolveManeuverSkillId({ environment: 'industrial' }), /industrial/)
})

// PLAN_EXOARMURE.md Lot 2bis §9.3 (trouvé en câblant le côté MJ) — isExoActorAuthorized, réutilisée
// par socketCombatAnnouncement.js (déclaration de combat) ET char-sheet.js (édition de fiche,
// délégation depuis exoIsGmOrOwnerOrPilot). Même décision Saar 2026-07-30 (Lot 1 §6.3) : GM,
// propriétaire OU pilote lié.
test('isExoActorAuthorized — GM toujours autorisé, quel que soit propriétaire/pilote', { skip }, async () => {
  const [otherOwner] = await db('users')
    .insert({ email: `combatant-ctx-authgm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'combatant-ctx-authgm' })
    .returning('*')
  const fx = await createExoFixture({ exoOwnerId: otherOwner.id, withPilot: false })
  try {
    assert.equal(await isExoActorAuthorized(db, fx.exoCharacter, { isGm: true, userId: 'nimporte-qui' }), true)
  } finally {
    await cleanupExo(fx)
    await db('users').where({ id: otherOwner.id }).del()
  }
})

test('isExoActorAuthorized — propriétaire brut (characters.user_id) autorisé même sans pilote', { skip }, async () => {
  const fx = await createExoFixture({ withPilot: false })
  try {
    assert.equal(await isExoActorAuthorized(db, fx.exoCharacter, { isGm: false, userId: fx.exoCharacter.user_id }), true)
  } finally {
    await cleanupExo(fx)
  }
})

test('isExoActorAuthorized — pilote autorisé même si propriétaire est quelqu\'un d\'autre', { skip }, async () => {
  const [otherOwner] = await db('users')
    .insert({ email: `combatant-ctx-authpilot-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'combatant-ctx-authpilot' })
    .returning('*')
  const fx = await createExoFixture({ exoOwnerId: otherOwner.id })
  try {
    assert.equal(await isExoActorAuthorized(db, fx.exoCharacter, { isGm: false, userId: fx.character.user_id }), true)
  } finally {
    await cleanupExo(fx)
    await db('users').where({ id: otherOwner.id }).del()
  }
})

test('isExoActorAuthorized — ni GM, ni propriétaire, ni pilote : refusé', { skip }, async () => {
  const fx = await createExoFixture()
  try {
    assert.equal(await isExoActorAuthorized(db, fx.exoCharacter, { isGm: false, userId: 'un-inconnu' }), false)
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantTestContext — dispatch pj/pnj inchangé (pas de régression du dispatcher sur le chemin humanoïde)', { skip }, async () => {
  const fx = await createFixture({ FOR: 14 })
  try {
    const direct = await resolveHumanoidTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    const viaDispatcher = await resolveCombatantTestContext(db, fx.character, 'COMBAT_A_MAINS_NUES')
    assert.deepEqual(viaDispatcher, direct)
  } finally {
    await cleanup(fx)
  }
})

test('resolveCombatantIdentity — humain : sheetId/userId/effectiveType propres, 1 seule requête équivalente au fetch direct d\'avant ce chantier', { skip }, async () => {
  const fx = await createFixture()
  try {
    const identity = await resolveCombatantIdentity(db, fx.character)
    assert.deepEqual(identity, { sheetId: fx.sheet.id, userId: fx.character.user_id, effectiveType: 'pj' })
  } finally {
    await cleanup(fx)
  }
})

// PLAN_EXOARMURE.md Lot 2 §7.7 — trou trouvé en clôturant ce Lot : resolveMeleeAction routait la
// confirmation de défense vers characters.user_id de la fiche exo elle-même, jamais vers le pilote.
// Ce test force un propriétaire distinct du pilote (exoOwnerId) pour vérifier que le fix suit bien le
// second, pas le premier — les fixtures précédentes utilisaient le même utilisateur pour les deux et
// n'auraient jamais pu détecter ce bug.
test('resolveCombatantIdentity — exo avec pilote PJ : sheetId/userId du PILOTE, jamais du propriétaire brut de la fiche exo', { skip }, async () => {
  const [otherOwner] = await db('users')
    .insert({ email: `combatant-ctx-exoowner-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'combatant-ctx-exoowner' })
    .returning('*')
  const fx = await createExoFixture({ exoOwnerId: otherOwner.id })
  try {
    assert.notEqual(otherOwner.id, fx.character.user_id, 'précondition du test — propriétaire de l\'exo distinct du pilote')
    const identity = await resolveCombatantIdentity(db, fx.exoCharacter)
    assert.deepEqual(identity, { sheetId: fx.sheet.id, userId: fx.character.user_id, effectiveType: 'pj' })
  } finally {
    await cleanupExo(fx)
    await db('users').where({ id: otherOwner.id }).del()
  }
})

test('resolveCombatantIdentity — exo avec pilote PNJ : effectiveType \'pnj\' (auto-résolution, jamais un prompt de confirmation qui ne viendrait jamais)', { skip }, async () => {
  const fx = await createExoFixture({ pilotType: 'pnj' })
  try {
    const identity = await resolveCombatantIdentity(db, fx.exoCharacter)
    assert.deepEqual(identity, { sheetId: fx.sheet.id, userId: fx.character.user_id, effectiveType: 'pnj' })
  } finally {
    await cleanupExo(fx)
  }
})

test('resolveCombatantIdentity — exo sans pilote assigné : repli pnj (auto-résolution), sheetId/userId null', { skip }, async () => {
  const fx = await createExoFixture({ withPilot: false })
  try {
    const identity = await resolveCombatantIdentity(db, fx.exoCharacter)
    assert.deepEqual(identity, { sheetId: null, userId: null, effectiveType: 'pnj' })
  } finally {
    await cleanupExo(fx)
  }
})
