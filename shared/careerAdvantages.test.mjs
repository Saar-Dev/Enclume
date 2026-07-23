import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveCareerRandomEffects, computeCareerBlockSavings, getPendingCareerPickStep } from './careerAdvantages.js'

const BENEFIT_ROWS = [
  { roll: 1, effects: [{ type: 'attribute', target: 'ADA', value: 1 }] },
  { roll: 2, effects: [{ type: 'skill_points', value: 2 }, { type: 'celebrity', value: 2 }, { type: 'category', target: 'Matériel', value: 1 }] },
  { roll: 3, effects: [{ type: 'income_percent', value: 10 }] },
  { roll: 5, effects: [{ type: 'income_multiplier', value: 2 }] },
  { roll: 8, effects: [] },
  { roll: 10, effects: [] },
]

test('additionne les effets de plusieurs tirages resolus', () => {
  const picks = [{ blockIndex: 0, roll: 1 }, { blockIndex: 1, roll: 2 }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 1 })
  assert.equal(totals.celebrity, 2)
  assert.equal(totals.skillPoints, 2)
  assert.deepEqual(totals.categories, { 'Matériel': 1 })
})

test('useAsPoints=true exclut l\'effet de la ligne (jamais points ET effet)', () => {
  const picks = [{ blockIndex: 0, roll: 10, useAsPoints: true }, { blockIndex: 1, roll: 1, useAsPoints: false }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 1 })
})

test('income_percent et income_multiplier se composent, base neutre 1/0 sans tirage', () => {
  const noPicks = resolveCareerRandomEffects([], BENEFIT_ROWS)
  assert.equal(noPicks.incomeMultiplier, 1)
  assert.equal(noPicks.incomePercent, 0)

  const withBoth = resolveCareerRandomEffects(
    [{ blockIndex: 0, roll: 3 }, { blockIndex: 1, roll: 5 }],
    BENEFIT_ROWS
  )
  assert.equal(withBoth.incomePercent, 10)
  assert.equal(withBoth.incomeMultiplier, 2)
})

test('meme attribut cumule sur plusieurs tirages (deux tranches, meme roll)', () => {
  const picks = [{ blockIndex: 0, roll: 1 }, { blockIndex: 1, roll: 1 }]
  const totals = resolveCareerRandomEffects(picks, BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, { ADA: 2 })
})

test('picks vides ou undefined -> totaux neutres', () => {
  assert.deepEqual(resolveCareerRandomEffects(undefined, BENEFIT_ROWS).attributes, {})
  assert.deepEqual(resolveCareerRandomEffects([], BENEFIT_ROWS).categories, {})
})

test('roll sans ligne correspondante (defensif) -> ignore silencieusement', () => {
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 999 }], BENEFIT_ROWS)
  assert.deepEqual(totals.attributes, {})
  assert.equal(totals.celebrity, 0)
})

// ─── Nouveaux types (Lot 1, 2026-07-22) — un cas réel par type, données du plan §5/§6 ───

test('type inconnu leve une erreur explicite, jamais un silence (piege 1)', () => {
  const rows = [{ roll: 1, effects: [{ type: 'ce_type_n_existe_pas' }] }]
  assert.throws(() => resolveCareerRandomEffects([{ blockIndex: 0, roll: 1 }], rows), /inconnu/)
})

test('grant_advantage/manual_grant_choice/points_cap (Revers seul) levent une erreur ici', () => {
  const rows = [{ roll: 1, effects: [{ type: 'grant_advantage', advantage_id: 'adv_050' }] }]
  assert.throws(() => resolveCareerRandomEffects([{ blockIndex: 0, roll: 1 }], rows), /inconnu/)
})

test('trait — Artisan/Artiste resultat 5 (Allie +1)', () => {
  const rows = [{
    roll: 5,
    effects: [
      { type: 'celebrity', value: 4 },
      { type: 'category', target: 'Art/Artisanat', value: 6 },
      { type: 'income_percent', value: 20 },
      { type: 'category', target: 'Étal/Boutique', value: 1 },
      { type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: 1 },
    ],
  }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5 }], rows)
  assert.equal(totals.celebrity, 4)
  assert.deepEqual(totals.categories, { 'Art/Artisanat': 6, 'Étal/Boutique': 1 })
  assert.deepEqual(totals.traits, [{ trait_type: 'ally', op: 'gauge_delta', value: 1, note: null }])
})

test('celebrity_reward — Pirate resultat 5 (Mise a prix, base Celebrite x 1000)', () => {
  const rows = [{
    roll: 5,
    effects: [
      { type: 'celebrity', value: 6 },
      { type: 'celebrity_reward', multiplier: 1000 },
    ],
  }]
  // Célébrité déjà accumulée (carrières précédentes) = 10 ; +6 sur cette ligne avant le calcul
  // de la récompense (ordre du tableau effects[], §8.1) => (10 + 6) * 1000.
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5 }], rows, 10)
  assert.equal(totals.celebrity, 6)
  assert.equal(totals.celebrityRewardSols, 16000)
  assert.equal(totals.moneyRewardSols, 0)
})

test('money_reward — Marchand itinerant resultat 4 (reliques, 1D100x500 sols)', () => {
  const rows = [{ roll: 4, effects: [{ type: 'money_reward', die: '1d100', multiplier: 500 }] }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, moneyRoll: 37 }], rows)
  assert.equal(totals.moneyRewardSols, 18500)
  assert.equal(totals.celebrityRewardSols, 0)
})

test('money_reward sans pick.moneyRoll deja determine leve une erreur (jamais de tirage interne)', () => {
  const rows = [{ roll: 4, effects: [{ type: 'money_reward', die: '1d100', multiplier: 500 }] }]
  assert.throws(() => resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows), /moneyRoll/)
})

test('choice — Chasseur de primes resultat 4 (accepte/refuse la grande societe)', () => {
  const rows = [{
    roll: 4,
    effects: [{
      type: 'choice',
      key: 'chasseur_primes.grande_societe',
      options: [
        { effects: [{ type: 'income_percent', value: 20 }, { type: 'celebrity', value: 4 }, { type: 'skill_points', value: 4 }] },
        { effects: [] },
      ],
    }],
  }]
  const accepte = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 0 }], rows)
  assert.equal(accepte.incomePercent, 20)
  assert.equal(accepte.celebrity, 4)
  assert.equal(accepte.skillPoints, 4)

  const refuse = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 1 }], rows)
  assert.equal(refuse.incomePercent, 0)
  assert.equal(refuse.celebrity, 0)
})

test('choice sans pick.choice valide leve une erreur', () => {
  const rows = [{ roll: 4, effects: [{ type: 'choice', key: 'x', options: [{ effects: [] }, { effects: [] }] }] }]
  assert.throws(() => resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows), /choice/)
})

test('income_multiplier_permanent — plafonne, ne se recompose jamais (Officier militaire resultat 5)', () => {
  const rows = [{
    roll: 5,
    effects: [
      { type: 'income_multiplier_permanent', value: 2 },
      { type: 'skill_points', value: 6 },
      { type: 'celebrity', value: 6 },
      { type: 'category', target: 'Matériel', value: 4 },
    ],
  }]
  // Deux tranches qui retombent sur le même résultat (simulation d'un "nouveau jet" identique) :
  // le maximum est conservé, jamais multiplié par lui-même (2 * 2 = 4 serait faux).
  const totals = resolveCareerRandomEffects(
    [{ blockIndex: 0, roll: 5 }, { blockIndex: 1, roll: 5 }],
    rows
  )
  assert.equal(totals.incomeMultiplierPermanent, 2)
  assert.equal(totals.skillPoints, 12)
})

test('narrative — Assassin resultat 3 (Secret) aucune consequence mecanique, jamais une erreur', () => {
  const rows = [{ roll: 3, effects: [{ type: 'narrative', key: 'assassin.secret' }] }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 3 }], rows)
  assert.equal(totals.celebrity, 0)
  assert.equal(totals.skillPoints, 0)
})

test('grant_mutation — Cultivateur/Eleveur resultat 4 (Empathie niveau 1, seul cas des 37 metiers)', () => {
  const rows = [{ roll: 4, effects: [{ type: 'grant_mutation', mutation_id: 'EMPATHIE', subtype_id: null }] }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows)
  assert.deepEqual(totals.grantedMutations, [{ mutation_id: 'EMPATHIE', subtype_id: null }])
})

test('add_skill (Lot 6, Pretre du Trident resultat 4 - competences fixes, pas un choix) — accumule dans grantedSkills', () => {
  const rows = [{ roll: 4, effects: [
    { type: 'add_skill', skill_id: 'ACROBATIE_EQUILIBRE' },
    { type: 'add_skill', skill_id: 'COMBAT_ARME' },
    { type: 'celebrity', value: 2 },
  ] }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows)
  assert.deepEqual(totals.grantedSkills, ['ACROBATIE_EQUILIBRE', 'COMBAT_ARME'])
  assert.equal(totals.celebrity, 2)
})

test('skill_choice (Lot 6, "Formation") — accumule pick.chosenSkillId, leve une erreur si absent', () => {
  const rows = [{ roll: 7, effects: [{ type: 'skill_choice' }, { type: 'skill_points', value: 2 }] }]
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 7, chosenSkillId: 'ACROBATIE_EQUILIBRE' }], rows)
  assert.deepEqual(totals.chosenSkills, ['ACROBATIE_EQUILIBRE'])
  assert.equal(totals.skillPoints, 2)

  assert.throws(
    () => resolveCareerRandomEffects([{ blockIndex: 0, roll: 7 }], rows),
    /chosenSkillId/
  )
})

// ─── computeCareerBlockSavings (Lot 2, 2026-07-22) — calcul par tranche de 5 ans ───

test('sans tirage -> equivalent a l\'ancien calcul plat (non-regression)', () => {
  const result = computeCareerBlockSavings([], [], { salary: 1000, years: 12 })
  // 2 tranches pleines (10 ans) + 1 reliquat de 2 ans, aucun effet -> salary * years au total.
  assert.equal(result.savings, 1000 * 12)
  assert.deepEqual(result.attributes, {})
  assert.equal(result.celebrity, 0)
})

test('income_percent est permanent a partir de la tranche ou il est gagne, pas avant', () => {
  const rows = [{ roll: 4, effects: [{ type: 'income_percent', value: 20 }] }]
  // Gagné à la tranche 1 (2e tranche de 5 ans) sur une carrière de 10 ans (2 tranches pleines) :
  // la tranche 0 ne doit PAS en bénéficier, seule la tranche 1 (celle où il est gagné) le doit.
  const result = computeCareerBlockSavings(
    [{ blockIndex: 1, roll: 4 }], rows, { salary: 1000, years: 10 }
  )
  assert.equal(result.savings, 1000 * 5 /* tranche 0, sans le +20% */ + 1000 * 5 * 1.2 /* tranche 1 */)
})

test('income_multiplier est ponctuel, ne s\'applique qu\'a sa propre tranche', () => {
  const rows = [{ roll: 4, effects: [{ type: 'income_multiplier', value: 2 }] }]
  const result = computeCareerBlockSavings(
    [{ blockIndex: 0, roll: 4 }], rows, { salary: 1000, years: 10 }
  )
  assert.equal(result.savings, 1000 * 5 * 2 /* tranche 0, doublée */ + 1000 * 5 /* tranche 1, normale */)
})

test('income_multiplier_permanent plafonne : deux tranches au meme resultat ne composent pas (x2, jamais x4)', () => {
  const rows = [{ roll: 5, effects: [{ type: 'income_multiplier_permanent', value: 2 }] }]
  const result = computeCareerBlockSavings(
    [{ blockIndex: 0, roll: 5 }, { blockIndex: 1, roll: 5 }], rows, { salary: 1000, years: 10 }
  )
  // Les deux tranches sont x2 (permanent, gagné dès la tranche 0) — jamais x4 à la tranche 1.
  assert.equal(result.savings, 1000 * 5 * 2 + 1000 * 5 * 2)
})

test('Mise a prix (celebrity_reward) : 2e occurrence double le montant REEL de la 1re, pas un recalcul', () => {
  const rows = [
    { roll: 2, effects: [{ type: 'celebrity', value: 10 }] },
    { roll: 5, effects: [{ type: 'celebrity', value: 6 }, { type: 'celebrity_reward', multiplier: 1000 }] },
  ]
  // Bloc 0 : Célébrité +10 (pas de récompense). Bloc 1 : 1re Mise à prix, Célébrité déjà à 10 avant
  // ce bloc -> (10+6)*1000 = 16000. Bloc 2 : 2e Mise à prix, Célébrité déjà à 16 avant ce bloc ->
  // un recalcul naïf donnerait (16+6)*1000 = 22000, mais la règle exige de doubler le montant RÉEL
  // de la 1re occurrence (16000*2 = 32000), pas de recalculer depuis la Célébrité courante.
  const result = computeCareerBlockSavings(
    [{ blockIndex: 0, roll: 2 }, { blockIndex: 1, roll: 5 }, { blockIndex: 2, roll: 5 }],
    rows, { salary: 1000, years: 15 }
  )
  assert.equal(result.celebrity, 10 + 6 + 6)
  assert.equal(result.savings, 1000 * 5 * 3 + 16000 + 32000)
})

test('miseAPrixHistory est scopee par carriere : une autre carriere ne voit pas cet historique', () => {
  const rows = [{ roll: 5, effects: [{ type: 'celebrity_reward', multiplier: 1000 }] }]
  const firstCareer = computeCareerBlockSavings([{ blockIndex: 0, roll: 5 }], rows, { salary: 0, years: 5 })
  // Un historique vide (nouvelle carrière) -> pas de doublement, montant "frais" à nouveau.
  const secondCareer = computeCareerBlockSavings([{ blockIndex: 0, roll: 5 }], rows, { salary: 0, years: 5 })
  assert.equal(firstCareer.savings, secondCareer.savings)
})

test('extraEffectsByBlock (Lot 4, Revers Renvoi) — income_multiplier applique au SEUL bloc concerne', () => {
  const extra = new Map([[1, [{ type: 'income_multiplier', value: 0.5 }]]])
  const result = computeCareerBlockSavings([], [], { salary: 1000, years: 10, extraEffectsByBlock: extra })
  assert.equal(result.savings, 1000 * 5 /* tranche 0, inchangee */ + 1000 * 5 * 0.5 /* tranche 1, Renvoi */)
})

test('extraEffectsByBlock se compose avec l\'effet de tirage du meme bloc (jamais l\'un OU l\'autre)', () => {
  const rows = [{ roll: 3, effects: [{ type: 'income_multiplier', value: 2 }] }]
  const extra = new Map([[0, [{ type: 'income_multiplier', value: 0.5 }]]])
  const result = computeCareerBlockSavings(
    [{ blockIndex: 0, roll: 3 }], rows, { salary: 1000, years: 5, extraEffectsByBlock: extra }
  )
  // Les deux multiplicateurs ponctuels du même bloc se composent par multiplication (2 * 0.5 = 1).
  assert.equal(result.savings, 1000 * 5 * 2 * 0.5)
})

test('computeCareerBlockSavings propage chosenSkills (Lot 6, "Formation") a travers les tranches', () => {
  const rows = [{ roll: 7, effects: [{ type: 'skill_choice' }] }]
  const result = computeCareerBlockSavings(
    [{ blockIndex: 0, roll: 7, chosenSkillId: 'ACROBATIE_EQUILIBRE' }], rows, { salary: 0, years: 5 }
  )
  assert.deepEqual(result.chosenSkills, ['ACROBATIE_EQUILIBRE'])
})

// ─── getPendingCareerPickStep (Lot 5, UI) ───

test('getPendingCareerPickStep — money_reward sans moneyRoll -> pending, avec moneyRoll -> null', () => {
  const row = { roll: 4, effects: [{ type: 'money_reward', die: '1d100', multiplier: 500 }] }
  assert.deepEqual(getPendingCareerPickStep(row, { blockIndex: 0, roll: 4 }), { type: 'money_reward', die: '1d100' })
  assert.equal(getPendingCareerPickStep(row, { blockIndex: 0, roll: 4, moneyRoll: 37 }), null)
})

test('getPendingCareerPickStep — choice sans pick.choice -> pending avec labels, avec choice -> null', () => {
  const row = {
    roll: 4,
    effects: [{
      type: 'choice', key: 'chasseur_primes.grande_societe',
      options: [
        { label: 'Accepter', effects: [{ type: 'income_percent', value: 20 }] },
        { label: 'Refuser', effects: [] },
      ],
    }],
  }
  assert.deepEqual(getPendingCareerPickStep(row, { blockIndex: 0, roll: 4 }), {
    type: 'choice', key: 'chasseur_primes.grande_societe',
    options: [{ label: 'Accepter' }, { label: 'Refuser' }],
  })
  assert.equal(getPendingCareerPickStep(row, { blockIndex: 0, roll: 4, choice: 1 }), null)
})

test('getPendingCareerPickStep — useAsPoints ignore tout effet (le joueur a pris les points, pas l\'effet)', () => {
  const row = { roll: 4, effects: [{ type: 'money_reward', die: '1d100', multiplier: 500 }] }
  assert.equal(getPendingCareerPickStep(row, { blockIndex: 0, roll: 4, useAsPoints: true }), null)
})

test('getPendingCareerPickStep — skill_choice (Lot 6, "Formation") sans chosenSkillId -> pending, avec -> null', () => {
  const row = { roll: 7, effects: [{ type: 'skill_choice' }, { type: 'skill_points', value: 2 }] }
  assert.deepEqual(getPendingCareerPickStep(row, { blockIndex: 0, roll: 7 }), { type: 'skill_choice' })
  assert.equal(getPendingCareerPickStep(row, { blockIndex: 0, roll: 7, chosenSkillId: 'ACROBATIE_EQUILIBRE' }), null)
})

test('getPendingCareerPickStep — pas de pick/ligne -> null (defensif)', () => {
  assert.equal(getPendingCareerPickStep(undefined, undefined), null)
  assert.equal(getPendingCareerPickStep({ roll: 1, effects: [] }, { blockIndex: 0, roll: 1 }), null)
})
