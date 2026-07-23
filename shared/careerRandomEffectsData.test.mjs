// Vérifie les 37 métiers réels (Lot 6) contre resolveCareerRandomEffects/getPendingCareerPickStep —
// pas seulement contre le résumé "effet en clair" du plan (deux erreurs de transcription trouvées en
// relisant le RAW, cf. shared/careerRandomEffectsData.js pour le détail).
import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveCareerRandomEffects, getPendingCareerPickStep } from './careerAdvantages.js'
import { CAREER_RANDOM_EFFECTS_BY_CODE } from './careerRandomEffectsData.js'

const ALL_CODES = [
  'artisan_artiste', 'assassin', 'barman', 'contrebandier', 'cultivateur_eleveur', 'diplomate',
  'erudit_archeologue', 'espion', 'hybride_trident', 'marchand', 'marchand_itinerant',
  'medecin_chirurgien', 'mercenaire', 'mineur', 'officier_naval_civil', 'officier_naval_militaire',
  'officier_militaire_souterrain', 'officier_militaire_surface', 'ouvrier_docker',
  'pilote_chasse_sous_marin', 'pilote_chasse_atmospherique', 'pirate', 'policier_enqueteur',
  'pretre_trident', 'prostitue', 'scientifique_ingenieur', 'soldat_milicien',
  'soldat_elite_commando_marin', 'soldat_elite_commando_souterrain', 'soldat_elite_commando_surface',
  'soldat_elite_forces_speciales', 'sous_marinier', 'technicien_mecanicien', 'techno_hybride',
  'veilleur', 'voleur_criminel',
]

function rowsFor(code) {
  const table = CAREER_RANDOM_EFFECTS_BY_CODE[code]
  return Object.entries(table).map(([roll, effects]) => ({ roll: Number(roll), effects }))
}

test('les 37 metiers (hors chasseur_primes, deja migre) ont une table complete 1-10', () => {
  assert.equal(ALL_CODES.length, 36)
  for (const code of ALL_CODES) {
    const table = CAREER_RANDOM_EFFECTS_BY_CODE[code]
    assert.ok(table, `table manquante pour ${code}`)
    for (let roll = 1; roll <= 10; roll++) {
      assert.ok(Array.isArray(table[roll]) || table[roll]?.type === 'choice', `roll ${roll} manquant pour ${code}`)
    }
  }
})

test('metiers a table partagee : meme reference, jamais une copie divergente', () => {
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.officier_naval_militaire, CAREER_RANDOM_EFFECTS_BY_CODE.officier_naval_civil)
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.officier_militaire_surface, CAREER_RANDOM_EFFECTS_BY_CODE.officier_militaire_souterrain)
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.pilote_chasse_atmospherique, CAREER_RANDOM_EFFECTS_BY_CODE.pilote_chasse_sous_marin)
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_souterrain, CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin)
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_surface, CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin)
  assert.equal(CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_forces_speciales, CAREER_RANDOM_EFFECTS_BY_CODE.soldat_elite_commando_marin)
})

test('chaque metier resout son resultat 1 (attribut) sans erreur', () => {
  for (const code of ALL_CODES) {
    const rows = rowsFor(code)
    const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 1 }], rows)
    assert.equal(Object.keys(totals.attributes).length, 1, `resultat 1 de ${code} devrait donner un seul attribut`)
  }
})

test('chaque metier resout son resultat 10 -> aucun effet (points_alt gere ailleurs)', () => {
  for (const code of ALL_CODES) {
    const rows = rowsFor(code)
    const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 10 }], rows)
    assert.deepEqual(totals.attributes, {})
    assert.equal(totals.celebrity, 0)
  }
})

test('Diplomate resultat 5 (reel) — choice refuse/accepte, effets reellement differents', () => {
  const rows = rowsFor('diplomate')
  const refuse = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5, choice: 0 }], rows)
  assert.equal(refuse.celebrity, 6)
  assert.equal(refuse.incomeMultiplier, 1)
  const accepte = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5, choice: 1 }], rows)
  assert.equal(accepte.celebrity, 0)
  assert.equal(accepte.incomeMultiplier, 2)
})

test('Erudit/Scientifique resultat 4 (reel) — choice Opposants vs Ennemi', () => {
  for (const code of ['erudit_archeologue', 'scientifique_ingenieur']) {
    const rows = rowsFor(code)
    const opposants = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 0 }], rows)
    assert.deepEqual(opposants.traits, [
      { trait_type: 'ally', op: 'gauge_delta', value: 1, note: null },
      { trait_type: 'opponent', op: 'gauge_delta', value: 3, note: null },
    ])
    const ennemi = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 1 }], rows)
    assert.deepEqual(ennemi.traits, [
      { trait_type: 'ally', op: 'gauge_delta', value: 1, note: null },
      { trait_type: 'enemy', op: 'gauge_delta', value: 1, note: null },
    ])
  }
})

test('Cultivateur/Eleveur resultat 4 (reel) — grant_mutation Empathie (mutation_id 13, pas une string)', () => {
  const rows = rowsFor('cultivateur_eleveur')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows)
  assert.deepEqual(totals.grantedMutations, [{ mutation_id: 13, subtype_id: null }])
})

test('Marchand itinerant resultat 4 (reel) — money_reward 1d100x500', () => {
  const rows = rowsFor('marchand_itinerant')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, moneyRoll: 42 }], rows)
  assert.equal(totals.moneyRewardSols, 42 * 500)
})

test('Pirate resultat 3 (reel, CORRIGE) — money_reward 1d10x100 + Celebrite +2 + Materiel +2', () => {
  const rows = rowsFor('pirate')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 3, moneyRoll: 7 }], rows)
  assert.equal(totals.moneyRewardSols, 7 * 100)
  assert.equal(totals.celebrity, 2)
  assert.equal(totals.categories['Matériel'], 2)
})

test('Pirate resultat 5 (reel) — celebrity_reward, Celebrite +6 comptee AVANT le multiplicateur', () => {
  const rows = rowsFor('pirate')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5 }], rows, 10 /* celebriteBefore */)
  assert.equal(totals.celebrity, 6)
  assert.equal(totals.celebrityRewardSols, (10 + 6) * 1000)
})

test('Pirate resultat 8 (reel, CORRIGE) — Transfert genetique, pas Groupe/Gang narratif', () => {
  const rows = rowsFor('pirate')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 8 }], rows)
  assert.equal(totals.celebrity, 6)
  assert.equal(totals.categories['Relations'], 4)
  assert.deepEqual(totals.traits, [{ trait_type: 'ally', op: 'gauge_delta', value: 2, note: null }])
})

test('Voleur/Criminel resultat 5 (reel) — celebrity_reward multiplier 500 (pas 1000, different de Pirate)', () => {
  const rows = rowsFor('voleur_criminel')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5 }], rows, 0)
  assert.equal(totals.celebrityRewardSols, 4 * 500)
})

test('Voleur/Criminel resultat 7 (reel, CORRIGE) — 16e cas income_multiplier_permanent non catalogue avant', () => {
  const rows = rowsFor('voleur_criminel')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 7 }], rows)
  assert.equal(totals.incomeMultiplierPermanent, 2)
  assert.equal(totals.incomeMultiplier, 1)
})

test('Pretre du Trident resultat 4 (reel) — add_skill FIXE (pas skill_choice), 2 competences precises', () => {
  const rows = rowsFor('pretre_trident')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4 }], rows)
  assert.deepEqual(totals.grantedSkills, ['ACROBATIE_EQUILIBRE', 'COMBAT_ARME'])
  assert.equal(totals.celebrity, 2)
})

test('Pretre du Trident resultats 5/6 (reel) — harmonises en income_multiplier_permanent sur la branche accepte', () => {
  const rows = rowsFor('pretre_trident')
  const accepte5 = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5, choice: 0 }], rows)
  assert.equal(accepte5.incomeMultiplierPermanent, 2)
  const refuse5 = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5, choice: 1 }], rows)
  assert.equal(refuse5.incomeMultiplier, 2)
  assert.equal(refuse5.incomeMultiplierPermanent, 1)
  const accepte6 = resolveCareerRandomEffects([{ blockIndex: 0, roll: 6, choice: 0 }], rows)
  assert.equal(accepte6.incomeMultiplierPermanent, 2)
})

test('Formation (skill_choice, reel) — Hybride du Trident resultat 8, pending puis resolu', () => {
  const rows = rowsFor('hybride_trident')
  const rolledRow = rows.find(r => r.roll === 8)
  assert.deepEqual(getPendingCareerPickStep(rolledRow, { blockIndex: 0, roll: 8 }), { type: 'skill_choice' })
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 8, chosenSkillId: 'NAVIGATION' }], rows)
  assert.deepEqual(totals.chosenSkills, ['NAVIGATION'])
})

test('Hybride du Trident resultat 4 (reel) — choice reel mais memes effets numeriques dans les deux options', () => {
  const rows = rowsFor('hybride_trident')
  const accepte = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 0 }], rows)
  const refuse = resolveCareerRandomEffects([{ blockIndex: 0, roll: 4, choice: 1 }], rows)
  assert.equal(accepte.incomeMultiplier, 2)
  assert.equal(refuse.incomeMultiplier, 2)
  assert.deepEqual(accepte.traits, refuse.traits)
})

test('Technicien/Mecanicien resultat 5 (reel) — effet a plat, aucun choice (decision Saar)', () => {
  const rows = rowsFor('technicien_mecanicien')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 5 }], rows)
  assert.equal(totals.categories['Atelier'], 2)
  assert.equal(totals.categories['Matériel'], 4)
  assert.equal(totals.celebrity, 3)
})

test('Assassin resultat 8 (reel) — Allie simple, pas de nouveau trait_type "fournisseur", aucune note (decision Saar : "juste un +1")', () => {
  const rows = rowsFor('assassin')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 8 }], rows)
  assert.deepEqual(totals.traits, [{ trait_type: 'ally', op: 'gauge_delta', value: 1, note: null }])
})

test('Barman/3 et Chasseur de primes/8 style (Groupe/Gang) — narratif seul, aucun effet chiffre', () => {
  const rows = rowsFor('barman')
  const totals = resolveCareerRandomEffects([{ blockIndex: 0, roll: 3 }], rows)
  assert.deepEqual(totals.traits, [])
  assert.equal(totals.celebrity, 0)
})

test('type d\'effet inconnu leve une erreur explicite (piege 1, verifie sur ces donnees reelles)', () => {
  const rows = rowsFor('artisan_artiste')
  const corrupted = rows.map(r => r.roll === 1 ? { ...r, effects: [{ type: 'ce_type_n_existe_pas' }] } : r)
  assert.throws(() => resolveCareerRandomEffects([{ blockIndex: 0, roll: 1 }], corrupted), /inconnu/)
})
