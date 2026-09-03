// server/src/lib/campaignRosterService.js — Vue MJ « roster de campagne » pour l'onglet Joueurs de
// la Configuration (client : SectionPlayers.jsx). Agrège en un seul appel : les membres, les
// personnages que chaque JOUEUR possède dans la campagne (par type, avec l'état création-en-cours
// vs prêt), et les demandes de transfert depuis le Coffre. Remplace trois lectures recousues côté
// client (ex-CharacterPoolPage : GET /creation/campaign/:id/drafts + GET /campaigns/:id/members ;
// ex-SectionPlayers : GET /vault/campaigns/:id/transfer-requests, supprimé avec ce lot).
//
// Décisions Saar (2026-09-03) : la carte MJ ne liste aucun personnage (tous les PNJ de la campagne,
// « liste trop longue ») — seulement un emplacement `stats` pour un futur Lot présence/temps de jeu,
// en pause. MJ affiché en dernier.
//
// Lecture seule via `db`, hors transaction (même raison que woundReviewService.js : jamais une
// décision serveur, uniquement un affichage MJ). Aucune autorisation ici — la route
// GET /api/campaigns/:id/roster porte requireRole('gm'). 4 requêtes à plat recousues par userId,
// jamais une boucle par joueur.
import db from '../db/knex.js'

// Un brouillon Wizard n'est pas une entité séparée : c'est une ligne `characters` (type 'pj') dont
// le char_sheet n'est pas verrouillé (`wizard_locked_at IS NULL`). Tout le reste — exo/drone/pnj, ou
// pj finalisé — est « prêt ». startCreation garantit au plus un brouillon actif par (campagne, joueur).
function characterStatus(row) {
  const isDraft = row.type === 'pj' && row.sheetId != null && row.wizardLockedAt == null
  return isDraft ? 'draft' : 'ready'
}

export async function getCampaignRoster(campaignId) {
  const members = await db('campaign_members as cm')
    .join('users as u', 'u.id', 'cm.user_id')
    .where('cm.campaign_id', campaignId)
    .select('u.id as userId', 'u.username', 'cm.role', 'cm.created_at as joinedAt')

  const playerIds = members.filter(m => m.role !== 'gm').map(m => m.userId)

  const characterRows = playerIds.length
    ? await db('characters as c')
      .leftJoin('char_sheet as cs', 'cs.character_id', 'c.id')
      .where('c.campaign_id', campaignId)
      .whereIn('c.user_id', playerIds)
      .select(
        'c.id', 'c.name', 'c.type', 'c.user_id as userId',
        'c.portrait_url as portraitUrl', 'c.visible',
        'cs.id as sheetId', 'cs.wizard_locked_at as wizardLockedAt', 'cs.updated_at as sheetUpdatedAt',
      )
      .orderBy('c.created_at', 'asc')
    : []

  const transferRows = await db('vault_transfer_requests as vtr')
    .join('characters as c', 'c.id', 'vtr.vault_character_id')
    .where({ 'vtr.target_campaign_id': campaignId, 'vtr.status': 'pending' })
    .select(
      'vtr.id', 'vtr.requested_by as userId', 'vtr.created_at as requestedAt',
      'c.name as characterName', 'c.type as characterType',
    )
    .orderBy('vtr.created_at', 'asc')

  const charsByUser = {}
  for (const row of characterRows) {
    const status = characterStatus(row)
    const list = charsByUser[row.userId] || (charsByUser[row.userId] = [])
    list.push({
      id: row.id,
      name: row.name,
      type: row.type,
      status,
      portraitUrl: row.portraitUrl ?? null,
      visible: row.visible,
      ...(status === 'draft' ? { sheetId: row.sheetId, updatedAt: row.sheetUpdatedAt } : {}),
    })
  }

  const transfersByUser = {}
  for (const row of transferRows) {
    const list = transfersByUser[row.userId] || (transfersByUser[row.userId] = [])
    list.push({
      id: row.id,
      characterName: row.characterName,
      characterType: row.characterType,
      requestedAt: row.requestedAt,
    })
  }

  return members
    .map(m => ({
      userId: m.userId,
      username: m.username,
      role: m.role,
      joinedAt: m.joinedAt,
      characters: m.role === 'gm' ? [] : (charsByUser[m.userId] || []),
      transferRequests: transfersByUser[m.userId] || [],
      stats: null,
    }))
    .sort((a, b) => {
      // MJ en dernier, puis les joueurs par date d'arrivée dans la campagne.
      if ((a.role === 'gm') !== (b.role === 'gm')) return a.role === 'gm' ? 1 : -1
      return new Date(a.joinedAt) - new Date(b.joinedAt)
    })
}
