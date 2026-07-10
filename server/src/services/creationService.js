// creationService.js — Wizard création — Architecture client-primary (Session 130)
// Toutes les données du wizard restent dans Zustand côté client jusqu'au bouton "Terminer".
// reconcileCreation applique un état partiel ou complet (pattern reconciliation Kubernetes/
// Terraform) — rejouable sans duplication à chaque ouverture de la fenêtre fiche personnage
// pendant le Wizard (docs/STE6_FINAL.md). lockWizard verrouille définitivement après "Terminer".

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getAgeEffects, evaluateSalaryFormula, validateStep1 } from '../../../shared/polarisUtils.js'
import { evaluateCareerEligibility } from '../../../shared/careerEligibility.js'
import { computeSkillAllocation, validateChoiceGroups } from '../../../shared/careerSkills.js'
import { computeProAdvantageAllocation, computeRandomBudgetDelta } from '../../../shared/careerAdvantages.js'
import { getSetbackBlockCount, resolveSetback } from '../../../shared/careerSetbacks.js'
import { getAutodidacteEligibleIds, validateAutodidacteAllocations } from '../../../shared/autodidacte.js'
import { addAdvantage } from './advantageService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'

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

// Formation "Autodidacte" (REGLE_CREATION.txt:1026-1033) : 7 points libres choisis par le joueur,
// +2 max/compétence, hors compétences (X) et hors compétences à prérequis SKILL_MIN — voir
// shared/autodidacte.js pour la règle d'éligibilité (source unique, importée aussi côté client).
async function resolveAutodidacteSkills(trx, autodidacteAllocations) {
  const [skills, reqs] = await Promise.all([
    trx('ref_skills').select('id', 'marker', 'is_category'),
    trx('ref_skill_requirements').where({ type: 'SKILL_MIN' }).select('skill_id'),
  ])
  const prereqIds = new Set(reqs.map(r => r.skill_id))
  const shaped = skills.map(s => ({
    ...s,
    requirements: prereqIds.has(s.id) ? [{ type: 'SKILL_MIN' }] : [],
  }))
  const eligibleIds = getAutodidacteEligibleIds(shaped)

  const { errors } = validateAutodidacteAllocations(autodidacteAllocations, eligibleIds)
  if (errors.length > 0) {
    const err = errors[0]
    throw new AppError(400, `Répartition Autodidacte invalide (${err.code}${err.skillId ? ' : ' + err.skillId : ''})`)
  }

  return Object.entries(autodidacteAllocations || {})
    .filter(([, points]) => Number.isInteger(points) && points > 0)
    .map(([skill_id, bonus]) => ({ skill_id, bonus }))
}

// Upsert additif — pour les backgrounds uniquement.
async function upsertSkillBonus(trx, sheetId, skillId, bonus) {
  await trx('char_skills')
    .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: bonus, is_learned: false })
    .onConflict(['char_sheet_id', 'skill_id'])
    .merge({ mastery: trx.raw('char_skills.mastery + ?', [bonus]) })
}

// ─── Validations carrière ─────────────────────────────────────────────────────

// Formate une raison structurée (shared/careerEligibility.js) vers le message historique.
// PARITÉ STRICTE : wording identique aux anciens validateCareer* (ne pas modifier sans raison).
function formatEligibilityReason(r) {
  switch (r.code) {
    case 'prereq':
      return `Nécessite ${r.minYears} an(s) en tant que ${r.careerName}`
    case 'genotype':
      return `Cette profession nécessite le génotype : ${r.genotypeLabel}`
    case 'attributes':
      return `Attributs insuffisants : ${r.failed.map(f => `${f.attr} ${f.have ?? '?'}/${f.min}`).join(', ')}`
    case 'education':
      return r.present
        ? `Cette profession nécessite les études : ${r.fields.join(' ou ')}`
        : `Cette profession nécessite des études supérieures : ${r.fields.join(' ou ')}`
    default:
      return 'Profession non accessible'
  }
}

// Éligibilité d'une carrière (prérequis, génotype, attributs, études) — remplace les 4 anciens
// validateCareer*. Lit la base (un seul passage), construit career+context avec noms prérésolus,
// délègue la logique à l'évaluateur pur partagé, puis formate reasons[0] (parité stricte : ordre
// [prereq, genotype, attributes, education], early-return préservé côté message).
async function checkCareerEligibility(sheetId, careerId, trx) {
  const career = await trx('ref_careers').where({ id: careerId }).first()

  // Prérequis + noms de carrière prérésolus (pour la raison structurée).
  const prereqRows = await trx('ref_career_prerequisites').where({ career_id: careerId })
  const prerequisites = []
  for (const p of prereqRows) {
    const pc = await trx('ref_careers').where({ id: p.prerequisite_career_id }).first()
    prerequisites.push({ ...p, prerequisiteCareerName: pc?.name })
  }

  // Label génotype prérésolu.
  let requiredGenotypeLabel
  if (career.required_genotype) {
    const g = await trx('ref_genotypes').where({ id: career.required_genotype }).first()
    requiredGenotypeLabel = g?.label ?? career.required_genotype
  }

  const education = await trx('ref_career_education').where({ career_id: careerId })

  // Contexte personnage.
  const existingCareers = await trx('char_careers').where({ char_sheet_id: sheetId })
  const archetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).first()
  const attrRows = await trx('char_attributes').where({ char_sheet_id: sheetId })
  const attributes = {}
  for (const a of attrRows) attributes[a.attr_id] = a.base_level + a.pc_modifier

  const { eligible, reasons } = evaluateCareerEligibility(
    { ...career, prerequisites, requiredGenotypeLabel, education },
    {
      careers: existingCareers.map(c => ({ career_id: c.career_id, years: c.years })),
      genotypeId: archetype?.genotype_id,
      higherEd: archetype?.higher_ed,
      attributes,
    }
  )

  if (eligible) return { valide: true }
  return { valide: false, erreur: formatEligibilityReason(reasons[0]) }
}

// ─── Step 4 : données de référence ────────────────────────────────────────────

export async function getStep4RefData(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')

  const [backgrounds, bgSkills, careers, careerSkills, careerTitles, careerPrereqs, careerPointCats, careerEducation, careerRandomBenefits, setbacks] = await Promise.all([
    db('ref_backgrounds').select('*').orderBy(['type', 'sort_order']),
    db('ref_background_skills as rbs')
  .leftJoin('ref_skills as rs', 'rbs.skill_id', 'rs.id')
  .select('rbs.*', 'rs.label as skill_name', 'rs.family'),
    db('ref_careers').select('*'),
    db('ref_career_skills as rcs').join('ref_skills as rs', 'rcs.skill_id', 'rs.id').select('rcs.*', 'rs.family'),
    db('ref_career_titles').select('*'),
    db('ref_career_prerequisites').select('*'),
    db('ref_career_point_categories').select('*').orderBy('sort_order'),
    db('ref_career_education').select('*'),
    db('ref_career_random_benefits').select('*').orderBy(['career_id', 'roll']),
    db('ref_setbacks').select('*').orderBy('roll_min'),
  ])

  const bgMap = new Map(backgrounds.map(b => [b.id, { ...b, skills: [] }]))
  for (const sk of bgSkills) bgMap.get(sk.background_id)?.skills.push(sk)
  const bgsWithSkills = Array.from(bgMap.values())

  const careersMap = new Map(
    careers.map(c => [c.id, { ...c, skills: [], titles: [], prerequisites: [], pointCategories: [], education: [], randomBenefits: [] }])
  )
  for (const sk of careerSkills) careersMap.get(sk.career_id)?.skills.push(sk)
  for (const t of careerTitles) careersMap.get(t.career_id)?.titles.push(t)
  for (const p of careerPrereqs) careersMap.get(p.career_id)?.prerequisites.push(p)
  for (const pc of careerPointCats) careersMap.get(pc.career_id)?.pointCategories.push(pc)
  for (const e of careerEducation) careersMap.get(e.career_id)?.education.push(e)
  for (const rb of careerRandomBenefits) careersMap.get(rb.career_id)?.randomBenefits.push(rb)

  const byType = (type) => bgsWithSkills.filter(b => b.type === type)

  return {
    geoOrigins: byType('geo_origin'),
    socialOrigins: byType('social_origin'),
    trainings: byType('training'),
    higherEds: byType('higher_ed'),
    careers: Array.from(careersMap.values()),
    setbacks,
  }
}

export async function getStep4State(sheetId) {
  const [archetype, careers] = await Promise.all([
    db('char_archetype').where({ char_sheet_id: sheetId }).first(),
    db('char_careers').where({ char_sheet_id: sheetId }).select('*'),
  ])
  return { archetype: archetype || null, careers }
}

// ─── Step 3 : données de référence ────────────────────────────────────────────

export async function getStep3RefData() {
  const [mutations, subtypes, skills] = await Promise.all([
    db('ref_mutations').select('*').orderBy('mutation_id'),
    db('ref_mutation_subtypes').select('*').orderBy(['mutation_id', 'd4_roll']),
    db('ref_mutation_skills').select('*'),
  ])

  const mutMap = new Map(mutations.map(m => [m.mutation_id, { ...m, subtable: [], skills: [] }]))
  for (const sub of subtypes) mutMap.get(sub.mutation_id)?.subtable.push(sub)
  for (const sk of skills) mutMap.get(sk.mutation_id)?.skills.push(sk)

  return Array.from(mutMap.values())
}

// ─── Step 5 : données de référence ────────────────────────────────────────────

// OPT-04 (polaris_latent, défaut OFF) : adv_077/adv_078 masqués si l'option n'est pas
// activée pour cette campagne. adv_079 ("Force Polaris") reste toujours visible.
export async function getStep5RefData(campaignId) {
  const settings = await getCampaignSettings(db, campaignId)
  const rows = await db('ref_advantages').select('*').orderBy(['type', 'name'])
  if (settings.polaris_latent) return rows
  return rows.filter(r => !['adv_077', 'adv_078'].includes(r.advantage_id))
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

    const settings = await getCampaignSettings(trx, campaignId)

    return {
      sheetId: sheet.id,
      characterId: character.id,
      ambiance: settings.ambiance,
      randomMutationsEnabled: settings.random_mutations,
      femininBonusEnabled: settings.feminin_bonus,
      randomProAdvantagesEnabled: settings.random_pro_advantages,
      reversEnabled: settings.revers,
      skillMaxLevelEnabled: settings.skill_max_level,
      youngPenaltyEnabled: settings.young_penalty,
    }
  })
}

// ─── Reconciliation : transaction unique, état partiel ou complet ──────────────
// Pattern reconciler (Kubernetes/Terraform) : chaque bloc STEP n'est appliqué que si
// l'étape correspondante est fournie. Rejouable sans duplication — chaque bloc reset
// ses tables dérivées avant réapplication. Voir docs/STE6_FINAL.md.

export async function reconcileCreation(sheetId, { step1, step2, step3, step4, step5 }) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.wizard_locked_at) throw new AppError(400, "Cette fiche a quitté l'assistant de création — modifications via la fiche personnage uniquement")
    const characterId = sheet.character_id

    // ── STEP 1 : attributs + identité ──────────────────────────────────────────
    if (step1) {
      const {
        charName, playerName, attributes, pcSpent: pc1, isFeminin: isFeminin1,
        height, weight, skin, eyes, hair, build, distinctiveSigns, handPref,
      } = step1
      if (!charName?.trim()) throw new AppError(400, 'Nom du personnage requis')
      if (!attributes || typeof attributes !== 'object') throw new AppError(400, 'Attributs requis')
      if (handPref != null && !['R', 'L', 'A'].includes(handPref)) {
        throw new AppError(400, `Main directrice invalide : ${handPref}`)
      }

      const { campaign_id: campaignId } = await trx('characters').where({ id: characterId }).select('campaign_id').first()
      const settings = await getCampaignSettings(trx, campaignId)
      const femininBonusApplies = (isFeminin1 ?? false) && settings.feminin_bonus
      const { valide, erreurs } = validateStep1(attributes, settings.ambiance, pc1 ?? 0, femininBonusApplies)
      if (!valide) throw new AppError(400, `Étape 1 invalide : ${erreurs.join(' ; ')}`)

      await trx('characters').where({ id: characterId }).update({ name: charName.trim() })
      await trx('char_identity')
        .insert({
          char_sheet_id: sheetId, char_name: charName.trim(), player_name: playerName ?? '',
          height: height ?? null, weight: weight ?? null,
          skin: skin ?? '', eyes: eyes ?? '', hair: hair ?? '', build: build ?? '',
          distinctive_signs: distinctiveSigns ?? '', hand_pref: handPref ?? null,
        })
        .onConflict('char_sheet_id')
        .merge(['char_name', 'player_name', 'height', 'weight', 'skin', 'eyes', 'hair', 'build', 'distinctive_signs', 'hand_pref'])
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ sex: (isFeminin1 ?? false) ? 'femme' : 'homme' })
      for (const [attrId, level] of Object.entries(attributes)) {
        await trx('char_attributes')
          .where({ char_sheet_id: sheetId, attr_id: attrId })
          .update({ base_level: level })
      }
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step1: pc1 ?? 0 })
    }

    // ── STEP 2 : génotype ───────────────────────────────────────────────────────
    if (step2) {
      const { genotypeId, isDeserter = false } = step2
      const geno = await trx('ref_genotypes').where({ id: genotypeId }).first()
      if (!geno) throw new AppError(400, `Génotype inconnu : ${genotypeId}`)
      const pc2 = isDeserter ? 4 : (geno.pc_cost ?? 0)
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId })
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pc2 })
    }

    // ── STEP 3 : mutations ──────────────────────────────────────────────────────
    if (step3) {
      const { method: step3Method, mutations: step3Mutations, kept: step3Kept, pcSpent: pc3 } = step3
      if (!['chosen', 'random', 'none'].includes(step3Method)) {
        throw new AppError(400, `Méthode de mutation invalide : ${step3Method}`)
      }
      // Reset avant réapplication — sans ça, retirer une mutation Autofécondation/le
      // désavantage Fécondité lors d'un retravail laisserait is_fertile bloqué à true.
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ is_fertile: false })
      await trx('char_mutations').where({ char_sheet_id: sheetId }).del()
      const mutationsToInsert = step3Method === 'random' ? (step3Kept ?? []) : (step3Mutations ?? [])
      const mutationSource = step3Method === 'random' ? 'random' : 'chosen'
      let sexOverride = null
      let fertilityOverride = null // null = pas d'override, sinon true/false
      for (const { mutation_id, subtype_id } of mutationsToInsert) {
        const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
        if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
        if (mutRef.mod_sex) sexOverride = mutRef.mod_sex
        if (mutRef.mod_fertility) fertilityOverride = mutRef.mod_fertility === 'self_fertile'
        if (subtype_id == null) {
          // Mutation is_stackable sans sous-type : incrémente count si déjà choisie dans ce lot
          // (index partiel uq_char_mut_no_sub — cible explicite requise pour Postgres).
          await trx.raw(`
            INSERT INTO char_mutations (char_sheet_id, mutation_id, subtype_id, source, status, count)
            VALUES (?, ?, NULL, ?, 'active', 1)
            ON CONFLICT (char_sheet_id, mutation_id) WHERE subtype_id IS NULL
            DO UPDATE SET count = char_mutations.count + 1
          `, [sheetId, mutation_id, mutationSource])
        } else {
          await trx('char_mutations').insert({
            char_sheet_id: sheetId,
            mutation_id,
            subtype_id,
            source: mutationSource,
            status: 'active',
            count: 1,
          })
        }
      }
      if (sexOverride || fertilityOverride !== null) {
        const archetypeUpdate = {}
        if (sexOverride) archetypeUpdate.sex = sexOverride
        if (fertilityOverride !== null) archetypeUpdate.is_fertile = fertilityOverride
        await trx('char_archetype').where({ char_sheet_id: sheetId }).update(archetypeUpdate)
      }
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step3: pc3 ?? 0 })
    }

    // ── STEP 4 : expérience ─────────────────────────────────────────────────────
    if (step4) {
      const { age: baseAge, originGeo, originSoc, training, higherEd, careers: careersData, pcSpent: pc4 } = step4
      if (!baseAge || baseAge < 16) throw new AppError(400, 'Âge de base invalide')
      if (!Array.isArray(careersData) || careersData.length === 0) {
        throw new AppError(400, 'Au moins une carrière requise')
      }

      // OPT-08 (skill_max_level, défaut OFF) : revalidation serveur du plafond par années —
      // voir shared/careerSkills.js (getSkillCap).
      const { campaign_id: campaignId } = await trx('characters').where({ id: characterId }).select('campaign_id').first()
      const settings = await getCampaignSettings(trx, campaignId)

      // OPT-06 (revers, défaut OFF) — REGLE_CREATION.txt:1190-1199 : déclencheur sur le total
      // d'années CUMULÉES toutes carrières confondues (pas par métier, contrairement au Tirage
      // 1D10 d'OPT-05/Lot 6) — calculable immédiatement depuis le payload d'entrée, pas besoin
      // d'attendre la boucle carrières ci-dessous. Obligatoire (pas de refus) : rejet si une
      // tranche due n'a pas été jetée. shared/careerSetbacks.js.
      const totalCareerYears = careersData.reduce((sum, c) => sum + (c.years || 0), 0)
      const setbackRolls = step4.setbackRolls || []
      const maxSetbackBlocks = getSetbackBlockCount(totalCareerYears)
      const setbackRows = await trx('ref_setbacks').select('*')
      const seenSetbackBlocks = new Set()
      for (const sb of setbackRolls) {
        if (!Number.isInteger(sb.blockIndex) || sb.blockIndex < 0 || sb.blockIndex >= maxSetbackBlocks) {
          throw new AppError(400, 'Revers invalide : tranche hors bornes')
        }
        if (seenSetbackBlocks.has(sb.blockIndex)) {
          throw new AppError(400, 'Revers invalide : tranche déjà jetée')
        }
        seenSetbackBlocks.add(sb.blockIndex)
        if (!resolveSetback(sb.roll, setbackRows)) {
          throw new AppError(400, `Revers invalide : résultat de jet hors table (${sb.roll})`)
        }
      }
      if (settings.revers && seenSetbackBlocks.size < maxSetbackBlocks) {
        throw new AppError(400, `Revers obligatoire non résolu : ${maxSetbackBlocks - seenSetbackBlocks.size} tirage(s) manquant(s)`)
      }

      // Reset avant réapplication — char_skills/char_careers ne sont écrits que par ce
      // bloc pendant le Wizard (avant verrouillage) : wipe sûr, pas d'orphelin FK possible.
      await trx('char_skills').where({ char_sheet_id: sheetId }).del()
      await trx('char_careers').where({ char_sheet_id: sheetId }).del()

      // Backgrounds → compétences
      const bgRows = await resolveStep4Backgrounds(trx, { originGeo, originSoc, training, higherEd })
      const bgSkillsToApply = await getBackgroundSkillsToApply(trx, bgRows, step4.appliedSkills || [])
      if (training === 'autodidacte') {
        bgSkillsToApply.push(...await resolveAutodidacteSkills(trx, step4.autodidacteAllocations || {}))
      }
      for (const sk of bgSkillsToApply) await upsertSkillBonus(trx, sheetId, sk.skill_id, sk.bonus)

      // Archetype (origins + higherEd) AVANT la boucle carrières :
      // checkCareerEligibility lit char_archetype.higher_ed, il doit être à jour.
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({
        origin_geo: originGeo,
        origin_soc: originSoc,
        training_base: training,
        higher_ed: higherEd || null,
        setback_rolls: JSON.stringify(setbackRolls),
      })

      // Carrières
      // totalCareerYears calculé plus haut (validation Revers) — même somme, réutilisée ici.
      const careersCtx = []
      for (const career of careersData) {
        const refCareer = await trx('ref_careers').where({ id: career.career_id }).first()
        if (!refCareer) throw new AppError(400, `Carrière inconnue : ${career.career_id}`)
        if (!career.years || career.years < 1) throw new AppError(400, `Années invalides pour ${refCareer.name}`)

        const eligCheck = await checkCareerEligibility(sheetId, career.career_id, trx)
        if (!eligCheck.valide) throw new AppError(400, eligCheck.erreur)

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

        // Tirage 1D10 (Lot 6) : validé AVANT Q3 — le delta budgétaire qui en résulte est injecté
        // dans computeProAdvantageAllocation ci-dessous. Ignoré (mais toujours validé en forme) pour
        // les métiers sans ref_career_point_categories (ex. Chasseur de primes) : le jet y reste
        // possible (narratif), sans effet sur un budget qui n'existe pas — voir careerAdvantages.js.
        const randomPicks = career.randomPicks || []
        const randomBenefitRows = await trx('ref_career_random_benefits').where({ career_id: career.career_id })
        const benefitByRoll = new Map(randomBenefitRows.map(r => [r.roll, r]))
        const maxBlocks = Math.floor(career.years / 5)
        const seenBlocks = new Set()
        for (const pick of randomPicks) {
          if (!Number.isInteger(pick.blockIndex) || pick.blockIndex < 0 || pick.blockIndex >= maxBlocks) {
            throw new AppError(400, `Tirage 1D10 invalide pour ${refCareer.name} : tranche hors bornes`)
          }
          if (seenBlocks.has(pick.blockIndex)) {
            throw new AppError(400, `Tirage 1D10 invalide pour ${refCareer.name} : tranche déjà jetée`)
          }
          seenBlocks.add(pick.blockIndex)
          const row = benefitByRoll.get(pick.roll)
          if (!row) {
            throw new AppError(400, `Tirage 1D10 invalide pour ${refCareer.name} : résultat inconnu (${pick.roll})`)
          }
          if (pick.useAsPoints && row.points_alt == null) {
            throw new AppError(400, `Tirage 1D10 invalide pour ${refCareer.name} : conversion en points impossible pour ce résultat`)
          }
        }
        const randomBudgetDelta = computeRandomBudgetDelta(randomPicks, randomBenefitRows)

        // Q3 — validation par métier du coût avantages pro (shared/careerAdvantages.js, Lot 4).
        const pointCatRows = await trx('ref_career_point_categories').where({ career_id: career.career_id })
        const advResult = computeProAdvantageAllocation(career.proAdvantages || {}, {
          categories: pointCatRows.map(c => c.category),
          years: career.years,
          randomBudgetDelta,
        })
        if (advResult.errors.length > 0) {
          const err = advResult.errors[0]
          const msg = err.code === 'over_budget'
            ? `Budget d'avantages professionnels dépassé pour ${refCareer.name} : ${err.totalSpent} pts sur ${err.budget} disponibles`
            : `Catégorie d'avantage invalide pour ${refCareer.name} : ${err.category}`
          throw new AppError(400, msg)
        }

        await trx('char_careers').insert({
          char_sheet_id: sheetId,
          career_id: career.career_id,
          years: career.years,
          savings,
          pro_advantages: JSON.stringify(career.proAdvantages || {}),
          random_picks: JSON.stringify(career.randomPicks || []),
          setbacks: JSON.stringify(career.setbacks || []),
        })

        // Compétences "au choix" (Lot 5) : validées par groupe AVANT d'être traitées comme pro
        // (une seule ouverte par choice_group, exclusivité radio — voir shared/careerSkills.js).
        const conditionalRows = await trx('ref_career_skills').where({ career_id: career.career_id, conditional: true })
        const { errors: choiceErrors } = validateChoiceGroups(step4.openedSkills || [], conditionalRows)
        if (choiceErrors.length > 0) {
          const err = choiceErrors[0]
          throw new AppError(400, `Choix multiple invalide pour ${refCareer.name} (${err.choiceGroup})`)
        }

        const openedConditionalIds = conditionalRows
          .filter(s => (step4.openedSkills || []).includes(s.skill_id))
          .map(s => s.skill_id)
        const nonConditionalRows = await trx('ref_career_skills').where({ career_id: career.career_id, conditional: false })
        careersCtx.push({
          skills: [...nonConditionalRows.map(s => s.skill_id), ...openedConditionalIds],
          years: career.years,
        })
      }

      // Q2 — validation globale du coût compétences (shared/careerSkills.js, Lot 1/2).
      // baseMastery : agrégation des bonus d'origines déjà appliqués ci-dessus (upsertSkillBonus).
      const baseMastery = {}
      for (const sk of bgSkillsToApply) baseMastery[sk.skill_id] = (baseMastery[sk.skill_id] ?? 0) + sk.bonus

      let higherEdSkills = []
      if (bgRows.higherEdRow) {
        const heSkillRows = await trx('ref_background_skills').where({ background_id: bgRows.higherEdRow.id, conditional: false })
        higherEdSkills = heSkillRows.map(s => s.skill_id)
      }

      const refSkillsRows = await trx('ref_skills').select('*')

      const allocResult = computeSkillAllocation(step4.skillAllocations || {}, {
        careers: careersCtx,
        higherEdSkills,
        baseMastery,
        refSkills: refSkillsRows,
        openedSkills: step4.openedSkills || [],
        skillMaxLevelEnabled: settings.skill_max_level,
      })
      if (allocResult.errors.length > 0) {
        const err = allocResult.errors[0]
        const msg = err.code === 'over_budget'
          ? `Budget de compétences dépassé : ${err.totalCost} pts dépensés sur ${err.budget} disponibles`
          : `Plafond de maîtrise dépassé pour ${err.skillId} (visé ${err.target}, max ${err.cap})`
        throw new AppError(400, msg)
      }

      for (const [skillId, target] of Object.entries(step4.skillAllocations || {})) {
        const isLearned = (step4.openedSkills || []).includes(skillId)
        await trx('char_skills')
          .insert({ char_sheet_id: sheetId, skill_id: skillId, mastery: target, is_learned: isLearned })
          .onConflict(['char_sheet_id', 'skill_id'])
          .merge({ mastery: target, is_learned: isLearned })
      }

      // finalAge = baseAge + higherEd.years_added + années de carrières
      let higherEdYears = 0
      if (higherEd) {
        const heRow = await trx('ref_backgrounds').where({ type: 'higher_ed', code: higherEd }).first()
        higherEdYears = heRow?.years_added ?? 0
      }
      const finalAge = baseAge + higherEdYears + totalCareerYears

      // OPT-10 (young_penalty, défaut OFF) : "Niveau de base" FOR/PRE (avant tout modificateur,
      // dont celui-ci) requis pour la règle "non applicable si Attribut ≤7" — lu en base plutôt
      // que depuis step1 (peut être absent de ce payload si déjà réconcilié précédemment).
      const ageAttrRows = await trx('char_attributes')
        .where({ char_sheet_id: sheetId })
        .whereIn('attr_id', ['FOR', 'PRE'])
        .select('attr_id', 'base_level')
      const ageAttrs = Object.fromEntries(ageAttrRows.map(r => [r.attr_id, r.base_level]))

      // Effets de l'âge sur les attributs — set absolu (pas increment) : rejouer la
      // reconciliation avec un âge final différent recalcule au lieu de cumuler les malus.
      const ageEffects = getAgeEffects(finalAge, { attributes: ageAttrs, youngPenaltyEnabled: settings.young_penalty })
      for (const attr of ATTR_IDS_START) {
        await trx('char_attributes')
          .where({ char_sheet_id: sheetId, attr_id: attr })
          .update({ pc_modifier: ageEffects[attr] ?? 0 })
      }
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ age: finalAge })
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: pc4 ?? 0 })
    }

    // ── STEP 5 : avantages/désavantages ────────────────────────────────────────
    // CRITIQUE : le ledger (pc_spent_step1..4) est rempli ci-dessus avant cet appel.
    // addAdvantage lit le ledger dans validateAdvantage pour vérifier sufficient_pc.
    if (step5) {
      const { advantages = [] } = step5
      // Reset avant réapplication — pendant le Wizard, char_advantages n'est écrit que
      // par cette boucle : suppression directe + remise à zéro du ledger, pas de
      // décrémentation ligne-à-ligne via removeAdvantage.
      await trx('char_advantages').where({ char_sheet_id: sheetId }).del()
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step5: 0, pc_gained_desavantages: 0 })
      for (const advantageId of advantages) {
        await addAdvantage(sheetId, advantageId, 'creation_step5', trx)
      }
    }

    // ── FINALISATION ────────────────────────────────────────────────────────────
    // isComplete=true pose characters.visible=true indépendamment du verrouillage —
    // voir garde wizard_locked_at dans characters.js (invariant documenté à cet endroit).
    const isComplete = !!(step1 && step2 && step3 && step4 && step5)
    if (isComplete) {
      await trx('characters').where({ id: characterId }).update({ visible: true })
      await trx('char_sheet').where({ id: sheetId }).update({ creation_state: 'complete' })
    }

    return { ok: true, characterId, isComplete }
  })
}

// ─── Verrouillage : fin du Wizard, la fiche devient éditable en session ────────

export async function lockWizard(sheetId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')
  if (sheet.creation_state !== 'complete') throw new AppError(400, 'Personnage non finalisé — impossible de verrouiller')
  await db('char_sheet').where({ id: sheetId }).update({ wizard_locked_at: db.fn.now() })
  return { ok: true }
}

// ─── Preview : lecture du brouillon pendant le Wizard (fenêtre fiche personnage) ─
// Ne réutilise pas characters.js (liste filtrée sur wizard_locked_at — cacherait le
// brouillon à son propre créateur). Garde d'ownership : router.param('sheetId') de
// routes/creation.js, indépendante du filtre de liste générale.

export async function getCharacterPreview(characterId, isGm) {
  const columns = [
    'characters.id', 'characters.name', 'characters.type', 'characters.color',
    'characters.visible', 'characters.glb_url', 'characters.portrait_url',
    'characters.user_id', 'characters.description', 'characters.created_at',
    'characters.updated_at', 'users.username as owner_username',
  ]
  if (isGm) columns.push('characters.gm_notes')
  return db('characters')
    .where({ 'characters.id': characterId })
    .leftJoin('users', 'characters.user_id', 'users.id')
    .select(columns)
    .first()
}
