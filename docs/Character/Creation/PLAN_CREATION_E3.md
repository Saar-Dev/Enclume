PLAN ÉTAPE 3 — CAPACITÉS SPÉCIALES (MUTATIONS) • VERSION FINALE v3

Vérifié contre : LdB p.117-125 + migrations 091 v2, 095, 096 + plan étapes 1-2 + correctifs session 127
SOMMAIRE

    Architecture données

    API Routes

    Services

    Fonctions partagées

    Composant UI

    Intégration Wizard

    Intégration CharacterSheet

    i18n

    Fichiers touchés

    Scénarios de test

1. ARCHITECTURE DONNÉES
1.1 Migration 095 — char_mutations + tables associées
js

// 095_create_char_mutations_polaris_advantages_careers_traits.cjs
// Crée char_mutations + char_polaris + char_personal_advantages + char_careers + char_traits
// La vue char_mutation_effects_view est créée dans 096 (après ref_mutations)

export const up = async (knex) => {

  // ════════════════════════════════════════════════════════════
  // char_mutations — liaison PJ ↔ mutation
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_mutations', (table) => {
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.integer('mutation_id').notNullable()
    table.integer('subtype_id').references('subtype_id').inTable('ref_mutation_subtypes')
    table.text('source').notNullable().defaultTo('chosen')
    table.text('status').notNullable().defaultTo('active')
    table.integer('count').defaultTo(1)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.primary(['char_sheet_id', 'mutation_id', 'subtype_id'])
  })

  await knex.schema.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random')),
    ADD CONSTRAINT chk_char_mutations_status CHECK (status IN ('active', 'removed'))
  `)

  // Note : la vue char_mutation_effects_view est créée dans 096 (dépend de ref_mutations)

  // ════════════════════════════════════════════════════════════
  // char_polaris — Force Polaris (étape 5, hors scope V1)
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_polaris', (table) => {
    table.uuid('char_sheet_id').primary().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('state').notNullable()
    table.jsonb('powers')
  })

  // ════════════════════════════════════════════════════════════
  // char_personal_advantages — Avantages/Désavantages (étape 5)
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_personal_advantages', (table) => {
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('advantage_id').notNullable()
    table.text('type').notNullable()
    table.primary(['char_sheet_id', 'advantage_id'])
  })

  // ════════════════════════════════════════════════════════════
  // char_careers — Professions (étape 4)
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_careers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.uuid('career_id').notNullable().references('id').inTable('ref_careers').onDelete('CASCADE')
    table.integer('years').notNullable()
    table.integer('savings').defaultTo(0)
    table.jsonb('pro_advantages')
    table.jsonb('random_picks')
    table.jsonb('setbacks')
  })

  // ════════════════════════════════════════════════════════════
  // char_traits — Traits divers
  // ════════════════════════════════════════════════════════════
  await knex.schema.createTable('char_traits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('trait_type').notNullable()
    table.jsonb('params')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_traits')
  await knex.schema.dropTableIfExists('char_careers')
  await knex.schema.dropTableIfExists('char_personal_advantages')
  await knex.schema.dropTableIfExists('char_polaris')
  await knex.schema.dropTableIfExists('char_mutations')
}

1.2 Migration 096 — ref_mutations + vue
js

// 96_ref_mutations.cjs
// Crée ref_mutations, ref_mutation_subtypes, ref_mutation_skills,
// ref_mutation_discounts, ref_mutation_incompatibilities + seed + vue

export const up = async (knex) => {

  // ... (création des tables ref_mutations, ref_mutation_subtypes, etc. — existant)

  // ... (seed des 50 mutations — existant)

  // ════════════════════════════════════════════════════════════
  // Vue agrégée des effets actifs des mutations
  // ════════════════════════════════════════════════════════════
  await knex.schema.raw(`
    CREATE VIEW char_mutation_effects_view AS
    SELECT 
      cm.char_sheet_id,
      COALESCE(SUM(COALESCE(rms.mod_FOR, rm.mod_FOR)), 0) AS mod_FOR,
      COALESCE(SUM(COALESCE(rms.mod_CON, rm.mod_CON)), 0) AS mod_CON,
      COALESCE(SUM(COALESCE(rms.mod_COO, rm.mod_COO)), 0) AS mod_COO,
      COALESCE(SUM(COALESCE(rms.mod_INT, rm.mod_INT)), 0) AS mod_INT,
      COALESCE(SUM(COALESCE(rms.mod_VOL, rm.mod_VOL)), 0) AS mod_VOL,
      COALESCE(SUM(COALESCE(rms.mod_PRE, rm.mod_PRE)), 0) AS mod_PRE,
      COALESCE(SUM(rm.mod_res_damage), 0) AS mod_res_damage,
      COALESCE(SUM(rm.mod_res_shock), 0) AS mod_res_shock,
      COALESCE(SUM(rm.mod_res_drugs), 0) AS mod_res_drugs,
      COALESCE(SUM(rm.mod_res_disease), 0) AS mod_res_disease,
      COALESCE(SUM(rm.mod_res_poison), 0) AS mod_res_poison,
      COALESCE(SUM(rm.mod_res_radiation), 0) AS mod_res_radiation,
      COALESCE(SUM(rm.natural_armor), 0) AS natural_armor,
      BOOL_OR(rm.mod_sex = 'androgyne') AS is_androgyne,
      BOOL_OR(rm.mod_sex = 'asexue') AS is_asexue,
      BOOL_OR(rm.mod_fertility = 'sterile') AS is_sterile,
      BOOL_OR(rm.mod_fertility = 'self_fertile') AS is_self_fertile,
      STRING_AGG(rm.special_effect, ' | ') FILTER (WHERE rm.special_effect IS NOT NULL) AS special_effects
    FROM char_mutations cm
    JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
    LEFT JOIN ref_mutation_subtypes rms ON rms.subtype_id = cm.subtype_id
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
  `)
}

export const down = async (knex) => {
  await knex.schema.raw('DROP VIEW IF EXISTS char_mutation_effects_view')
  // ... (drop tables existant)
}

1.3 State machine
text

draft_step2 → draft_step3  (validation étape 3)
draft_step3 → draft_step2  (rollback)

1.4 Tables de référence (non modifiées)

    ref_mutations — 50 mutations, seed complet dans 096

    ref_mutation_subtypes — Caractère animal (4) + Organes sensoriels (10)

    ref_mutation_skills — Compétences débloquées

    ref_mutation_discounts — Réductions (V1 non utilisé)

    ref_mutation_incompatibilities — Incompatibilités

2. API ROUTES
2.1 server/src/routes/creation.js — ajouts
js

// GET /step3/:sheetId — Données pour l'étape 3
router.get('/step3/:sheetId', async (req, res) => {
  try {
    const data = await creationService.getStep3Data(req.params.sheetId)
    res.json(data)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /step3/:sheetId — Validation + persistance (ACHAT)
router.post('/step3/:sheetId', async (req, res) => {
  try {
    const result = await creationService.validateAndPersistStep3(req.params.sheetId, req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /step3/:sheetId/roll — Tirage aléatoire sans persistance
router.post('/step3/:sheetId/roll', async (req, res) => {
  try {
    const result = await creationService.rollMutations(req.params.sheetId)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /step3/:sheetId/random — Validation + persistance (ALÉATOIRE)
router.post('/step3/:sheetId/random', async (req, res) => {
  try {
    const result = await creationService.validateAndPersistStep3Random(req.params.sheetId, req.body)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /rollback-to-step2/:sheetId — Retour à l'étape 2
router.post('/rollback-to-step2/:sheetId', async (req, res) => {
  try {
    const result = await creationService.rollbackToStep2(req.params.sheetId)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

2.2 server/src/routes/char-ref.js — ajout
js

// GET /mutation-subtypes/:mutationId
router.get('/mutation-subtypes/:mutationId', async (req, res) => {
  try {
    const subtypes = await db('ref_mutation_subtypes')
      .where({ mutation_id: req.params.mutationId })
      .orderBy('d4_roll')
    res.json({ subtypes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

2.3 server/src/routes/char-sheet.js — ajout

ATTENTION : définir cette route AVANT GET /:characterId pour éviter qu'Express n'interprète "mutation-effects" comme un characterId.
js

// GET /:characterId/mutation-effects — DOIT ÊTRE AVANT GET /:characterId
router.get('/:characterId/mutation-effects', async (req, res) => {
  try {
    const sheet = await db('char_sheet').where({ character_id: req.params.characterId }).first()
    if (!sheet) return res.status(404).json({ error: 'Fiche introuvable.' })

    const effects = await db('char_mutation_effects_view')
      .where({ char_sheet_id: sheet.id })
      .first()

    res.json({ effects: effects || {} })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

3. SERVICES
3.1 server/src/services/creationService.js — ajouts complets
js

import { calcMutationsCost, calcRemovalCost, getMutationRollCount, validateMutationConstraints } from '../../../shared/polarisUtils.js'

// ══════════════════════════════════════════════════════════════
// ÉTAPE 3 : CAPACITÉS SPÉCIALES (MUTATIONS)
// ══════════════════════════════════════════════════════════════

export async function getStep3Data(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step2') {
    throw { status: 400, message: 'Wizard non disponible pour cette étape.' }
  }

  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
  if (!ledger) throw { status: 500, message: 'Ledger introuvable.' }

  const availablePC = ledger.pc_total
    - ledger.pc_spent_step1
    - ledger.pc_spent_step2
    + ledger.pc_gained_desavantages

  const mutations = await db('ref_mutations')
    .select('*')
    .orderBy('cost_pc', 'desc')
    .orderBy('name')

  const incompatibilities = await db('ref_mutation_incompatibilities').select('*')

  const currentMutations = await db('char_mutations')
    .where({ char_sheet_id: sheetId, status: 'active' })
    .select('mutation_id', 'subtype_id', 'source')

  return { mutations, currentMutations, availablePC, incompatibilities }
}

export async function validateAndPersistStep3(sheetId, data) {
  const { mutations: selectedMutations } = data

  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step2') {
    throw { status: 400, message: 'Étape non accessible.' }
  }

  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
  const availablePC = ledger.pc_total
    - ledger.pc_spent_step1
    - ledger.pc_spent_step2
    + ledger.pc_gained_desavantages

  const mutationIds = selectedMutations.map(m => m.mutation_id)

  const trx = await db.transaction()

  try {
    // Toutes les lectures dans la transaction
    const refMutations = await trx('ref_mutations').whereIn('mutation_id', mutationIds)

    // Rejeter les mutations désavantageuses
    const hasNegativeCost = refMutations.some(m => m.cost_pc < 0)
    if (hasNegativeCost) {
      await trx.rollback()
      throw { status: 400, message: 'Les mutations désavantageuses ne peuvent pas être achetées. Utilisez la méthode Aléatoire ou l\'étape 5 (Désavantages).' }
    }

    const allMutations = await trx('ref_mutations').select(
      'mutation_id', 'name', 'is_unique', 'is_stackable', 'stack_limit',
      'max_cumul_group', 'max_cumul_limit'
    )
    const incompatibilities = await trx('ref_mutation_incompatibilities').select('*')

    const existingMutations = await trx('char_mutations')
      .where({ char_sheet_id: sheetId, status: 'active' })
      .select('mutation_id')
    const existingIds = existingMutations.map(m => m.mutation_id)

    const totalCost = calcMutationsCost(refMutations)

    const { valide, erreurs } = validateMutationConstraints(
      mutationIds, allMutations, incompatibilities, existingIds
    )
    if (!valide) {
      await trx.rollback()
      throw { status: 400, message: erreurs.join(' ') }
    }

    if (availablePC < totalCost) {
      await trx.rollback()
      throw { status: 400, message: `PC insuffisants : ${totalCost} requis, ${availablePC} disponibles.` }
    }

    for (const mut of selectedMutations) {
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id: mut.mutation_id,
        subtype_id: mut.subtype_id || null,
        source: 'chosen',
        status: 'active',
      })
    }

    const mutationSkills = await trx('ref_mutation_skills').whereIn('mutation_id', mutationIds)
    for (const ms of mutationSkills) {
      const existing = await trx('char_skills')
        .where({ char_sheet_id: sheetId, skill_id: ms.skill_name })
        .first()
      if (!existing) {
        await trx('char_skills').insert({
          char_sheet_id: sheetId,
          skill_id: ms.skill_name,
          mastery: 0,
          is_learned: true,
        })
      }
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: totalCost })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    await trx.commit()

    return { success: true, availablePC: availablePC - totalCost, mutations: selectedMutations }
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

export async function rollMutations(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step2') {
    throw { status: 400, message: 'Étape non accessible.' }
  }

  const d20 = Math.floor(Math.random() * 20) + 1
  const count = getMutationRollCount(d20)

  const allMutations = await db('ref_mutations').select(
    'mutation_id', 'name', 'cost_pc', 'd100_range_start', 'd100_range_end',
    'has_subtable', 'subtype', 'description'
  )

  const results = []
  for (let i = 0; i < count; i++) {
    const d100 = Math.floor(Math.random() * 100) + 1
    const mutation = allMutations.find(m => d100 >= m.d100_range_start && d100 <= m.d100_range_end)

    if (!mutation) {
      results.push({ d100, mutation: allMutations[0], subtype: null, error: 'Plage D100 non couverte' })
      continue
    }

    let subtype = null
    if (mutation.has_subtable) {
      const subtypes = await db('ref_mutation_subtypes')
        .where({ mutation_id: mutation.mutation_id })
        .orderBy('d4_roll')
      if (subtypes.length > 0) {
        const roll = Math.floor(Math.random() * subtypes.length) + 1
        subtype = subtypes.find(s => s.d4_roll === roll) || subtypes[0]
      }
    }

    results.push({
      d100,
      mutation: {
        mutation_id: mutation.mutation_id,
        name: mutation.name,
        cost_pc: mutation.cost_pc,
        description: mutation.description,
      },
      subtype: subtype ? {
        subtype_id: subtype.subtype_id,
        name: subtype.name,
        d4_roll: subtype.d4_roll,
      } : null,
    })
  }

  return { d20, count, results }
}

export async function validateAndPersistStep3Random(sheetId, data) {
  const { kept, removed } = data

  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || sheet.creation_state !== 'draft_step2') {
    throw { status: 400, message: 'Étape non accessible.' }
  }

  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
  const availablePC = ledger.pc_total
    - ledger.pc_spent_step1
    - ledger.pc_spent_step2
    + ledger.pc_gained_desavantages

  let removalCost = 0
  if (removed && removed.length > 0) {
    const removedIds = removed.map(r => r.mutation_id)
    const removedMutations = await db('ref_mutations').whereIn('mutation_id', removedIds)
    removalCost = removedMutations.reduce((sum, m) => sum + calcRemovalCost(m), 0)
  }

  if (availablePC < removalCost) {
    throw { status: 400, message: `PC insuffisants pour les suppressions : ${removalCost} requis.` }
  }

  const trx = await db.transaction()

  try {
    // Récupérer les mutations déjà actives
    const existing = await trx('char_mutations')
      .where({ char_sheet_id: sheetId, status: 'active' })
      .select('mutation_id', 'subtype_id')

    const existingKeys = new Set(
      existing.map(e => `${e.mutation_id}:${e.subtype_id ?? 'NULL'}`)
    )

    // Filtrer les kept pour exclure les doublons
    const duplicates = []
    const toInsert = []

    for (const mut of (kept || [])) {
      const key = `${mut.mutation_id}:${mut.subtype_id ?? 'NULL'}`
      if (existingKeys.has(key)) {
        duplicates.push(mut)
      } else {
        toInsert.push(mut)
        existingKeys.add(key)
      }
    }

    for (const mut of toInsert) {
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id: mut.mutation_id,
        subtype_id: mut.subtype_id || null,
        source: 'random',
        status: 'active',
      })
    }

    for (const mut of (removed || [])) {
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id: mut.mutation_id,
        subtype_id: mut.subtype_id || null,
        source: 'random',
        status: 'removed',
      })
    }

    const keptIds = toInsert.map(m => m.mutation_id)
    if (keptIds.length > 0) {
      const mutationSkills = await trx('ref_mutation_skills').whereIn('mutation_id', keptIds)
      for (const ms of mutationSkills) {
        const exists = await trx('char_skills')
          .where({ char_sheet_id: sheetId, skill_id: ms.skill_name })
          .first()
        if (!exists) {
          await trx('char_skills').insert({
            char_sheet_id: sheetId,
            skill_id: ms.skill_name,
            mastery: 0,
            is_learned: true,
          })
        }
      }
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: removalCost })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    await trx.commit()

    return {
      success: true,
      availablePC: availablePC - removalCost,
      inserted: toInsert.length,
      duplicates: duplicates.length,
      removed: removed?.length || 0,
    }
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

export async function rollbackToStep2(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet || !['draft_step2', 'draft_step3'].includes(sheet.creation_state)) {
    throw { status: 400, message: 'Rollback non disponible.' }
  }

  const trx = await db.transaction()

  try {
    // Récupérer les mutation_ids avant suppression pour nettoyer les skills
    const removedMutations = await trx('char_mutations')
      .where({ char_sheet_id: sheetId })
      .whereIn('source', ['chosen', 'random'])
      .select('mutation_id')

    const removedIds = removedMutations.map(m => m.mutation_id)

    if (removedIds.length > 0) {
      const skillsToRemove = await trx('ref_mutation_skills')
        .whereIn('mutation_id', removedIds)
        .select('skill_name')

      const skillNames = skillsToRemove.map(s => s.skill_name)

      if (skillNames.length > 0) {
        await trx('char_skills')
          .where({ char_sheet_id: sheetId })
          .whereIn('skill_id', skillNames)
          .del()
      }
    }

    await trx('char_mutations')
      .where({ char_sheet_id: sheetId })
      .whereIn('source', ['chosen', 'random'])
      .del()

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: 0 })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step2' })

    await trx.commit()

    const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
    const availablePC = ledger.pc_total
      - ledger.pc_spent_step1
      - ledger.pc_spent_step2
      + ledger.pc_gained_desavantages

    return { success: true, availablePC }
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

4. FONCTIONS PARTAGÉES
4.1 shared/polarisUtils.js — ajouts
js

/**
 * Calcule le coût total en PC d'une liste de mutations.
 */
export function calcMutationsCost(mutations) {
  return mutations.reduce((sum, m) => sum + (m.cost_pc || 0), 0)
}

/**
 * Coût de suppression d'une mutation. Gratuit si avantageuse (cost_pc > 0),
 * 1 PC si neutre (0) ou désavantageuse (<0).
 */
export function calcRemovalCost(mutation) {
  return (mutation.cost_pc > 0) ? 0 : 1
}

/**
 * Nombre de mutations obtenues par tirage 1D20.
 * 1-15 → 1, 16-19 → 2, 20 → 3
 */
export function getMutationRollCount(d20Result) {
  if (d20Result <= 15) return 1
  if (d20Result <= 19) return 2
  return 3
}

/**
 * Valide les contraintes de cumul et d'incompatibilité.
 * @param {number[]} selectedIds - IDs sélectionnés
 * @param {object[]} allMutations - Toutes les mutations de référence
 * @param {object[]} incompatibilities - [{ mutation_id_a, mutation_id_b }]
 * @param {number[]} existingMutationIds - IDs déjà actifs en base
 */
export function validateMutationConstraints(selectedIds, allMutations, incompatibilities = [], existingMutationIds = []) {
  const erreurs = []
  const mutationMap = new Map(allMutations.map(m => [m.mutation_id, m]))

  const allIds = [...selectedIds, ...existingMutationIds]

  const counts = new Map()
  for (const id of allIds) {
    counts.set(id, (counts.get(id) || 0) + 1)
  }

  for (const [id, count] of counts) {
    const mut = mutationMap.get(id)
    if (!mut) continue

    if (mut.is_unique && count > 1) {
      erreurs.push(`${mut.name} est unique (une seule occurrence autorisée).`)
    }
    if (mut.is_stackable && mut.stack_limit != null && mut.stack_limit > 0 && count > mut.stack_limit) {
      erreurs.push(`${mut.name} limité à ${mut.stack_limit} occurrence(s).`)
    }
  }

  const groupCounts = new Map()
  for (const id of allIds) {
    const mut = mutationMap.get(id)
    if (mut?.max_cumul_group) {
      groupCounts.set(mut.max_cumul_group, (groupCounts.get(mut.max_cumul_group) || 0) + 1)
    }
  }
  for (const id of allIds) {
    const mut = mutationMap.get(id)
    if (mut?.max_cumul_group && mut?.max_cumul_limit) {
      const current = groupCounts.get(mut.max_cumul_group) || 0
      if (current > mut.max_cumul_limit) {
        erreurs.push(`Limite du groupe "${mut.max_cumul_group}" dépassée (max ${mut.max_cumul_limit}).`)
        break
      }
    }
  }

  const allIdsSet = new Set(allIds)
  for (const inc of incompatibilities) {
    if (allIdsSet.has(inc.mutation_id_a) && allIdsSet.has(inc.mutation_id_b)) {
      const nameA = mutationMap.get(inc.mutation_id_a)?.name || inc.mutation_id_a
      const nameB = mutationMap.get(inc.mutation_id_b)?.name || inc.mutation_id_b
      erreurs.push(`Incompatibilité : ${nameA} et ${nameB} ne peuvent pas être prises ensemble.`)
    }
  }

  return { valide: erreurs.length === 0, erreurs }
}

5. COMPOSANT UI
5.1 client/src/components/creation/Step3Mutations.jsx
jsx

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api.js'

export default function Step3Mutations({ sheetId, availablePC: initialPC, onNext, onPrev }) {
  const { t } = useTranslation()

  // ─── État ───────────────────────────────────────────────────────────
  const [method, setMethod] = useState(null)
  const [allMutations, setAllMutations] = useState([])
  const [incompatibilities, setIncompatibilities] = useState([])
  const [selectedMutations, setSelectedMutations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [availablePC, setAvailablePC] = useState(initialPC)

  // Aléatoire
  const [rollResult, setRollResult] = useState(null)
  const [keptMutations, setKeptMutations] = useState([])
  const [removedMutations, setRemovedMutations] = useState([])
  const [rolling, setRolling] = useState(false)

  // Sous-type
  const [pendingSubtype, setPendingSubtype] = useState(null)
  const [subtypes, setSubtypes] = useState([])

  // ─── Chargement ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/creation/step3/${sheetId}`)
        setAllMutations(res.data.mutations || [])
        setIncompatibilities(res.data.incompatibilities || [])
        setAvailablePC(res.data.availablePC)
      } catch (err) {
        setError(err.response?.data?.error || t('common.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sheetId])

  // ─── Helpers ────────────────────────────────────────────────────────
  const totalCost = selectedMutations.reduce((sum, m) => sum + (m.cost_pc || 0), 0)
  const canAfford = (mutation) => (availablePC - totalCost) >= (mutation.cost_pc || 0)

  // ─── Handlers ACHAT ─────────────────────────────────────────────────
  const handleAddMutation = async (mutation) => {
    if (pendingSubtype) return

    if (mutation.has_subtable) {
      try {
        const res = await api.get(`/char-ref/mutation-subtypes/${mutation.mutation_id}`)
        setSubtypes(res.data.subtypes || [])
        setPendingSubtype({ mutation, showSelector: true })
      } catch (err) {
        setError('Impossible de charger les sous-types.')
      }
      return
    }
    if (!canAfford(mutation)) return
    setSelectedMutations(prev => [...prev, { ...mutation, subtype_id: null }])
  }

  const handleSelectSubtype = (subtype) => {
    if (!pendingSubtype) return
    const mutation = pendingSubtype.mutation
    if (!canAfford(mutation)) return
    setSelectedMutations(prev => [...prev, {
      ...mutation,
      subtype_id: subtype.subtype_id,
      subtype_name: subtype.name,
    }])
    setPendingSubtype(null)
  }

  const handleRemoveMutation = (index) => {
    setSelectedMutations(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitChosen = async () => {
    try {
      const payload = {
        method: 'chosen',
        mutations: selectedMutations.map(m => ({
          mutation_id: m.mutation_id,
          subtype_id: m.subtype_id || null,
        })),
      }
      const res = await api.post(`/creation/step3/${sheetId}`, payload)
      onNext?.(res.data)
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    }
  }

  // ─── Handlers ALÉATOIRE ─────────────────────────────────────────────
  const handleRoll = async () => {
    try {
      setRolling(true)
      setError(null)
      const res = await api.post(`/creation/step3/${sheetId}/roll`)
      setRollResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    } finally {
      setRolling(false)
    }
  }

  const handleKeep = (result, index) => {
    setKeptMutations(prev => [...prev, result])
    const newResults = [...rollResult.results]
    newResults.splice(index, 1)
    setRollResult({ ...rollResult, results: newResults })
  }

  const handleRemoveRandom = (result, index) => {
    const cost = result.mutation.cost_pc > 0 ? 0 : 1
    if (availablePC < cost) {
      setError(t('creation.step3.insufficient_pc'))
      return
    }
    setAvailablePC(prev => prev - cost)
    setRemovedMutations(prev => [...prev, result])
    const newResults = [...rollResult.results]
    newResults.splice(index, 1)
    setRollResult({ ...rollResult, results: newResults })
  }

  const handleSubmitRandom = async () => {
    if (rollResult && rollResult.results.length > 0) {
      setError(t('creation.step3.pending_mutations'))
      return
    }
    try {
      const payload = {
        method: 'random',
        kept: keptMutations.map(m => ({
          mutation_id: m.mutation.mutation_id,
          subtype_id: m.subtype?.subtype_id || null,
        })),
        removed: removedMutations.map(m => ({
          mutation_id: m.mutation.mutation_id,
          subtype_id: m.subtype?.subtype_id || null,
        })),
      }
      const res = await api.post(`/creation/step3/${sheetId}/random`, payload)
      if (res.data.duplicates > 0) {
        setError(t('creation.step3.duplicates_ignored', { count: res.data.duplicates }))
      }
      onNext?.(res.data)
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'))
    }
  }

  // ─── Rendu ──────────────────────────────────────────────────────────
  if (loading) return <div style={s.center}>{t('common.loading')}</div>

  return (
    <div style={s.container}>
      <h2 style={s.title}>{t('creation.step3.title')}</h2>
      {error && <div style={s.error}>{error}</div>}

      {!method && (
        <div style={s.methodChoice}>
          <button style={s.methodBtn} onClick={() => setMethod('chosen')}>
            {t('creation.step3.method_choose')}
          </button>
          <button style={s.methodBtn} onClick={() => setMethod('random')}>
            {t('creation.step3.method_random')}
          </button>
        </div>
      )}

      {/* ACHAT */}
      {method === 'chosen' && (
        <div>
          <div style={s.pcDisplay}>
            {t('creation.step3.pc_display', { current: availablePC - totalCost, total: availablePC })}
          </div>

          <div style={s.mutationGrid}>
            {allMutations
              .filter(m => m.cost_pc >= 0 && m.cost_pc <= availablePC - totalCost)
              .map(mutation => (
                <div key={mutation.mutation_id} style={s.mutationCard}>
                  <div style={s.mutationHeader}>
                    <span style={s.mutationName}>{mutation.name}</span>
                    <span style={{
                      ...s.mutationCost,
                      color: mutation.cost_pc > 0 ? '#5b8dee' : '#888',
                    }}>
                      {mutation.cost_pc > 0 ? `-${mutation.cost_pc} PC` : '0 PC'}
                    </span>
                    <button style={s.addBtn} onClick={() => handleAddMutation(mutation)}>+</button>
                  </div>
                  <div style={s.mutationDesc}>
                    {mutation.description?.substring(0, 120)}{mutation.description?.length > 120 ? '...' : ''}
                  </div>
                  <div style={s.mutationTags}>
                    {mutation.is_unique && <span style={s.tag}>{t('creation.step3.unique')}</span>}
                    {mutation.is_stackable && (
                      <span style={s.tag}>
                        {t('creation.step3.stackable', { limit: mutation.stack_limit || '∞' })}
                      </span>
                    )}
                    {mutation.has_subtable && <span style={s.tag}>Sous-types</span>}
                  </div>
                </div>
              ))}
          </div>

          {selectedMutations.length > 0 && (
            <div style={s.selectedSection}>
              <h3 style={s.selectedTitle}>Sélection ({selectedMutations.length})</h3>
              {selectedMutations.map((m, i) => (
                <div key={i} style={s.selectedItem}>
                  <span>{m.name}{m.subtype_name ? ` — ${m.subtype_name}` : ''}</span>
                  <span style={{ color: m.cost_pc > 0 ? '#5b8dee' : '#888', fontSize: '11px' }}>
                    {m.cost_pc > 0 ? `-${m.cost_pc} PC` : '0 PC'}
                  </span>
                  <button style={s.removeBtn} onClick={() => handleRemoveMutation(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ALÉATOIRE */}
      {method === 'random' && (
        <div>
          <div style={s.pcDisplay}>
            {t('creation.step3.pc_display', { current: availablePC, total: initialPC })}
          </div>

          {!rollResult && (
            <button style={s.rollBtn} onClick={handleRoll} disabled={rolling}>
              {rolling ? '...' : t('creation.step3.roll_d20')}
            </button>
          )}

          {rollResult && (
            <div>
              <div style={s.rollInfo}>
                D20 = {rollResult.d20} → {rollResult.count} mutation(s)
              </div>

              {rollResult.results.map((result, i) => (
                <div key={i} style={s.rollCard}>
                  <div style={s.rollHeader}>
                    <span style={s.mutationName}>{result.mutation.name}</span>
                    <span style={{ color: '#888', fontSize: '11px' }}>D100 = {result.d100}</span>
                  </div>
                  {result.subtype && (
                    <div style={s.subtypeInfo}>→ {result.subtype.name}</div>
                  )}
                  <div style={s.mutationDesc}>
                    {result.mutation.description?.substring(0, 100)}{result.mutation.description?.length > 100 ? '...' : ''}
                  </div>
                  <div style={s.rollActions}>
                    <button style={s.keepBtn} onClick={() => handleKeep(result, i)}>
                      {t('creation.step3.keep')}
                    </button>
                    <button style={s.removeRandomBtn} onClick={() => handleRemoveRandom(result, i)}>
                      {result.mutation.cost_pc > 0
                        ? t('creation.step3.remove_free')
                        : t('creation.step3.remove_cost')}
                    </button>
                  </div>
                </div>
              ))}

              <div style={s.summary}>
                <div>{t('creation.step3.kept_count', { count: keptMutations.length })}</div>
                <div>{t('creation.step3.removed_count', { count: removedMutations.length })}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal sous-type */}
      {pendingSubtype?.showSelector && (
        <div style={s.modal}>
          <div style={s.modalContent}>
            <h3 style={{ color: '#c0c0d0', fontSize: '14px', marginBottom: '12px' }}>
              {pendingSubtype.mutation.name} — Choisir un sous-type
            </h3>
            {subtypes.map(st => (
              <button key={st.subtype_id} style={s.subtypeBtn} onClick={() => handleSelectSubtype(st)}>
                {st.name}
              </button>
            ))}
            <button style={s.cancelBtn} onClick={() => setPendingSubtype(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {method && (
        <div style={s.nav}>
          <button style={s.navBtn} onClick={onPrev}>
            {t('creation.wizard.prev')}
          </button>
          <button
            style={s.navBtn}
            disabled={method === 'random' && rollResult?.results?.length > 0}
            onClick={method === 'chosen' ? handleSubmitChosen : handleSubmitRandom}
          >
            {t('creation.wizard.next')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────
const s = {
  container: { padding: '16px', color: '#c0c0d0' },
  center: { textAlign: 'center', padding: '32px', color: '#5a5a7a' },
  error: {
    color: '#e05c5c', fontSize: '12px', padding: '8px',
    background: 'rgba(224,92,92,0.08)', borderRadius: '4px', marginBottom: '12px',
  },
  title: { fontSize: '16px', fontWeight: '700', color: '#5b8dee', marginBottom: '16px' },

  methodChoice: { display: 'flex', gap: '12px', justifyContent: 'center', padding: '32px 0' },
  methodBtn: {
    padding: '12px 24px', background: '#0e0e1a', border: '1px solid #2a2a3e',
    borderRadius: '6px', color: '#c0c0d0', fontSize: '14px', cursor: 'pointer',
  },

  pcDisplay: {
    fontSize: '12px', color: '#5b8dee', fontWeight: '600', marginBottom: '12px',
    padding: '6px 10px', background: 'rgba(91,141,238,0.08)', borderRadius: '4px',
  },

  mutationGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px',
  },
  mutationCard: {
    background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '10px',
  },
  mutationHeader: {
    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px',
  },
  mutationName: {
    fontSize: '13px', fontWeight: '600', color: '#c0c0d0',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  mutationCost: { fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  mutationDesc: { fontSize: '10px', color: '#6a6a8a', marginBottom: '6px', lineHeight: '1.4' },
  mutationTags: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  tag: {
    fontSize: '9px', background: 'rgba(91,141,238,0.12)', color: '#5b8dee',
    padding: '2px 6px', borderRadius: '3px',
  },
  addBtn: {
    width: '28px', height: '28px', background: '#1e1e3e', border: '1px solid #3a3a5e',
    borderRadius: '4px', color: '#5b8dee', fontSize: '18px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  selectedSection: {
    marginTop: '16px', padding: '10px',
    background: 'rgba(91,141,238,0.05)', borderRadius: '6px', border: '1px solid #1e1e2e',
  },
  selectedTitle: { fontSize: '12px', color: '#5a5a7a', marginBottom: '8px' },
  selectedItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 0', fontSize: '11px', borderBottom: '1px solid #1a1a2e',
  },
  removeBtn: { background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: '16px' },

  rollBtn: {
    padding: '12px 24px', background: '#5b8dee', border: 'none', borderRadius: '6px',
    color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    display: 'block', margin: '16px auto',
  },
  rollInfo: {
    textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#5b8dee', marginBottom: '12px',
  },
  rollCard: {
    background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '6px',
    padding: '10px', marginBottom: '8px',
  },
  rollHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px',
  },
  subtypeInfo: { fontSize: '10px', color: '#9090c8', marginBottom: '4px' },
  rollActions: { display: 'flex', gap: '8px', marginTop: '8px' },
  keepBtn: {
    padding: '4px 12px', background: '#1e3a1e', border: '1px solid #2a5a2a',
    borderRadius: '4px', color: '#5ae05a', cursor: 'pointer', fontSize: '11px',
  },
  removeRandomBtn: {
    padding: '4px 12px', background: '#1e1e1e', border: '1px solid #3a3a3a',
    borderRadius: '4px', color: '#e05c5c', cursor: 'pointer', fontSize: '11px',
  },
  summary: {
    display: 'flex', justifyContent: 'space-around', padding: '8px',
    fontSize: '11px', color: '#5a5a7a', marginTop: '8px',
  },

  modal: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 100,
  },
  modalContent: {
    background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '8px',
    padding: '24px', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  subtypeBtn: {
    padding: '8px 16px', background: '#1e1e3e', border: '1px solid #3a3a5e',
    borderRadius: '4px', color: '#c0c0d0', cursor: 'pointer', textAlign: 'left',
  },
  cancelBtn: {
    padding: '6px 12px', background: 'transparent', border: 'none',
    color: '#e05c5c', cursor: 'pointer', marginTop: '8px',
  },

  nav: {
    display: 'flex', justifyContent: 'space-between', marginTop: '24px',
    paddingTop: '12px', borderTop: '1px solid #1e1e2e',
  },
  navBtn: {
    padding: '8px 16px', background: '#0e0e1a', border: '1px solid #2a2a3e',
    borderRadius: '4px', color: '#c0c0d0', cursor: 'pointer', fontSize: '12px',
  },
}

6. INTÉGRATION WIZARD
6.1 CreationWizard.jsx — ajout case étape 3
jsx

case 3:
  return (
    <Step3Mutations
      sheetId={sheetId}
      availablePC={availablePC}
      onNext={(data) => {
        setAvailablePC(data.availablePC)
        setCurrentStep(4)
      }}
      onPrev={async () => {
        try {
          const res = await api.post(`/creation/rollback-to-step2/${sheetId}`)
          setAvailablePC(res.data.availablePC)
          setCurrentStep(2)
        } catch (err) {
          setError(err.response?.data?.error || 'Erreur rollback')
        }
      }}
    />
  )

7. INTÉGRATION CHARACTERSHEET
7.1 CharacterSheet.jsx — ajout modificateurs mutations
js

// Nouveau state
const [mutationEffects, setMutationEffects] = useState(null)

// Dans le useEffect de chargement initial, ajouter :
try {
  const mutRes = await api.get(`/char-sheet/${characterId}/mutation-effects`)
  if (!cancelled) setMutationEffects(mutRes.data.effects || {})
} catch (mutErr) {
  console.error('Erreur chargement effets mutations :', mutErr)
}

// Modifier getModGen pour inclure les mutations
const getModGen = useCallback(
  (attrId) => {
    const genoMod = genotypeData[`mod_${attrId.toLowerCase()}`] || 0
    const mutMod = mutationEffects?.[`mod_${attrId}`] || 0
    return genoMod + mutMod
  },
  [genotypeData, mutationEffects]
)

// TODO V2 : utiliser mutationEffects.natural_armor, mod_res_*, is_androgyne,
// is_asexue, is_sterile, is_self_fertile, special_effects dans les modules
// Armure, Résistances, Identité

8. i18n
8.1 client/src/locales/fr.json — clés ajoutées
json

{
  "creation": {
    "step3": {
      "title": "Capacités spéciales",
      "method_choose": "Acheter des mutations",
      "method_random": "Tirage aléatoire",
      "roll_d20": "Lancer 1D20",
      "keep": "Garder",
      "remove_free": "Supprimer (gratuit)",
      "remove_cost": "Supprimer (coûte 1 PC)",
      "unique": "Unique",
      "stackable": "Stackable (max {{limit}})",
      "insufficient_pc": "PC insuffisants",
      "pending_mutations": "Traitez toutes les mutations avant de continuer",
      "pc_display": "PC : {{current}} / {{total}}",
      "kept_count": "Gardées : {{count}}",
      "removed_count": "Supprimées : {{count}}",
      "duplicates_ignored": "{{count}} mutation(s) déjà possédée(s) ignorée(s)"
    }
  }
}

⚠️ Vérification manuelle requise : la clé common.cancel doit exister dans fr.json. Si absente, ajouter "cancel": "Annuler" dans "common": {}.
9. FICHIERS TOUCHÉS
Fichier	Action
server/migrations/095_...cjs	Révisé — retrait vue
server/migrations/096_ref_mutations.cjs	Ajout vue char_mutation_effects_view
shared/polarisUtils.js	+4 fonctions étape 3
server/src/services/creationService.js	+5 fonctions étape 3
server/src/routes/creation.js	+5 routes étape 3
server/src/routes/char-ref.js	+GET /mutation-subtypes/:mutationId
server/src/routes/char-sheet.js	+GET /:characterId/mutation-effects (AVANT /:characterId)
client/src/components/creation/Step3Mutations.jsx	Nouveau composant
client/src/components/creation/CreationWizard.jsx	+case 3
client/src/components/CharacterSheet.jsx	+mutationEffects, getModGen modifié
client/src/locales/fr.json	+10 clés creation.step3.*
10. SCÉNARIOS DE TEST
Test 1 — Achat simple

    Wizard étape 2, availablePC = 11, clic "Suivant"

    Mutations affichées, seules cost_pc >= 0 visibles

    Sélection "Squelette renforcé" (3 PC) + "Crocs" (1 PC) → availablePC = 7

    Clic "Suivant" → succès, creation_state = 'draft_step3', pc_spent_step3 = 4

Test 2 — Achat avec sous-type

    Sélection "Caractère génétique animal" (has_subtable)

    Modal s'ouvre → choix "Caractère félin"

    Ajouté avec subtype_id et subtype_name affiché

    Second clic sur autre mutation à sous-type → ignoré (modal déjà ouvert)

Test 3 — Mutation désavantageuse refusée

    Méthode ACHAT : les mutations cost_pc < 0 n'apparaissent pas dans la grille

    Si soumise manuellement → erreur 400 serveur

Test 4 — Doublon unique refusé

    "Crocs" déjà en base, tentative d'ajout → erreur "unique"

Test 5 — Aléatoire

    Méthode "Aléatoire", clic "Lancer 1D20"

    2 mutations affichées, D100 visibles

    Garder avantageuse, supprimer désavantageuse (1 PC)

    Clic "Suivant" → pc_spent_step3 = 1

    Si doublon avec existant → ignoré silencieusement, compteur duplicates retourné

Test 6 — Rollback

    Étape 3 validée, clic "Précédent"

    creation_state = 'draft_step2', pc_spent_step3 = 0

    Mutations et skills nettoyés

Test 7 — CharacterSheet

    Fiche avec mutations → GET /char-sheet/:id/mutation-effects retourne les modificateurs

    naMap inclut mod_mutations dans le calcul

    natural_armor, résistances, etc. disponibles pour usage futur (TODO V2)