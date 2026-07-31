// server/src/lib/fatigueService.js — Test de Fatigue (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4,
// RAW FATIGUE&DOMMAGES.md:934-1017 + Annexe p.250). Résolution immédiate, pas un consommateur du
// Lot 2 (pas de réponse différée à travers plusieurs jours réels) — même famille que la Chute
// (fallDamageService.js), déclarée et résolue dans le même geste MJ.
import db from '../db/knex.js'
import { parseDice } from './diceParser.js'
import { calcAttributeNA, calcSkillTotal } from './charStats.js'
import { calcActiveMalus } from './activeMalusRegistry.js'
import { resolvePolarisTest } from './polarisTestService.js'
import { applyStunWithDuration, resolveCharacterTokens } from './statusService.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { AppError } from './AppError.js'
import { WS } from '../../../shared/events.js'
import {
  MAX_FATIGUE_POINTS, getFatiguePalier, getFatigueTestMalus,
} from '../../../shared/fatigueConstants.js'

const FATIGUE_TEST_SOURCES = ['CON', 'VOL', 'ENDURANCE', 'MOYENNE']

// setFatiguePoints — mutateur unique (point d'entrée partagé par les Lots 5/7/8/9/10 à venir).
// Suppose `char_sheet` déjà verrouillé (.forUpdate()) par l'appelant dans la même transaction —
// jamais de lire-puis-écrire hors verrou (trou structurel 2, même classe déjà corrigée pour
// adjustGameTime, Lot 1, et pending_advance_undo_log, Lot 2).
export async function setFatiguePoints(trx, characterId, points) {
  const clamped = Math.max(0, Math.min(MAX_FATIGUE_POINTS, Math.round(points)))
  await trx('char_sheet').where({ character_id: characterId }).update({ fatigue_points: clamped })
  return clamped
}

// Fetch combiné identique au patron déjà établi (fallDamageService.js:resolveFall) : un seul
// Promise.all pour attrs/archetype/mutationEffects (+ char_skills/ref_skills si source ENDURANCE),
// plus wounds/char_inventory nécessaires à calcActiveMalus (trou structurel 4 — le Test de Fatigue
// lui-même reste soumis au malus de blessure/encombrement, RAW n'exempte que le malus de palier de
// Fatigue, jamais les autres).
async function fetchFatigueTestContext(trx, characterId, charSheetId, source) {
  const [attrs, archetype, mutationEffects, wounds, invItems] = await Promise.all([
    trx('char_attributes').where({ char_sheet_id: charSheetId }),
    trx('char_archetype').where({ char_sheet_id: charSheetId }).first(),
    getMutationEffects(charSheetId),
    trx('character_wounds').where({ char_sheet_id: charSheetId }),
    trx('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity'),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await trx('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null

  let sourceValue
  if (source === 'ENDURANCE') {
    const [refSkill, charSkill] = await Promise.all([
      trx('ref_skills').where({ id: 'ENDURANCE' }).first(),
      trx('char_skills').where({ char_sheet_id: charSheetId, skill_id: 'ENDURANCE' }).first(),
    ])
    sourceValue = refSkill ? calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects) : 0
  } else if (source === 'MOYENNE') {
    const con = calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects)
    const vol = calcAttributeNA(attrs, 'VOL', genotypeRow, mutationEffects)
    sourceValue = Math.round((con + vol) / 2)
  } else {
    sourceValue = calcAttributeNA(attrs, source, genotypeRow, mutationEffects)
  }

  const totalWeight = invItems.reduce((sum, i) =>
    (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
  )
  const forNA = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)

  return { sourceValue, wounds, totalWeight, forNA }
}

// performFatigueTest — RAW p.243, table de résultat complète (docs/PLAN_FATIGUE_DOMMAGES.md §10) :
// - Échec, pas de risque de Catastrophe → palier +1, case 0 du nouveau palier.
// - Catastrophe (catastropheRisk, marge ≤ -15 — PAS isCriticalFail/jet=20, deux concepts RAW
//   distincts, vérifié contre shared/polarisTestResolution.js) → palier +1, case 1. Appliqué
//   automatiquement (tranché Saar 2026-07-30) — le chapitre Fatigue ne prévoit aucune option MJ ici,
//   contrairement à l'usage cosmétique de catastropheRisk partout ailleurs dans le projet.
// - Réussite, marge < 15 → case +1 (plafonnée au palier courant).
// - Réussite, marge >= 15 (« second souffle ») → case -1 (plancher case 0 du palier courant,
//   [HYPOTHÈSE] documentée §10 — RAW ambigu sur un franchissement de palier par ce chemin).
// - Palier 5 (« À bout de force ») : Test remplacé par un Test de Résistance au Choc (même source,
//   malus de case = table Choc) — échec → Évanoui (1D6 min), Catastrophe → Inconscient (même
//   formule ×10 que le Choc de blessure), réussite → case +1 quand même.
//
// Cœur de calcul, sans transaction propre ni émission WS (docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5,
// Trou B). `resolveFatigueTest` ouvrait sa propre transaction et émettait lui-même le WS —
// inutilisable tel quel depuis un handler d'échéance (`cold_fatigue_check`, Froid) qui tourne déjà
// dans un savepoint du balayage de `sweepDueEcheances` : une 2e transaction sur une connexion séparée
// risquerait un deadlock sur le verrou `char_sheet` que le savepoint englobant tient déjà. Extrait
// pour être réutilisé par les deux : `resolveFatigueTest` (ouvre sa transaction, appelle ce cœur, émet
// après commit — comportement inchangé pour ses appelants actuels) et `coldFatigueCheckHandler`
// (reçoit le trx du balayage, retourne le résultat via `effects` pour émission différée par
// l'appelant, voir echeanceService.js/gameTimeService.js).
export async function performFatigueTest(trx, campaignId, characterId, { source, mjModifier = 0 }) {
  if (!FATIGUE_TEST_SOURCES.includes(source)) {
    throw new AppError(400, `resolveFatigueTest : source invalide (${source})`)
  }

  const settings = await getCampaignSettings(trx, campaignId)
  if (!settings.fatigue_enabled) {
    throw new AppError(400, 'La Fatigue est désactivée sur cette campagne')
  }

  // Verrou avant toute lecture de fatigue_points (trou structurel 2) — même patron que
  // tradeService.js:190.
  const sheet = await trx('char_sheet').where({ character_id: characterId }).forUpdate().first()
  if (!sheet) throw new AppError(404, 'Fiche de personnage introuvable')

  const currentPoints = sheet.fatigue_points ?? 0
  const palier = getFatiguePalier(currentPoints)
  const isChocReplacement = palier === 5

  const ctx = await fetchFatigueTestContext(trx, characterId, sheet.id, source)

  // exclude: ['fatigue'] — auto-exemption RAW du malus de palier de Fatigue sur son propre Test
  // (ligne 976-979), blessure/encombrement restent appliqués (rien ne les exempte).
  const activeMalus = calcActiveMalus(
    { wounds: ctx.wounds, totalWeight: ctx.totalWeight, forNA: ctx.forNA, settings, fatiguePoints: currentPoints },
    { exclude: ['fatigue'] }
  )
  const testMalus = getFatigueTestMalus(currentPoints)
  const seuil = ctx.sourceValue + activeMalus + testMalus + Number(mjModifier)
  const outcome = await resolvePolarisTest(seuil)

  let newPoints = currentPoints
  let statusOutcome = null

  if (isChocReplacement) {
    if (!outcome.isSuccess) {
      statusOutcome = outcome.catastropheRisk ? 'inconscient' : 'evanoui'
    } else {
      newPoints = Math.min(MAX_FATIGUE_POINTS, currentPoints + 1)
    }
  } else if (outcome.catastropheRisk) {
    newPoints = (palier + 1) * 3 + 1
  } else if (!outcome.isSuccess) {
    newPoints = (palier + 1) * 3
  } else if (outcome.mr >= 15) {
    newPoints = Math.max(palier * 3, currentPoints - 1)
  } else {
    newPoints = Math.min(palier * 3 + 2, currentPoints + 1)
  }

  await setFatiguePoints(trx, characterId, newPoints)

  let pendingStun = null
  if (statusOutcome) {
    // Statut Choc — trou structurel 8 : hors combat, current_turn ne progresse jamais (confirmé
    // Saar : comportement voulu, badge sans expiration hors combat, retrait manuel MJ).
    const combatState = await trx('combat_state').where({ campaign_id: campaignId }).first()
    const currentTurn = combatState?.current_turn ?? null
    const { total: durationRoll } = await parseDice('1d6')
    const stunDuration = statusOutcome === 'inconscient' ? durationRoll * 10 : durationRoll
    const statusCode = statusOutcome === 'inconscient' ? 'unconscious' : 'evanoui'
    const tokenIds = await resolveCharacterTokens(trx, campaignId, characterId)
    pendingStun = { tokenIds, statusOutcome, statusCode, stunDuration, currentTurn }
  }

  const result = {
    characterId, source, seuil, mjModifier: Number(mjModifier),
    roll: outcome.roll, mr: outcome.mr,
    isSuccess: outcome.isSuccess, catastropheRisk: outcome.catastropheRisk,
    previousPoints: currentPoints, newPoints,
    statusOutcome,
  }

  return { result, pendingStun }
}

export async function resolveFatigueTest(io, campaignId, { characterId, source, mjModifier = 0 }) {
  let result
  let pendingStun

  await db.transaction(async (trx) => {
    ({ result, pendingStun } = await performFatigueTest(trx, campaignId, characterId, { source, mjModifier }))
  })

  // applyStunWithDuration gère sa propre transaction interne (patron déjà établi ailleurs) —
  // jamais imbriquer une 2e transaction knex dans la première, appelée après commit.
  if (pendingStun) {
    for (const tokenId of pendingStun.tokenIds) {
      await applyStunWithDuration(
        io, db, campaignId, tokenId, pendingStun.statusOutcome, pendingStun.stunDuration,
        pendingStun.currentTurn, { statusCode: pendingStun.statusCode }
      )
    }
  }

  io.to(campaignId).emit(WS.FATIGUE_TEST_RESULT, result)
  return result
}

// restFatigue — action MJ manuelle (docs/PLAN_FATIGUE_DOMMAGES.md §10, décision §4.2 : narratif/
// manuel, pas un balayage automatique du Lot 2). `full: true` → palier -1, case 0 du palier
// inférieur (symétrique de la montée par échec). `full: false` → case -= caseDelta (repos partiel,
// RAW ligne 1015-1017), jamais de changement de palier.
export async function restFatigue(io, campaignId, characterId, { full = true, caseDelta = 1 } = {}) {
  let result
  await db.transaction(async (trx) => {
    const settings = await getCampaignSettings(trx, campaignId)
    if (!settings.fatigue_enabled) {
      throw new AppError(400, 'La Fatigue est désactivée sur cette campagne')
    }

    const sheet = await trx('char_sheet').where({ character_id: characterId }).forUpdate().first()
    if (!sheet) throw new AppError(404, 'Fiche de personnage introuvable')

    const currentPoints = sheet.fatigue_points ?? 0
    const palier = getFatiguePalier(currentPoints)

    const newPoints = full
      ? Math.max(0, (palier - 1) * 3)
      : Math.max(palier * 3, currentPoints - Math.abs(caseDelta))

    await setFatiguePoints(trx, characterId, newPoints)
    result = { characterId, full, previousPoints: currentPoints, newPoints }
  })

  io.to(campaignId).emit(WS.FATIGUE_TEST_RESULT, { ...result, isRest: true })
  return result
}
