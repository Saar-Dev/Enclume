// server/src/lib/deathStateService.js — « ce personnage est-il un cadavre ? » (autorité unique).
//
// Chantier 6ᵉ ligne du compteur de blessures (docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md, Lots 1e/1f).
// Règle Saar 2026-09-24 : un mort reste une cible et prend des blessures (technologies de résurrection),
// mais ne peut NI esquiver NI dépenser de Chance. Modèle : « immunités aux états » de dnd5e
// (`traits.ci`) / PF2e — la cible reste visée, seul l'effet n'est pas appliqué.
//
// Le statut `dead` est porté par un TOKEN, la Chance par la FICHE : un personnage est mort si l'un de ses
// tokens porte un statut `isDeath` du registre (même lecture « au niveau du personnage » que `/heal`,
// woundService.js:clearCharacterWoundsAndStatuses). Actif seulement en mode `status_effects_mode ===
// 'enforced'` (comme le blocage de déclaration, combatTurnEngine.js:getDeclarationBlockedTokens) :
// 'icon_only'/'off' n'ont aucun effet mécanique.
//
// Module FEUILLE (dépend seulement du registre partagé et des réglages de campagne, `db` reçu en
// paramètre) : `exoPilotService.js`, elle-même feuille du graphe d'import, l'appelle.

import { DEATH_STATUS_CODES } from '../../../shared/tokenStatusRegistry.js'
import { getCampaignSettings } from './campaignSettingsService.js'

export async function isCharacterDead(db, campaignId, characterId) {
  if (!characterId) return false
  const settings = await getCampaignSettings(db, campaignId)
  if (settings.status_effects_mode !== 'enforced') return false
  const row = await db('token_statuses as ts')
    .join('tokens as t', 't.id', 'ts.token_id')
    .where('t.character_id', characterId)
    .whereIn('ts.status_code', DEATH_STATUS_CODES)
    .first('ts.id')
  return !!row
}
