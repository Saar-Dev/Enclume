// server/src/socket/socketCombatDrone.js
//
// Ordres permanents drone (docs/PLANS/PLAN_DRONE.md Sprint 2d, mode `ordres_permanents`) — fixer ou
// changer à tout moment la cible surveillée et l'arme utilisée par un drone autonome, hors file
// d'ANNONCE (ne consomme ni déclaration ni Tour). Fichier dédié, pas `socketCombatAnnouncement.js` :
// ce n'est ni une déclaration de Tour ni une transition de phase, mais une mutation de state
// persistant sur `combat_roster`, utilisable indépendamment du tour de qui que ce soit — même logique
// d'extraction que `combatTurnEngine.js` en son temps (éviter de rajouter une préoccupation de plus à
// un fichier déjà dense).

import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { buildBroadcastRoster } from '../lib/combatRosterBroadcast.js'

export function registerDroneOrdersHandlers(io, socket, context) {
  const { campaignId, user, isGm } = context

  // ─── COMBAT:DRONE_SET_ORDERS ────────────────────────────────────────────────
  // MJ ou propriétaire du drone → serveur, à tout moment (pas de garde de phase/tour — RAW : un drone
  // en ordres permanents ne « déclare » jamais). `targetTokenId:null` désassigne la cible surveillée.
  socket.on(WS.COMBAT_DRONE_SET_ORDERS, async ({ tokenId, targetTokenId, droneWeaponInvId }) => {
    try {
      const token = await db('tokens').where({ id: tokenId }).first()
      if (!token?.character_id) return
      const character = await db('characters').where({ id: token.character_id }).first()
      if (!character || character.type !== 'drone') return
      // Même garde d'autorisation que la déclaration Sprint 2c (socketCombatAnnouncement.js) — MJ ou
      // propriétaire du compte, symétrique entre les deux (pas de distinction de rôle ici).
      const isOwner = character.user_id && character.user_id === user.id
      if (!isGm && !isOwner) return

      const rosterEntry = await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).first()
      if (!rosterEntry) return // pas de combat actif pour ce token — rien à mémoriser

      // Ordres permanents n'ont de sens (et d'exécution, cf. combatTurnEngine.js#prefillAutonomousDroneOrders)
      // qu'en mode `ordres_permanents` — rejeté explicitement en `classique` plutôt qu'accepté en
      // silence (serveur = autorité, jamais confiance au payload/à l'UI client, .claude/rules/core.md).
      // Réglage différencié MJ/joueur (retour Saar, 2026-09-17) : le champ pertinent dépend de qui
      // possède CE drone, pas d'un réglage unique — même discriminant que prefillAutonomousDroneOrders.
      const combatState = await db('combat_state').where({ campaign_id: campaignId }).first()
      const relevantModel = character.user_id != null ? combatState?.drone_turn_model_player : combatState?.drone_turn_model_gm
      if (relevantModel !== 'ordres_permanents') {
        socket.emit(WS.COMBAT_DRONE_ORDERS_ERROR, {
          message: 'Ordres permanents indisponibles — ce combat est en mode de tour classique pour ce drone',
        })
        return
      }

      if (droneWeaponInvId) {
        const droneWeapon = await db('drone_weapons')
          .where({ id: droneWeaponInvId, character_id: character.id })
          .first()
        if (!droneWeapon) {
          socket.emit(WS.COMBAT_DRONE_ORDERS_ERROR, { message: "Arme drone introuvable — désinstallée entre-temps ?" })
          return
        }
      }
      if (targetTokenId) {
        const targetToken = await db('tokens').where({ id: targetTokenId }).first()
        if (!targetToken) {
          socket.emit(WS.COMBAT_DRONE_ORDERS_ERROR, { message: 'Cible introuvable' })
          return
        }
      }

      await db('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .update({
          acquired_target_token_id: targetTokenId ?? null,
          acquired_drone_weapon_inv_id: droneWeaponInvId ?? null,
          updated_at: db.fn.now(),
        })

      // Affichage requis (docs/PLANS/PLAN_DRONE.md §4) — réutilise COMBAT_ROSTER_UPDATED/
      // buildBroadcastRoster (déjà générique sur les colonnes), pas un nouvel événement d'affichage.
      const roster = await db('combat_roster').where({ campaign_id: campaignId }).orderBy('initiative', 'desc')
      io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: await buildBroadcastRoster(db, roster) })

      console.log(`[WS] combat:drone_set_orders — ${user.username} token:${tokenId} target:${targetTokenId ?? 'none'} weapon:${droneWeaponInvId ?? 'none'}`)
    } catch (err) {
      console.error('[WS] combat:drone_set_orders error:', err.message)
    }
  })
}
