import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { PROTECTABLE_TYPES, linkRejectionReason } from '../../../shared/droneInterception.js'

// Liens de protection d'un drone d'interception (table drone_interception_targets, migrations 357-358 ;
// docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.6). Service métier unique : la route REST le consomme, et le
// service d'interposition (lib/droneInterceptionService.js) lit les protecteurs par `listProtectorLinks`.
// Les règles de validation vivent dans le noyau pur (shared/droneInterception.js), jamais ici.

const REJECTION = Object.freeze({
  not_a_drone: [400, 'Only a drone can protect a character'],
  target_missing: [404, 'Character to protect not found'],
  self: [400, 'A drone cannot protect itself'],
  other_campaign: [400, 'The protected character must belong to the same campaign as the drone'],
  target_type: [400, 'Only a player character, an NPC or an exo-armor can be protected'],
})

// Personnages que ce drone peut protéger (même campagne, types admis, hors lui-même), et ceux qu'il
// protège déjà. Un seul aller-retour côté client pour la section « Protection » de la fiche drone.
export async function listInterceptionLinks(drone, database = db) {
  const protectedRows = await database('drone_interception_targets as dit')
    .join('characters as c', 'c.id', 'dit.protected_character_id')
    .where('dit.drone_character_id', drone.id)
    .orderBy('c.name', 'asc')
    .select('c.id', 'c.name', 'c.type')

  const candidates = drone.campaign_id
    ? await database('characters')
      .where({ campaign_id: drone.campaign_id })
      .whereIn('type', PROTECTABLE_TYPES)
      .whereNot({ id: drone.id })
      .orderBy('name', 'asc')
      .select('id', 'name', 'type')
    : []
  return { protected: protectedRows, candidates }
}

export async function addInterceptionLink(drone, protectedCharacterId, database = db) {
  const target = await database('characters').where({ id: protectedCharacterId }).first()
  const reason = linkRejectionReason(drone, target)
  if (reason) {
    const [status, message] = REJECTION[reason]
    throw new AppError(status, message)
  }
  await database('drone_interception_targets')
    .insert({ drone_character_id: drone.id, protected_character_id: target.id })
    .onConflict(['drone_character_id', 'protected_character_id'])
    .ignore()
  return { id: target.id, name: target.name, type: target.type }
}

export async function removeInterceptionLink(droneCharacterId, protectedCharacterId, database = db) {
  return database('drone_interception_targets')
    .where({ drone_character_id: droneCharacterId, protected_character_id: protectedCharacterId })
    .del()
}

// Drones qui protègent ce personnage — lecture faite à chaque tir touché (index sur protected_character_id).
export async function listProtectorLinks(protectedCharacterId, database = db) {
  const rows = await database('drone_interception_targets')
    .where({ protected_character_id: protectedCharacterId })
    .select('drone_character_id')
  return rows.map(row => row.drone_character_id)
}
