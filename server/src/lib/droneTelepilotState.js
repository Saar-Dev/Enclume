import db from '../db/knex.js'

// « Ce drone est-il télépiloté CE Tour ? » — autorité unique (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.3).
// RAW (LdB p.319) : le télépilotage est un choix non persistant, fait à chaque Tour (`son action ce tour =
// l'action du drone`) ; un drone télépiloté n'exécute aucun comportement réactif automatique (interception
// « en mode autonome uniquement », docs/SYSTEME/COMBAT REFERENCE.md). Réutilisable par tout futur programme
// réactif — jamais reconstruit ailleurs, jamais un drapeau à synchroniser avec l'annulation d'une déclaration.
//
// Piège : la ligne `combat_actions` d'un télépilotage porte le token du PILOTE (Initiative,
// socketCombatAnnouncement.js), pas celui du drone. Le drone s'y retrouve par :
//  - `drone_weapon_inv_id` (Tir / CaC télépiloté, `action_key = 'drone_telepilot'`) ;
//  - `modifiers.dronePilotTokenId` (déplacement télépiloté, `move_short` / `move_long`).
// Une déclaration annulée passe en `skipped` (chk_action_status) : elle ne compte plus.
export async function isDroneTelepilotedThisTurn(campaignId, droneCharacterId, droneTokenId, database = db) {
  const state = await database('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
  if (!state) return false // hors combat : le télépilotage n'a pas de sens

  const row = await database('combat_actions')
    .where({ campaign_id: campaignId, turn_number: state.current_turn })
    .whereNot({ status: 'skipped' })
    .where(function telepilotsThisDrone() {
      this.where(function weaponAction() {
        this.where({ action_key: 'drone_telepilot' })
          .whereIn('drone_weapon_inv_id', database('drone_weapons').where({ character_id: droneCharacterId }).select('id'))
      }).orWhereRaw("modifiers->>'dronePilotTokenId' = ?", [droneTokenId])
    })
    .first('id')
  return Boolean(row)
}
