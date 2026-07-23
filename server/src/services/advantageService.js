// advantageService.js
// Service char_advantages V2 (soft-delete + snapshot_data). Utilisé par routes/creation.js
// (wizard step5) et routes/character/char-sheet.js (ajout/retrait en campagne).
// Source : docs/Character/Creation/PLAN_CREATION_E5.md — corrigé (AppError, JOIN currentAdvantages,
// pas de champ "notes", catch err.code === '23505').

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { validateAdvantage } from './advantageConstraints.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { applyIdentityGrant, recomputeIdentity, normalizeModIdentity } from './identityService.js'

export async function getAdvantages(sheetId) {
  return db('char_advantages as ca')
    .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
    .whereNull('ca.removed_at')
    .where('ca.char_sheet_id', sheetId)
    .select(
      'ca.id', 'ca.advantage_id', 'ca.acquired_at', 'ca.acquired_during',
      'ra.name', 'ra.type', 'ra.description', 'ra.cost_pc', 'ra.special_rule',
      'ra.mod_attribute', 'ra.mod_value', 'ra.mod_resistance', 'ra.mod_res_value',
    )
    .orderBy('ca.acquired_at', 'asc')
}

/**
 * Ajoute un avantage/désavantage. trxOpt permet l'appel depuis une transaction
 * externe (batch step5) ; sinon ouvre sa propre transaction (pattern trx-or-db).
 */
export async function addAdvantage(sheetId, advantageId, acquiredDuring, trxOpt) {
  const exec = async (trx) => {
    const currentAdvantages = await trx('char_advantages as ca')
      .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
      .whereNull('ca.removed_at')
      .where('ca.char_sheet_id', sheetId)
      .select('ca.advantage_id', 'ra.type', 'ra.cost_pc', 'ra.family', 'ra.family_limit', 'ra.is_unique', 'ra.name')

    const [ledger, allRefAdvantages, sterileMutation, sheetCampaign] = await Promise.all([
      trx('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
      trx('ref_advantages').select('*'),
      trx('char_mutations as cm')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active', 'rm.mod_fertility': 'sterile' })
        .first(),
      trx('char_sheet as cs')
        .join('characters as c', 'c.id', 'cs.character_id')
        .where('cs.id', sheetId)
        .select('c.campaign_id')
        .first(),
    ])
    if (!ledger) throw new AppError(500, 'Ledger PC manquant — incohérence wizard')

    const settings = await getCampaignSettings(trx, sheetCampaign.campaign_id)

    const validation = validateAdvantage(advantageId, currentAdvantages, ledger, allRefAdvantages, !!sterileMutation, settings.polaris_latent)
    if (!validation.valid) throw new AppError(400, validation.message)

    const refAdv = allRefAdvantages.find(a => a.advantage_id === advantageId)

    let row
    try {
      ;[row] = await trx('char_advantages').insert({
        char_sheet_id: sheetId,
        advantage_id: advantageId,
        snapshot_data: JSON.stringify(refAdv),
        acquired_during: acquiredDuring,
      }).returning('*')
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, `Avantage "${refAdv.name}" déjà possédé.`)
      throw err
    }

    if (refAdv.type === 'advantage') {
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).increment('pc_spent_step5', refAdv.cost_pc)
    } else {
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).increment('pc_gained_desavantages', Math.abs(refAdv.cost_pc))
    }

    await applyIdentityGrant(trx, sheetId, refAdv.mod_identity)

    return row
  }

  if (trxOpt) return exec(trxOpt)
  return db.transaction(exec)
}

export async function removeAdvantage(sheetId, charAdvantageId, reason) {
  return db.transaction(async (trx) => {
    const charAdv = await trx('char_advantages as ca')
      .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
      .where({ 'ca.id': charAdvantageId, 'ca.char_sheet_id': sheetId })
      .whereNull('ca.removed_at')
      .select('ca.id', 'ca.advantage_id', 'ca.acquired_during', 'ra.type', 'ra.cost_pc', 'ra.mod_identity')
      .first()
    if (!charAdv) throw new AppError(404, 'Avantage non trouvé ou déjà supprimé.')

    const [updated] = await trx('char_advantages')
      .where({ id: charAdvantageId })
      .update({ removed_at: trx.fn.now(), removal_reason: reason || null })
      .returning('*')

    // Un octroi narratif (grantAdvantage, acquired_during !== 'creation_step5') n'a jamais crédité/
    // débité char_pc_ledger — ne jamais le décrémenter au retrait, sinon on retire un budget qui n'a
    // jamais été affecté par cet avantage (bug qui serait resté invisible tant qu'aucune source
    // narrative n'existait — première fois que acquired_during peut différer de 'creation_step5').
    if (charAdv.acquired_during === 'creation_step5') {
      if (charAdv.type === 'advantage') {
        await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).decrement('pc_spent_step5', charAdv.cost_pc)
      } else {
        await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).decrement('pc_gained_desavantages', Math.abs(charAdv.cost_pc))
      }
    }

    const modIdentity = normalizeModIdentity(charAdv.mod_identity)
    if (modIdentity) {
      await recomputeIdentity(trx, sheetId, Object.keys(modIdentity))
    }

    return updated
  })
}

/**
 * Octroi narratif MJ post-création — même contraintes que addAdvantage (moins le budget PC,
 * inexistant/épuisé pour un personnage verrouillé), aucun contact avec char_pc_ledger. Pattern
 * identique à mutationService.addMutation (source='campaign', pas de coût).
 *
 * trxOpt : permet l'appel depuis une transaction externe déjà ouverte (ex. reconcileCreation
 * STEP4, Revers → grant_advantage/manual_grant_choice, PLAN_WIZARD_AVANTAGES.md §17 — l'octroi
 * doit faire partie de la même atomicité que le reste du Wizard, pas une transaction séparée qui
 * commiterait indépendamment d'un rollback plus tard dans le même reconcile). Même correction que
 * mutationService.addMutation (Lot 1, même raison) ; sinon comportement inchangé (octroi MJ en jeu).
 */
export async function grantAdvantage(sheetId, advantageId, acquiredDuring, trxOpt) {
  const run = async (trx) => {
    const currentAdvantages = await trx('char_advantages as ca')
      .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
      .whereNull('ca.removed_at')
      .where('ca.char_sheet_id', sheetId)
      .select('ca.advantage_id', 'ra.type', 'ra.cost_pc', 'ra.family', 'ra.family_limit', 'ra.is_unique', 'ra.name')

    const [allRefAdvantages, sterileMutation, sheetCampaign] = await Promise.all([
      trx('ref_advantages').select('*'),
      trx('char_mutations as cm')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active', 'rm.mod_fertility': 'sterile' })
        .first(),
      trx('char_sheet as cs')
        .join('characters as c', 'c.id', 'cs.character_id')
        .where('cs.id', sheetId)
        .select('c.campaign_id')
        .first(),
    ])

    const settings = await getCampaignSettings(trx, sheetCampaign.campaign_id)

    const validation = validateAdvantage(advantageId, currentAdvantages, null, allRefAdvantages, !!sterileMutation, settings.polaris_latent, true)
    if (!validation.valid) throw new AppError(400, validation.message)

    const refAdv = allRefAdvantages.find(a => a.advantage_id === advantageId)

    let row
    try {
      ;[row] = await trx('char_advantages').insert({
        char_sheet_id: sheetId,
        advantage_id: advantageId,
        snapshot_data: JSON.stringify(refAdv),
        acquired_during: acquiredDuring,
      }).returning('*')
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, `Avantage "${refAdv.name}" déjà possédé.`)
      throw err
    }

    await applyIdentityGrant(trx, sheetId, refAdv.mod_identity)

    // Forme identique à getAdvantages() (JOIN ref_advantages) — le client pousse directement ce
    // retour dans charAdvantages sans re-fetch, il doit porter les mêmes champs (name/type/...)
    // que toutes les autres lignes de la liste, sinon l'entrée fraîchement ajoutée s'afficherait
    // vide jusqu'au prochain rechargement complet de la fiche.
    return {
      id: row.id,
      advantage_id: row.advantage_id,
      acquired_at: row.acquired_at,
      acquired_during: row.acquired_during,
      name: refAdv.name,
      type: refAdv.type,
      description: refAdv.description,
      cost_pc: refAdv.cost_pc,
      special_rule: refAdv.special_rule,
      mod_attribute: refAdv.mod_attribute,
      mod_value: refAdv.mod_value,
      mod_resistance: refAdv.mod_resistance,
      mod_res_value: refAdv.mod_res_value,
    }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

// ─── Notes "Autres" (texte libre) — table dédiée, hors catalogue ref_advantages ─
// Pas de coût PC, pas de contrainte de famille/unicité, pas de soft-delete (aucun
// enjeu mécanique à auditer). Voir docs/PLAN_ADVANTAGESPANEL.md Lot C.

export async function getAdvantageNotes(sheetId) {
  return db('char_advantage_notes').where({ char_sheet_id: sheetId }).orderBy('created_at', 'asc')
}

export async function addAdvantageNote(sheetId, label) {
  const trimmed = (label ?? '').trim()
  if (!trimmed) throw new AppError(400, 'label requis')
  if (trimmed.length > 255) throw new AppError(400, 'label limité à 255 caractères')
  const [row] = await db('char_advantage_notes')
    .insert({ char_sheet_id: sheetId, label: trimmed })
    .returning('*')
  return row
}

export async function removeAdvantageNote(sheetId, noteId) {
  const deleted = await db('char_advantage_notes')
    .where({ id: noteId, char_sheet_id: sheetId })
    .del()
  if (!deleted) throw new AppError(404, 'Note non trouvée')
  return { deleted: true }
}
