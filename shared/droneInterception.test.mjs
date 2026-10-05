import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GRENADE_PROTECTION_AIM_RADIUS_M,
  INELIGIBILITY_REASONS,
  INTERCEPTION_LIMIT_FIELDS,
  SIMULTANEOUS_INTERCEPTION_PENALTY,
  aimedAtProtected,
  effectiveLevel,
  halveExplosionDamage,
  hasSimultaneityRule,
  ineligibilityReason,
  isInterposed,
  isSaturated,
  parseInterceptionLimit,
  pickProtector,
  screenCandidates,
  simultaneityPenalty,
  withinLeash,
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
    ['saturated', { maxSimultaneous: 4, usesThisTurn: 4 }],
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
  assert.deepEqual([...INELIGIBILITY_REASONS], ['melee', 'no_program', 'destroyed', 'no_token', 'hidden', 'other_battlemap', 'is_target', 'telepiloted', 'saturated', 'speed_missing', 'unreachable'])
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

// ── CRD : interceptions simultanées et rayon d'action (Lot 3) ────────────────────────────────────
const crd = (patch = {}) => candidate({ level: 12, maxSimultaneous: 4, usesThisTurn: 0, ...patch })

test('sans plafond renseigné (bouclier personnel) : aucune règle de simultanéité, ni malus ni saturation', () => {
  for (const maxSimultaneous of [null, undefined]) {
    const shield = candidate({ maxSimultaneous, usesThisTurn: 9 })
    assert.equal(hasSimultaneityRule(shield), false)
    assert.equal(isSaturated(shield), false)
    assert.equal(effectiveLevel(shield), 12)
    assert.equal(ineligibilityReason(shield, { attackKind: 'ranged' }), null)
  }
  assert.equal(hasSimultaneityRule({ maxSimultaneous: 0 }), false) // un plafond invalide n'active pas la règle
  assert.equal(hasSimultaneityRule({ maxSimultaneous: 2.5 }), false)
})

test('CRD : −1 au Seuil par interception déjà engagée ce Tour, jusqu’au plafond (RAW : 12, 11, 10, 9 puis refus)', () => {
  assert.equal(SIMULTANEOUS_INTERCEPTION_PENALTY, 1)
  assert.deepEqual([0, 1, 2, 3].map(usesThisTurn => effectiveLevel(crd({ usesThisTurn }))), [12, 11, 10, 9])
  assert.deepEqual([1, 2, 3, 4].map(simultaneityPenalty), [0, 1, 2, 3])
  assert.equal(isSaturated(crd({ usesThisTurn: 3 })), false)
  assert.equal(isSaturated(crd({ usesThisTurn: 4 })), true)
  assert.equal(ineligibilityReason(crd({ usesThisTurn: 4 }), { attackKind: 'ranged' }), 'saturated')
  assert.equal(ineligibilityReason(crd({ usesThisTurn: 3 }), { attackKind: 'ranged' }), null)
})

test('le plafond est une donnée de la fiche : un CRD réglé à 2 sature à 2', () => {
  assert.equal(isSaturated(crd({ maxSimultaneous: 2, usesThisTurn: 1 })), false)
  assert.equal(isSaturated(crd({ maxSimultaneous: 2, usesThisTurn: 2 })), true)
})

test('simultaneityPenalty refuse un rang invalide', () => {
  for (const rank of [0, -1, 1.5, NaN, undefined]) assert.throws(() => simultaneityPenalty(rank), RangeError)
})

test('effectiveLevel : niveau absent → null, jamais NaN', () => {
  assert.equal(effectiveLevel(crd({ level: null })), null)
  assert.equal(effectiveLevel({}), null)
})

test('pickProtector : le Seuil EFFECTIF décide — un CRD déjà sollicité passe derrière un bouclier plus frais', () => {
  const tired = crd({ droneTokenId: 'tok-crd', usesThisTurn: 2 })      // 12 − 2 = 10
  const fresh = candidate({ droneTokenId: 'tok-shield', level: 11 })   // 11, sans règle
  assert.equal(pickProtector([tired, fresh], { attackKind: 'ranged' }).protector.droneTokenId, 'tok-shield')
  const rested = crd({ droneTokenId: 'tok-crd', usesThisTurn: 0 })     // 12
  assert.equal(pickProtector([rested, fresh], { attackKind: 'ranged' }).protector.droneTokenId, 'tok-crd')
})

test('pickProtector : un CRD saturé est écarté avec son motif, un autre drone prend le relais', () => {
  const saturated = crd({ droneTokenId: 'tok-crd', usesThisTurn: 4 })
  const other = candidate({ droneTokenId: 'tok-b', level: 8 })
  const { protector, rejected } = pickProtector([saturated, other], { attackKind: 'ranged' })
  assert.equal(protector.droneTokenId, 'tok-b')
  assert.deepEqual(rejected, [{ droneTokenId: 'tok-crd', reason: 'saturated' }])
})

test('withinLeash : distance 3D aux pieds du protégé, 10 m de rayon (1 unité monde = 1,5 m)', () => {
  const armor = { x: 0, y: 0, z: 0 }
  assert.equal(withinLeash({ x: 6, y: 0, z: 0 }, [armor], 10), true)    // 9 m
  assert.equal(withinLeash({ x: 7, y: 0, z: 0 }, [armor], 10), false)   // 10,5 m
  assert.equal(withinLeash({ x: 4, y: 4, z: 0 }, [armor], 10), true)    // altitude comprise : 8,49 m
  assert.equal(withinLeash({ x: 5, y: 5, z: 0 }, [armor], 10), false)   // 10,6 m : un étage compte
  assert.equal(withinLeash({ x: 200, y: 0, z: 0 }, [armor], null), true) // pas de limite (bouclier personnel)
  assert.equal(withinLeash({ x: 200, y: 0, z: 0 }, [armor], undefined), true)
})

test('withinLeash : plusieurs protégés visés, il suffit d’être dans le rayon de l’un d’eux', () => {
  const anchors = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }]
  assert.equal(withinLeash({ x: 19, y: 0, z: 0 }, anchors, 10), true)
  assert.equal(withinLeash({ x: 10, y: 0, z: 0 }, anchors, 10), false) // à 15 m des deux
})

test('withinLeash : une limite sans ancrage ne peut pas être vérifiée → refus ; rayon invalide → erreur', () => {
  assert.equal(withinLeash({ x: 0, y: 0, z: 0 }, [], 10), false)
  assert.equal(withinLeash({ x: 0, y: 0, z: 0 }, undefined, 10), false)
  for (const leash of [0, -3, NaN]) assert.throws(() => withinLeash({ x: 0, y: 0, z: 0 }, [{ x: 0, y: 0, z: 0 }], leash), RangeError)
})

test('withinLeash : les métriques de la battlemap convertissent les mètres', () => {
  const anchors = [{ x: 0, y: 0, z: 0 }]
  assert.equal(withinLeash({ x: 4, y: 0, z: 0 }, anchors, 10, createWorldMetrics({ metersPerCell: 3 })), false) // 12 m
  assert.equal(withinLeash({ x: 4, y: 0, z: 0 }, anchors, 10, createWorldMetrics({ metersPerCell: 2 })), true)  // 8 m
})

test('parseInterceptionLimit : plafond entier ≥ 1, rayon > 0, vide = bouclier personnel', () => {
  assert.deepEqual([...INTERCEPTION_LIMIT_FIELDS], ['interception_max_simultaneous', 'interception_leash_m'])
  assert.deepEqual(parseInterceptionLimit('interception_max_simultaneous', 4), { ok: true, value: 4 })
  assert.deepEqual(parseInterceptionLimit('interception_max_simultaneous', '4'), { ok: true, value: 4 })
  assert.deepEqual(parseInterceptionLimit('interception_max_simultaneous', null), { ok: true, value: null })
  assert.deepEqual(parseInterceptionLimit('interception_max_simultaneous', ''), { ok: true, value: null })
  for (const bad of [0, -1, 2.5, 'abc', NaN]) {
    assert.equal(parseInterceptionLimit('interception_max_simultaneous', bad).ok, false, String(bad))
  }
  assert.deepEqual(parseInterceptionLimit('interception_leash_m', 10), { ok: true, value: 10 })
  assert.deepEqual(parseInterceptionLimit('interception_leash_m', '7,5'), { ok: true, value: 7.5 })
  assert.deepEqual(parseInterceptionLimit('interception_leash_m', null), { ok: true, value: null })
  for (const bad of [0, -2, 'x', Infinity]) {
    assert.equal(parseInterceptionLimit('interception_leash_m', bad).ok, false, String(bad))
  }
  assert.throws(() => parseInterceptionLimit('vitesse', 3), RangeError)
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
