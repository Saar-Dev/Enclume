import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveSetbackEffects } from './setbackEffects.js'

// Données réelles (docs/REGLES/REVERS PROFESSIONNELS.md), traduites en effects[] pour les tests —
// pas le peuplement final (Lot 6), juste ce qu'il faut pour vérifier le résolveur lui-même.
const SETBACK_ROWS = [
  {
    name: 'Accident', roll_min: 21, roll_max: 25,
    effects: [
      { type: 'skill_points', value: -5 },
      { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2] }, key: 'accident_blessure' },
    ],
  },
  {
    name: 'Blessure', roll_min: 32, roll_max: 36,
    effects: [
      { type: 'subroll', key: 'blessure_detail', die: 'd10', outcomes: [
        { range: [1, 1], effects: [{ type: 'attribute', target: 'FOR', value: -1 }] },
        { range: [2, 2], effects: [{ type: 'attribute', target: 'CON', value: -1 }] },
        { range: [9, 9], effects: [{ type: 'narrative', key: 'blessure.jambe_handicapee' }] },
        { range: [10, 10], effects: [{ type: 'narrative', key: 'blessure.bras_handicape' }] },
      ] },
    ],
  },
  {
    name: 'Deuil', roll_min: 58, roll_max: 60,
    effects: [{ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }],
  },
  {
    name: 'Polaris', roll_min: 95, roll_max: 95,
    effects: [
      { type: 'chained_setback', target: 'Blessure', chance: { die: 'd10', hit: [1, 2, 3] }, key: 'polaris_blessure' },
      { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6] }, key: 'polaris_deuil' },
      { type: 'chained_setback', target: 'Fugitif', chance: { die: 'd10', hit: [1, 2] }, key: 'polaris_fugitif', condition: 'force_polaris' },
      { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5, 6, 7] }, key: 'polaris_deuil_tier2', condition: 'force_polaris' },
    ],
  },
  {
    name: 'Fugitif', roll_min: 83, roll_max: 86,
    effects: [
      { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['recherche_petite', 'recherche_nation'] },
      { type: 'skill_points', value: -5 },
    ],
  },
  {
    name: 'Contrat', roll_min: 55, roll_max: 57,
    effects: [{ type: 'narrative', key: 'contrat.differe_campagne' }],
  },
  {
    name: 'Bannissement', roll_min: 29, roll_max: 31,
    effects: [{ type: 'skill_points', value: -5 }],
  },
  {
    name: 'Emprisonnement', roll_min: 65, roll_max: 69,
    effects: [{ type: 'narrative', key: 'emprisonnement.age_plus_un' }],
  },
  {
    name: 'Renvoi', roll_min: 96, roll_max: 96,
    effects: [{ type: 'points_cap', scope: 'skill_points', value: 5 }, { type: 'income_multiplier', value: 0.5 }],
  },
  {
    name: 'Complot', roll_min: 49, roll_max: 51,
    effects: [
      { type: 'subroll', key: 'complot_detail', die: 'd10', outcomes: [
        { range: [1, 1], effects: [{ type: 'apply_setback', target: 'Contrat' }] },
        { range: [2, 2], effects: [{ type: 'apply_setback', target: 'Bannissement' }] },
        { range: [9, 9], effects: [{ type: 'apply_setback', target: 'Renvoi' }] },
        { range: [10, 10], effects: [{ type: 'reroll_table', count: 2 }] },
      ] },
    ],
  },
]

// ─── Cas réels demandés par le document d'implantation ───

test('Accident — 1 clic pour le suspense, "raté" -> pas de Blessure', () => {
  const step1 = resolveSetbackEffects(22, SETBACK_ROWS)
  assert.equal(step1.status, 'pending')
  assert.deepEqual(step1, { status: 'pending', kind: 'roll', key: 'accident_blessure', die: 'd10', origin: 'chained_setback', history: [] })

  const done = resolveSetbackEffects(22, SETBACK_ROWS, { accident_blessure: 5 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, [{ type: 'skill_points', value: -5 }])
  // history (Lot 5, 2026-07-23) : le jet raté doit quand meme apparaitre (hit:false), sinon le
  // joueur ne sait jamais ce qu'il a obtenu — bug reel remonte par Saar (Revers Attentat).
  assert.deepEqual(done.history, [{ type: 'chained_setback', key: 'accident_blessure', target: 'Blessure', die: 'd10', value: 5, hit: false }])
})

test('Accident — suspense "touché" -> cascade vers Blessure, puis son propre jet de detail', () => {
  const pendingDetail = resolveSetbackEffects(22, SETBACK_ROWS, { accident_blessure: 1 })
  assert.deepEqual(pendingDetail, {
    status: 'pending', kind: 'roll', key: 'blessure_detail', die: 'd10', origin: 'subroll',
    history: [{ type: 'chained_setback', key: 'accident_blessure', target: 'Blessure', die: 'd10', value: 1, hit: true }],
  })

  const done = resolveSetbackEffects(22, SETBACK_ROWS, { accident_blessure: 1, blessure_detail: 2 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, [
    { type: 'skill_points', value: -5 },
    { type: 'attribute', target: 'CON', value: -1 },
  ])
  assert.deepEqual(done.history, [
    { type: 'chained_setback', key: 'accident_blessure', target: 'Blessure', die: 'd10', value: 1, hit: true },
    { type: 'subroll', key: 'blessure_detail', die: 'd10', value: 2 },
  ])
})

test('Attentat (reel, Lot 6) — 2 chained_setback enchaines, historique complet des 2 jets', () => {
  const rows = [
    {
      name: 'Attentat', roll_min: 26, roll_max: 28,
      effects: [
        { type: 'skill_points', value: -5 },
        { type: 'chained_setback', target: 'Mutilation', chance: { die: 'd10', hit: [1, 2] }, key: 'attentat_mutilation' },
        { type: 'chained_setback', target: 'Deuil', chance: { die: 'd10', hit: [1, 2, 3, 4, 5] }, key: 'attentat_deuil' },
      ],
    },
    { name: 'Mutilation', roll_min: 37, roll_max: 39, effects: [{ type: 'narrative', key: 'mutilation.membre' }] },
    { name: 'Deuil', roll_min: 58, roll_max: 60, effects: [{ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }] },
  ]
  const pendingMutilation = resolveSetbackEffects(27, rows)
  assert.equal(pendingMutilation.key, 'attentat_mutilation')

  const pendingDeuil = resolveSetbackEffects(27, rows, { attentat_mutilation: 7 })
  assert.equal(pendingDeuil.key, 'attentat_deuil')
  // Le 1er jet (rate, 7 pas dans [1,2]) doit deja etre visible dans l'historique en attendant le 2e.
  assert.deepEqual(pendingDeuil.history, [{ type: 'chained_setback', key: 'attentat_mutilation', target: 'Mutilation', die: 'd10', value: 7, hit: false }])

  const done = resolveSetbackEffects(27, rows, { attentat_mutilation: 7, attentat_deuil: 3 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, [{ type: 'skill_points', value: -5 }, { type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }])
  assert.deepEqual(done.history, [
    { type: 'chained_setback', key: 'attentat_mutilation', target: 'Mutilation', die: 'd10', value: 7, hit: false },
    { type: 'chained_setback', key: 'attentat_deuil', target: 'Deuil', die: 'd10', value: 3, hit: true },
  ])
})

test('Choc psychologique (reel, Lot 6) — historique du subroll auto-tire', () => {
  const rows = [{
    name: 'Choc psychologique', roll_min: 40, roll_max: 48,
    effects: [{ type: 'subroll', key: 'choc_psy_detail', die: 'd10', outcomes: [
      { range: [1, 6], effects: [{ type: 'manual_grant_choice', trait_type: 'phobia', candidates: ['adv_062'] }] },
      { range: [7, 10], effects: [{ type: 'manual_grant_choice', trait_type: 'mental_imbalance', candidates: ['adv_044'] }] },
    ] }],
  }]
  const done = resolveSetbackEffects(45, rows, { choc_psy_detail: 8 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.history, [{ type: 'subroll', key: 'choc_psy_detail', die: 'd10', value: 8 }])
})

test('Polaris — cascade a 2 niveaux : tier 2 saute sans jet si pas de Force Polaris', () => {
  const result = resolveSetbackEffects(95, SETBACK_ROWS, { polaris_blessure: 5, polaris_deuil: 8 }, { force_polaris: false })
  // Les deux jets tier 1 ratés (5 et 8 ne sont pas dans les plages hit), tier 2 jamais demandé.
  assert.equal(result.status, 'done')
  assert.deepEqual(result.effects, [])
  assert.deepEqual(result.history, [
    { type: 'chained_setback', key: 'polaris_blessure', target: 'Blessure', die: 'd10', value: 5, hit: false },
    { type: 'chained_setback', key: 'polaris_deuil', target: 'Deuil', die: 'd10', value: 8, hit: false },
  ])
})

test('Polaris — Force Polaris present : tier 2 demande bien ses propres jets', () => {
  const pending = resolveSetbackEffects(95, SETBACK_ROWS, { polaris_blessure: 5, polaris_deuil: 8 }, { force_polaris: true })
  assert.deepEqual(pending, {
    status: 'pending', kind: 'roll', key: 'polaris_fugitif', die: 'd10', origin: 'chained_setback',
    history: [
      { type: 'chained_setback', key: 'polaris_blessure', target: 'Blessure', die: 'd10', value: 5, hit: false },
      { type: 'chained_setback', key: 'polaris_deuil', target: 'Deuil', die: 'd10', value: 8, hit: false },
    ],
  })

  const stillPending = resolveSetbackEffects(
    95, SETBACK_ROWS,
    { polaris_blessure: 5, polaris_deuil: 8, polaris_fugitif: 9 },
    { force_polaris: true }
  )
  assert.equal(stillPending.key, 'polaris_deuil_tier2')
  assert.deepEqual(stillPending.history, [
    { type: 'chained_setback', key: 'polaris_blessure', target: 'Blessure', die: 'd10', value: 5, hit: false },
    { type: 'chained_setback', key: 'polaris_deuil', target: 'Deuil', die: 'd10', value: 8, hit: false },
    { type: 'chained_setback', key: 'polaris_fugitif', target: 'Fugitif', die: 'd10', value: 9, hit: false },
  ])

  const done = resolveSetbackEffects(
    95, SETBACK_ROWS,
    { polaris_blessure: 5, polaris_deuil: 8, polaris_fugitif: 9, polaris_deuil_tier2: 2 },
    { force_polaris: true }
  )
  assert.equal(done.status, 'done')
  // polaris_fugitif raté (9 pas dans [1,2]), polaris_deuil_tier2 touché (2 dans [1..7]) -> Deuil.
  assert.deepEqual(done.effects, [{ type: 'trait', trait_type: 'ally', op: 'gauge_delta', value: -1 }])
})

test('Complot — sous-table, apply_setback redirige sans nouveau jet 1D100', () => {
  const pending = resolveSetbackEffects(50, SETBACK_ROWS)
  assert.deepEqual(pending, { status: 'pending', kind: 'roll', key: 'complot_detail', die: 'd10', origin: 'subroll', history: [] })

  const done = resolveSetbackEffects(50, SETBACK_ROWS, { complot_detail: 9 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, [{ type: 'points_cap', scope: 'skill_points', value: 5 }, { type: 'income_multiplier', value: 0.5 }])
  assert.deepEqual(done.history, [{ type: 'subroll', key: 'complot_detail', die: 'd10', value: 9 }])
})

test('Complot — "Deux jets sur cette table" (reroll_table) demande 2 jets supplementaires, cumule les deux', () => {
  const pendingReroll1 = resolveSetbackEffects(50, SETBACK_ROWS, { complot_detail: 10 })
  assert.equal(pendingReroll1.key, 'complot_detail#2')
  assert.deepEqual(pendingReroll1.history, [{ type: 'subroll', key: 'complot_detail', die: 'd10', value: 10 }])

  const pendingReroll2 = resolveSetbackEffects(50, SETBACK_ROWS, { complot_detail: 10, 'complot_detail#2': 1 })
  assert.equal(pendingReroll2.key, 'complot_detail#3')
  assert.deepEqual(pendingReroll2.history, [
    { type: 'subroll', key: 'complot_detail', die: 'd10', value: 10 },
    { type: 'subroll', key: 'complot_detail#2', die: 'd10', value: 1 },
  ])

  const done = resolveSetbackEffects(
    50, SETBACK_ROWS,
    { complot_detail: 10, 'complot_detail#2': 1, 'complot_detail#3': 2 }
  )
  assert.equal(done.status, 'done')
  // #2=1 -> apply_setback Contrat (narratif) ; #3=2 -> apply_setback Bannissement (skill_points -5).
  assert.deepEqual(done.effects, [
    { type: 'narrative', key: 'contrat.differe_campagne' },
    { type: 'skill_points', value: -5 },
  ])
})

test('Emprisonnement — choice imbrique : refuse redirige vers Fugitif via apply_setback', () => {
  const rows = SETBACK_ROWS.map(r => r.name === 'Emprisonnement'
    ? {
        name: 'Emprisonnement', roll_min: 65, roll_max: 69,
        effects: [{
          type: 'choice',
          key: 'emprisonnement_choix',
          options: [
            { label: 'Purger sa peine', effects: [{ type: 'narrative', key: 'emprisonnement.accepte' }] },
            { label: "S'évader", effects: [{ type: 'apply_setback', target: 'Fugitif' }] },
          ],
        }],
      }
    : r)

  const pending = resolveSetbackEffects(67, rows)
  assert.deepEqual(pending, {
    status: 'pending', kind: 'choice', key: 'emprisonnement_choix',
    options: [{ label: 'Purger sa peine' }, { label: "S'évader" }],
    history: [],
  })

  const accepte = resolveSetbackEffects(67, rows, { emprisonnement_choix: 0 })
  assert.deepEqual(accepte.effects, [{ type: 'narrative', key: 'emprisonnement.accepte' }])

  const refuse = resolveSetbackEffects(67, rows, { emprisonnement_choix: 1 })
  assert.equal(refuse.status, 'done')
  assert.deepEqual(refuse.effects, [
    { type: 'manual_grant_choice', trait_type: 'wanted', candidates: ['recherche_petite', 'recherche_nation'] },
    { type: 'skill_points', value: -5 },
  ])
})

test('choice sans label (donnee pas encore peuplee, Lot 6) -> label: null, pas un crash', () => {
  const rows = [{
    name: 'X', roll_min: 1, roll_max: 1,
    effects: [{ type: 'choice', key: 'x_choix', options: [{ effects: [] }, { effects: [] }] }],
  }]
  const pending = resolveSetbackEffects(1, rows)
  assert.deepEqual(pending, { status: 'pending', kind: 'choice', key: 'x_choix', options: [{ label: null }, { label: null }], history: [] })
})

test('Diffamation (Lot 6) — celebrity_fraction et trait/gauge_fraction_delta transmis tels quels', () => {
  const rows = [{
    name: 'Diffamation', roll_min: 61, roll_max: 62,
    effects: [
      { type: 'celebrity_fraction', value: -0.25 },
      { type: 'trait', trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
      { type: 'trait', trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
    ],
  }]
  const done = resolveSetbackEffects(61, rows)
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, rows[0].effects)
})

test('irradiation_reward (Lot 6) — jet de 2D10 transmis tel quel en trait gauge_delta', () => {
  const rows = [{ name: 'Irradiation', roll_min: 99, roll_max: 99, effects: [
    { type: 'irradiation_reward', key: 'irradiation_score', die: '2d10' },
  ] }]
  const pending = resolveSetbackEffects(99, rows)
  assert.deepEqual(pending, { status: 'pending', kind: 'roll', key: 'irradiation_score', die: '2d10', origin: 'chained_setback', history: [] })

  const done = resolveSetbackEffects(99, rows, { irradiation_score: 13 })
  assert.equal(done.status, 'done')
  assert.deepEqual(done.effects, [{ type: 'trait', trait_type: 'irradiation', op: 'gauge_delta', value: 13 }])
  assert.deepEqual(done.history, [{ type: 'irradiation_reward', key: 'irradiation_score', die: '2d10', value: 13 }])
})

test('subroll avec condition (Lot 6, Polaris "Culte du Trident") — saute sans jet si condition absente', () => {
  const rows = [{ name: 'X', roll_min: 1, roll_max: 1, effects: [
    { type: 'subroll', key: 'culte_detail', die: 'd10', condition: 'force_polaris', outcomes: [
      { range: [1, 7], effects: [{ type: 'narrative', key: 'culte.offre' }] },
      { range: [8, 10], effects: [] },
    ] },
  ] }]
  const sansCondition = resolveSetbackEffects(1, rows, {}, { force_polaris: false })
  assert.deepEqual(sansCondition, { status: 'done', effects: [], history: [] })

  const avecCondition = resolveSetbackEffects(1, rows, {}, { force_polaris: true })
  assert.deepEqual(avecCondition, { status: 'pending', kind: 'roll', key: 'culte_detail', die: 'd10', origin: 'subroll', history: [] })

  const resolu = resolveSetbackEffects(1, rows, { culte_detail: 3 }, { force_polaris: true })
  assert.deepEqual(resolu.effects, [{ type: 'narrative', key: 'culte.offre' }])
  assert.deepEqual(resolu.history, [{ type: 'subroll', key: 'culte_detail', die: 'd10', value: 3 }])
})

// ─── Cas défensifs ───

test('roll sans Revers correspondant leve une erreur', () => {
  assert.throws(() => resolveSetbackEffects(200, SETBACK_ROWS), /introuvable/)
})

test('type d\'effet inconnu leve une erreur explicite', () => {
  const rows = [{ name: 'X', roll_min: 1, roll_max: 1, effects: [{ type: 'ce_type_n_existe_pas' }] }]
  assert.throws(() => resolveSetbackEffects(1, rows), /inconnu/)
})

test('reroll_table hors d\'un outcome de subroll leve une erreur', () => {
  const rows = [{ name: 'X', roll_min: 1, roll_max: 1, effects: [{ type: 'reroll_table', count: 1 }] }]
  assert.throws(() => resolveSetbackEffects(1, rows), /subroll parent/)
})

test('target de chained_setback/apply_setback introuvable leve une erreur explicite', () => {
  const rows = [{ name: 'X', roll_min: 1, roll_max: 1, effects: [
    { type: 'chained_setback', target: 'Inexistant', chance: { die: 'd10', hit: [1] }, key: 'x' },
  ] }]
  assert.throws(() => resolveSetbackEffects(1, rows, { x: 1 }), /introuvable/)
})
