import test from 'node:test'
import assert from 'node:assert/strict'

import {
  INELIGIBILITY_REASONS,
  aimedAtProtected,
  ineligibilityReason,
  isInterposed,
  pickProtector,
  screenCandidates,
} from './droneInterception.js'
import { resolveTestOutcome } from './polarisTestResolution.js'

const candidate = (patch = {}) => ({
  droneTokenId: 'tok-a', droneCharacterId: 'chr-a', level: 12, integrity: 3,
  tokenBattlemapId: 'bm', shotBattlemapId: 'bm', isTarget: false, telepilotedThisTurn: false,
  speedM: 25, reachable: true,
  ...patch,
})

test('un candidat complet et à portée est éligible', () => {
  assert.equal(ineligibilityReason(candidate(), { attackKind: 'ranged' }), null)
})

test('corps à corps : jamais éligible, quoi que dise le reste (RAW)', () => {
  assert.equal(ineligibilityReason(candidate(), { attackKind: 'melee' }), 'melee')
})

test('attackKind explicite obligatoire : jamais déduit', () => {
  assert.throws(() => ineligibilityReason(candidate(), {}), RangeError)
  assert.throws(() => ineligibilityReason(candidate(), { attackKind: 'distance' }), RangeError)
})

test('chaque motif d’inéligibilité est reconnu', () => {
  const cases = [
    ['no_program', { level: null }],
    ['destroyed', { integrity: 0 }],
    ['no_token', { tokenBattlemapId: null }],
    ['hidden', { tokenHidden: true }],
    ['other_battlemap', { tokenBattlemapId: 'autre' }],
    ['is_target', { isTarget: true }],
    ['telepiloted', { telepilotedThisTurn: true }],
    ['speed_missing', { speedM: null }],
    ['unreachable', { reachable: false }],
  ]
  for (const [reason, patch] of cases) {
    assert.equal(ineligibilityReason(candidate(patch), { attackKind: 'ranged' }), reason, reason)
  }
})

test('une vitesse explicitement nulle (RAW « Déplacement : - ») est une vitesse renseignée : éligible tant que la portée le permet', () => {
  assert.equal(ineligibilityReason(candidate({ speedM: 0 }), { attackKind: 'ranged' }), null)
})

test('tous les motifs déclarés sont couverts par les cas ci-dessus (garde-fou de dérive)', () => {
  assert.deepEqual([...INELIGIBILITY_REASONS], ['melee', 'no_program', 'destroyed', 'no_token', 'hidden', 'other_battlemap', 'is_target', 'telepiloted', 'speed_missing', 'unreachable'])
})

test('l’ordre d’évaluation est déterministe : le premier motif rencontré l’emporte', () => {
  assert.equal(ineligibilityReason(candidate({ level: null, integrity: 0, isTarget: true }), { attackKind: 'ranged' }), 'no_program')
  assert.equal(ineligibilityReason(candidate({ integrity: 0, isTarget: true }), { attackKind: 'ranged' }), 'destroyed')
})

test('screenCandidates ignore `reachable` (calculé ensuite) et explique chaque rejet', () => {
  const { screened, rejected } = screenCandidates([
    candidate({ droneTokenId: 'ok', reachable: undefined }),
    candidate({ droneTokenId: 'mort', integrity: 0 }),
    candidate({ droneTokenId: 'pilote', telepilotedThisTurn: true }),
  ], { attackKind: 'ranged' })
  assert.deepEqual(screened.map(c => c.droneTokenId), ['ok'])
  assert.deepEqual(rejected, [
    { droneTokenId: 'mort', reason: 'destroyed' },
    { droneTokenId: 'pilote', reason: 'telepiloted' },
  ])
})

test('screenCandidates : au corps à corps tout le monde est rejeté', () => {
  const { screened, rejected } = screenCandidates([candidate(), candidate({ droneTokenId: 'b' })], { attackKind: 'melee' })
  assert.equal(screened.length, 0)
  assert.deepEqual(rejected.map(r => r.reason), ['melee', 'melee'])
})

test('pickProtector : le niveau le plus élevé, égalité départagée par token_id croissant', () => {
  const { protector } = pickProtector([
    candidate({ droneTokenId: 'b', level: 12 }),
    candidate({ droneTokenId: 'a', level: 12 }),
    candidate({ droneTokenId: 'c', level: 9 }),
  ], { attackKind: 'ranged' })
  assert.equal(protector.droneTokenId, 'a')
  const best = pickProtector([candidate({ droneTokenId: 'b', level: 15 }), candidate({ droneTokenId: 'a', level: 12 })], { attackKind: 'ranged' })
  assert.equal(best.protector.droneTokenId, 'b')
})

test('pickProtector : une portée non confirmée n’est jamais retenue', () => {
  const { protector, rejected } = pickProtector([candidate({ reachable: undefined }), candidate({ droneTokenId: 'x', reachable: false })], { attackKind: 'ranged' })
  assert.equal(protector, null)
  assert.deepEqual(rejected.map(r => r.reason), ['unreachable', 'unreachable'])
})

test('pickProtector : aucun candidat → aucun protecteur, sans erreur', () => {
  assert.deepEqual(pickProtector([], { attackKind: 'ranged' }), { protector: null, rejected: [] })
})

test('isInterposed : strictement supérieure, jamais à égalité', () => {
  assert.equal(isInterposed(9, 8), true)
  assert.equal(isInterposed(8, 8), false)
  assert.equal(isInterposed(7, 8), false)
  assert.equal(isInterposed(null, 8), false)
  assert.equal(isInterposed(9, undefined), false)
})

test('isInterposed avec les vraies marges de resolveTestOutcome : un Test raté ne bat jamais une attaque réussie', () => {
  const droneRate = resolveTestOutcome(15, 12)   // seuil 12, jet 15 → échec, marge négative
  const attaqueReussie = resolveTestOutcome(3, 10) // succès, marge = le jet
  assert.equal(droneRate.isSuccess, false)
  assert.equal(isInterposed(droneRate.mr, attaqueReussie.mr), false)
  const droneReussi = resolveTestOutcome(11, 12)
  assert.equal(isInterposed(droneReussi.mr, attaqueReussie.mr), true)
})

test('aimedAtProtected : le point visé est dans la case du protégé (même étage)', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  assert.equal(aimedAtProtected({ x: 4.9, y: 0.125, z: 2.1 }, feet, { bodyHeight: 1.8 }), true)
  assert.equal(aimedAtProtected({ x: 5.1, y: 0.125, z: 2.5 }, feet, { bodyHeight: 1.8 }), false)
  assert.equal(aimedAtProtected({ x: 4.5, y: 0.125, z: 3.0 }, feet, { bodyHeight: 1.8 }), false)
})

test('aimedAtProtected : même case mais autre étage → non', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  assert.equal(aimedAtProtected({ x: 4.5, y: 3.0, z: 2.5 }, feet, { bodyHeight: 1.8 }), false)
  assert.equal(aimedAtProtected({ x: 4.5, y: 1.0, z: 2.5 }, feet, { bodyHeight: 1.8 }), true)
})

test('aimedAtProtected refuse une hauteur de corps invalide', () => {
  assert.throws(() => aimedAtProtected({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { bodyHeight: 0 }), RangeError)
})

// ── Liens de protection ──────────────────────────────────────────────────────────────────────────
import { LINK_REJECTION_REASONS, PROTECTABLE_TYPES, linkRejectionReason } from './droneInterception.js'

const drone = (patch = {}) => ({ id: 'd1', type: 'drone', campaign_id: 'c1', ...patch })
const cible = (patch = {}) => ({ id: 'p1', type: 'pj', campaign_id: 'c1', ...patch })

test('lien valide : PJ, PNJ et exo de la même campagne', () => {
  for (const type of PROTECTABLE_TYPES) assert.equal(linkRejectionReason(drone(), cible({ type })), null, type)
})

test('lien : chaque motif de rejet est reconnu', () => {
  assert.equal(linkRejectionReason(drone({ type: 'pj' }), cible()), 'not_a_drone')
  assert.equal(linkRejectionReason(null, cible()), 'not_a_drone')
  assert.equal(linkRejectionReason(drone(), null), 'target_missing')
  assert.equal(linkRejectionReason(drone(), cible({ id: 'd1' })), 'self')
  assert.equal(linkRejectionReason(drone(), cible({ campaign_id: 'c2' })), 'other_campaign')
  assert.equal(linkRejectionReason(drone({ campaign_id: null }), cible({ campaign_id: null })), 'other_campaign')
  assert.equal(linkRejectionReason(drone(), cible({ type: 'drone' })), 'target_type')
  assert.deepEqual([...LINK_REJECTION_REASONS], ['not_a_drone', 'target_missing', 'self', 'other_campaign', 'target_type'])
})
