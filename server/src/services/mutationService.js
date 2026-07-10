// mutationService.js
// Mutations octroyées en jeu par le MJ (AdvantagesPanel.jsx Lot D) — char_mutations, source='campaign'.
// Distinct du flux Wizard Step3 (creationService.js reconcileCreation, source='chosen'/'random',
// wipe-and-reinsert complet) : ici, ajout unitaire sur un personnage déjà verrouillé, pas de reset.
// Pas de coût PC (décision Saar — octroi narratif, pas un achat), pas de sélection de sous-type ni
// de tirage aléatoire (le MJ gère la nuance narrative lui-même). Voir docs/PLAN_ADVANTAGESPANEL.md Lot D.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// Agrégat mod_FOR..PRE + résistances + identité de toutes les mutations actives d'un personnage —
// char_mutation_effects_view fait déjà la somme + le stacking (migration 109). Null si aucune
// mutation active (pas de ligne GROUP BY). Voir docs/PLAN_MUTATION2.md Lot 1.
export async function getMutationEffects(sheetId) {
  return (await db('char_mutation_effects_view').where({ char_sheet_id: sheetId }).first()) ?? null
}

export async function getMutations(sheetId) {
  return db('char_mutations as cm')
    .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
    .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active' })
    .select('cm.id', 'cm.mutation_id', 'cm.subtype_id', 'cm.source', 'cm.count', 'cm.created_at', 'rm.name', 'rm.description')
    .orderBy('cm.created_at', 'asc')
}

export async function addMutation(sheetId, mutationId) {
  return db.transaction(async (trx) => {
    const mutRef = await trx('ref_mutations').where({ mutation_id: mutationId }).first()
    if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutationId}`)

    // Upsert stackable sans sous-type — mirrors creationService.js STEP3 (index partiel
    // uq_char_mut_no_sub, knex.onConflict() ne gère pas les index partiels).
    const { rows } = await trx.raw(`
      INSERT INTO char_mutations (char_sheet_id, mutation_id, subtype_id, source, status, count)
      VALUES (?, ?, NULL, 'campaign', 'active', 1)
      ON CONFLICT (char_sheet_id, mutation_id) WHERE subtype_id IS NULL
      DO UPDATE SET count = char_mutations.count + 1
      RETURNING *
    `, [sheetId, mutationId])
    const row = rows[0]

    // Overrides sexe/fécondité (mirrors STEP3) — garantit la cohérence avec la contrainte
    // not_if_sterile (advantageConstraints.js) même pour une mutation octroyée post-création.
    const archetypeUpdate = {}
    if (mutRef.mod_sex) archetypeUpdate.sex = mutRef.mod_sex
    if (mutRef.mod_fertility) archetypeUpdate.is_fertile = mutRef.mod_fertility === 'self_fertile'
    if (Object.keys(archetypeUpdate).length > 0) {
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update(archetypeUpdate)
    }

    return { ...row, name: mutRef.name, description: mutRef.description }
  })
}

export async function removeMutation(sheetId, charMutationId) {
  const [updated] = await db('char_mutations')
    .where({ id: charMutationId, char_sheet_id: sheetId })
    .update({ status: 'removed' })
    .returning('*')
  if (!updated) throw new AppError(404, 'Mutation non trouvée')
  return updated
}
