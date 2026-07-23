// mutationService.js
// Mutations octroyées en jeu par le MJ (AdvantagesPanel.jsx Lot D) — char_mutations, source='campaign'.
// Distinct du flux Wizard Step3 (creationService.js reconcileCreation, source='chosen'/'random',
// wipe-and-reinsert complet) : ici, ajout unitaire sur un personnage déjà verrouillé, pas de reset.
// Pas de coût PC (décision Saar — octroi narratif, pas un achat), pas de tirage aléatoire (le MJ
// gère la nuance narrative lui-même). Sélection de sous-type (ex. "Caractère génétique animal" →
// félin/canin/reptilien/simiesque) possible depuis Session 141 (suite 10) — voir
// docs/PLAN_ADVANTAGESPANEL.md Lot D et docs/PLAN_MUTATION2.md.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { applyMutationIdentityGrant, recomputeIdentity } from './identityService.js'

// Agrégat mod_FOR..PRE + résistances + identité de toutes les mutations actives d'un personnage —
// char_mutation_effects_view fait déjà la somme + le stacking (migration 109). Null si aucune
// mutation active (pas de ligne GROUP BY). Voir docs/PLAN_MUTATION2.md Lot 1.
export async function getMutationEffects(sheetId) {
  return (await db('char_mutation_effects_view').where({ char_sheet_id: sheetId }).first()) ?? null
}

export async function getMutations(sheetId) {
  return db('char_mutations as cm')
    .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
    .leftJoin('ref_mutation_subtypes as rmst', 'rmst.subtype_id', 'cm.subtype_id')
    .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active' })
    .select(
      'cm.id', 'cm.mutation_id', 'cm.subtype_id', 'cm.source', 'cm.count', 'cm.created_at',
      'rm.name', 'rm.description', 'rmst.name as subtype_name',
      'rm.natural_weapon_formula', 'rm.natural_weapon_requires_grapple',
    )
    .orderBy('cm.created_at', 'asc')
}

// trxOpt : permet l'appel depuis une transaction externe déjà ouverte (ex. reconcileCreation
// STEP4, grant_mutation — l'octroi doit faire partie de la même atomicité que le reste du Wizard,
// pas une transaction séparée qui commiterait indépendamment d'un rollback plus tard dans le même
// reconcile) ; sinon ouvre sa propre transaction sur `db`, comportement inchangé pour l'appelant
// existant (AdvantagesPanel.jsx, octroi MJ en jeu). Même pattern que lockWizard (creationService.js).
// source : distingue l'octroi MJ en jeu ('campaign', défaut — comportement inchangé de l'appelant
// existant) de l'octroi Wizard par Revers/tirage carrière ('revers', creationService.js — même mot
// que char_advantages.acquired_during et que le nom joueur/UI, docs/VOCABULARY.md "Revers"). Avant
// ce paramètre, les deux étaient confondus sous 'campaign' en base, sans aucun moyen de les
// distinguer après coup (audit MJ impossible). Valeur ajoutée à la contrainte CHECK de la colonne
// par la migration 192 — sans elle, l'INSERT échoue (violation de contrainte).
export async function addMutation(sheetId, mutationId, subtypeId = null, source = 'campaign', trxOpt) {
  const run = async (trx) => {
    const mutRef = await trx('ref_mutations').where({ mutation_id: mutationId }).first()
    if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutationId}`)

    let subtypeRef = null
    if (subtypeId != null) {
      subtypeRef = await trx('ref_mutation_subtypes')
        .where({ subtype_id: subtypeId, mutation_id: mutationId })
        .first()
      if (!subtypeRef) throw new AppError(400, `Sous-type inconnu pour cette mutation : ${subtypeId}`)
    }

    // Upsert stackable — mirrors creationService.js STEP3 (knex.onConflict() ne gère pas les
    // index partiels). Deux arbiters distincts (migration 96) : uq_char_mut_no_sub (subtype_id
    // NULL) vs uq_char_mut_with_sub (subtype_id NOT NULL) — Postgres exige de cibler l'un ou
    // l'autre explicitement, jamais les deux dans la même clause ON CONFLICT.
    const { rows } = subtypeId == null
      ? await trx.raw(`
          INSERT INTO char_mutations (char_sheet_id, mutation_id, subtype_id, source, status, count)
          VALUES (?, ?, NULL, ?, 'active', 1)
          ON CONFLICT (char_sheet_id, mutation_id) WHERE subtype_id IS NULL
          DO UPDATE SET count = char_mutations.count + 1
          RETURNING *
        `, [sheetId, mutationId, source])
      : await trx.raw(`
          INSERT INTO char_mutations (char_sheet_id, mutation_id, subtype_id, source, status, count)
          VALUES (?, ?, ?, ?, 'active', 1)
          ON CONFLICT (char_sheet_id, mutation_id, subtype_id) WHERE subtype_id IS NOT NULL
          DO UPDATE SET count = char_mutations.count + 1
          RETURNING *
        `, [sheetId, mutationId, subtypeId, source])
    const row = rows[0]

    // Overrides sexe/fécondité (mirrors STEP3) — garantit la cohérence avec la contrainte
    // not_if_sterile (advantageConstraints.js) même pour une mutation octroyée post-création.
    await applyMutationIdentityGrant(trx, sheetId, mutRef)

    return { ...row, name: mutRef.name, description: mutRef.description, subtype_name: subtypeRef?.name ?? null }
  }
  return trxOpt ? run(trxOpt) : db.transaction(run)
}

export async function removeMutation(sheetId, charMutationId) {
  return db.transaction(async (trx) => {
    // Jointure ref_mutations pour savoir si CETTE mutation retirée déclarait mod_sex/mod_fertility —
    // sert de garde à recomputeIdentity (Lot 6) : ne recalcule jamais sex/is_fertile si la mutation
    // retirée n'y touchait pas.
    const charMut = await trx('char_mutations as cm')
      .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
      .where({ 'cm.id': charMutationId, 'cm.char_sheet_id': sheetId })
      .select('cm.id', 'rm.mod_sex', 'rm.mod_fertility')
      .first()
    if (!charMut) throw new AppError(404, 'Mutation non trouvée')

    const [updated] = await trx('char_mutations')
      .where({ id: charMutationId, char_sheet_id: sheetId })
      .update({ status: 'removed' })
      .returning('*')

    const fields = []
    if (charMut.mod_sex) fields.push('sex')
    if (charMut.mod_fertility) fields.push('is_fertile')
    if (fields.length) await recomputeIdentity(trx, sheetId, fields)

    return updated
  })
}
