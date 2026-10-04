import test from 'node:test'
import assert from 'node:assert/strict'

import {
  areRequirementsSatisfied,
  effectiveRequirements,
  gatherChainIdentityRequirements,
  isBlockedByIdentityChain,
} from './skillRequirements.js'

// ─── areRequirementsSatisfied — comportement existant, filet de sécurité ──────────────────────

test('areRequirementsSatisfied — aucun prérequis → satisfait', () => {
  assert.equal(areRequirementsSatisfied([], () => false), true)
  assert.equal(areRequirementsSatisfied(null, () => false), true)
})

test('areRequirementsSatisfied — lignes non groupées = ET', () => {
  const reqs = [{ type: 'A', value: '1' }, { type: 'B', value: '2' }]
  assert.equal(areRequirementsSatisfied(reqs, r => r.type === 'A'), false)
  assert.equal(areRequirementsSatisfied(reqs, () => true), true)
})

test('areRequirementsSatisfied — même or_group = OU', () => {
  const reqs = [
    { type: 'GENOTYPE', value: 'HYB_NAT', or_group: 'G' },
    { type: 'MUTATION', value: '2', or_group: 'G' },
  ]
  assert.equal(areRequirementsSatisfied(reqs, r => r.value === '2'), true)
  assert.equal(areRequirementsSatisfied(reqs, () => false), false)
})

// ─── Fixtures — miroir simplifié de la chaîne Pouvoirs Polaris réelle ─────────────────────────
// POUVOIRS_POLARIS (catégorie) --SKILL_MIN--> MAITRISE_DE_LA_FORCE_POLARIS --ADVANTAGE--> adv_079
// ONDE_POLARIS (enfant de la catégorie, aucun prérequis propre)

function buildPolarisFixture() {
  const skillsById = new Map()
  skillsById.set('MAITRISE_DE_LA_FORCE_POLARIS', {
    id: 'MAITRISE_DE_LA_FORCE_POLARIS',
    parent: null,
    is_category: false,
    requirements: [{ type: 'ADVANTAGE', value: 'adv_079', threshold: 1, or_group: null }],
  })
  skillsById.set('POUVOIRS_POLARIS', {
    id: 'POUVOIRS_POLARIS',
    parent: null,
    is_category: true,
    requirements: [{ type: 'SKILL_MIN', value: 'MAITRISE_DE_LA_FORCE_POLARIS', threshold: 1, or_group: null }],
  })
  skillsById.set('ONDE_POLARIS', {
    id: 'ONDE_POLARIS',
    parent: 'POUVOIRS_POLARIS',
    is_category: false,
    requirements: [],
  })
  return skillsById
}

// ─── effectiveRequirements ─────────────────────────────────────────────────────────────────────

test('effectiveRequirements — une compétence avec ses propres prérequis les garde', () => {
  const skillsById = buildPolarisFixture()
  const reqs = effectiveRequirements(skillsById.get('POUVOIRS_POLARIS'), skillsById)
  assert.equal(reqs.length, 1)
  assert.equal(reqs[0].type, 'SKILL_MIN')
})

test('effectiveRequirements — un enfant sans prérequis hérite de ceux de sa catégorie parente', () => {
  const skillsById = buildPolarisFixture()
  const reqs = effectiveRequirements(skillsById.get('ONDE_POLARIS'), skillsById)
  assert.equal(reqs.length, 1)
  assert.equal(reqs[0].type, 'SKILL_MIN')
  assert.equal(reqs[0].value, 'MAITRISE_DE_LA_FORCE_POLARIS')
})

test("effectiveRequirements — un parent qui n'est pas une catégorie n'est jamais hérité", () => {
  const skillsById = new Map()
  skillsById.set('PARENT_NORMAL', { id: 'PARENT_NORMAL', parent: null, is_category: false, requirements: [{ type: 'ADVANTAGE', value: 'adv_x' }] })
  skillsById.set('CHILD', { id: 'CHILD', parent: 'PARENT_NORMAL', is_category: false, requirements: [] })
  assert.deepEqual(effectiveRequirements(skillsById.get('CHILD'), skillsById), [])
})

test('effectiveRequirements — sans prérequis et sans parent → vide', () => {
  const skillsById = new Map()
  skillsById.set('SEUL', { id: 'SEUL', parent: null, is_category: false, requirements: [] })
  assert.deepEqual(effectiveRequirements(skillsById.get('SEUL'), skillsById), [])
})

// ─── gatherChainIdentityRequirements / isBlockedByIdentityChain ────────────────────────────────

test('isBlockedByIdentityChain — un Pouvoir Polaris enfant est bloqué par la chaîne sans l\'Avantage', () => {
  const skillsById = buildPolarisFixture()
  const noAdvantage = () => false
  assert.equal(isBlockedByIdentityChain(skillsById.get('ONDE_POLARIS'), skillsById, noAdvantage), true)
  // La catégorie elle-même (consultée directement, ex. panneau MJ) doit être bloquée pareil.
  assert.equal(isBlockedByIdentityChain(skillsById.get('POUVOIRS_POLARIS'), skillsById, noAdvantage), true)
})

test("isBlockedByIdentityChain — un Pouvoir Polaris enfant n'est plus bloqué une fois l'Avantage possédé", () => {
  const skillsById = buildPolarisFixture()
  const hasAdvantage = req => req.type === 'ADVANTAGE' && req.value === 'adv_079'
  assert.equal(isBlockedByIdentityChain(skillsById.get('ONDE_POLARIS'), skillsById, hasAdvantage), false)
})

test('isBlockedByIdentityChain — une chaîne SKILL_MIN pure (type Informatique → Culture générale) ne bloque jamais, même niveau non atteint', () => {
  const skillsById = new Map()
  skillsById.set('CULTURE_GENERALE', { id: 'CULTURE_GENERALE', parent: null, is_category: false, requirements: [] })
  skillsById.set('INFORMATIQUE', {
    id: 'INFORMATIQUE',
    parent: null,
    is_category: false,
    requirements: [{ type: 'SKILL_MIN', value: 'CULTURE_GENERALE', threshold: 10, or_group: null }],
  })
  // isIdentityReqSatisfied n'est même pas censé être appelé ici (aucune ligne d'identité dans la
  // chaîne) — on le fait échouer explicitement pour vérifier que ça n'influence pas le résultat.
  assert.equal(isBlockedByIdentityChain(skillsById.get('INFORMATIQUE'), skillsById, () => false), false)
})

test('isBlockedByIdentityChain — un verrou Mutation direct (type Agilité Caudale) bloque sans la mutation', () => {
  const skillsById = new Map()
  skillsById.set('AGILITE_CAUDALE', {
    id: 'AGILITE_CAUDALE',
    parent: null,
    is_category: false,
    requirements: [{ type: 'MUTATION', value: '31', threshold: 1, or_group: null }],
  })
  assert.equal(isBlockedByIdentityChain(skillsById.get('AGILITE_CAUDALE'), skillsById, () => false), true)
  assert.equal(isBlockedByIdentityChain(skillsById.get('AGILITE_CAUDALE'), skillsById, req => req.value === '31'), false)
})

test('isBlockedByIdentityChain — HYBRIDE (OU entre génotype et mutation) reste géré par le OU, pas cassé par la chaîne', () => {
  const skillsById = new Map()
  skillsById.set('HYBRIDE', {
    id: 'HYBRIDE',
    parent: null,
    is_category: false,
    requirements: [
      { type: 'GENOTYPE', value: 'HYB_NAT', threshold: 1, or_group: 'HYBRIDE_ORIGIN' },
      { type: 'GENOTYPE', value: 'GEN_HYB', threshold: 1, or_group: 'HYBRIDE_ORIGIN' },
      { type: 'GENOTYPE', value: 'TEC_HYB', threshold: 1, or_group: 'HYBRIDE_ORIGIN' },
      { type: 'MUTATION',  value: '2',       threshold: 1, or_group: 'HYBRIDE_ORIGIN' },
    ],
  })
  // Une seule des quatre lignes satisfaite suffit (OU) → non bloqué.
  assert.equal(isBlockedByIdentityChain(skillsById.get('HYBRIDE'), skillsById, req => req.value === '2'), false)
  assert.equal(isBlockedByIdentityChain(skillsById.get('HYBRIDE'), skillsById, () => false), true)
})

test('gatherChainIdentityRequirements — une boucle de prérequis SKILL_MIN ne provoque jamais de récursion infinie', () => {
  const skillsById = new Map()
  skillsById.set('A', { id: 'A', parent: null, is_category: false, requirements: [{ type: 'SKILL_MIN', value: 'B', threshold: 1 }] })
  skillsById.set('B', { id: 'B', parent: null, is_category: false, requirements: [{ type: 'SKILL_MIN', value: 'A', threshold: 1 }] })
  const result = gatherChainIdentityRequirements(skillsById.get('A'), skillsById)
  assert.deepEqual(result, [])
})

test('isBlockedByIdentityChain — une compétence sans aucun prérequis (directe ou héritée) n\'est jamais bloquée', () => {
  const skillsById = new Map()
  skillsById.set('LIBRE', { id: 'LIBRE', parent: null, is_category: false, requirements: [] })
  assert.equal(isBlockedByIdentityChain(skillsById.get('LIBRE'), skillsById, () => false), false)
})
