// vaultCoreService.js — Accès bas niveau à la table `vaults` (une par compte).
//
// Extrait de vaultService.js pour casser un cycle d'import : vaultService.js importe déjà
// lockWizard depuis creationService.js, et creationService.js a besoin de créer/retrouver le
// Vault d'un utilisateur pour la création de personnage directement dans le Coffre (sans
// campagne) — getOrCreateVault ne peut donc pas rester dans vaultService.js sans fermer le cycle.
// Ce module ne dépend ni de creationService.js ni de vaultService.js.

import db from '../db/knex.js'

export async function getOrCreateVault(userId) {
  const existing = await db('vaults').where({ user_id: userId }).first()
  if (existing) return existing
  try {
    const [vault] = await db('vaults').insert({ user_id: userId }).returning('*')
    return vault
  } catch (err) {
    // vaults.user_id est UNIQUE : deux appels concurrents (double-clic, deux onglets) peuvent
    // tous les deux échouer à trouver un Vault existant puis se percuter sur l'INSERT — le second
    // retombe sur le Vault créé entre-temps par le premier plutôt que de planter en 500.
    if (err.code === '23505') {
      const raceWinner = await db('vaults').where({ user_id: userId }).first()
      if (raceWinner) return raceWinner
    }
    throw err
  }
}
