// server/src/services/gmArbitratedTestService.js
//
// Résolution d'un Test arbitré par le MJ (confirmation déjà obtenue → jet 1d20 + total compétence/
// attribut → critique → breakdown → DICE_RESULT → Catastrophe éventuelle) — extrait de
// `socketEntity.js` (ENTITY_ACTION_RESOLVE) le 2026-09-02 pour être réutilisé tel quel par
// CONNECTOR_ACTION_RESOLVE (docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md §7 point 4) : cette
// mécanique est 100% RAW générique (aucune dépendance à une entité), la dupliquer aurait reproduit le
// risque de divergence déjà vécu ailleurs dans le projet (collision PC28, dispatch drone —
// docs/ROADMAP.md §5). Extraction pure, aucun changement de comportement voulu — le corps est
// identique à l'original, seuls les champs qui variaient déjà d'un appelant à l'autre (le
// `DICE_RESULT.type`, le `site` transmis à la Catastrophe) sont devenus des paramètres.
//
// L'appelant reste seul responsable de : la confirmation MJ elle-même (refus, timeout, Map d'attente),
// et de l'effet de jeu appliqué en cas de succès (ex. `resolveEntityState` pour une entité, écrire
// l'état d'une porte pour un connecteur) — cette fonction ne fait que résoudre le Test et notifier,
// jamais l'effet métier qui en découle.

import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { getUserColor } from '../lib/socketUtils.js'
import { resolveTestOutcome, getCriticalSuccessBonus, applyCriticalSuccessBonus, applyCriticalFailReroll } from '../../../shared/polarisTestResolution.js'
import { calcSkillTotal, calcAttributeAN, calcAttributeNA, ATTR_LABELS } from '../lib/charStats.js'
import { calcActiveMalus } from '../lib/activeMalusRegistry.js'
import { getMutationEffects } from './mutationService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { WS } from '../../../shared/events.js'

// Issue d'un Test approuvé sans jet (bouton "Réussite auto" du MJ, ou compétence absente — S34-2) :
// même forme que l'issue d'un jet réel pour que l'appelant n'ait qu'un seul contrat à consommer.
const NO_ROLL_OUTCOME = Object.freeze({
  isSuccess: true,
  isCriticalSuccess: false,
  isCriticalFail: false,
  mr: null,
  catastropheRisk: false,
  chancesDeReussite: null,
  breakdown: null,
  rolled: false,
})

/**
 * @param {object} params
 * @param {import('socket.io').Server} params.io
 * @param {string} params.campaignId
 * @param {string} params.characterId
 * @param {string} params.playerUserId
 * @param {string} params.playerName
 * @param {string|null} params.skillId
 * @param {string|null} params.attributeId
 * @param {number} params.defaultDifficulty  Modificateur signé (positif = bonus, négatif = malus,
 *   ajouté directement au Seuil — pas une DC classique, cf. REGLE_MUTATION.md "Très difficile, -7").
 * @param {number} params.gmModifier
 * @param {boolean} params.autoSuccess       Le MJ approuve sans jet (bouton dédié).
 * @param {string} params.dicePayloadType    `DICE_RESULT.type` émis pour un jet réel (ex.
 *   'entity_action', 'connector_action') — consommé côté client pour router l'affichage/le nettoyage
 *   d'état en attente propre à chaque domaine.
 * @param {string} params.catastropheSite    `site` transmis à `maybeTriggerCatastrophe`.
 * @returns {Promise<object|null>} l'issue du Test (voir `NO_ROLL_OUTCOME` pour la forme), ou `null` si
 *   le calcul a échoué (déjà loggé ici) — dans ce cas l'appelant n'applique aucun effet, exactement
 *   comme le faisait l'original.
 */
export async function resolveGmArbitratedTest({
  io, campaignId, characterId, playerUserId, playerName,
  skillId, attributeId, defaultDifficulty, gmModifier, autoSuccess,
  dicePayloadType, catastropheSite,
}) {
  // ── Réussite automatique (sans jet) ───────────────────────────────
  if (autoSuccess) {
    const timestamp = new Date().toISOString()
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: playerUserId,
      username: playerName,
      color: '#5b8dee',
      formula: skillId,
      rolls: [],
      total: null,
      type: 'auto',
      isCriticalSuccess: false,
      isCriticalFail: false,
      timestamp,
    })
    return NO_ROLL_OUTCOME
  }

  // ── Compétence absente → succès automatique sans jet (S34-2) ────────────
  if (!skillId) {
    return NO_ROLL_OUTCOME
  }

  // ── Jet de dés (1d20 + total serveur vs Seuil) ───────────────────────
  try {
    const { rolls, total: diceRoll, seed } = await parseDice('1d20')

    let mechanicalTotal = 0
    let effectiveMalus = 0
    let formulaLabel = skillId || attributeId || '?'
    // Renseigné selon le type de Test (mutuellement exclusif, cf. branchement plus bas) — sert
    // uniquement à résoudre le bonus de Réussite critique RAW p.204 (docs/PLAN_TEST_CRITIQUE.md
    // Lot 2) via getCriticalSuccessBonus, jamais recalculé à la main ici.
    let masteryLevel, attributeANForBonus

    const sheet = characterId
      ? await db('char_sheet').where({ character_id: characterId }).first()
      : null

    if (sheet) {
      const [attrs, archetype, charSkillRow, refSkill, mutationEffects, settings] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheet.id }),
        db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
        skillId
          ? db('char_skills').where({ char_sheet_id: sheet.id, skill_id: skillId }).first()
          : Promise.resolve(null),
        skillId
          ? db('ref_skills').where({ id: skillId }).first()
          : Promise.resolve(null),
        getMutationEffects(sheet.id),
        getCampaignSettings(db, campaignId),
      ])

      const genotypeRow = archetype?.genotype_id
        ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
        : null

      if (skillId && refSkill) {
        mechanicalTotal = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow, mutationEffects)
        masteryLevel = charSkillRow?.mastery ?? 0
        formulaLabel = refSkill.label || skillId
      } else if (attributeId) {
        mechanicalTotal = calcAttributeAN(attrs, attributeId, genotypeRow, mutationEffects)
        attributeANForBonus = mechanicalTotal
        formulaLabel = ATTR_LABELS[attributeId] || attributeId
      }

      // ── Malus effectif (blessures + encombrement) ──────────────────────
      try {
        const wounds = await db('character_wounds').where({ char_sheet_id: sheet.id })

        // FOR nette = calcAttributeNA (base + pc_modifier + génotype + mutations), corrige PI4
        const forValue = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)

        const invItems = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': characterId })
          .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity')

        const totalWeight = invItems.reduce((sum, item) => {
          if (item.container === 'Coffre') return sum
          if (item.ref_weight == null) return sum
          return sum + item.ref_weight * item.quantity
        }, 0)

        // Registre de malus actifs (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4).
        effectiveMalus = calcActiveMalus({
          wounds, fatiguePoints: sheet.fatigue_points, totalWeight, forNA: forValue, settings,
        })

        if (effectiveMalus < 0) console.log(`[DBG] gmArbitratedTestService — malus actif ${effectiveMalus} pour character ${characterId}`)
      } catch (malusErr) {
        console.warn('[WS] gmArbitratedTestService — calcul malus échoué, fallback 0:', malusErr.message)
      }
    } else {
      console.warn(`[WS] gmArbitratedTestService — char_sheet introuvable pour character ${characterId}, fallback total=0`)
      if (skillId) formulaLabel = skillId
      else if (attributeId) formulaLabel = ATTR_LABELS[attributeId] || attributeId
    }

    const color = await getUserColor(db, playerUserId)

    const totalDiffMod = defaultDifficulty + gmModifier
    const chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus

    // Résolution RAW complète (p.201-205, docs/PLAN_TEST_CRITIQUE.md) — même moteur que les autres
    // Tests du projet, pas une variante locale.
    let outcome = applyCriticalSuccessBonus(
      resolveTestOutcome(diceRoll, chancesDeReussite),
      getCriticalSuccessBonus({ masteryLevel, attributeAN: attributeANForBonus }),
    )
    if (outcome.isCriticalFail) {
      const { total: reroll } = await parseDice('1d20')
      outcome = applyCriticalFailReroll(outcome, reroll)
    }
    const { isSuccess, isCriticalSuccess, isCriticalFail, mr, catastropheRisk } = outcome
    const diffLabel = totalDiffMod >= 0 ? `+${totalDiffMod}` : `${totalDiffMod}`

    const breakdown = [
      { label: formulaLabel, value: mechanicalTotal, type: 'base' },
      ...(defaultDifficulty !== 0 ? [{ label: 'Difficulté', value: defaultDifficulty, type: defaultDifficulty > 0 ? 'bonus' : 'malus' }] : []),
      ...(gmModifier !== 0 ? [{ label: 'Modificateur GM', value: gmModifier, type: gmModifier > 0 ? 'bonus' : 'malus' }] : []),
      ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]

    const timestamp = new Date().toISOString()
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: playerUserId,
      username: playerName,
      color,
      formula: formulaLabel,
      rolls,
      total: diceRoll,
      type: dicePayloadType,
      isCriticalSuccess,
      isCriticalFail,
      catastropheRisk,
      seed,
      timestamp,
      skillLabel: formulaLabel,
      mechanicalTotal,
      chancesDeReussite,
      effectiveMalus,
      diffLabel,
      isSuccess,
      mr,
      breakdown,
    })

    // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1) — maybeTriggerCatastrophe
    // applique lui-même la garde combat actif : aucun effet hors combat, garde jamais dupliquée ici.
    const actorTokenForCatastrophe = await db('tokens').where({ character_id: characterId }).first()
    if (actorTokenForCatastrophe) {
      await maybeTriggerCatastrophe(io, campaignId, actorTokenForCatastrophe.id, catastropheRisk, {
        site: catastropheSite, actorTokenId: actorTokenForCatastrophe.id, targetTokenId: null,
      })
    }

    return { isSuccess, isCriticalSuccess, isCriticalFail, mr, catastropheRisk, chancesDeReussite, breakdown, rolled: true }
  } catch (err) {
    console.error('[WS] gmArbitratedTestService — dice error:', err.message)
    return null
  }
}
