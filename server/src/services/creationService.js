// creationService.js
// Service wizard création — Step 4 (background/carrière) + Step 5 (ref avantages).
// Source : docs/Character/Creation/PLAN_CREATION_E4.md §3.1
//
// State machine : creation_state = dernière étape complétée.
// draft_step3 (step1-3 backend non implémenté à ce jour) → draft_step4 → draft_step5.
//
// Compétences background : additives automatiques (ref_background_skills.bonus).
// Compétences carrière : SET explicite via skillAllocations soumis par le joueur
//   (ref_career_skills n'a pas de colonne bonus — skill_group + conditional seulement).
//   Rollback : snapshot-before (pas de replay-and-decrement).

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getAgeEffects, evaluateSalaryFormula } from '../../../shared/polarisUtils.js'

// ─── Résolution background avec parent nullable (single-query) ────────────────
async function resolveBackground(trx, type, code, parentCode) {
  if (!code) return null
  const query = trx('ref_backgrounds').where({ type, code })
  if (parentCode) {
    query.where(function () {
      this.where('parent_code', parentCode).orWhereNull('parent_code')
    })
  } else {
    query.whereNull('parent_code')
  }
  return query.orderByRaw('parent_code IS NOT NULL DESC').first()
}

async function resolveStep4Backgrounds(trx, { originGeo, originSoc, training, higherEd }) {
  const geoRow = await resolveBackground(trx, 'geo_origin', originGeo, null)
  const socRow = await resolveBackground(trx, 'social_origin', originSoc, originGeo)
  const trainRow = await resolveBackground(trx, 'training', training, originSoc)
  const higherEdRow = higherEd
    ? await resolveBackground(trx, 'higher_ed', higherEd, 'education_scolaire')
    : null

  if (!geoRow) throw new AppError(400, `Origine géographique inconnue : ${originGeo}`)
  if (!socRow) throw new AppError(400, `Origine sociale inconnue : ${originSoc}`)
  if (!trainRow) throw new AppError(400, `Formation inconnue : ${training}`)
  if (higherEd && !higherEdRow) throw new AppError(400, `Études supérieures inconnues : ${higherEd}`)

  return { geoRow, socRow, trainRow, higherEdRow }
}

// Compétences background : non conditionnelles + conditionnelles choisies par le joueur.
async function getBackgroundSkillsToApply(trx, { geoRow, socRow, trainRow, higherEdRow }, appliedSkills = []) {
  const bgIds = [geoRow?.id, socRow?.id, trainRow?.id, higherEdRow?.id].filter(Boolean)
  const bgSkills = await trx('ref_background_skills').whereIn('background_id', bgIds)
  return bgSkills.filter(s => !s.conditional || appliedSkills.includes(s.skill_id))
}

// Upsert additif — pour les backgrounds uniquement.
async function upsertSkillBonus(trx, sheetId, skillId, bonus) {
  await trx('char_skills')
    .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: bonus, is_learned: false })
    .onConflict(['char_sheet_id', 'skill_id'])
    .merge({ mastery: trx.raw('char_skills.mastery + ?', [bonus]) })
}

// ─── Snapshot de l'état courant (avant toute modification step4) ──────────────
async function createSnapshot(trx, sheetId) {
  const [skills, archetype, attributes] = await Promise.all([
    trx('char_skills').where({ char_sheet_id: sheetId }),
    trx('char_archetype').where({ char_sheet_id: sheetId }).first(),
    trx('char_attributes').where({ char_sheet_id: sheetId }),
  ])
  const snapshot = {
    skills: Object.fromEntries(
      skills.map(s => [s.skill_id, { mastery: s.mastery, is_learned: s.is_learned }])
    ),
    archetype: {
      age: archetype?.age ?? null,
      origin_geo: archetype?.origin_geo ?? null,
      origin_soc: archetype?.origin_soc ?? null,
      training_base: archetype?.training_base ?? null,
      higher_ed: archetype?.higher_ed ?? null,
    },
    attributes: Object.fromEntries(
      attributes.map(a => [a.attr_id, { pc_modifier: a.pc_modifier }])
    ),
  }
  await trx('char_creation_snapshot')
    .insert({ char_sheet_id: sheetId, step: 'step4_before', snapshot: JSON.stringify(snapshot) })
    .onConflict(['char_sheet_id', 'step']).merge()
}

// Restauration depuis snapshot — upsert des valeurs sauvegardées.
async function restoreSnapshot(trx, sheetId) {
  const row = await trx('char_creation_snapshot')
    .where({ char_sheet_id: sheetId, step: 'step4_before' }).first()
  if (!row) throw new AppError(500, 'Snapshot step4_before manquant — rollback impossible')
  const snap = row.snapshot

  for (const [skillId, data] of Object.entries(snap.skills)) {
    await trx('char_skills')
      .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: data.mastery, is_learned: data.is_learned })
      .onConflict(['char_sheet_id', 'skill_id']).merge(['mastery', 'is_learned'])
  }

  // Supprimer les skills absents du snapshot (ajoutés par step4, pas présents avant)
  const snapshotSkillIds = Object.keys(snap.skills)
  await trx('char_skills')
    .where({ char_sheet_id: sheetId })
    .modify(qb => { if (snapshotSkillIds.length > 0) qb.whereNotIn('skill_id', snapshotSkillIds) })
    .del()

  await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
    age: snap.archetype.age,
    origin_geo: snap.archetype.origin_geo,
    origin_soc: snap.archetype.origin_soc,
    training_base: snap.archetype.training_base,
    higher_ed: snap.archetype.higher_ed,
  })

  for (const [attrId, data] of Object.entries(snap.attributes)) {
    await trx('char_attributes')
      .where({ char_sheet_id: sheetId, attr_id: attrId })
      .update({ pc_modifier: data.pc_modifier })
  }

  await trx('char_creation_snapshot').where({ char_sheet_id: sheetId, step: 'step4_before' }).del()
}

// ─── Validations carrière (source : PLAN_CREATION_E4.md §3.1) ─────────────────

async function validateCareerPrerequisites(sheetId, careerId, trx) {
  const prereqs = await trx('ref_career_prerequisites').where({ career_id: careerId })
  if (prereqs.length === 0) return { valide: true }

  const existingCareers = await trx('char_careers').where({ char_sheet_id: sheetId })
  for (const prereq of prereqs) {
    const match = existingCareers.find(c => c.career_id === prereq.prerequisite_career_id)
    if (!match || match.years < prereq.min_years) {
      const prereqCareer = await trx('ref_careers').where({ id: prereq.prerequisite_career_id }).first()
      return { valide: false, erreur: `Nécessite ${prereq.min_years} an(s) en tant que ${prereqCareer?.name}` }
    }
  }
  return { valide: true }
}

async function validateCareerGenotype(sheetId, careerId, trx) {
  const career = await trx('ref_careers').where({ id: careerId }).first()
  if (!career.required_genotype) return { valide: true }

  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  if (!archetype || archetype.genotype_id !== career.required_genotype) {
    const genotype = await trx('ref_genotypes').where({ id: career.required_genotype }).first()
    return { valide: false, erreur: `Cette profession nécessite le génotype : ${genotype?.label ?? career.required_genotype}` }
  }
  return { valide: true }
}

async function validateCareerAttributes(sheetId, careerId, trx) {
  const career = await trx('ref_careers').where({ id: careerId }).first()
  const attributes = await trx('char_attributes').where({ char_sheet_id: sheetId })
  const attrs = {}
  for (const a of attributes) attrs[a.attr_id] = a.base_level + a.pc_modifier

  const attrNames = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']
  const failed = []
  for (const attr of attrNames) {
    const min = career[`min_${attr.toLowerCase()}`]
    if (min !== null && min !== undefined && (attrs[attr] ?? 0) < min) {
      failed.push(`${attr} ${attrs[attr] ?? '?'}/${min}`)
    }
  }
  if (failed.length > 0) {
    return { valide: false, erreur: `Attributs insuffisants : ${failed.join(', ')}` }
  }
  return { valide: true }
}

async function validateCareerEducation(sheetId, careerId, trx) {
  const educationReqs = await trx('ref_career_education').where({ career_id: careerId })
  if (educationReqs.length === 0) return { valide: true }

  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  if (!archetype?.higher_ed) {
    const fields = educationReqs.map(e => e.field).join(' ou ')
    return { valide: false, erreur: `Cette profession nécessite des études supérieures : ${fields}` }
  }
  const fieldMatch = educationReqs.some(e => e.field === archetype.higher_ed)
  if (!fieldMatch) {
    const fields = educationReqs.map(e => e.field).join(' ou ')
    return { valide: false, erreur: `Cette profession nécessite les études : ${fields}` }
  }
  return { valide: true }
}

// ─── Step 4 : données de référence ────────────────────────────────────────────

export async function getStep4RefData(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')

  const [backgrounds, careers, careerSkills, careerTitles, careerPrereqs, careerPointCats] = await Promise.all([
    db('ref_backgrounds').select('*').orderBy(['type', 'sort_order']),
    db('ref_careers').select('*'),
    db('ref_career_skills').select('*'),
    db('ref_career_titles').select('*'),
    db('ref_career_prerequisites').select('*'),
    db('ref_career_point_categories').select('*').orderBy('sort_order'),
  ])

  const careersMap = new Map(
    careers.map(c => [c.id, { ...c, skills: [], titles: [], prerequisites: [], pointCategories: [] }])
  )
  for (const sk of careerSkills) careersMap.get(sk.career_id)?.skills.push(sk)
  for (const t of careerTitles) careersMap.get(t.career_id)?.titles.push(t)
  for (const p of careerPrereqs) careersMap.get(p.career_id)?.prerequisites.push(p)
  for (const pc of careerPointCats) careersMap.get(pc.career_id)?.pointCategories.push(pc)

  const byType = (type) => backgrounds.filter(b => b.type === type)

  return {
    geoOrigins: byType('geo_origin'),
    socialOrigins: byType('social_origin'),
    trainings: byType('training'),
    higherEds: byType('higher_ed'),
    careers: Array.from(careersMap.values()),
  }
}

export async function getStep4State(sheetId) {
  const [archetype, careers] = await Promise.all([
    db('char_archetype').where({ char_sheet_id: sheetId }).first(),
    db('char_careers').where({ char_sheet_id: sheetId }).select('*'),
  ])
  return { archetype: archetype || null, careers }
}

// ─── Step 4 : validation + persistance ────────────────────────────────────────

export async function validateAndPersistStep4(sheetId, data) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.creation_state !== 'draft_step3') {
      throw new AppError(400, `État de création invalide pour step4 : ${sheet.creation_state}`)
    }

    const { age, originGeo, originSoc, training, higherEd, careers: careersData, appliedSkills, pcSpent } = data

    if (!age || age < 18 || age > 70) throw new AppError(400, 'Âge invalide')
    if (!Array.isArray(careersData) || careersData.length === 0) {
      throw new AppError(400, 'Au moins une carrière requise')
    }

    // 1. Snapshot avant toute modification (source du rollback)
    await createSnapshot(trx, sheetId)

    // 2. Bonus de compétences background (additifs, auto-appliqués)
    const bgRows = await resolveStep4Backgrounds(trx, { originGeo, originSoc, training, higherEd })
    const bgSkillsToApply = await getBackgroundSkillsToApply(trx, bgRows, appliedSkills || [])
    for (const sk of bgSkillsToApply) {
      await upsertSkillBonus(trx, sheetId, sk.skill_id, sk.bonus)
    }

    // 3. Carrières + allocations compétences (SET explicite soumis par le joueur)
    let totalSavings = 0
    for (const career of careersData) {
      const refCareer = await trx('ref_careers').where({ id: career.career_id }).first()
      if (!refCareer) throw new AppError(400, `Carrière inconnue : ${career.career_id}`)
      if (!career.years || career.years < 1) throw new AppError(400, `Années invalides pour ${refCareer.name}`)

      const prereqCheck = await validateCareerPrerequisites(sheetId, career.career_id, trx)
      if (!prereqCheck.valide) throw new AppError(400, prereqCheck.erreur)
      const genotypeCheck = await validateCareerGenotype(sheetId, career.career_id, trx)
      if (!genotypeCheck.valide) throw new AppError(400, genotypeCheck.erreur)
      const attrCheck = await validateCareerAttributes(sheetId, career.career_id, trx)
      if (!attrCheck.valide) throw new AppError(400, attrCheck.erreur)
      const eduCheck = await validateCareerEducation(sheetId, career.career_id, trx)
      if (!eduCheck.valide) throw new AppError(400, eduCheck.erreur)

      // Salaire selon le titre atteint
      const titles = await trx('ref_career_titles').where({ career_id: career.career_id }).orderBy('min_years')
      const title = titles.find(t =>
        career.years >= t.min_years && (t.max_years === null || career.years <= t.max_years)
      )
      let salary = 0
      if (title) {
        if (title.salary_per_year) salary = title.salary_per_year
        else if (title.salary_formula) salary = evaluateSalaryFormula(title.salary_formula)
      }
      const savings = salary * career.years
      totalSavings += savings

      await trx('char_careers').insert({
        char_sheet_id: sheetId,
        career_id: career.career_id,
        years: career.years,
        savings,
        pro_advantages: JSON.stringify(career.proAdvantages || {}),
        random_picks: JSON.stringify(career.randomPicks || []),
        setbacks: JSON.stringify(career.setbacks || []),
      })

      // skillAllocations : { skill_id → mastery_cible } soumis par le joueur
      // Le joueur voit le total (background + carrière) et soumet la mastery finale.
      for (const [skillId, targetMastery] of Object.entries(career.skillAllocations || {})) {
        const isLearned = (career.openedSkills || []).includes(skillId)
        await trx('char_skills')
          .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: targetMastery, is_learned: isLearned })
          .onConflict(['char_sheet_id', 'skill_id'])
          .merge({
            mastery: targetMastery,
            is_learned: trx.raw('char_skills.is_learned OR ?', [isLearned]),
          })
      }
    }

    // 4. Effets de l'âge sur les Attributs
    const ageEffects = getAgeEffects(age)
    for (const [attr, delta] of Object.entries(ageEffects)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attr })
        .increment('pc_modifier', delta)
    }

    // 5. char_archetype
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
      age,
      origin_geo: originGeo,
      origin_soc: originSoc,
      training_base: training,
      higher_ed: higherEd || null,
    })

    // 6. Ledger PC
    const ledger = await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).first()
    if (!ledger) throw new AppError(500, 'Ledger PC manquant — incohérence wizard (step1 non initialisé)')
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: pcSpent || 0 })

    // 7. State machine
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step4' })

    return { creation_state: 'draft_step4', totalSavings }
  })
}

// ─── Step 4 : rollback (restauration snapshot, pas de décréments) ─────────────

export async function rollbackStep4(sheetId) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.creation_state !== 'draft_step4') {
      throw new AppError(400, `État incompatible avec rollback step4 : ${sheet.creation_state}`)
    }

    // Restaure skills, archetype, attributes depuis snapshot ; supprime le snapshot
    await restoreSnapshot(trx, sheetId)

    await trx('char_careers').where({ char_sheet_id: sheetId }).del()
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: 0 })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    return { creation_state: 'draft_step3' }
  })
}

// ─── Step 5 : données de référence ────────────────────────────────────────────

export async function getStep5RefData() {
  return db('ref_advantages').select('*').orderBy(['type', 'name'])
}

// ─── Helpers state machine ─────────────────────────────────────────────────

function getStateIndex(state) {
  const m = state?.match(/^draft_step(\d+)$/)
  return m ? parseInt(m[1], 10) : -1
}

function assertMinState(sheet, minStepN, stepName) {
  if (getStateIndex(sheet.creation_state) < minStepN)
    throw new AppError(400, `État invalide pour ${stepName} : ${sheet.creation_state}`)
}

// ─── Start : création du brouillon ─────────────────────────────────────────

const ATTR_IDS_START = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

export async function startCreation(campaignId, userId) {
  return db.transaction(async (trx) => {
    const [character] = await trx('characters')
      .insert({ campaign_id: campaignId, user_id: userId, name: 'Brouillon', type: 'pj', visible: false })
      .returning(['id'])

    const [sheet] = await trx('char_sheet')
      .insert({ character_id: character.id, creation_state: 'draft_step0' })
      .returning(['id'])

    await trx('char_pc_ledger').insert({ char_sheet_id: sheet.id, pc_total: 20 })
    await trx('char_archetype').insert({ char_sheet_id: sheet.id })
    await trx('char_attributes').insert(
      ATTR_IDS_START.map(attr_id => ({ char_sheet_id: sheet.id, attr_id, base_level: 7, pc_modifier: 0 }))
    )

    return { sheetId: sheet.id, characterId: character.id }
  })
}

// ─── Step 1 : attributs + identité ─────────────────────────────────────────

export async function validateAndPersistStep1(sheetId, data) {
  const { charName, playerName, attributes, pcSpent } = data
  if (!charName?.trim()) throw new AppError(400, 'Nom du personnage requis')
  if (!attributes || typeof attributes !== 'object') throw new AppError(400, 'Attributs requis')

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    assertMinState(sheet, 0, 'step1')

    const row = await trx('char_sheet as cs')
      .join('characters as c', 'c.id', 'cs.character_id')
      .where('cs.id', sheetId)
      .select('c.id as character_id')
      .first()

    await trx('characters').where({ id: row.character_id }).update({ name: charName.trim() })

    await trx('char_identity')
      .insert({ char_sheet_id: sheetId, char_name: charName.trim(), player_name: playerName ?? '' })
      .onConflict('char_sheet_id').merge(['char_name', 'player_name'])

    for (const [attrId, level] of Object.entries(attributes)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attrId })
        .update({ base_level: level })
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step1: pcSpent ?? 0 })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step1' })

    return { creation_state: 'draft_step1' }
  })
}

// ─── Step 2 : génotype ─────────────────────────────────────────────────────

export async function validateAndPersistStep2(sheetId, data) {
  const { genotypeId, isDeserter = false } = data

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    assertMinState(sheet, 1, 'step2')

    const geno = await trx('ref_genotypes').where({ id: genotypeId }).first()
    if (!geno) throw new AppError(400, `Génotype inconnu : ${genotypeId}`)
    if (isDeserter && !geno.has_deserter_option)
      throw new AppError(400, `Le génotype ${genotypeId} n'a pas d'option déserteur`)

    const pcCost = isDeserter ? 4 : (geno.pc_cost ?? 0)

    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pcCost })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step2' })

    return { creation_state: 'draft_step2', pcCost }
  })
}

// ─── Step 3 : mutations ────────────────────────────────────────────────────

export async function validateAndPersistStep3(sheetId, data) {
  const { method, mutations = [], pcSpent = 0 } = data
  if (!['chosen', 'random', 'none'].includes(method))
    throw new AppError(400, `Méthode de mutation invalide : ${method}`)

  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    assertMinState(sheet, 2, 'step3')

    await trx('char_mutations').where({ char_sheet_id: sheetId }).del()

    for (const { mutation_id, subtype_id } of mutations) {
      const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
      if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id,
        subtype_id: subtype_id ?? null,
        source: method === 'random' ? 'random' : 'chosen',
        status: 'active',
        count: 1,
      })
    }

    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: pcSpent })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'draft_step3' })

    return { creation_state: 'draft_step3' }
  })
}

// ─── Finalize ──────────────────────────────────────────────────────────────

export async function finalizeCreation(sheetId) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (sheet.creation_state !== 'draft_step5')
      throw new AppError(400, `État invalide pour finalize : ${sheet.creation_state}`)

    await trx('characters').where({ id: sheet.character_id }).update({ visible: true })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })

    return { ok: true, characterId: sheet.character_id }
  })
}
