// creationService.js — Wizard création — Architecture client-primary (Session 130)
// Toutes les données du wizard restent dans Zustand côté client jusqu'au bouton "Finaliser".
// Un seul POST /finalize envoie le payload complet des 5 étapes — une seule transaction.

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getAgeEffects, evaluateSalaryFormula } from '../../../shared/polarisUtils.js'
import { addAdvantage } from './advantageService.js'

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

// Compétences background : non conditionnelles uniquement (pas de choix conditionnel en création).
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

// ─── Validations carrière ─────────────────────────────────────────────────────

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

  const [backgrounds, bgSkills, careers, careerSkills, careerTitles, careerPrereqs, careerPointCats] = await Promise.all([
    db('ref_backgrounds').select('*').orderBy(['type', 'sort_order']),
    db('ref_background_skills').select('*'),
    db('ref_careers').select('*'),
    db('ref_career_skills').select('*'),
    db('ref_career_titles').select('*'),
    db('ref_career_prerequisites').select('*'),
    db('ref_career_point_categories').select('*').orderBy('sort_order'),
  ])

  const bgMap = new Map(backgrounds.map(b => [b.id, { ...b, skills: [] }]))
  for (const sk of bgSkills) bgMap.get(sk.background_id)?.skills.push(sk)
  const bgsWithSkills = Array.from(bgMap.values())

  const careersMap = new Map(
    careers.map(c => [c.id, { ...c, skills: [], titles: [], prerequisites: [], pointCategories: [] }])
  )
  for (const sk of careerSkills) careersMap.get(sk.career_id)?.skills.push(sk)
  for (const t of careerTitles) careersMap.get(t.career_id)?.titles.push(t)
  for (const p of careerPrereqs) careersMap.get(p.career_id)?.prerequisites.push(p)
  for (const pc of careerPointCats) careersMap.get(pc.career_id)?.pointCategories.push(pc)

  const byType = (type) => bgsWithSkills.filter(b => b.type === type)

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

// ─── Step 5 : données de référence ────────────────────────────────────────────

export async function getStep5RefData() {
  return db('ref_advantages').select('*').orderBy(['type', 'name'])
}

// ─── Start : création du brouillon ────────────────────────────────────────────

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

// ─── Finalisation : transaction unique — architecture client-primary ───────────

export async function finalizeCreation(sheetId, { step1, step2, step3, step4, step5 }) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.creation_state === 'complete') throw new AppError(400, 'Ce personnage est déjà finalisé')
    const characterId = sheet.character_id

    // ── STEP 1 : attributs + identité ──────────────────────────────────────────
    const { charName, playerName, attributes, pcSpent: pc1 } = step1
    if (!charName?.trim()) throw new AppError(400, 'Nom du personnage requis')
    if (!attributes || typeof attributes !== 'object') throw new AppError(400, 'Attributs requis')

    await trx('characters').where({ id: characterId }).update({ name: charName.trim() })
    await trx('char_identity')
      .insert({ char_sheet_id: sheetId, char_name: charName.trim(), player_name: playerName ?? '' })
      .onConflict('char_sheet_id').merge(['char_name', 'player_name'])
    for (const [attrId, level] of Object.entries(attributes)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attrId })
        .update({ base_level: level })
    }
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step1: pc1 ?? 0 })

    // ── STEP 2 : génotype ───────────────────────────────────────────────────────
    const { genotypeId, isDeserter = false } = step2
    const geno = await trx('ref_genotypes').where({ id: genotypeId }).first()
    if (!geno) throw new AppError(400, `Génotype inconnu : ${genotypeId}`)
    const pc2 = isDeserter ? 4 : (geno.pc_cost ?? 0)
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pc2 })

    // ── STEP 3 : mutations ──────────────────────────────────────────────────────
    const { method: step3Method, mutations: step3Mutations, kept: step3Kept, pcSpent: pc3 } = step3
    if (!['chosen', 'random', 'none'].includes(step3Method)) {
      throw new AppError(400, `Méthode de mutation invalide : ${step3Method}`)
    }
    await trx('char_mutations').where({ char_sheet_id: sheetId }).del()
    const mutationsToInsert = step3Method === 'random' ? (step3Kept ?? []) : (step3Mutations ?? [])
    for (const { mutation_id, subtype_id } of mutationsToInsert) {
      const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
      if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
      await trx('char_mutations').insert({
        char_sheet_id: sheetId,
        mutation_id,
        subtype_id: subtype_id ?? null,
        source: step3Method === 'random' ? 'random' : 'chosen',
        status: 'active',
        count: 1,
      })
    }
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: pc3 ?? 0 })

    // ── STEP 4 : expérience ─────────────────────────────────────────────────────
    const { age: baseAge, originGeo, originSoc, training, higherEd, careers: careersData, pcSpent: pc4 } = step4
    if (!baseAge || baseAge < 16) throw new AppError(400, 'Âge de base invalide')
    if (!Array.isArray(careersData) || careersData.length === 0) {
      throw new AppError(400, 'Au moins une carrière requise')
    }

    // Backgrounds → compétences
    const bgRows = await resolveStep4Backgrounds(trx, { originGeo, originSoc, training, higherEd })
    const bgSkillsToApply = await getBackgroundSkillsToApply(trx, bgRows, [])
    for (const sk of bgSkillsToApply) await upsertSkillBonus(trx, sheetId, sk.skill_id, sk.bonus)

    // Archetype (origins + higherEd) AVANT la boucle carrières :
    // validateCareerEducation lit char_archetype.higher_ed, il doit être à jour.
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
      origin_geo: originGeo,
      origin_soc: originSoc,
      training_base: training,
      higher_ed: higherEd || null,
    })

    // Carrières
    let totalCareerYears = 0
    for (const career of careersData) {
      const refCareer = await trx('ref_careers').where({ id: career.career_id }).first()
      if (!refCareer) throw new AppError(400, `Carrière inconnue : ${career.career_id}`)
      if (!career.years || career.years < 1) throw new AppError(400, `Années invalides pour ${refCareer.name}`)

      const prereqCheck = await validateCareerPrerequisites(sheetId, career.career_id, trx)
      if (!prereqCheck.valide) throw new AppError(400, prereqCheck.erreur)
      const genoCheck = await validateCareerGenotype(sheetId, career.career_id, trx)
      if (!genoCheck.valide) throw new AppError(400, genoCheck.erreur)
      const attrCheck = await validateCareerAttributes(sheetId, career.career_id, trx)
      if (!attrCheck.valide) throw new AppError(400, attrCheck.erreur)
      const eduCheck = await validateCareerEducation(sheetId, career.career_id, trx)
      if (!eduCheck.valide) throw new AppError(400, eduCheck.erreur)

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
      totalCareerYears += career.years

      await trx('char_careers').insert({
        char_sheet_id: sheetId,
        career_id: career.career_id,
        years: career.years,
        savings,
        pro_advantages: JSON.stringify(career.proAdvantages || {}),
        random_picks: JSON.stringify(career.randomPicks || []),
        setbacks: JSON.stringify(career.setbacks || []),
      })

      for (const [skillId, targetMastery] of Object.entries(career.skillAllocations || {})) {
        const isLearned = (career.openedSkills || []).includes(skillId)
        await trx('char_skills')
          .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: targetMastery, is_learned: isLearned })
          .onConflict(['char_sheet_id', 'skill_id'])
          .merge({ mastery: targetMastery, is_learned: trx.raw('char_skills.is_learned OR ?', [isLearned]) })
      }
    }

    // finalAge = baseAge + higherEd.years_added + années de carrières
    let higherEdYears = 0
    if (higherEd) {
      const heRow = await trx('ref_backgrounds').where({ type: 'higher_ed', code: higherEd }).first()
      higherEdYears = heRow?.years_added ?? 0
    }
    const finalAge = baseAge + higherEdYears + totalCareerYears

    // Effets de l'âge sur les attributs
    const ageEffects = getAgeEffects(finalAge)
    for (const [attr, delta] of Object.entries(ageEffects)) {
      await trx('char_attributes')
        .where({ char_sheet_id: sheetId, attr_id: attr })
        .increment('pc_modifier', delta)
    }
    await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ age: finalAge })
    await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: pc4 ?? 0 })

    // ── STEP 5 : avantages/désavantages ────────────────────────────────────────
    // CRITIQUE : le ledger (pc_spent_step1..4) est rempli ci-dessus avant cet appel.
    // addAdvantage lit le ledger dans validateAdvantage pour vérifier sufficient_pc.
    const { advantages = [] } = step5
    for (const advantageId of advantages) {
      await addAdvantage(sheetId, advantageId, 'creation_step5', trx)
    }

    // ── FINALISATION ────────────────────────────────────────────────────────────
    await trx('characters').where({ id: characterId }).update({ visible: true })
    await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })

    return { ok: true, characterId }
  })
}
