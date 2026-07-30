import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { resolvePolarisTest } from '../lib/polarisTestService.js'
import { getUserColor } from '../lib/socketUtils.js'
import { calcSkillTotal, calcAttributeNA } from '../lib/charStats.js'
import {
  calcREA, getAdvantageModForAttr, getAdvantageModForResistance, getMutationModForResistance,
  calcSeuils, calcSouffle, calcResistanceDroguesInput, calcResistanceNaturelle, calcResistanceDommages,
  getNaturalArmorMod,
} from '../../../shared/polarisUtils.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getAdvantages } from '../services/advantageService.js'
import { resolveEcheanceNow } from '../lib/echeanceService.js'
import { computeWoundInfectionThreshold } from '../lib/woundEvolutionService.js'
import { broadcastWoundUpdate } from '../lib/woundReviewService.js'

export function registerDiceHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── DICE:ROLL ─────────────────────────────────────────────────────────
  // Le client demande un jet de dés.
  // Le serveur est le seul responsable du calcul — jamais le client.
  // Payload : { formula, secret? } — ex: "2d6+3", "d20", "3d6"
  // secret=true : broadcast uniquement au lanceur + GM (PE2 socket.data.role)
  socket.on(WS.DICE_ROLL, async ({ formula, secret = false }) => {
    if (!campaignId) return

    try {
      const { rolls, total, formula: normalizedFormula, dieType, seed } = await parseDice(formula)

      const color = await getUserColor(db, user.id)

      let isCriticalSuccess = false
      let isCriticalFail = false

      try {
        const campaign = await db('campaigns').where({ id: campaignId }).select('dice_config').first()
        const diceConfig = campaign?.dice_config

        if (diceConfig && dieType) {
          const dieCfg = diceConfig[dieType]
          if (dieCfg?.success) {
            isCriticalSuccess = total >= dieCfg.success.min && total <= dieCfg.success.max
          }
          if (dieCfg?.fail) {
            isCriticalFail = total >= dieCfg.fail.min && total <= dieCfg.fail.max
          }
        }
      } catch (_) {}

      const timestamp = new Date().toISOString()
      const payload = {
        userId: user.id,
        username: user.username,
        color,
        formula: normalizedFormula,
        rolls,
        total,
        isCriticalSuccess,
        isCriticalFail,
        seed,
        timestamp,
        secret: secret || false,
      }

      if (secret) {
        // Jet au MJ : visible uniquement par le lanceur et le(s) GM (PE2)
        socket.emit(WS.DICE_RESULT, payload)
        if (!isGm) {
          const roomSockets = await io.in(campaignId).fetchSockets()
          const gmSockets = roomSockets.filter(s => s.data.role === 'gm')
          gmSockets.forEach(s => s.emit(WS.DICE_RESULT, payload))
        }
      } else {
        io.to(campaignId).emit(WS.DICE_RESULT, payload)
      }

      console.log(`[WS] dice:roll — ${user.username} : ${normalizedFormula} = ${total}${secret ? ' [secret]' : ''}`)
    } catch (err) {
      console.error(`[WS] dice:roll error (${user.username}) : ${err.message}`)
    }
  })

  // ─── MACRO:ROLL ────────────────────────────────────────────────────────
  // Payload : { macroId, characterId, secret? }
  // Lance un jet lié aux stats vivantes du personnage (PLAN 13).
  socket.on(WS.MACRO_ROLL, async ({ macroId, characterId, secret = false }) => {
    if (!campaignId) return
    try {
      // ── 1. Macro ──────────────────────────────────────────────────────
      const macro = await db('character_macros')
        .where({ id: macroId, character_id: characterId }).first()
      if (!macro) return

      // ── 2. Ownership : propriétaire OU GM ──────────────────────────
      const character = await db('characters').where({ id: characterId }).first()
      if (!character) return
      const isOwner = character.user_id === user.id
      if (!isOwner && !isGm) return

      const color = await getUserColor(db, user.id, '#aa8a30')

      // ── 3. Stats du personnage ─────────────────────────────────────
      const sheet = await db('char_sheet').where({ character_id: characterId }).first()
      if (!sheet) return

      const [attrs, archetype, mutationEffects, advantages] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheet.id }),
        db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
        getMutationEffects(sheet.id),
        getAdvantages(sheet.id),
      ])
      const genotypeRow = archetype?.genotype_id
        ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
        : null

      // ── 4. Seuil (somme des sources + modificateur fixe) ──────────
      const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow, mutationEffects)

      const secondaryValue = (key) => {
        switch (key) {
          case 'rea':                return calcREA(na('ADA'), na('PER'), getAdvantageModForAttr(advantages, 'reaction'))
          case 'seuil_etourdi':      return calcSeuils(na('FOR'), na('CON'), na('VOL'), getMutationModForResistance(mutationEffects, 'shock'), getAdvantageModForResistance(advantages, 'shock')).etourdissement
          case 'seuil_incons':       return calcSeuils(na('FOR'), na('CON'), na('VOL'), getMutationModForResistance(mutationEffects, 'shock'), getAdvantageModForResistance(advantages, 'shock')).inconscience
          case 'souffle':            return calcSouffle(na('CON'), na('VOL'), getAdvantageModForAttr(advantages, 'breath'))
          case 'resistance_dommages':  return calcResistanceDommages(na('FOR'), na('CON'), getMutationModForResistance(mutationEffects, 'damage') + getNaturalArmorMod(mutationEffects), getAdvantageModForResistance(advantages, 'damage'))
          case 'resistance_drogues':   return calcResistanceNaturelle(calcResistanceDroguesInput(na('CON'), na('VOL'))) + getMutationModForResistance(mutationEffects, 'drugs') + getAdvantageModForResistance(advantages, 'drugs')
          case 'resistance_poison':    return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'poison') + getAdvantageModForResistance(advantages, 'poison')
          case 'resistance_maladie':   return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'disease') + getAdvantageModForResistance(advantages, 'disease')
          case 'resistance_radiation': return calcResistanceNaturelle(na('CON')) + getMutationModForResistance(mutationEffects, 'radiation') + getAdvantageModForResistance(advantages, 'radiation')
          default:                   return 0
        }
      }

      let baseThreshold = 0
      for (const src of macro.sources) {
        if (src.type === 'attribute') {
          baseThreshold += na(src.ref_id)
        } else if (src.type === 'skill') {
          const [charSkill, refSkill] = await Promise.all([
            db('char_skills').where({ char_sheet_id: sheet.id, skill_id: src.ref_id }).first(),
            db('ref_skills').where({ id: src.ref_id }).first(),
          ])
          baseThreshold += calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects)
        } else if (src.type === 'secondary') {
          baseThreshold += secondaryValue(src.ref_id)
        }
      }
      const threshold = baseThreshold + macro.modifier

      // ── 5-6. Jet 1d20 + Succès/critique/Catastrophe — règle absolue Polaris, extraite dans
      // server/src/lib/polarisTestService.js (docs/PLAN_FATIGUE_DOMMAGES.md, résolveur de Test
      // générique) : point d'entrée unique partagé avec les futures échéances serveur autonomes.
      const { roll: rollResult, seed, isSuccess, isCriticalSuccess, isCriticalFail } = await resolvePolarisTest(threshold)

      // ── 7. Substitution template ──────────────────────────────────
      const sourceLabel  = macro.sources.map(s => s.ref_label).join(' + ')
      const successText  = isSuccess ? 'Succès' : 'Échec'
      const critiqueText = isCriticalSuccess ? 'critique !' : isCriticalFail ? 'fumble !' : ''
      const modDisplay   = macro.modifier > 0 ? `+${macro.modifier}`
        : macro.modifier < 0 ? `${macro.modifier}` : ''

      const tpl = macro.template || '{me} — {source} → {résultat}/{seuil} → {succès} {critique}'
      const formattedMessage = tpl
        .replace(/\{me\}/g,           character.name || '?')
        .replace(/\{source\}/g,       sourceLabel)
        .replace(/\{résultat\}/g,     String(rollResult))
        .replace(/\{seuil\}/g,        String(threshold))
        .replace(/\{modificateur\}/g, modDisplay)
        .replace(/\{succès\}/g,       successText)
        .replace(/\{critique\}/g,     critiqueText)
        .trim()

      // ── 8. Broadcast ───────────────────────────────────────────────
      const payload = {
        macroId,
        characterId,
        characterName:    character.name,
        color,
        sourceLabel,
        rollResult,
        threshold,
        modifier:         macro.modifier,
        isSuccess,
        isCriticalSuccess,
        isCriticalFail,
        formattedMessage,
        secret,
        seed,
        timestamp: new Date().toISOString(),
      }

      if (secret) {
        socket.emit(WS.MACRO_ROLL_RESULT, payload)
        if (!isGm) {
          const roomSockets = await io.in(campaignId).fetchSockets()
          const gmSockets = roomSockets.filter(s => s.data.role === 'gm')
          gmSockets.forEach(s => s.emit(WS.MACRO_ROLL_RESULT, payload))
        }
      } else {
        io.to(campaignId).emit(WS.MACRO_ROLL_RESULT, payload)
      }

      console.log(`[WS] macro:roll — ${user.username} : ${macro.label} = ${rollResult}/${threshold} → ${successText}${secret ? ' [secret]' : ''}`)
    } catch (err) {
      console.error(`[WS] macro:roll error (${user.username}) : ${err.message}`)
    }
  })

  // ─── WOUND:INFECTION_ROLL ──────────────────────────────────────────────
  // Payload : { echeanceId } — docs/PLAN_BLESSURES_GUERISON.md §6.1. Contrairement à DICE_ROLL/
  // MACRO_ROLL (purement d'affichage), ce handler mute character_wounds via resolveEcheanceNow —
  // plus proche en forme d'un handler de combat que d'un jet d'affichage : lance le dé, calcule le
  // seuil, résout l'échéance, notifie, dans cet ordre.
  socket.on(WS.WOUND_INFECTION_ROLL, async ({ echeanceId }) => {
    if (!campaignId) return
    try {
      const echeance = await db('game_echeances').where({ id: echeanceId, campaign_id: campaignId }).first()
      if (!echeance || echeance.condition_type !== 'wound_infection_check' || echeance.status !== 'awaiting_player_roll') {
        socket.emit('error', { message: 'Échéance introuvable ou déjà résolue' })
        return
      }

      const character = await db('characters').where({ id: echeance.character_id }).first()
      const isOwner = character?.user_id === user.id
      if (!character || (!isOwner && !isGm)) {
        socket.emit('error', { message: 'Ce jet ne vous appartient pas' })
        return
      }

      const wound = await db('character_wounds').where({ id: echeance.payload.woundId }).first()
      if (!wound) return

      const { rollResult, threshold, resolution } = await db.transaction(async (trx) => {
        const seuil = await computeWoundInfectionThreshold(trx, wound, echeance.payload.periodesSansSoin ?? 0)
        const roll = await resolvePolarisTest(seuil)
        await trx('game_echeances').where({ id: echeance.id })
          .update({ payload: trx.raw('payload || ?::jsonb', [JSON.stringify({ rollResult: roll })]) })
        const resolved = await resolveEcheanceNow(trx, echeance.id)
        return { rollResult: roll, threshold: seuil, resolution: resolved }
      })

      io.to(campaignId).emit(WS.GAME_ECHEANCE_RESOLVED, { echeanceId: echeance.id })
      if (resolution.resolved) {
        await broadcastWoundUpdate(io, campaignId, {
          characterId: echeance.character_id, charSheetIdForWorst: wound.char_sheet_id, woundId: echeance.payload.woundId,
        })
      }

      // Réutilise DICE_RESULT (même forme que DICE_ROLL) — le jet du joueur reste visible dans le
      // journal de dés déjà en place côté client, sans nouveau composant d'affichage.
      const color = await getUserColor(db, user.id)
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: user.id, username: user.username, color,
        formula: '1d20 (Constitution, Infection)', rolls: [rollResult.roll], total: rollResult.roll,
        isCriticalSuccess: rollResult.isCriticalSuccess, isCriticalFail: rollResult.isCriticalFail,
        seed: rollResult.seed, timestamp: new Date().toISOString(), secret: false,
      })

      console.log(`[WS] wound:infection_roll — ${user.username} : ${rollResult.roll}/${threshold} → ${rollResult.isSuccess ? 'Succès' : 'Échec'}`)
    } catch (err) {
      console.error(`[WS] wound:infection_roll error (${user.username}) : ${err.message}`)
      // Sans ça, le bouton "Lancer" du joueur (PendingRollsPanel.jsx, state `rolling`) reste
      // désactivé indéfiniment sur tout échec après les gardes explicites ci-dessus (ex. double clic
      // concurrent → resolveEcheanceNow rejette en AppError 409, jamais catché avant ce bloc) —
      // trouvé en analyse à charge du chantier, pas au premier passage.
      socket.emit('error', { message: 'Le jet a échoué, réessayez' })
    }
  })

  // ─── CHAT:MESSAGE ──────────────────────────────────────────────────────
  // Payload : { text }
  socket.on(WS.CHAT_MESSAGE, async ({ text }) => {
    if (!text || !campaignId) return
    const color = await getUserColor(db, user.id)
    io.to(campaignId).emit(WS.CHAT_MESSAGE, {
      userId: user.id,
      username: user.username,
      color,
      text,
      timestamp: new Date().toISOString(),
    })
  })

  // ─── CHARACTER:UPDATED ─────────────────────────────────────────────────
  // Conservé temporairement — relique Chantier 1, à nettoyer chantier dédié.
  socket.on(WS.CHARACTER_UPDATED, async ({ characterId }) => {
    try {
      if (!isGm) {
        socket.emit('error', { message: 'GM only' })
        return
      }

      const character = await db('characters')
        .where({ 'characters.id': characterId })
        .leftJoin('users', 'characters.user_id', 'users.id')
        .select(
          'characters.id',
          'characters.campaign_id',
          'characters.user_id',
          'characters.name',
          'characters.color',
          'characters.visible',
          'characters.glb_url',
          'characters.portrait_url',
          'users.username',
        )
        .first()

      if (!character) return
      io.to(campaignId).emit(WS.CHARACTER_UPDATED, character)
    } catch (err) {
      console.error('[WS] character:updated error:', err.message)
    }
  })
}
