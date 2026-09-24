import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GRENADE_PROTECTION_AIM_RADIUS_M,
  INELIGIBILITY_REASONS,
  aimedAtProtected,
  halveExplosionDamage,
  ineligibilityReason,
  isInterposed,
  pickProtector,
  screenCandidates,
} from './droneInterception.js'
import { resolveTestOutcome } from './polarisTestResolution.js'
import { createWorldMetrics } from './world/worldMetrics.js'

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

test('isInterposed : Test réussi et marge strictement supérieure, jamais à égalité', () => {
  assert.equal(isInterposed({ isSuccess: true, mr: 9 }, 8), true)
  assert.equal(isInterposed({ isSuccess: true, mr: 8 }, 8), false)
  assert.equal(isInterposed({ isSuccess: true, mr: 7 }, 8), false)
  assert.equal(isInterposed(null, 8), false)
  assert.equal(isInterposed({ isSuccess: true, mr: null }, 8), false)
  assert.equal(isInterposed({ isSuccess: true, mr: 9 }, undefined), false)
})

test('isInterposed avec les vraies marges de resolveTestOutcome : un Test raté ne bat jamais une attaque réussie', () => {
  const droneRate = resolveTestOutcome(15, 12)   // seuil 12, jet 15 → échec, marge négative
  const attaqueReussie = resolveTestOutcome(3, 10) // succès, marge = le jet
  assert.equal(droneRate.isSuccess, false)
  assert.equal(isInterposed(droneRate, attaqueReussie.mr), false)
  const droneReussi = resolveTestOutcome(11, 12)
  assert.equal(isInterposed(droneReussi, attaqueReussie.mr), true)
})

test('isInterposed : lancer de grenade raté (marge négative) — un Test réussi la bat, un Test raté jamais', () => {
  const lancerRate = resolveTestOutcome(19, 12)   // seuil 12, jet 19 → échec, marge négative (-7)
  assert.equal(lancerRate.isSuccess, false)
  assert.ok(lancerRate.mr < 0)
  const droneReussi = resolveTestOutcome(2, 10)
  assert.equal(isInterposed(droneReussi, lancerRate.mr), true)
  // Test raté mais « moins négatif » que le lancer : sans exigence de réussite il passerait à tort.
  const droneRate = resolveTestOutcome(13, 12)    // marge -1 > -7
  assert.ok(droneRate.mr > lancerRate.mr)
  assert.equal(isInterposed(droneRate, lancerRate.mr), false)
})

test('halveExplosionDamage : moitié des dommages bruts, arrondie à l’inférieur', () => {
  assert.equal(halveExplosionDamage(12), 6)
  assert.equal(halveExplosionDamage(13), 6)
  assert.equal(halveExplosionDamage(1), 0)
  assert.equal(halveExplosionDamage(0), 0)
  assert.throws(() => halveExplosionDamage(-1), RangeError)
  assert.throws(() => halveExplosionDamage(NaN), RangeError)
})

test('GRENADE_PROTECTION_AIM_RADIUS_M : réglage positif (valeur de départ : une case, 1,5 m)', () => {
  assert.equal(GRENADE_PROTECTION_AIM_RADIUS_M, 1.5)
})

// Métriques par défaut du moteur : 1 case = 1 unité monde = 1,5 m.
test('aimedAtProtected : le point visé est à moins du rayon de réglage des pieds du protégé (même étage)', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  assert.equal(aimedAtProtected({ x: 4.9, y: 0.125, z: 2.1 }, feet, { bodyHeight: 1.8 }), true)
  // Un point visé dans la case VOISINE reste dans le rayon (le cas ridicule du modèle « à la case » : viser les pieds).
  assert.equal(aimedAtProtected({ x: 5.4, y: 0.125, z: 2.5 }, feet, { bodyHeight: 1.8 }), true)
  // Bornes comprises : 1 unité monde = 1,5 m pile.
  assert.equal(aimedAtProtected({ x: 5.5, y: 0.125, z: 2.5 }, feet, { bodyHeight: 1.8 }), true)
  assert.equal(aimedAtProtected({ x: 5.6, y: 0.125, z: 2.5 }, feet, { bodyHeight: 1.8 }), false)
  // Distance horizontale : l'altitude n'y compte pas (elle a sa propre règle).
  assert.equal(aimedAtProtected({ x: 4.5, y: 1.0, z: 3.5 }, feet, { bodyHeight: 1.8 }), true)
})

test('aimedAtProtected : le rayon est un réglage — plus large, plus étroit, nul', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  const far = { x: 6.0, y: 0.125, z: 2.5 } // 1,5 unité monde = 2,25 m
  assert.equal(aimedAtProtected(far, feet, { bodyHeight: 1.8 }), false)
  assert.equal(aimedAtProtected(far, feet, { bodyHeight: 1.8, radiusM: 3 }), true)
  const near = { x: 5.0, y: 0.125, z: 2.5 } // 0,5 unité monde = 0,75 m
  assert.equal(aimedAtProtected(near, feet, { bodyHeight: 1.8, radiusM: 0.75 }), true)
  assert.equal(aimedAtProtected(near, feet, { bodyHeight: 1.8, radiusM: 0.5 }), false)
  assert.equal(aimedAtProtected(feet, feet, { bodyHeight: 1.8, radiusM: 0 }), true)
})

test('aimedAtProtected : les métriques de la battlemap convertissent les mètres', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  const target = { x: 5.4, y: 0.125, z: 2.5 } // 0,9 unité monde
  assert.equal(aimedAtProtected(target, feet, { bodyHeight: 1.8, metrics: createWorldMetrics({ metersPerCell: 3 }) }), false) // 2,7 m > 1,5 m
  assert.equal(aimedAtProtected(target, feet, { bodyHeight: 1.8, metrics: createWorldMetrics({ metersPerCell: 1 }) }), true)  // 0,9 m
})

test('aimedAtProtected : proche à l’horizontale mais autre étage → non', () => {
  const feet = { x: 4.5, y: 0.125, z: 2.5 }
  assert.equal(aimedAtProtected({ x: 4.5, y: 3.0, z: 2.5 }, feet, { bodyHeight: 1.8 }), false)
  assert.equal(aimedAtProtected({ x: 4.5, y: 1.0, z: 2.5 }, feet, { bodyHeight: 1.8 }), true)
})

test('aimedAtProtected refuse une hauteur de corps ou un rayon invalides', () => {
  assert.throws(() => aimedAtProtected({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { bodyHeight: 0 }), RangeError)
  assert.throws(() => aimedAtProtected({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { bodyHeight: 1.8, radiusM: -1 }), RangeError)
  assert.throws(() => aimedAtProtected({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { bodyHeight: 1.8, radiusM: NaN }), RangeError)
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
