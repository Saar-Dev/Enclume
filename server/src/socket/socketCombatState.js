import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { canTransition } from '../lib/combatFSM.js'
import { parseDice } from '../lib/diceParser.js'
import { calcAttributeNA, calcSkillTotal } from '../lib/charStats.js'
import { calcREA, getAdvantageModForAttr } from '../../../shared/polarisUtils.js'
import { resolveCombatantIdentity, resolveExoContext, resolveManeuverSkillId } from '../lib/combatantContextService.js'
import { getMutationEffects } from '../services/mutationService.js'
import { getUserColor } from '../lib/socketUtils.js'
import * as statusService from '../lib/statusService.js'
import { startAnnouncementTimers, startResolutionPhase } from './socketCombatHelpers.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { getAdvantages } from '../services/advantageService.js'
import { getAllModStatusCodes } from '../services/weaponModService.js'
import { setCharacterState } from '../lib/characterStateService.js'
import { shadowCheckCharacterState } from '../lib/characterStateShadowCheck.js'
import { buildBroadcastRoster } from '../lib/combatRosterBroadcast.js'
import { purgePendingCatastrophes } from '../lib/catastropheService.js'

export function registerStateHandlers(io, socket, context, pendingMaps) {
  const { campaignId, user, isGm } = context

  // ─── COMBAT:START ─────────────────────────────────────────────────────
  // GM démarre un combat. Calcule le roster d'initiative depuis les tokens
  // présents sur la battlemap, insère combat_state + combat_roster en DB,
  // puis broadcast COMBAT_STARTED à toute la room.
  // Payload : { battlemap_id, surprisedTokenIds: UUID[] }
  socket.on(WS.COMBAT_START, async ({ battlemap_id, surprisedTokenIds = [], excludedTokenIds = [] }) => {
    if (!isGm) return
    try {
      const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
      const { phase: _gPhase, sub_phase: _gSubPhase } = existing ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_START')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_START`)
        return
      }
      // Guard — combat déjà en cours
      if (existing) {
        socket.emit('error', { message: 'Combat déjà en cours pour cette campagne' })
        return
      }

      // Lire le timer configuré pour cette campagne
      const settings = await getCampaignSettings(db, campaignId)
      const actionTimerSec = settings.action_timer_sec

      // Guard — tokens présents sur la carte (hors exclus GM)
      const allTokens = await db('tokens').where({ battlemap_id })
      const tokens = allTokens.filter(t => !excludedTokenIds.includes(t.id))
      if (tokens.length === 0) {
        socket.emit('error', { message: 'Aucun personnage sur la carte' })
        return
      }

      // Calcul base_ini (REA) pour chaque token via char_sheet
      const rosterData = []
      for (const token of tokens) {
        // Entité de décor (porte, console) — pas un personnage, ignorée en combat
        if (!token.character_id) {
          console.warn(`[COMBAT_START] Token ${token.id} sans character_id (Entité) — ignoré`)
          continue
        }
        let base_ini = 0
        let character = null
        try {
          // PD1 — fetcher character en premier pour détecter le type avant d'accéder à char_sheet
          character = await db('characters').where({ id: token.character_id }).first()

          if (character?.type === 'drone') {
            // Drone : INI 12 fixe (LdB p.320), pas de char_sheet, pas de surprise
            rosterData.push({ token, base_ini: 12, character, is_pnj: false, forcedNotSurprised: true })
            continue
          }

          if (character?.type === 'exo') {
            // PLAN_EXOARMURE.md Lot 3 §10.2 — miroir du cas drone ci-dessus : l'exo n'a pas de
            // char_sheet, ses stats de combat viennent du pilote. resolveExoContext (Lot 2bis) : un
            // seul fetch pilote+exoSheet, pas de pilote/base configurée (exoSheet.category NULL,
            // sentinelle Lot B §13.3) → base_ini reste à son défaut 0 (repli neutre, même esprit que
            // "char_sheet introuvable" ci-dessous pour un humain — jamais un crash).
            const { pilot, exoSheet } = await resolveExoContext(db, character)
            let is_pnj = false
            if (pilot && exoSheet?.category) {
              const pilotSheet = await db('char_sheet').where({ character_id: pilot.id }).first()
              if (pilotSheet) {
                // is_pnj dépend seulement de l'existence du pilote — posé ici, jamais à l'intérieur du
                // bloc maneuverSkillId ci-dessous, pour rester correct même si le Test de Manœuvre
                // d'armure est impossible (armure hybride sans active_maneuver_environment posé,
                // §16.2.5 — sinon un exo piloté par un PNJ retomberait sur le catch englobant plus bas,
                // dont le is_pnj générique (character?.type==='pnj') est toujours faux pour une exo,
                // cassant la Surprise auto-résolue PNJ, même famille de bug que le ticket "Blocage —
                // Joueur surpris" déjà rencontré sur ce projet).
                is_pnj = pilot.type === 'pnj'
                // Test de Manœuvre d'armure impossible (environment='industrial' en suspens, ou
                // 'hybrid' sans choix explicite, §16.2.5) : base_ini reste à son défaut 0, jamais un
                // crash qui empêcherait tout le roster de démarrer — même esprit que "pas de pilote".
                let maneuverSkillId = null
                try {
                  maneuverSkillId = resolveManeuverSkillId(exoSheet)
                } catch (err) {
                  console.warn(`[COMBAT_START] Manœuvre d'armure indéterminable pour exo ${character.id} (INI reste à 0) : ${err.message}`)
                }
                if (maneuverSkillId) {
                  const [attrs, archetype, advantages, mutationEffects, maneuverCharSkill, maneuverRefSkill] = await Promise.all([
                    db('char_attributes').where({ char_sheet_id: pilotSheet.id }),
                    db('char_archetype').where({ char_sheet_id: pilotSheet.id }).first(),
                    getAdvantages(pilotSheet.id),
                    getMutationEffects(pilotSheet.id),
                    db('char_skills').where({ char_sheet_id: pilotSheet.id, skill_id: maneuverSkillId }).first(),
                    db('ref_skills').where({ id: maneuverSkillId }).first(),
                  ])
                  const genotypeRow = archetype?.genotype_id
                    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
                    : null
                  const ada_na = calcAttributeNA(attrs, 'ADA', genotypeRow)
                  const per_na = calcAttributeNA(attrs, 'PER', genotypeRow)
                  const reaction = calcREA(ada_na, per_na, getAdvantageModForAttr(advantages, 'reaction'))
                  const maneuverSkillTotal = maneuverRefSkill
                    ? calcSkillTotal(attrs, maneuverCharSkill, maneuverRefSkill, genotypeRow, mutationEffects)
                    : 0
                  // Malus d'Initiative — REGLEARMURE.md:136-146, doublé hors-milieu. EAU1 (aucun signal
                  // d'immersion temps réel, même limite que resolveManeuverSkillId/getExoMovementBudget) :
                  // 'submarine' suppose toujours "hors milieu" (surface par défaut) ; les autres
                  // environnements supposent toujours "dans leur milieu", jamais doublés.
                  const iniMalus = exoSheet.environment === 'submarine'
                    ? exoSheet.malus_init_underwater * 2
                    : exoSheet.malus_init_surface
                  base_ini = Math.min(reaction, maneuverSkillTotal) - iniMalus
                }
              }
            }
            // Pas de pilote assigné : personne à qui adresser un jet de Surprise manuel — même
            // traitement que le drone (forcedNotSurprised), pas un blocage silencieux.
            rosterData.push({ token, base_ini, character, is_pnj, forcedNotSurprised: !pilot })
            continue
          }

          const cs = await db('char_sheet').where({ character_id: token.character_id }).first()
          if (!cs) {
            console.warn(`[COMBAT_START] char_sheet introuvable pour token ${token.id}`)
          } else {
            const [attrs, archetype, advantages] = await Promise.all([
              db('char_attributes').where({ char_sheet_id: cs.id }),
              db('char_archetype').where({ char_sheet_id: cs.id }).first(),
              getAdvantages(cs.id),
            ])
            const genotypeRow = archetype?.genotype_id
              ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
              : null
            const ada_na = calcAttributeNA(attrs, 'ADA', genotypeRow)
            const per_na = calcAttributeNA(attrs, 'PER', genotypeRow)
            base_ini = calcREA(ada_na, per_na, getAdvantageModForAttr(advantages, 'reaction'))
          }
        } catch (err) {
          console.warn(`[COMBAT_START] Erreur calcul INI token ${token.id}:`, err.message)
        }
        const is_pnj = character?.type === 'pnj'
        rosterData.push({ token, base_ini, character, is_pnj })
      }

      // Tri DESC initiative — égalités résolues par Math.random() (LdB : simultanéité)
      rosterData.sort((a, b) => b.base_ini - a.base_ini || Math.random() - 0.5)

      // Construction des lignes roster
      const rosterRows = rosterData.map(({ token, base_ini, is_pnj, forcedNotSurprised }) => {
        const is_surprised = !forcedNotSurprised && surprisedTokenIds.includes(token.id)
        let surprise_roll = null
        let initiative = base_ini
        // PNJ surpris : jet auto côté serveur
        if (is_surprised && is_pnj) {
          surprise_roll = Math.ceil(Math.random() * 20)
          initiative = base_ini + surprise_roll
        }
        return {
          campaign_id: campaignId,
          token_id: token.id,
          is_surprised,
          surprise_roll,
          base_ini,
          initiative,
          status: 'active',
          has_announced: false,
          has_resolved: false,
          // PNJ : déjà en état d'alerte au début du combat (arme au clair) — le
          // GM ajuste ensuite via le roster. PJ : défaut colonne (Rangée), choix au joueur.
          ...(is_pnj ? { state_weapon: 'drawn' } : {}),
        }
      })

      // Insertion DB
      await db('combat_state').insert({
        campaign_id: campaignId,
        battlemap_id,
        phase: 'ROSTER',
        current_turn: 1,
        action_timer_sec: actionTimerSec,
      })
      const insertedRoster = await db.transaction(async (trx) => {
        const rows = await trx('combat_roster').insert(rosterRows).returning('*')
        // Lot 1 (shadow, docs/PLANS/PLAN_CHARACTER_STATES.md §3) — state_position n'a pas de colonne
        // seedée ici (toujours le défaut 'standing'), seul state_weapon PNJ ('drawn') s'écarte du
        // défaut ('holstered') et mérite une ligne character_states.
        for (const row of rows) {
          if (row.state_weapon !== 'holstered') await setCharacterState(trx, row.token_id, 'weapon', row.state_weapon)
          await shadowCheckCharacterState(trx, row.token_id, { position: row.state_position, weapon: row.state_weapon })
        }
        return rows
      })

      // Le prompt COMBAT_SURPRISE_ROLL n'est PAS émis ici — la phase est encore ROSTER, et la FSM
      // (combatFSM.js) n'accepte COMBAT_SURPRISE_RESULT que depuis ANNOUNCEMENT. Un prompt livré ici
      // serait affiché côté joueur avant d'être réellement actionnable (ticket "Blocage - Joueur
      // surpris au premier tour", 9e7aa7d5) — émis à COMBAT_ANNOUNCE_START à la place, une fois la
      // phase effectivement ouverte.

      // Broadcast COMBAT_STARTED — sans surprise_roll (PC25)
      const broadcastRoster = await buildBroadcastRoster(db, insertedRoster)
      io.to(campaignId).emit(WS.COMBAT_STARTED, { roster: broadcastRoster, phase: 'ROSTER' })

      console.log('###### DEBUT COMBAT #############')
      console.log(`[WS] combat:start — ${user.username} → ${tokens.length} participants (campagne ${campaignId})`)
    } catch (err) {
      console.error('[WS] combat:start error:', err.message)
      socket.emit('error', { message: 'Erreur lors du démarrage du combat' })
    }
  })

  // ─── COMBAT:END ───────────────────────────────────────────────────────
  // GM termine le combat. Nettoie tous les timers (PC19), supprime les 3
  // tables combat dans l'ordre des FK, puis broadcast COMBAT_ENDED.
  socket.on(WS.COMBAT_END, async () => {
    if (!isGm) return
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_END')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_END`)
        return
      }
      // PC19 — clearTimeout AVANT delete
      const timers = pendingMaps.combatTimers.get(campaignId)
      if (timers) {
        for (const timeoutId of timers.values()) {
          clearTimeout(timeoutId)
        }
        pendingMaps.combatTimers.delete(campaignId)
      }

      await db('combat_actions').where({ campaign_id: campaignId }).delete()

      // Nettoyer les statuts stunned/unconscious des tokens du roster avant suppression
      const rosterTokenIds = await db('combat_roster')
        .where({ campaign_id: campaignId })
        .pluck('token_id')
      if (rosterTokenIds.length > 0) {
        const affected = await db('token_statuses')
          .whereIn('token_id', rosterTokenIds)
          .whereIn('status_code', ['stunned', 'unconscious'])
          .select('token_id')
        if (affected.length > 0) {
          await db('token_statuses')
            .whereIn('token_id', rosterTokenIds)
            .whereIn('status_code', ['stunned', 'unconscious'])
            .delete()
          const affectedIds = [...new Set(affected.map(r => r.token_id))]
          for (const tid of affectedIds) {
            await statusService.emitTokenStatusUpdated(io, db, campaignId, tid)
          }
        }
      }

      // Groupe 4 (docs/PLAN_MODDING_REFONTE.md Phase 3.4) — un state de mod (ex. cumulativeMR de
      // l'ATI) ne survit jamais hors combat. Registre vide aujourd'hui : modStatusCodes est
      // toujours [], ce bloc reste un no-op tant que Phase 4 ne déclare pas de statusCodes.
      if (rosterTokenIds.length > 0) {
        const rosterCharacterIds = await db('tokens').whereIn('id', rosterTokenIds).pluck('character_id')
        if (rosterCharacterIds.length > 0) {
          const characterWeaponInvIds = await db('char_inventory')
            .whereIn('character_id', rosterCharacterIds)
            .pluck('id')
          if (characterWeaponInvIds.length > 0) {
            await db('char_inventory_mods')
              .whereIn('weapon_inv_id', characterWeaponInvIds)
              .whereNotNull('state')
              .update({ state: null })
          }
        }
        const modStatusCodes = getAllModStatusCodes()
        if (modStatusCodes.length > 0) {
          const affectedMods = await db('token_statuses')
            .whereIn('token_id', rosterTokenIds)
            .whereIn('status_code', modStatusCodes)
            .select('token_id')
          if (affectedMods.length > 0) {
            await db('token_statuses')
              .whereIn('token_id', rosterTokenIds)
              .whereIn('status_code', modStatusCodes)
              .delete()
            const affectedModIds = [...new Set(affectedMods.map(r => r.token_id))]
            for (const tid of affectedModIds) {
              await statusService.emitTokenStatusUpdated(io, db, campaignId, tid)
            }
          }
        }
      }

      await db('combat_pending').where({ campaign_id: campaignId }).delete()
      // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1, §4) — aucune Catastrophe
      // combat non résolue ne traverse la fin du combat, même patron que combat_pending/combat_roster
      // ci-dessous (décision assumée, différente des statuts environnementaux du Lot 3).
      await purgePendingCatastrophes(campaignId, db)
      await db('combat_roster').where({ campaign_id: campaignId }).delete()
      await db('combat_state').where({ campaign_id: campaignId }).delete()

      pendingMaps.combatPreviews.delete(campaignId)
      io.to(campaignId).emit(WS.COMBAT_ENDED)

      console.log('###### FIN COMBAT #############')
      console.log(`[WS] combat:end — ${user.username} (campagne ${campaignId})`)
    } catch (err) {
      console.error('[WS] combat:end error:', err.message)
      socket.emit('error', { message: 'Erreur lors de la fin du combat' })
    }
  })

  // ─── COMBAT:ANNOUNCE_START ────────────────────────────────────────────
  // GM passe de la phase ROSTER à ANNOUNCEMENT.
  // Démarre les timers auto-skip pour les joueurs (PC17 : skip si action_timer_sec > 0).
  socket.on(WS.COMBAT_ANNOUNCE_START, async () => {
    if (!isGm) return
    try {
      const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
      const { phase: _gPhase, sub_phase: _gSubPhase } = existing ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_ANNOUNCE_START')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_ANNOUNCE_START`)
        return
      }
      // Guard phase — doit être en ROSTER
      if (!existing || existing.phase !== 'ROSTER') return

      const [updated] = await db('combat_state')
        .where({ campaign_id: campaignId })
        .update({ phase: 'ANNOUNCEMENT', updated_at: db.fn.now() })
        .returning('action_timer_sec')
      if (!updated) return

      io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT' })

      // PJ surpris pas encore résolus (surprise_roll IS NULL — les PNJ surpris ont déjà leur jet auto
      // posé à COMBAT_START) : le prompt de jet de Réaction n'est légitime qu'à partir d'ici, seule
      // phase où la FSM accepte COMBAT_SURPRISE_RESULT (combatFSM.js) — cf. commentaire COMBAT_START.
      // Ligne combat_pending durable (même patron que melee_defense/damage/stun, cf. resync
      // server/src/socket/index.js) pour survivre à une reconnexion, + émission live en best-effort
      // pour un joueur déjà connecté.
      const surprisedPending = await db('combat_roster')
        .where({ campaign_id: campaignId, is_surprised: true, status: 'active' })
        .whereNull('surprise_roll')
      if (surprisedPending.length > 0) {
        const roomSockets = await io.in(campaignId).fetchSockets()
        for (const entry of surprisedPending) {
          await db('combat_pending').insert({
            campaign_id: campaignId, token_id: entry.token_id, type: 'surprise', payload: {},
          })
          const token = await db('tokens').where({ id: entry.token_id }).first()
          const character = token?.character_id
            ? await db('characters').where({ id: token.character_id }).first()
            : null
          // PLAN_EXOARMURE.md Lot 3 §10.3 — character?.user_id seul ratait le pilote d'une exo-armure
          // (propriétaire brut ≠ pilote effectif, même famille de bug que Lots 2/2bis) :
          // resolveCombatantIdentity résout déjà correctement les deux cas (humain : son propre
          // user_id, exo : celui du pilote), sans changement de comportement pour pj/pnj/drone.
          const targetUserId = character ? (await resolveCombatantIdentity(db, character)).userId : null
          const targetSocket = roomSockets.find(s => s.data.userId === targetUserId)
          if (targetSocket) targetSocket.emit(WS.COMBAT_SURPRISE_ROLL, { tokenId: entry.token_id })
        }
      }

      // PC17 — timers auto-skip uniquement si action_timer_sec > 0
      await startAnnouncementTimers(io, campaignId, updated.action_timer_sec, user.id, pendingMaps)

      // LdB p.212 — annonce séquentielle : émettre le premier slot (base_ini ASC)
      const firstAnnounceSlot = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
        .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
        .first()
      if (firstAnnounceSlot) {
        io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: firstAnnounceSlot.token_id })
      }

      console.log(`[WS] combat:announce_start — ${user.username} (campagne ${campaignId})`)
    } catch (err) {
      console.error('[WS] combat:announce_start error:', err.message)
    }
  })

  // ─── COMBAT:INIT_STATE ────────────────────────────────────────────────
  // Joueur déclare l'état initial (posture/arme/mode de tir) de son PJ ; le GM
  // déclare celui d'un PNJ (sans user_id, donc sans fenêtre joueur dédiée).
  socket.on(WS.COMBAT_INIT_STATE, async ({ tokenId, position, weapon, fire_mode }) => {
    try {
      const VALID_POS = new Set(['standing', 'crouching', 'kneeling', 'prone'])
      const VALID_WPN = new Set(['holstered', 'ready', 'drawn'])
      const VALID_FM  = new Set(['cc', 'rc', 'rl'])
      if (!VALID_POS.has(position) || !VALID_WPN.has(weapon) || !VALID_FM.has(fire_mode)) return

      const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
      if (!existing || existing.phase !== 'ROSTER') return

      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character) return
      if (isGm) {
        // Le GM ne déclare l'état que des PNJ — les PJ restent sous l'autorité de leur joueur,
        // les drones n'ont pas d'état initial (character.type === 'drone' → refusé ici).
        if (character.type !== 'pnj') return
      } else if (character.user_id !== user.id) return

      await db.transaction(async (trx) => {
        await trx('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({
            state_position:  position,
            state_weapon:    weapon,
            state_fire_mode: fire_mode,
            state_character: trx.raw('state_character || ?::jsonb', [JSON.stringify({ init_state_confirmed: true })]),
          })
        // Lot 1 (shadow, docs/PLANS/PLAN_CHARACTER_STATES.md §3)
        await setCharacterState(trx, tokenId, 'position', position)
        await setCharacterState(trx, tokenId, 'weapon', weapon)
        await shadowCheckCharacterState(trx, tokenId, { position, weapon })
      })

      const updatedRoster = await db('combat_roster').where({ campaign_id: campaignId })
      const broadcastRoster = await buildBroadcastRoster(db, updatedRoster)
      io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: broadcastRoster })

      console.log(`[WS] combat:init_state — ${user.username} pos:${position} wpn:${weapon} fm:${fire_mode}`)
    } catch (err) {
      console.error('[WS] combat:init_state error:', err.message)
    }
  })

  // ─── COMBAT:SURPRISE_RESULT ───────────────────────────────────────────
  // Joueur surpris déclenche son jet 1d20 — le serveur génère le dé côté serveur.
  // Payload : { tokenId }
  socket.on(WS.COMBAT_SURPRISE_RESULT, async ({ tokenId }) => {
    try {
      const { phase: _gPhase, sub_phase: _gSubPhase, current_turn: _gCurrentTurn } = await db('combat_state').where({ campaign_id: campaignId }).first() ?? {}
      if (!canTransition(_gPhase ?? null, _gSubPhase ?? null, 'COMBAT_SURPRISE_RESULT')) {
        console.warn(`[FSM] guard bloqué : ${_gPhase ?? null}|${_gSubPhase ?? null} + COMBAT_SURPRISE_RESULT`)
        return
      }
      // Validation ownership
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character || character.user_id !== user.id) return

      const entry = await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .first()
      if (!entry || !entry.is_surprised) return

      // Prompt consommé — même patron que melee_defense/stun (socketCombatResolution.js).
      await db('combat_pending')
        .where({ campaign_id: campaignId, token_id: tokenId, type: 'surprise' })
        .delete()

      // Génération serveur du d20 — résultat non manipulable par le client
      const { rolls, total: diceRoll, seed } = await parseDice('1d20')
      // Test de Réaction : roll ≤ base_ini → succès (LdB Polaris p.213-214)
      const isSuccess = diceRoll <= entry.base_ini
      const timestamp = new Date().toISOString()

      // Couleur joueur pour DICE_RESULT
      const color = await getUserColor(db, user.id)

      // Broadcast DICE_RESULT — chat + animation dés (pas de skillLabel → animation active)
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: user.id,
        username: user.username,
        color,
        formula: '1d20',
        rolls,
        total: diceRoll,
        isCriticalSuccess: false,
        isCriticalFail: false,
        seed,
        timestamp,
      })

      if (isSuccess) {
        // Succès : initiative = résultat du dé (marge de réussite = le score du dé)
        console.log(`[DBG] surprise_result: SUCCÈS roll:${diceRoll} ≤ base_ini:${entry.base_ini} → ini:${diceRoll}`)
        const rowsUpdated = await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({ surprise_roll: diceRoll, initiative: diceRoll, updated_at: db.fn.now() })
        console.log(`[DBG] surprise_result: rows updated=${rowsUpdated}`)
      } else {
        // Échec : initiative = 0, auto-skip, ne peut pas agir ce tour
        console.log(`[DBG] surprise_result: ÉCHEC roll:${diceRoll} > base_ini:${entry.base_ini} → ini:0`)
        const rowsUpdated = await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({ surprise_roll: diceRoll, initiative: 0, has_announced: true, updated_at: db.fn.now() })
        console.log(`[DBG] surprise_result: rows updated=${rowsUpdated}`)
        await db('combat_actions').insert({
          campaign_id: campaignId,
          token_id: tokenId,
          type: 'skip',
          action_key: 'skip',
          sequence: 99,
          status: 'skipped',
          turn_number: _gCurrentTurn ?? 1,
        })
        // PC13 — tous annoncés → phase Résolution
        const [{ count }] = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false })
          .count('* as count')
        if (parseInt(count) === 0) {
          await startResolutionPhase(io, campaignId, pendingMaps)
        }
      }

      // Broadcast roster mis à jour — sans surprise_roll (PC25)
      const updatedRoster = await db('combat_roster').where({ campaign_id: campaignId })
      console.log(`[DBG] surprise_result: roster fetched count=${updatedRoster.length} initiatives=${JSON.stringify(updatedRoster.map(r => ({ t: r.token_id.slice(-6), ini: r.initiative })))}`)
      const broadcastRoster = await buildBroadcastRoster(db, updatedRoster)
      io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: broadcastRoster })

      console.log(`[WS] combat:surprise_result — ${user.username} token:${tokenId} roll:${diceRoll} success:${isSuccess} ini:${isSuccess ? diceRoll : 0}`)
    } catch (err) {
      console.error('[WS] combat:surprise_result error:', err.message)
    }
  })
}
