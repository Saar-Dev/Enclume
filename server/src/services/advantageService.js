// advantageService.js
// Service char_advantages V2 (soft-delete + snapshot_data). Utilisé par routes/creation.js
// (wizard step5) et routes/character/char-sheet.js (ajout/retrait en campagne).
// Source : docs/Character/Creation/PLAN_CREATION_E5.md — corrigé (AppError, JOIN currentAdvantages,
// pas de champ "notes", catch err.code === '23505').

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { validateAdvantage } from './advantageConstraints.js'

export async function getAdvantages(sheetId) {
  return db('char_advantages as ca')
    .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
    .whereNull('ca.removed_at')
    .where('ca.char_sheet_id', sheetId)
    .select(
      'ca.id', 'ca.advantage_id', 'ca.acquired_at', 'ca.acquired_during',
      'ra.name', 'ra.type', 'ra.description', 'ra.cost_pc', 'ra.special_rule',
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

    const [ledger, allRefAdvantages, sterileMutation] = await Promise.all([
      trx('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
      trx('ref_advantages').select('*'),
      trx('char_mutations as cm')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active', 'rm.mod_fertility': 'sterile' })
        .first(),
    ])
    if (!ledger) throw new AppError(500, 'Ledger PC manquant — incohérence wizard')

    const validation = validateAdvantage(advantageId, currentAdvantages, ledger, allRefAdvantages, !!sterileMutation)
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

    if (advantageId === 'adv_076') {
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: true })
    }

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
      .select('ca.id', 'ca.advantage_id', 'ra.type', 'ra.cost_pc')
      .first()
    if (!charAdv) throw new AppError(404, 'Avantage non trouvé ou déjà supprimé.')

    const [updated] = await trx('char_advantages')
      .where({ id: charAdvantageId })
      .update({ removed_at: trx.fn.now(), removal_reason: reason || null })
      .returning('*')

    if (charAdv.type === 'advantage') {
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).decrement('pc_spent_step5', charAdv.cost_pc)
    } else {
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).decrement('pc_gained_desavantages', Math.abs(charAdv.cost_pc))
    }

    if (charAdv.advantage_id === 'adv_076') {
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: false })
    }

    return updated
  })
}
