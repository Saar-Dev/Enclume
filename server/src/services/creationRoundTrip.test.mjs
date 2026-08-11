// creationRoundTrip.test.mjs — Garde-fou round-trip Wizard (2026-08-11, question Saar sur
// l'architecture après les bugs #1/#3/#4/#5 de docs/BUG WIZARD.md).
//
// Invariant protégé : ce que getStepNState(sheetId) reconstruit après un reconcile doit être
// exactement ce qu'un second reconcile avec CE MÊME contenu (renvoyé tel quel, comme le font
// openPeek/handleTerminate côté client, WizardCreation.jsx) redonnerait à nouveau. Si getStepNState
// omet ou déforme un champ, soit ce champ disparaît silencieusement (mutationsMeta/advantagesMeta —
// Récap Étape 7), soit — pire — sa réinjection corrompt des données déjà correctes en base
// (skillAllocations vide → char_skills effacé, bug #3 ; age final réinjecté comme base → cumul,
// bug #5). Ce test ne remplace pas un scénario navigateur réel, mais aurait détecté chacun des
// bugs #1/#3/#4/#5 ainsi que les 4 champs trouvés lors de l'audit qui a suivi (mutationsMeta,
// advantagesMeta, pcNet, finalAge) avant qu'un beta-testeur ne les remonte.
//
// Lancement manuel : node --env-file=../.env --test server/src/services/creationRoundTrip.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  startCreation, reconcileCreation,
  getStep1State, getStep2State, getStep3State, getStep4State, getStep5State,
} from './creationService.js'

const skip = !process.env.DATABASE_URL

// IDs de référence stables (métier, pas de dépendance à un id auto-incrémenté fragile) — vérifiés
// contre la base de dev au moment de l'écriture. « Marchand » : aucun prérequis, aucun génotype/
// attribut minimum requis (ref_career_prerequisites vide, min_* tous NULL) — carrière universellement
// éligible, aucune dépendance à construire côté personnage pour ce test.
const MARCHAND_CAREER_ID = 'a8ac107b-c12e-426c-9e2a-1f162b3b3142'
const MARCHAND_SKILL_ID = 'ELOQUENCE_PERSUASION'
// Organe sensoriel manquant (hearing) — cost_pc négatif depuis le fix du bug #2 (docs/BUG WIZARD.md) :
// choisie ici volontairement pour vérifier que le round-trip reste correct pour une mutation
// désavantageuse achetée délibérément, pas seulement le cas positif.
const MUTATION_OREILLE_MANQUANTE_ID = 21

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `rt-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'rt-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: gm.id, name: 'Campagne test round-trip Wizard', invite_code: `RT-${Date.now()}-${Math.random()}`,
      // revers:false — évite le tirage de Revers obligatoire (hors périmètre de ce garde-fou,
      // testé par ailleurs via la validation serveur elle-même).
      settings: { revers: false },
    })
    .returning('*')
  await db('campaign_members').insert({ campaign_id: campaign.id, user_id: gm.id, role: 'gm' })
  const { sheetId } = await startCreation(campaign.id, gm.id)
  return { gm, campaign, sheetId }
}

async function cleanup({ campaign, gm }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
}

function buildPayloads() {
  return {
    step1: {
      charName: 'Test RoundTrip', playerName: '', pcSpent: 0, isFeminin: false,
      attributes: { FOR: 7, CON: 7, COO: 7, ADA: 7, PER: 7, INT: 7, VOL: 7, PRE: 7 },
    },
    step2: { genotypeId: 'HUMAIN', isDeserter: false },
    step3: {
      method: 'chosen',
      mutations: [{ mutation_id: MUTATION_OREILLE_MANQUANTE_ID, subtype_id: null }],
      pcSpent: -2,
    },
    step4: {
      age: 20, originGeo: 'petite_station', originSoc: 'milieu_ouvrier', training: 'apprentissage_technique',
      higherEd: null,
      careers: [{ career_id: MARCHAND_CAREER_ID, years: 1, proAdvantages: {}, randomPicks: [], setbacks: [] }],
      // Non vide volontairement (bug #3) : {} → {} serait trivialement identique au round-trip même
      // si la reconstruction était cassée, et ne garderait donc rien contre une régression.
      skillAllocations: { [MARCHAND_SKILL_ID]: 1 },
      openedSkills: [MARCHAND_SKILL_ID],
      autodidacteAllocations: {}, setbackRolls: [], pcSpent: 1,
    },
    // adv_002 Ambidextre (avantage, 1 PC) + adv_055 Froussard (désavantage, rapporte 1 PC) — un de
    // chaque type, pour couvrir les deux branches de pcNet et d'advantagesMeta.
    step5: { advantages: ['adv_002', 'adv_055'] },
  }
}

async function readAllSteps(sheetId) {
  return {
    step1: await getStep1State(sheetId),
    step2: await getStep2State(sheetId),
    step3: await getStep3State(sheetId),
    step4: await getStep4State(sheetId),
    step5: await getStep5State(sheetId),
  }
}

test('round-trip Wizard : getStepNState après reconcile est fidèle et idempotent', { skip }, async () => {
  const fixture = await createFixture()
  try {
    const { sheetId } = fixture
    await reconcileCreation(sheetId, buildPayloads(), false)
    const snapshotA = await readAllSteps(sheetId)

    // Simule exactement ce que openPeek/handleTerminate font côté client (WizardCreation.jsx) :
    // renvoyer tel quel le contenu du store, lui-même alimenté par l'écho WIZARD_STATE_SYNC —
    // c'est-à-dire précisément la sortie de getStepNState, jamais un payload reconstruit à la main.
    await reconcileCreation(sheetId, snapshotA, false)
    const snapshotB = await readAllSteps(sheetId)

    assert.deepEqual(
      snapshotB, snapshotA,
      'un second reconcile avec exactement ce que getStepNState a produit ne doit rien changer (round-trip idempotent)'
    )

    // Gardes explicites — plus lisibles qu'un diff générique si l'un de ces bugs régresse un jour.
    const skillRows = await db('char_skills').where({ char_sheet_id: sheetId, skill_id: MARCHAND_SKILL_ID })
    assert.equal(skillRows.length, 1, 'bug #3 : la compétence allouée ne doit pas être effacée par le round-trip')
    assert.equal(skillRows[0].mastery, 1, 'bug #3 : le niveau alloué doit survivre au round-trip')

    assert.equal(snapshotA.step3.method, 'chosen')
    assert.equal(snapshotA.step3.mutationsMeta.length, 1, 'audit 2026-08-11 : mutationsMeta doit survivre au round-trip')
    assert.equal(snapshotA.step3.mutationsMeta[0].name, 'Organe sensoriel manquant')
    assert.equal(snapshotA.step3.mutationsMeta[0].subtype, 'hearing')

    assert.equal(snapshotA.step4.age, 20, 'bug #5 : age doit rester l\'âge de BASE, jamais cumuler au round-trip')
    assert.equal(snapshotA.step4.finalAge, 21, 'audit 2026-08-11 : finalAge doit être exposé (20 + 1 an de carrière)')

    assert.equal(snapshotA.step5.advantagesMeta.length, 2, 'audit 2026-08-11 : advantagesMeta doit survivre au round-trip')
    assert.equal(snapshotA.step5.pcNet, 0, 'audit 2026-08-11 : pcNet = 1 (Froussard) - 1 (Ambidextre) = 0')

    // Rejoue une 3e fois pour vérifier que l'idempotence n'est pas un artefact du premier écart
    // corrigé au 2e passage (le round-trip doit être un point fixe, pas juste converger une fois).
    await reconcileCreation(sheetId, snapshotB, false)
    const snapshotC = await readAllSteps(sheetId)
    assert.deepEqual(snapshotC, snapshotB, 'le round-trip doit être un point fixe stable, pas seulement converger une fois')
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
