// characterOwnershipService.js — Autorité unique type/couleur personnage (docs/PLAN_CHARACTER_SERVICE.md)

import { AppError } from '../lib/AppError.js'

export const DEFAULT_CHARACTER_COLOR = '#4A90D9'

// Autorité unique : dérive type + color depuis l'appartenance réelle
// (campaign_members.role), jamais de la simple présence d'un user_id.
//
// role n'a AUCUNE contrainte CHECK en base (table.text('role'), texte libre) —
// liste blanche explicite : seul role === 'player' donne 'pj'. Tout le reste
// (gm, rôle futur non prévu, valeur corrompue) tombe côté 'pnj' — le défaut
// sûr, celui qui ne casse pas la classification combat.
//
// 'drone' n'est jamais dérivé ici — choix explicite du typeOverride, géré par
// l'appelant. color n'est en revanche jamais conditionné par le type : un
// drone avec un propriétaire hérite de sa couleur comme n'importe quel PNJ
// (comportement existant, préservé).
//
// db accepte indifféremment le knex par défaut (hors transaction) ou un trx
// actif — pas de garantie transactionnelle systématique, TOCTOU documenté
// dans docs/PLAN_CHARACTER_SERVICE.md §6.
export async function resolveOwnership(db, { campaignId, userId }) {
  if (!userId) return { user_id: null, type: 'pnj', color: DEFAULT_CHARACTER_COLOR }

  const [owner, member] = await Promise.all([
    db('users').where({ id: userId }).select('color').first(),
    db('campaign_members').where({ campaign_id: campaignId, user_id: userId }).first(),
  ])
  if (!owner) throw new AppError(404, 'Utilisateur introuvable')
  if (!member) throw new AppError(400, "Cet utilisateur n'est pas membre de cette campagne")

  return { user_id: userId, type: member.role === 'player' ? 'pj' : 'pnj', color: owner.color }
}
