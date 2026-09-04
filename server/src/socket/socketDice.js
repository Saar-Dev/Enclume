import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { resolvePolarisTest } from '../lib/polarisTestService.js'
import { getUserColor } from '../lib/socketUtils.js'
import { calcSkillTotal } from '../lib/charStats.js'
import { getCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { loadCharacterTestContext } from '../lib/characterTestContext.js'
import {
  calcREA, getAdvantageModForAttr, getAdvantageModForResistance, getMutationModForResistance,
  calcSeuils, calcSouffle, calcResistanceDroguesInput, calcResistanceNaturelle, calcResistanceDommages,
  getNaturalArmorMod,
} from '../../../shared/polarisUtils.js'
import { resolveEcheanceNow } from '../lib/echeanceService.js'
import { computeWoundInfectionThreshold } from '../lib/woundEvolutionService.js'
import { broadcastWoundUpdate } from '../lib/woundReviewService.js'
import { sendMessage as sendChatMessage } from '../chat/chatService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'

// PLAN_CHAT.md §12 Phase 2 — double-écriture (shadow write, pattern Strangler Fig). Absent/non "true"
// = comportement strictement inchangé. Lu une seule fois au chargement du module, pas à chaque
// message (cohérent avec un redémarrage nécessaire pour changer un flag d'environnement).
const CHAT_PERSISTENCE_ENABLED = process.env.CHAT_PERSISTENCE_ENABLED === 'true'

// ─── DICE:ROLL ───────────────────────────────────────────────────────────
// Extrait de registerDiceHandlers (docs/EN_COURS.md WIZ28) : seul jet nécessaire à un socket sans
// campagne (Wizard Coffre-native, /vault/creation — ProAdvantagesAndSetbacks.jsx y lance des jets
// 1D10/1D100 sans jamais avoir de room). Enregistré seul dans ce cas plutôt que via
// registerDiceHandlers en entier — MACRO_ROLL/WOUND_INFECTION_ROLL/CHAT_MESSAGE/CHARACTER_UPDATED
// n'ont aucun sens pour un personnage seul dans son Coffre (macro liée à une session de jeu réelle,
// chat de campagne, etc.) et gardent chacun leur propre garde `if (!campaignId) return` conçue pour
// un contexte de campagne — les exposer quand même sur un socket solo ajouterait une surface qui ne
// sert à rien et qui devrait, en silence, continuer de compter sur ces gardes-là pour rester inerte.
export function registerDiceRollHandler(io, socket, { campaignId, user, isGm }) {
  // Le client demande un jet de dés.
  // Le serveur est le seul responsable du calcul — jamais le client.
  // Payload : { formula, secret? } — ex: "2d6+3", "d20", "3d6"
  // secret=true : broadcast uniquement au lanceur + GM (PE2 socket.data.role)
  // campaignId absent = session solo (voir commentaire de module ci-dessus) : pas de config de dés
  // (critique/fumble, propre à une campagne) ni de room à notifier — seul le lanceur reçoit son
  // propre résultat, même invariant que SESSION_JOIN pour ce cas (index.js).
  socket.on(WS.DICE_ROLL, async ({ formula, secret = false }) => {
    try {
      const { rolls, total, formula: normalizedFormula, dieType, seed } = await parseDice(formula)

      const color = await getUserColor(db, user.id)

      let isCriticalSuccess = false
      let isCriticalFail = false

      if (campaignId) {
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
      }

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

      if (!campaignId) {
        // Solo (pas de room) : personne d'autre à notifier, jamais de GM à chercher.
        socket.emit(WS.DICE_RESULT, payload)
      } else if (secret) {
        // Jet au MJ : visible uniquement par le lanceur et le(s) GM (PE2)
        socket.emit(WS.DICE_RESULT, payload)
        if (!isGm) {
          const roomSockets = await io.in(campaignId).fetchSockets()
          const gmSockets = roomSockets.filter(s => s.data.role === 'gm')
          gmSockets.forEach(s => s.emit(WS.DICE_RESULT, payload))
        }
      } else {
        io.to(campaignId).emit(WS.DICE_RESULT, payload)

        // Persistance (docs/PLANS/PLAN_CHAT_COMMANDES.md §5) — senderUserId: null (patron Message
        // Builder, chatValidation.js:6-9 : DICE est un type système à payload structuré, pas une
        // saisie utilisateur ; senderUserId: user.id ferait rejeter le message par
        // validateMessagePayload, qui n'autorise que TEXT/WHISPER). payload identique à celui déjà
        // diffusé en direct ci-dessus — même forme, une seule source de vérité pour « à quoi ressemble
        // un jet ». Persistance seule, jamais broadcastMessageCreated : le DICE_RESULT ci-dessus reste
        // l'unique canal temps réel, un second broadcast dupliquerait le jet chez tout client déjà
        // connecté (deux ids différents, la dédup par id de sessionStore ne les fusionnerait pas) — la
        // persistance ne sert que l'historique/la reconnexion. Non bloquant : un échec ne doit jamais
        // gêner le direct, déjà parti.
        try {
          await sendChatMessage({ campaignId, channelId: 'general', senderUserId: null, type: 'DICE', payload })
        } catch (err) {
          console.error('[Chat] Persistance /r échouée (non bloquant) :', err.message)
        }
      }

      console.log(`[WS] dice:roll — ${user.username} : ${normalizedFormula} = ${total}${secret ? ' [secret]' : ''}`)
    } catch (err) {
      console.error(`[WS] dice:roll error (${user.username}) : ${err.message}`)
    }
  })
}

// Handlers de campagne — jamais posés pour un socket solo (voir registerDiceRollHandler ci-dessus).
export function registerDiceHandlers(io, socket, context) {
  registerDiceRollHandler(io, socket, context)
  const { campaignId, user, isGm } = context

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
      // Point structurel 3 (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4) : les macros ignoraient jusqu'ici
      // tout malus de blessure/encombrement/fatigue — corrigé en branchant le même registre que les
      // sites combat. Chargement extrait dans loadCharacterTestContext (docs/PLANS/PLAN_CHAT_COMMANDES.md
      // §6, second consommateur : /t) — mêmes requêtes, même ordre, comportement inchangé ici.
      const testContext = await loadCharacterTestContext(db, campaignId, characterId)
      if (!testContext) return
      const { sheet, attrs, genotypeRow, mutationEffects, advantages, activeMalus, na, an } = testContext

      // ── 4. Seuil (somme des sources + modificateur fixe) ──────────
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

      // Réussite critique (p.204, Lot 2) : la RAW ne couvre qu'un Test à une seule Compétence OU un
      // seul Attribut. Une macro perso (jusqu'à 3 sources libres, DicePanel.jsx) peut cumuler
      // plusieurs sources du même type sans que cela corresponde à un vrai Test RAW (décision Saar
      // 2026-07-31) — le bonus n'est donc appliqué que si la macro se réduit à exactement une source
      // Compétence (xor) une source Attribut ; toute autre combinaison (0, 2+, ou mélange) n'a pas de
      // règle RAW à appliquer et reste sans bonus.
      const skillMasteries = []
      const attributeANs = []

      let baseThreshold = 0
      for (const src of macro.sources) {
        if (src.type === 'attribute') {
          const attributeAN = an(src.ref_id)
          baseThreshold += attributeAN
          attributeANs.push(attributeAN)
        } else if (src.type === 'skill') {
          const [charSkill, refSkill] = await Promise.all([
            db('char_skills').where({ char_sheet_id: sheet.id, skill_id: src.ref_id }).first(),
            db('ref_skills').where({ id: src.ref_id }).first(),
          ])
          baseThreshold += calcSkillTotal(attrs, charSkill, refSkill, genotypeRow, mutationEffects)
          skillMasteries.push(charSkill?.mastery ?? 0)
        } else if (src.type === 'secondary') {
          baseThreshold += secondaryValue(src.ref_id)
        }
      }
      const threshold = baseThreshold + activeMalus + macro.modifier
      const criticalSuccessBonus = skillMasteries.length === 1 && attributeANs.length === 0
        ? getCriticalSuccessBonus({ masteryLevel: skillMasteries[0] })
        : attributeANs.length === 1 && skillMasteries.length === 0
          ? getCriticalSuccessBonus({ attributeAN: attributeANs[0] })
          : 0

      // ── 5-6. Jet 1d20 + Succès/critique/Catastrophe — règle absolue Polaris, extraite dans
      // server/src/lib/polarisTestService.js (docs/PLAN_FATIGUE_DOMMAGES.md, résolveur de Test
      // générique) : point d'entrée unique partagé avec les futures échéances serveur autonomes.
      // catastropheRisk : calculé par resolvePolarisTest mais silencieusement absent du payload
      // jusqu'ici — trouvé en analyse à charge (docs/PLANS/PLAN_CATASTROPHE_RISK.md §3/§8, 2ᵉ passe) :
      // MACRO_ROLL est un 7ᵉ site valide pour la Catastrophe automatique en combat (Lutte, Manœuvre
      // d'armure, tout Test résolu par macro pendant un Tour), sous la même garde combat actif que les
      // 6 autres sites (maybeTriggerCatastrophe, jamais une émission inconditionnelle).
      const { roll: rollResult, seed, isSuccess, isCriticalSuccess, isCriticalFail, catastropheRisk } = await resolvePolarisTest(threshold, criticalSuccessBonus)

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
        catastropheRisk,
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

      // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1, 7ᵉ site) — garde combat
      // actif appliquée par maybeTriggerCatastrophe lui-même, jamais dupliquée ici (décision Saar :
      // "si et seulement si combat en cours").
      const actorTokenForCatastrophe = await db('tokens').where({ character_id: characterId }).first()
      if (actorTokenForCatastrophe) {
        await maybeTriggerCatastrophe(io, campaignId, actorTokenForCatastrophe.id, catastropheRisk, {
          site: 'macro_roll', actorTokenId: actorTokenForCatastrophe.id, targetTokenId: null,
        })
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

    // Double-écriture Phase 2 (PLAN_CHAT.md §12) — effet de bord additionnel, jamais bloquant. Le
    // broadcast ci-dessus est déjà parti : un échec de persistance (rate limit, validation) ne doit
    // jamais atteindre le client ni perturber le chat existant. Rien ne lit encore cette table
    // (Phase 3) — un message manquant ici est un trou d'historique acceptable, pas une corruption.
    if (CHAT_PERSISTENCE_ENABLED) {
      try {
        await sendChatMessage({
          campaignId, channelId: 'general', senderUserId: user.id, type: 'TEXT', payload: { text },
        })
      } catch (err) {
        console.error('[Chat] Double-écriture Phase 2 échouée (non bloquant) :', err.message)
      }
    }
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
