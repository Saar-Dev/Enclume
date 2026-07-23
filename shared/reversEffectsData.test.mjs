// Vérifie chaque ligne réelle de REVERS_EFFECTS_BY_NAME (Lot 6) contre resolveSetbackEffects et,
// pour les cas chiffrés, contre le texte RAW (docs/REGLES/REVERS PROFESSIONNELS.md) — pas seulement
// contre le résumé "effet en clair" du plan (PLAN_WIZARD_AVANTAGES.md §5bis).
import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveSetbackEffects } from './setbackEffects.js'
import { REVERS_ROLL_RANGES, REVERS_EFFECTS_BY_NAME } from './reversEffectsData.js'

const SETBACK_ROWS = REVERS_ROLL_RANGES.map(r => ({ ...r, effects: REVERS_EFFECTS_BY_NAME[r.name] }))
const rollFor = (name) => REVERS_ROLL_RANGES.find(r => r.name === name).roll_min

test('les 27 Revers ont tous une entree effects[] (structure)', () => {
  assert.equal(REVERS_ROLL_RANGES.length, 27)
  for (const r of REVERS_ROLL_RANGES) {
    assert.ok(Array.isArray(REVERS_EFFECTS_BY_NAME[r.name]), `effects[] manquant pour ${r.name}`)
  }
})

test('Incident mineur sans consequence -> aucun effet', () => {
  const result = resolveSetbackEffects(1, SETBACK_ROWS)
  assert.deepEqual(result, { status: 'done', effects: [], history: [] })
})

test('Relancer ou autre Revers au choix du MJ -> aucun effet JSON (flux applicatif)', () => {
  const result = resolveSetbackEffects(100, SETBACK_ROWS)
  assert.deepEqual(result, { status: 'done', effects: [], history: [] })
})

test('Accident (reel) — identique a la tete de pont', () => {
  const done = resolveSetbackEffects(rollFor('Accident'), SETBACK_ROWS, { accident_blessure: 5 })
  assert.deepEqual(done.effects, [{ type: 'skill_points', value: -5 }])
})

test('Attentat — deux chances independantes (Mutilation puis Deuil)', () => {
  const roll = rollFor('Attentat')
  const pending = resolveSetbackEffects(roll, SETBACK_ROWS)
  assert.equal(pending.key, 'attentat_mutilation')

  const rate = resolveSetbackEffects(roll, SETBACK_ROWS, { attentat_mutilation: 9 })
  assert.equal(rate.key, 'attentat_deuil')

  const touche = resolveSetbackEffects(roll, SETBACK_ROWS, { attentat_mutilation: 9, attentat_deuil: 3 })
  assert.deepEqual(touche.effects, [
    { type: 'skill_points', value: -5 },
    { type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 },
  ])
})

test('Bannissement (reel) — perte totale, PAS -5 (correction vs stub de test du resolveur)', () => {
  const done = resolveSetbackEffects(rollFor('Bannissement'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
  ])
})

test('Blessure (reel) — 10 resultats complets, pas seulement 1-2', () => {
  const roll = rollFor('Blessure')
  const attrs = { 1: 'FOR', 2: 'CON', 3: 'COO', 4: 'ADA', 5: 'PER', 6: 'INT', 7: 'VOL', 8: 'PRE' }
  for (const [detail, attr] of Object.entries(attrs)) {
    const done = resolveSetbackEffects(roll, SETBACK_ROWS, { blessure_detail: Number(detail) })
    assert.deepEqual(done.effects, [{ type: 'attribute', target: attr, value: -1 }], `detail ${detail}`)
  }
  assert.deepEqual(
    resolveSetbackEffects(roll, SETBACK_ROWS, { blessure_detail: 9 }).effects,
    [{ type: 'narrative', key: 'blessure.jambe_handicapee' }]
  )
  assert.deepEqual(
    resolveSetbackEffects(roll, SETBACK_ROWS, { blessure_detail: 10 }).effects,
    [{ type: 'narrative', key: 'blessure.bras_handicape' }]
  )
})

test('Catastrophe — skill_points -5 + economies a 0 + 3 chances independantes', () => {
  const roll = rollFor('Catastrophe')
  const done = resolveSetbackEffects(roll, SETBACK_ROWS, {
    catastrophe_blessure: 9, catastrophe_deuil: 9, catastrophe_mutilation: 9,
  })
  assert.deepEqual(done.effects, [
    { type: 'skill_points', value: -5 },
    { type: 'income_multiplier', value: 0 },
    { type: 'narrative', key: 'catastrophe.exil_petite_communaute' },
  ])
})

test('Choc psychologique — 1-6 phobie, 7-10 desequilibre mental', () => {
  const roll = rollFor('Choc psychologique')
  const phobie = resolveSetbackEffects(roll, SETBACK_ROWS, { choc_psy_detail: 3 })
  assert.deepEqual(phobie.effects, [{
    type: 'manual_grant_choice', trait_type: 'phobia',
    candidates: ['adv_062', 'adv_063', 'adv_064', 'adv_065', 'adv_066'],
  }])
  const desequilibre = resolveSetbackEffects(roll, SETBACK_ROWS, { choc_psy_detail: 8 })
  assert.deepEqual(desequilibre.effects, [{
    type: 'manual_grant_choice', trait_type: 'mental_imbalance',
    candidates: ['adv_044', 'adv_045', 'adv_046', 'adv_047', 'adv_048', 'adv_049'],
  }])
})

test('Complot (reel) — 7 branches completes (3-4 Emprisonnement, 5 Fugitif, 6-8 Mise a pied manquaient dans le stub de test)', () => {
  const roll = rollFor('Complot')
  const emprisonnement = resolveSetbackEffects(roll, SETBACK_ROWS, { complot_detail: 4, emprisonnement_choix: 0 })
  assert.deepEqual(emprisonnement.effects, [{ type: 'narrative', key: 'emprisonnement.accepte' }])

  const fugitif = resolveSetbackEffects(roll, SETBACK_ROWS, { complot_detail: 5 })
  assert.deepEqual(fugitif.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['adv_067', 'adv_068'] },
  ])

  const misePied = resolveSetbackEffects(roll, SETBACK_ROWS, { complot_detail: 7 })
  assert.deepEqual(misePied.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
  ])
})

test('Contamination/Maladie — 5 issues, dont redirection vers Blessure', () => {
  const roll = rollFor('Contamination/Maladie')
  const guerison = resolveSetbackEffects(roll, SETBACK_ROWS, { contamination_detail: 2 })
  assert.deepEqual(guerison.effects, [{ type: 'skill_points', value: -5 }])

  const sequelles = resolveSetbackEffects(roll, SETBACK_ROWS, { contamination_detail: 4, blessure_detail: 1 })
  assert.deepEqual(sequelles.effects, [{ type: 'attribute', target: 'FOR', value: -1 }])
})

test('Contrat — differe a la campagne, aucun effet mecanique a la creation', () => {
  const done = resolveSetbackEffects(rollFor('Contrat'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [{ type: 'narrative', key: 'contrat.differe_campagne' }])
})

test('Deuil — -1 Allie', () => {
  const done = resolveSetbackEffects(rollFor('Deuil'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [{ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }])
})

test('Diffamation (reel) — fraction celebrite + allies + contacts', () => {
  const done = resolveSetbackEffects(rollFor('Diffamation'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'celebrity_fraction', value: -0.25 },
    { type: 'trait', trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
    { type: 'trait', trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
  ])
})

test('Enlevement (reel) — perte totale (pas juste skill_points) + chance de Mutilation', () => {
  const roll = rollFor('Enlèvement')
  const done = resolveSetbackEffects(roll, SETBACK_ROWS, { enlevement_mutilation: 9 })
  assert.deepEqual(done.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
  ])
})

test('Emprisonnement — choix accepte/refuse (refuse redirige vers Fugitif reel)', () => {
  const roll = rollFor('Emprisonnement')
  const accepte = resolveSetbackEffects(roll, SETBACK_ROWS, { emprisonnement_choix: 0 })
  assert.deepEqual(accepte.effects, [{ type: 'narrative', key: 'emprisonnement.accepte' }])

  const refuse = resolveSetbackEffects(roll, SETBACK_ROWS, { emprisonnement_choix: 1 })
  assert.deepEqual(refuse.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['adv_067', 'adv_068'] },
  ])
})

test('Ennemi / Ennemi important — +1 Ennemi, note distinctive pour important', () => {
  assert.deepEqual(
    resolveSetbackEffects(rollFor('Ennemi'), SETBACK_ROWS).effects,
    [{ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1 }]
  )
  assert.deepEqual(
    resolveSetbackEffects(rollFor('Ennemi important'), SETBACK_ROWS).effects,
    [{ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'important' }]
  )
})

test('Faute lourde (2D10) — bornes 2 et 20, plus quelques branches internes', () => {
  const roll = rollFor('Faute lourde')
  assert.deepEqual(
    resolveSetbackEffects(roll, SETBACK_ROWS, { faute_lourde_detail: 2 }).effects,
    [{ type: 'income_multiplier', value: 0 }]
  )
  assert.deepEqual(
    resolveSetbackEffects(roll, SETBACK_ROWS, { faute_lourde_detail: 9 }).effects,
    [{ type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1 }]
  )
  const deuxJets = resolveSetbackEffects(roll, SETBACK_ROWS, { faute_lourde_detail: 20 })
  assert.equal(deuxJets.status, 'pending')
  assert.equal(deuxJets.key, 'faute_lourde_detail#2')
})

test('Fugitif (reel) — perte totale + Recherche (pas -5 seul, correction vs stub de test)', () => {
  const done = resolveSetbackEffects(rollFor('Fugitif'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['adv_067', 'adv_068'] },
  ])
})

test('Mauvaise passe — revenus x0.5 + skill_points -5', () => {
  const done = resolveSetbackEffects(rollFor('Mauvaise passe'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'income_multiplier', value: 0.5 },
    { type: 'skill_points', value: -5 },
  ])
})

test('Mutilation (1D100, reel) — echantillon sur les 10 plages, bornes incluses', () => {
  const roll = rollFor('Mutilation')
  const cases = [
    [1, { type: 'manual_grant_choice', trait_type: 'infirmity', candidates: ['adv_056', 'adv_057'] }],
    [8, { type: 'manual_grant_choice', trait_type: 'infirmity', candidates: ['adv_056', 'adv_057'] }],
    [9, { type: 'narrative', key: 'mutilation.jambe_raide' }],
    [10, { type: 'narrative', key: 'mutilation.jambe_raide' }],
    [11, { type: 'grant_advantage', advantage_id: 'adv_071' }],
    [18, { type: 'grant_advantage', advantage_id: 'adv_071' }],
    [30, { type: 'grant_advantage', advantage_id: 'adv_072' }],
    [42, { type: 'grant_advantage', advantage_id: 'adv_073' }],
    [54, { type: 'grant_advantage', advantage_id: 'adv_074' }],
    [66, { type: 'grant_advantage', advantage_id: 'adv_042' }],
    [78, { type: 'attribute', target: 'PRE', value: -1 }],
    [90, { type: 'attribute', target: 'ADA', value: -1 }],
    [91, { type: 'attribute', target: 'COO', value: -1 }],
    [100, { type: 'attribute', target: 'COO', value: -1 }],
  ]
  for (const [detail, expected] of cases) {
    const done = resolveSetbackEffects(roll, SETBACK_ROWS, { mutilation_detail: detail })
    assert.deepEqual(done.effects, [expected], `detail ${detail}`)
  }
})

test('Pillage — argent a 0 + 3 chances independantes', () => {
  const roll = rollFor('Pillage')
  const done = resolveSetbackEffects(roll, SETBACK_ROWS, {
    pillage_deuil: 9, pillage_blessure: 9, pillage_catastrophe: 9,
  })
  assert.deepEqual(done.effects, [{ type: 'income_multiplier', value: 0 }])
})

test('Polaris (reel) — tier 1 complet (4 chances), tier 2 saute sans Force Polaris', () => {
  const roll = rollFor('Polaris')
  const answers = { polaris_blessure: 9, polaris_mutilation: 9, polaris_catastrophe: 9, polaris_deuil: 9 }
  const sansForce = resolveSetbackEffects(roll, SETBACK_ROWS, answers, { force_polaris: false })
  assert.equal(sansForce.status, 'done')
  assert.deepEqual(sansForce.effects, [])
})

test('Polaris (reel) — tier 2 complet avec Force Polaris, Culte du Trident (refuse -> Fugitif reel)', () => {
  const roll = rollFor('Polaris')
  const tier1Rate = { polaris_blessure: 9, polaris_mutilation: 9, polaris_catastrophe: 9, polaris_deuil: 9 }
  const tier2Rate = { polaris_fugitif: 9, polaris_ennemi_important: 9, polaris_bannissement: 9, polaris_deuil_tier2: 9 }

  const pendingCulte = resolveSetbackEffects(roll, SETBACK_ROWS, { ...tier1Rate, ...tier2Rate }, { force_polaris: true })
  assert.equal(pendingCulte.key, 'polaris_culte_detail')

  const pendingChoix = resolveSetbackEffects(
    roll, SETBACK_ROWS, { ...tier1Rate, ...tier2Rate, polaris_culte_detail: 3 }, { force_polaris: true }
  )
  assert.equal(pendingChoix.status, 'pending')
  assert.equal(pendingChoix.kind, 'choice')
  assert.equal(pendingChoix.key, 'polaris_culte_choix')
  assert.deepEqual(pendingChoix.options, [{ label: 'Accepter (rejoindre le Culte du Trident)' }, { label: 'Refuser' }])

  const refuse = resolveSetbackEffects(
    roll, SETBACK_ROWS,
    { ...tier1Rate, ...tier2Rate, polaris_culte_detail: 3, polaris_culte_choix: 1 },
    { force_polaris: true }
  )
  assert.equal(refuse.status, 'done')
  assert.deepEqual(refuse.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 0 },
    { type: 'income_multiplier', value: 0 },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['adv_067', 'adv_068'] },
  ])
})

test('Renvoi — plafond partiel (5 pts / revenu x0.5), jamais une perte totale', () => {
  const done = resolveSetbackEffects(rollFor('Renvoi'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'points_cap', scope: 'skill_points', value: 5 },
    { type: 'income_multiplier', value: 0.5 },
  ])
})

test('Vendetta — +1 Ennemi (note vendetta) + Recherche', () => {
  const done = resolveSetbackEffects(rollFor('Vendetta'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'trait', trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'vendetta' },
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['adv_067', 'adv_068'] },
  ])
})

test('Trahison — -1/4 Allies, -1/2 Contacts, pas de fraction Celebrite (contrairement a Diffamation)', () => {
  const done = resolveSetbackEffects(rollFor('Trahison'), SETBACK_ROWS)
  assert.deepEqual(done.effects, [
    { type: 'trait', trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
    { type: 'trait', trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
  ])
})

test('Irradiation (reel) — 2D10 transmis en trait gauge_delta', () => {
  const roll = rollFor('Irradiation')
  const pending = resolveSetbackEffects(roll, SETBACK_ROWS)
  assert.equal(pending.status, 'pending')
  assert.equal(pending.key, 'irradiation_score')
  assert.equal(pending.die, '2d10')
  assert.equal(pending.origin, 'chained_setback')
  const done = resolveSetbackEffects(roll, SETBACK_ROWS, { irradiation_score: 14 })
  assert.deepEqual(done.effects, [{ type: 'trait', trait_type: 'irradiation', op: 'gauge_delta', value: 14 }])
  assert.deepEqual(done.history, [{ type: 'irradiation_reward', key: 'irradiation_score', die: '2d10', value: 14 }])
})
