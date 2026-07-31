// server/src/lib/coldExposureService.js — Froid (docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5,
// RAW FATIGUE&DOMMAGES.md:127-189). Consommateur du moteur générique d'échéances (Lot 2) en patron
// automatique (`interactive:false`) — deux échéances indépendantes par personnage exposé,
// `cold_fatigue_check` (toutes tranches) et `cold_damage_tick` (Glacial et en dessous uniquement),
// jamais de jauge/table dédiée : `game_echeances.payload` porte tout l'état de replanification.
//
// [Trouvé en codant, absent des 4 passes de cadrage] `resolveTargetHit`/`woundService.applyWound`
// émet `WOUND_ADDED` de façon synchrone et inconditionnelle dès qu'il est appelé (woundService.js:38)
// — impossible à appeler depuis l'intérieur du savepoint de sweepDueEcheances sans émettre avant que
// la transaction englobante (adjustGameTime) n'ait committé. Plutôt que de tisser `io` à travers tout
// le moteur d'échéances (adjustGameTime → performTimeAdjustment → sweepDueEcheances →
// resolveEcheanceHandler → handler, un changement de signature partagé disproportionné pour ce Lot),
// `coldDamageTickHandler` ne fait QUE calculer quelles Localisations toucher avec quelle formule de
// dés et le retourne via `effects` — `applyColdDamageHits` (ci-dessous) fait le jet + l'application
// réelle (resolveTargetHit) après le commit, appelée par la route qui a `io`. Même séparation que
// `performFatigueTest` (calcul, pas de transaction propre) / `resolveFatigueTest` (transaction + WS).
import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { getCampaignSettings } from './campaignSettingsService.js'
import { performFatigueTest } from './fatigueService.js'
import { resolveCharacterTokens, applyModStatus, clearModStatus, applyStunWithDuration } from './statusService.js'
import { resolveTargetHit } from './damageService.js'
import { getMutationEffects } from '../services/mutationService.js'
import { calcAttributeNA } from './charStats.js'
import { parseDice } from './diceParser.js'
import { createEcheance } from './echeanceService.js'
import { WS } from '../../../shared/events.js'
import { computeColdIntervalMinutes, isValidColdExposureInput } from '../../../shared/coldExposureConstants.js'

const COLD_CONDITION_TYPES = ['cold_fatigue_check', 'cold_damage_tick']
const LIMB_SLOTS = ['BD', 'BG', 'JD', 'JG']

// declareColdExposure — idempotent (docs/PLAN_FATIGUE_DOMMAGES.md §11, "Contrat declareColdExposure")
// : un appel alors qu'une exposition est déjà active annule et recrée à la nouvelle tranche, plutôt
// qu'une route/fonction séparée pour "changer de tranche". Ne dépend pas de `fatigue_enabled`
// (décision Saar 2026-07-31) — seul l'effet de Fatigue s'efface si désactivé, voir
// coldFatigueCheckHandler ci-dessous, le reste (dégâts physiques Glacial+) est indépendant.
export async function declareColdExposure(io, campaignId, characterId, { tier, extremeSteps = 0, wet = false }) {
  if (!isValidColdExposureInput({ tier, extremeSteps, wet })) {
    throw new AppError(400, `Exposition au froid invalide (tier:${tier}, extremeSteps:${extremeSteps}, wet:${wet})`)
  }

  await db.transaction(async (trx) => {
    // Verrou pour la durée de l'opération cancel+create — un double-clic MJ (ou deux onglets) ne doit
    // jamais créer deux cold_fatigue_check actifs simultanés pour le même personnage (passe 3 point 4,
    // aucune contrainte unique en base sur (character_id, condition_type, status)).
    const sheet = await trx('char_sheet').where({ character_id: characterId }).forUpdate().first()
    if (!sheet) throw new AppError(404, 'Fiche de personnage introuvable')

    await trx('game_echeances')
      .where({ character_id: characterId, status: 'active' })
      .whereIn('condition_type', COLD_CONDITION_TYPES)
      .update({ status: 'cancelled', updated_at: trx.fn.now() })

    const campaign = await trx('campaigns').where({ id: campaignId }).select('game_time_resolved_minutes').first()
    if (!campaign) throw new AppError(404, 'Campaign not found')
    const now = campaign.game_time_resolved_minutes

    const payload = { tier, extremeSteps, wet }
    const testInterval = computeColdIntervalMinutes(payload, 'test')
    await createEcheance(trx, {
      campaignId, characterId, conditionType: 'cold_fatigue_check',
      payload,
      nextDueMinutes: now + testInterval,
      intervalMinutes: testInterval,
      occurrencesRemaining: null,
    })

    if (tier === 'glacial') {
      const damageInterval = computeColdIntervalMinutes(payload, 'damage')
      await createEcheance(trx, {
        campaignId, characterId, conditionType: 'cold_damage_tick',
        payload: { ...payload, hoursElapsed: 0 },
        nextDueMinutes: now + damageInterval,
        intervalMinutes: damageInterval,
        occurrencesRemaining: null,
      })
    }
  })

  // Badge après commit (patron resolveFatigueTest→applyStunWithDuration : jamais de 2e transaction
  // imbriquée dans la première) — purement cosmétique, aucune donnée mécanique dedans (passe 2 point
  // 2 : la tranche réelle ne vit que dans game_echeances, jamais dupliquée côté token).
  const tokenIds = await resolveCharacterTokens(db, campaignId, characterId)
  for (const tokenId of tokenIds) {
    await applyModStatus(io, db, campaignId, tokenId, 'hypothermia', { expiresAtTurn: null, data: null })
  }
}

// clearColdExposure — retrait manuel MJ. `status:'cancelled'`, pas `'completed'` (passe 3 point 5 —
// cette dernière valeur signifie déjà "le handler a fini naturellement").
export async function clearColdExposure(io, campaignId, characterId) {
  await db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ character_id: characterId }).forUpdate().first()
    if (!sheet) throw new AppError(404, 'Fiche de personnage introuvable')

    await trx('game_echeances')
      .where({ character_id: characterId, status: 'active' })
      .whereIn('condition_type', COLD_CONDITION_TYPES)
      .update({ status: 'cancelled', updated_at: trx.fn.now() })
  })

  const tokenIds = await resolveCharacterTokens(db, campaignId, characterId)
  for (const tokenId of tokenIds) {
    await clearModStatus(io, db, campaignId, tokenId, 'hypothermia')
  }
}

// getColdExposureState — lecture seule (passe 2 point 3), alimente le pré-remplissage du
// sous-formulaire de TokenStatusPanel.jsx. `cold_fatigue_check` existe toujours si une exposition est
// active (cold_damage_tick est conditionnel à Glacial+) — l'un ou l'autre suffit à retrouver
// tier/extremeSteps/wet, tous deux partagent le même payload de base posé à la déclaration.
export async function getColdExposureState(characterId) {
  const echeance = await db('game_echeances')
    .where({ character_id: characterId, status: 'active' })
    .whereIn('condition_type', COLD_CONDITION_TYPES)
    .orderBy('created_at', 'asc')
    .first()
  if (!echeance) return null
  const { tier, extremeSteps, wet } = echeance.payload
  return { tier, extremeSteps, wet }
}

// coldFatigueCheckHandler — patron automatique (interactive:false), enregistré dans
// echeanceHandlerRegistrations.js. Ne bloque jamais sur fatigue_enabled=false (décision Saar
// 2026-07-31) — tick neutre, replanifie à la même cadence sans toucher fatigue_points.
export async function coldFatigueCheckHandler(trx, echeance) {
  const settings = await getCampaignSettings(trx, echeance.campaign_id)
  if (!settings.fatigue_enabled) {
    return {
      resolved: true,
      effects: null,
      reschedule: { intervalMinutes: echeance.interval_minutes, occurrencesRemaining: null },
    }
  }

  const { result, pendingStun } = await performFatigueTest(trx, echeance.campaign_id, echeance.character_id, {
    source: 'CON', mjModifier: 0,
  })

  return {
    resolved: true,
    effects: { kind: 'fatigueTestResult', payload: result, applyStun: pendingStun },
    reschedule: { intervalMinutes: echeance.interval_minutes, occurrencesRemaining: null },
  }
}

// coldDamageTickHandler — Glacial et en dessous uniquement (créée conditionnellement par
// declareColdExposure). RAW p.244 : Bras+Jambes touchés dès la 1re heure (1D10, +1D10/heure
// supplémentaire), Corps+Tête s'y ajoutent à partir de la 2e heure avec leur propre progression
// (1D10 à leur 1re heure, soit hoursElapsed-1). `hoursElapsed` persisté directement dans `payload`
// (le reschedule générique de l'engine ne touche que next_due_minutes/interval_minutes/
// occurrences_remaining/status, jamais payload — voir echeanceService.js) ; l'undoEntry de ce
// changement est déjà couvert par l'engine (il snapshote toute la ligne AVANT l'appel handler, voir
// resolveEcheanceHandler). Ne calcule QUE les formules à jouer — le jet + l'application réelle
// (resolveTargetHit) attendent le commit, voir applyColdDamageHits ci-dessous.
// Aucune vérification d'existence du personnage ici : `game_echeances.character_id` référence
// `characters` en `onDelete('CASCADE')` (migration 221) — un personnage supprimé emporte déjà cette
// échéance avec lui, ce handler ne peut jamais être invoqué pour un personnage disparu.
export async function coldDamageTickHandler(trx, echeance) {
  const hoursElapsed = (echeance.payload.hoursElapsed ?? 0) + 1
  const bodyDice = hoursElapsed - 1 // 0 tant que hoursElapsed===1 : Corps/Tête pas encore touchés

  await trx('game_echeances').where({ id: echeance.id })
    .update({ payload: { ...echeance.payload, hoursElapsed } })

  const hitSpecs = LIMB_SLOTS.map((forcedSlotCode) => ({ forcedSlotCode, formula: `${hoursElapsed}d10` }))
  if (bodyDice > 0) {
    hitSpecs.push({ forcedSlotCode: 'T', formula: `${bodyDice}d10` })
    hitSpecs.push({ forcedSlotCode: 'C', formula: `${bodyDice}d10` })
  }

  return {
    resolved: true,
    effects: { kind: 'coldDamageHits', characterId: echeance.character_id, campaignId: echeance.campaign_id, hitSpecs },
    reschedule: { intervalMinutes: echeance.interval_minutes, occurrencesRemaining: null },
  }
}

// applyColdDamageHits — appelée par la route après le commit de la transaction d'ajustement
// d'horloge (jamais depuis le handler lui-même, voir note d'en-tête). Même fetch de contexte
// (attrs/archetype/mutations → NA) et même patron d'émission COMBAT_ATTACK_RESULT que
// resolveEnvironmentalHazardTicks (Lot 3, environmentalHazardService.js) — tireurId null (dégât
// automatique), isPnj:true réutilisé pour son effet pratique (montré MJ + joueur ciblé), pas pour son
// sens littéral.
//
// [Bug trouvé par Saar en testant] `hit.shockResult` ne doit JAMAIS rester un simple champ d'affichage
// ici. Le seul mécanisme existant pour résoudre un Choc issu de COMBAT_ATTACK_RESULT est une fenêtre
// interactive côté client (CombatOverlay.jsx, "Stun Dialog"), qui n'existe que si la fenêtre de combat
// est montée ET ne garde qu'un seul dialogue à la fois — le froid n'est pas un mécanisme de combat
// (aucune garantie qu'une fenêtre de combat soit ouverte), et peut toucher plusieurs personnages en un
// seul balayage. Corrigé en appliquant le Choc automatiquement, exactement comme `performFatigueTest`
// le fait déjà pour son propre remplacement de Test au palier 5 (roll 1D6, ×10 si inconscient, aucune
// fenêtre, aucune dépendance au combat).
export async function applyColdDamageHits(io, campaignId, characterId, hitSpecs) {
  const character = await db('characters').where({ id: characterId }).first()
  const sheet = character ? await db('char_sheet').where({ character_id: characterId }).first() : null
  if (!character || !sheet) return

  const [attrs, archetype, mutationEffects] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  const for_na_cible = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)
  const con_na_cible = calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects)
  const vol_na_cible = calcAttributeNA(attrs, 'VOL', genotypeRow, mutationEffects)

  // Un seul token représentatif pour cibleId (contrat COMBAT_ATTACK_RESULT — CombatOverlay.jsx
  // résout cibleId contre la liste des tokens, jamais un characterId) — absent si le personnage n'a
  // aucun token placé : la Blessure/WOUND_ADDED s'applique quand même via resolveTargetHit, seul
  // l'affichage combat de ce coup précis est silencieux.
  const tokenIds = await resolveCharacterTokens(db, campaignId, characterId)
  const cibleId = tokenIds[0] ?? null

  for (const { forcedSlotCode, formula } of hitSpecs) {
    const degatsRoll = await parseDice(formula)
    const hit = await resolveTargetHit(io, db, campaignId, {
      degautsBruts: degatsRoll.total,
      characterIdCible: character.id,
      cibleType: character.type,
      char_sheet_id_cible: sheet.id,
      for_na_cible, con_na_cible, vol_na_cible,
      forcedSlotCode,
    })
    if (!hit) continue

    // Choc auto-résolu — jamais via le Stun Dialog combat (voir note d'en-tête). Même formule que
    // performFatigueTest : 1D6 tours, ×10 si inconscient ; current_turn peut être null hors combat
    // (trou structurel 8, déjà accepté pour la Fatigue).
    if (hit.shockResult && hit.shockResult.outcome !== 'ok') {
      const combatState = await db('combat_state').where({ campaign_id: campaignId }).first()
      const currentTurn = combatState?.current_turn ?? null
      const { total: durationRoll } = await parseDice('1d6')
      const stunDuration = hit.shockResult.outcome === 'inconscient' ? durationRoll * 10 : durationRoll
      for (const stunTokenId of tokenIds) {
        await applyStunWithDuration(io, db, campaignId, stunTokenId, hit.shockResult.outcome, stunDuration, currentTurn)
      }
    }

    if (cibleId) {
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: null,
        sourceCode: 'hypothermia',
        cibleId,
        localisation: hit.localisation,
        degautsBruts: degatsRoll.total,
        degatsNets: hit.degatsNets,
        severity: hit.finalSeverity,
        is_lethal: hit.is_lethal,
        isSuccess: true,
        isPnj: true,
        shockResult: hit.shockResult,
      })
    }
  }
}
