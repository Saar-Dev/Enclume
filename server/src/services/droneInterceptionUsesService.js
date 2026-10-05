import db from '../db/knex.js'

// Compteur des interceptions engagées par un drone pendant un Tour de combat (table drone_interception_uses,
// migrations 360-361 ; docs/PLANS/PLAN_DRONE_INTERCEPTION.md §5, Lot 3 — CRD). Les règles (plafond, malus, Seuil
// effectif) vivent dans le noyau pur shared/droneInterception.js ; ce service ne fait que tenir le compteur.
//
// Un drone SANS plafond (bouclier personnel, `interception_max_simultaneous` NULL) n'a aucune règle de
// simultanéité : l'appelant ne l'engage pas ici, aucune ligne n'est écrite (cas courant : zéro coût).
//
// Le Tour fait partie de la clé : rien à remettre à zéro en fin de Tour ; la FK vers combat_state supprime les
// lignes à la fin du combat (migration 361).

// Tour courant du combat de la campagne, ou null hors combat.
export async function currentCombatTurn(campaignId, database = db) {
  const state = await database('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
  return state?.current_turn ?? null
}

// Interceptions déjà engagées CE Tour, par drone : Map<droneCharacterId, uses> (absent = 0). Lecture pour le tri des
// candidats (saturé ? malus ?) ; l'autorité reste `engageInterception`, qui recompte atomiquement.
export async function getInterceptionUses(campaignId, droneCharacterIds, database = db) {
  const uses = new Map()
  if (droneCharacterIds.length === 0) return uses
  const turn = await currentCombatTurn(campaignId, database)
  if (turn == null) return uses
  const rows = await database('drone_interception_uses')
    .where({ campaign_id: campaignId, turn_number: turn })
    .whereIn('drone_character_id', droneCharacterIds)
    .select('drone_character_id', 'uses')
  for (const row of rows) uses.set(row.drone_character_id, row.uses)
  return uses
}

// Engage UNE interception de plus pour ce drone ce Tour, sans jamais dépasser `maxSimultaneous`.
//
// Une seule requête atomique — INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING (doc PostgreSQL, INSERT, clause
// ON CONFLICT : « guarantees an atomic INSERT or UPDATE outcome [...] even under high concurrency », et une ligne
// verrouillée mais non mise à jour parce que la condition WHERE échoue n'est PAS retournée). Pas de verrou
// consultatif : la clé primaire (campagne, drone, Tour) est l'exclusion mutuelle. Même famille que le compteur à
// fenêtre fixe des guides de limitation de débit Postgres, avec le Tour (discret) à la place de la fenêtre de temps.
//
// Retourne :
//  - { status: 'engaged', rank }  rang de cette interception dans le Tour (1 = la première, sans malus) ;
//  - { status: 'saturated' }      plafond déjà atteint (course perdue contre une autre interception) : rien n'est écrit ;
//  - { status: 'no_combat' }      hors combat : aucun Tour, aucun compteur (la règle de simultanéité n'a pas de sens).
export async function engageInterception(campaignId, droneCharacterId, maxSimultaneous, database = db) {
  if (!Number.isInteger(maxSimultaneous) || maxSimultaneous < 1) {
    throw new RangeError('maxSimultaneous doit être un entier ≥ 1 (un drone sans plafond n\'est pas engagé ici)')
  }
  const turn = await currentCombatTurn(campaignId, database)
  if (turn == null) return { status: 'no_combat' }

  const { rows } = await database.raw(`
    INSERT INTO drone_interception_uses AS diu (campaign_id, drone_character_id, turn_number, uses)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (campaign_id, drone_character_id, turn_number)
    DO UPDATE SET uses = diu.uses + 1, updated_at = now()
    WHERE diu.uses < ?
    RETURNING uses
  `, [campaignId, droneCharacterId, turn, maxSimultaneous])
  return rows.length === 0 ? { status: 'saturated' } : { status: 'engaged', rank: rows[0].uses }
}
