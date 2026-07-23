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
import { computeProAdvantageAllocation, computeRandomBudgetDelta, computeCareerBlockSavings } from '../../../shared/careerAdvantages.js'
import { getSetbackBlockCount, resolveSetback, mapSetbackToCareerBlock } from '../../../shared/careerSetbacks.js'
import { resolveSetbackEffects } from '../../../shared/setbackEffects.js'
import { aggregateTraitGauges, applyFractionalLoss } from '../../../shared/traitAggregation.js'
import { getAutodidacteEligibleIds, validateAutodidacteAllocations } from '../../../shared/autodidacte.js'
import { addAdvantage, grantAdvantage } from './advantageService.js'
import { addMutation } from './mutationService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { applyMutationIdentityGrant, recomputeIdentity, normalizeModIdentity } from './identityService.js'
import { resolveOwnership } from './characterOwnershipService.js'
import {
  attrOptionKey, handOptionKey, genotypeOptionKey, mutationOptionKey, careerOptionKey, advantageOptionKey,
  originGeoOptionKey, originSocOptionKey, trainingOptionKey, careerWaiveOptionKey,
  isSingleChoiceLockViolation, findSetLockViolations,
} from '../../../shared/wizardOptionKeys.js'

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
    // rs.label (Lot 6, "Formation"/skill_choice) : le sélecteur de compétence côté UI a besoin d'un
    // texte lisible, pas seulement skill_id — même patron que bgSkills (rs.label as skill_name)
    // juste au-dessus, jamais utilisé jusqu'ici pour les compétences de carrière.
    db('ref_career_skills as rcs').join('ref_skills as rs', 'rcs.skill_id', 'rs.id').select('rcs.*', 'rs.family', 'rs.label'),
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

// ─── État existant du brouillon (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md Lot A3) ────────
// Miroir en lecture de ce que reconcileCreation persiste pour chaque step — jamais plus que ce que
// le reconciler écrit réellement (les champs purement locaux au composant React, jamais envoyés au
// serveur — ex. Step4Experience.jsx `setbackResolution`, `geoName` — n'ont pas de contrepartie ici,
// ils sont déjà perdus au moindre rechargement pour le joueur lui-même, avant même ce chantier).
// Step4 volontairement absent : sa reconstruction (skillAllocations vs bonus de background dans
// char_skills.mastery, à vérifier) est plus risquée et traitée séparément avant d'être ajoutée ici.

export async function getStep1State(sheetId) {
  const [identity, archetype, attrRows, ledger] = await Promise.all([
    db('char_identity').where({ char_sheet_id: sheetId }).first(),
    db('char_archetype').where({ char_sheet_id: sheetId }).first(),
    db('char_attributes').where({ char_sheet_id: sheetId }).select('attr_id', 'base_level'),
    db('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
  ])
  return {
    charName: identity?.char_name ?? '',
    playerName: identity?.player_name ?? '',
    isFeminin: archetype?.sex === 'femme',
    pcSpent: ledger?.pc_spent_step1 ?? 0,
    height: identity?.height ?? null,
    weight: identity?.weight ?? null,
    skin: identity?.skin ?? '',
    eyes: identity?.eyes ?? '',
    hair: identity?.hair ?? '',
    build: identity?.build ?? '',
    distinctiveSigns: identity?.distinctive_signs ?? '',
    handPref: identity?.hand_pref ?? '',
    attributes: Object.fromEntries(attrRows.map(r => [r.attr_id, r.base_level])),
  }
}

export async function getStep2State(sheetId) {
  const archetype = await db('char_archetype').where({ char_sheet_id: sheetId }).first()
  return {
    genotypeId: archetype?.genotype_id ?? null,
    isDeserter: archetype?.is_deserter ?? false,
  }
}

export async function getStep3State(sheetId) {
  const [mutations, ledger] = await Promise.all([
    db('char_mutations').where({ char_sheet_id: sheetId }).whereIn('source', ['chosen', 'random'])
      .select('mutation_id', 'subtype_id', 'source'),
    db('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
  ])
  const method = mutations.some(m => m.source === 'random') ? 'random'
    : mutations.some(m => m.source === 'chosen') ? 'chosen' : null
  const list = mutations.map(m => ({ mutation_id: m.mutation_id, subtype_id: m.subtype_id }))
  return {
    method,
    mutations: method === 'chosen' ? list : [],
    kept: method === 'random' ? list : [],
    pcSpent: ledger?.pc_spent_step3 ?? 0,
  }
}

export async function getStep5State(sheetId) {
  const rows = await db('char_advantages')
    .where({ char_sheet_id: sheetId, acquired_during: 'creation_step5' })
    .whereNull('removed_at')
    .select('advantage_id')
  return { advantages: rows.map(r => r.advantage_id) }
}

// Best-effort (§0, décision Saar sur cette trouvaille) : skillAllocations/autodidacteAllocations
// ne sont PAS reconstructibles proprement — upsertSkillBonus (bonus de background) est additif sur
// char_skills.mastery, l'allocation Step4 du joueur écrit ensuite en SET (.merge) par-dessus, sans
// laisser de trace de quelle part vient d'où. Les rejouer demanderait de dupliquer tout le moteur de
// calcul de background (resolveStep4Backgrounds/getBackgroundSkillsToApply/resolveAutodidacteSkills)
// en lecture — risque de divergence avec le chemin d'écriture, pour un gain cosmétique (les points
// réellement dépensés restent corrects dans char_skills, seule la ré-édition du tableau repart de
// zéro). Ces deux champs reviennent donc vides à la réouverture — même catégorie déjà acceptée que
// Step4Experience.jsx `setbackResolution`/`geoName` (jamais envoyés au serveur, perdus au moindre
// rechargement même pour le joueur, pas une régression introduite ici).
export async function getStep4State(sheetId) {
  const [archetype, careerRows, ledger, skillRows] = await Promise.all([
    db('char_archetype').where({ char_sheet_id: sheetId }).first(),
    db('char_careers').where({ char_sheet_id: sheetId }).select('*'),
    db('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
    db('char_skills').where({ char_sheet_id: sheetId, is_learned: true }).select('skill_id'),
  ])
  return {
    age: archetype?.age ?? 16,
    originGeo: archetype?.origin_geo ?? null,
    originSoc: archetype?.origin_soc ?? null,
    training: archetype?.training_base ?? null,
    higherEd: archetype?.higher_ed ?? null,
    setbackRolls: archetype?.setback_rolls ?? [],
    pcSpent: ledger?.pc_spent_step4 ?? 0,
    careers: careerRows.map(c => ({
      career_id: c.career_id,
      years: c.years,
      proAdvantages: c.pro_advantages ?? {},
      randomPicks: c.random_picks ?? [],
      setbacks: c.setbacks ?? [],
    })),
    openedSkills: skillRows.map(r => r.skill_id),
    skillAllocations: {},
    autodidacteAllocations: {},
  }
}

// ─── Accès fiche + verrous MJ (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md Lot A1) ──────────
// resolveSheetAccess : extraction pure de l'ancien corps de router.param('sheetId')
// (routes/creation.js), même comportement, partagée par le middleware REST et les handlers
// WebSocket (§0 5e passe du plan — la duplication réelle à éliminer était REST vs WS, pas un
// isGm générique inventé).

export async function resolveSheetAccess(sheetId, userId) {
  const sheet = await db('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')

  const character = await db('characters').where({ id: sheet.character_id }).first()
  if (!character) throw new AppError(404, 'Personnage introuvable')

  const member = await db('campaign_members')
    .where({ campaign_id: character.campaign_id, user_id: userId })
    .first()
  if (!member) throw new AppError(403, "Vous n'êtes pas membre de cette campagne")

  const isOwner = character.user_id && character.user_id === userId
  if (!isOwner && member.role !== 'gm') {
    throw new AppError(403, "Vous n'avez pas accès à cette fiche")
  }

  return { sheet, character, isGm: member.role === 'gm' }
}

export async function getWizardLocks(sheetId) {
  return db('wizard_locks').where({ char_sheet_id: sheetId }).select('step', 'option_key as optionKey')
}

// Toggle atomique d'un seul (step, optionKey) — jamais un remplacement de tableau (§0 4e passe :
// deux onglets MJ ou une reconnexion qui réordonne les paquets créeraient une race sur un
// remplacement intégral). onConflict().ignore() rend un double-lock idempotent, sans erreur.
export async function toggleWizardLock(sheetId, step, optionKey, locked) {
  if (locked) {
    await db('wizard_locks')
      .insert({ char_sheet_id: sheetId, step, option_key: optionKey })
      .onConflict(['char_sheet_id', 'step', 'option_key'])
      .ignore()
  } else {
    await db('wizard_locks').where({ char_sheet_id: sheetId, step, option_key: optionKey }).del()
  }
  return getWizardLocks(sheetId)
}

// ─── Start : création du brouillon ────────────────────────────────────────────

const ATTR_IDS_START = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

export async function startCreation(campaignId, userId) {
  return db.transaction(async (trx) => {
    // Idempotence (docs/PLAN_WIZARDCOLLAB.md §0 5e passe, Lot A3) : un brouillon actif existe déjà
    // pour cet utilisateur dans cette campagne → le retourner au lieu d'en créer un second. Sans
    // ça, un MJ démarrant un brouillon via targetUserId (routes/creation.js) pour un joueur qui,
    // sans le savoir, en démarre un second via le flux normal (ou l'inverse) créerait un doublon
    // orphelin — s'applique dans les deux sens, même vérification.
    const existing = await trx('char_sheet as cs')
      .join('characters as c', 'c.id', 'cs.character_id')
      .where({ 'c.campaign_id': campaignId, 'c.user_id': userId })
      .whereNull('cs.wizard_locked_at')
      .select('cs.id as sheetId', 'c.id as characterId')
      .first()

    let sheetId, characterId
    if (existing) {
      sheetId = existing.sheetId
      characterId = existing.characterId
    } else {
      // type/color dérivés de l'appartenance réelle (docs/PLAN_CHARACTER_SERVICE.md) — un GM
      // utilisant le Wizard pour lui-même obtient un PNJ, pas un PJ codé en dur.
      const ownership = await resolveOwnership(trx, { campaignId, userId })
      const [character] = await trx('characters')
        .insert({ campaign_id: campaignId, user_id: ownership.user_id, name: 'Brouillon', type: ownership.type, color: ownership.color, visible: false })
        .returning(['id'])

      const [sheet] = await trx('char_sheet')
        .insert({ character_id: character.id, creation_state: 'draft_step0' })
        .returning(['id'])

      await trx('char_pc_ledger').insert({ char_sheet_id: sheet.id, pc_total: 20 })
      await trx('char_archetype').insert({ char_sheet_id: sheet.id })
      await trx('char_attributes').insert(
        ATTR_IDS_START.map(attr_id => ({ char_sheet_id: sheet.id, attr_id, base_level: 7, pc_modifier: 0 }))
      )
      sheetId = sheet.id
      characterId = character.id
    }

    const settings = await getCampaignSettings(trx, campaignId)

    return {
      sheetId,
      characterId,
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

// ─── Enforcement des verrous MJ (Wizard collaboratif, docs/PLAN_WIZARDCOLLAB.md §4.5) ──────────
// Lecture seule, exécutée avant toute écriture de reconcileCreation. Le MJ n'est jamais bloqué
// par ses propres verrous (isGm=true → no-op immédiat). Pour le joueur : compare la valeur/
// l'ensemble soumis à la valeur/l'ensemble actuellement persisté pour chaque clé verrouillée
// (fonctions pures shared/wizardOptionKeys.js) — rejette un changement réel, accepte toujours la
// resoumission de l'état déjà acquis (le reconciler renvoie l'état complet à chaque appel).
async function enforceWizardLocks(trx, sheetId, { step1, step2, step3, step4, step5 }, isGm) {
  if (isGm) return

  const lockRows = await trx('wizard_locks').where({ char_sheet_id: sheetId })
  if (lockRows.length === 0) return
  const locksByStep = new Map()
  for (const row of lockRows) {
    if (!locksByStep.has(row.step)) locksByStep.set(row.step, new Set())
    locksByStep.get(row.step).add(row.option_key)
  }

  // STEP 1 — attributs (choix unique par attribut) + main directrice (choix unique)
  if (step1 && locksByStep.has(1)) {
    const lockedKeys = locksByStep.get(1)
    if (step1.attributes) {
      const persistedAttrs = await trx('char_attributes').where({ char_sheet_id: sheetId }).select('attr_id', 'base_level')
      const persistedByAttr = new Map(persistedAttrs.map(r => [r.attr_id, r.base_level]))
      for (const [attrId, level] of Object.entries(step1.attributes)) {
        const key = attrOptionKey(attrId)
        if (lockedKeys.has(key) && level !== persistedByAttr.get(attrId)) {
          throw new AppError(400, `Option verrouillée par le MJ : attribut ${attrId}`)
        }
      }
    }
    const persistedIdentity = await trx('char_identity').where({ char_sheet_id: sheetId }).select('hand_pref').first()
    const persistedKey = handOptionKey(persistedIdentity?.hand_pref ?? null)
    const submittedKey = handOptionKey(step1.handPref ?? null)
    if (isSingleChoiceLockViolation({ lockedKeys, submittedKey, persistedKey })) {
      throw new AppError(400, 'Option verrouillée par le MJ : main directrice')
    }
  }

  // STEP 2 — génotype (choix unique)
  if (step2 && locksByStep.has(2)) {
    const lockedKeys = locksByStep.get(2)
    const persistedArchetype = await trx('char_archetype').where({ char_sheet_id: sheetId }).select('genotype_id').first()
    const persistedKey = persistedArchetype?.genotype_id != null ? genotypeOptionKey(persistedArchetype.genotype_id) : null
    const submittedKey = step2.genotypeId != null ? genotypeOptionKey(step2.genotypeId) : null
    if (isSingleChoiceLockViolation({ lockedKeys, submittedKey, persistedKey })) {
      throw new AppError(400, 'Option verrouillée par le MJ : génotype')
    }
  }

  // STEP 3 — mutations (ensemble). Seules source='chosen'/'random' appartiennent à ce step
  // (source='revers' est écrit par STEP4, cf. creationService.js commentaire ligne ~552).
  if (step3 && locksByStep.has(3)) {
    const lockedKeys = locksByStep.get(3)
    const persistedMutations = await trx('char_mutations')
      .where({ char_sheet_id: sheetId }).whereIn('source', ['chosen', 'random'])
      .select('mutation_id')
    const persistedKeys = new Set(persistedMutations.map(r => mutationOptionKey(r.mutation_id)))
    const submittedList = step3.method === 'random' ? (step3.kept ?? []) : (step3.mutations ?? [])
    const submittedKeys = new Set(submittedList.map(m => mutationOptionKey(m.mutation_id)))
    const violations = findSetLockViolations({ lockedKeys, submittedKeys, persistedKeys })
    if (violations.length) {
      throw new AppError(400, `Option verrouillée par le MJ : mutation ${violations[0]}`)
    }
  }

  // STEP 4 — origine géo/sociale + formation (choix unique) et carrières (ensemble). L'âge de
  // départ n'est volontairement pas verrouillable (décision Saar). optionKey carrière utilise
  // ref_careers.code, la soumission porte career_id (uuid) — traduction par lecture DB, inévitable,
  // pas une duplication de logique.
  if (step4 && locksByStep.has(4)) {
    const lockedKeys = locksByStep.get(4)

    const persistedArchetype4 = await trx('char_archetype')
      .where({ char_sheet_id: sheetId }).select('origin_geo', 'origin_soc', 'training_base').first()

    const originGeoPersistedKey = persistedArchetype4?.origin_geo != null ? originGeoOptionKey(persistedArchetype4.origin_geo) : null
    const originGeoSubmittedKey = step4.originGeo != null ? originGeoOptionKey(step4.originGeo) : null
    if (isSingleChoiceLockViolation({ lockedKeys, submittedKey: originGeoSubmittedKey, persistedKey: originGeoPersistedKey })) {
      throw new AppError(400, 'Option verrouillée par le MJ : origine géographique')
    }

    const originSocPersistedKey = persistedArchetype4?.origin_soc != null ? originSocOptionKey(persistedArchetype4.origin_soc) : null
    const originSocSubmittedKey = step4.originSoc != null ? originSocOptionKey(step4.originSoc) : null
    if (isSingleChoiceLockViolation({ lockedKeys, submittedKey: originSocSubmittedKey, persistedKey: originSocPersistedKey })) {
      throw new AppError(400, 'Option verrouillée par le MJ : origine sociale')
    }

    const trainingPersistedKey = persistedArchetype4?.training_base != null ? trainingOptionKey(persistedArchetype4.training_base) : null
    const trainingSubmittedKey = step4.training != null ? trainingOptionKey(step4.training) : null
    if (isSingleChoiceLockViolation({ lockedKeys, submittedKey: trainingSubmittedKey, persistedKey: trainingPersistedKey })) {
      throw new AppError(400, 'Option verrouillée par le MJ : formation de base')
    }

    const persistedCareers = await trx('char_careers as cc')
      .join('ref_careers as rc', 'rc.id', 'cc.career_id')
      .where({ 'cc.char_sheet_id': sheetId })
      .select('rc.code')
    const persistedKeys = new Set(persistedCareers.map(r => careerOptionKey(r.code)))
    const careerIds = (step4.careers ?? []).map(c => c.career_id)
    const refCareers = careerIds.length
      ? await trx('ref_careers').whereIn('id', careerIds).select('id', 'code')
      : []
    const codeByCareerId = new Map(refCareers.map(r => [r.id, r.code]))
    const submittedKeys = new Set(
      careerIds.map(id => codeByCareerId.get(id)).filter(Boolean).map(careerOptionKey)
    )
    const violations = findSetLockViolations({ lockedKeys, submittedKeys, persistedKeys })
    if (violations.length) {
      throw new AppError(400, `Option verrouillée par le MJ : carrière ${violations[0]}`)
    }
  }

  // STEP 5 — avantages (ensemble). Seuls acquired_during='creation_step5' appartiennent à ce
  // step (même filtre que reconcileCreation utilise déjà pour wiper/réinsérer, cf. §4.3 du plan).
  if (step5 && locksByStep.has(5)) {
    const lockedKeys = locksByStep.get(5)
    const persistedAdvantages = await trx('char_advantages')
      .where({ char_sheet_id: sheetId, acquired_during: 'creation_step5' })
      .whereNull('removed_at')
      .select('advantage_id')
    const persistedKeys = new Set(persistedAdvantages.map(r => advantageOptionKey(r.advantage_id)))
    const submittedKeys = new Set((step5.advantages ?? []).map(advantageOptionKey))
    const violations = findSetLockViolations({ lockedKeys, submittedKeys, persistedKeys })
    if (violations.length) {
      throw new AppError(400, `Option verrouillée par le MJ : avantage ${violations[0]}`)
    }
  }
}

// ─── Reconciliation : transaction unique, état partiel ou complet ──────────────
// Pattern reconciler (Kubernetes/Terraform) : chaque bloc STEP n'est appliqué que si
// l'étape correspondante est fournie. Rejouable sans duplication — chaque bloc reset
// ses tables dérivées avant réapplication. Voir docs/STE6_FINAL.md.

export async function reconcileCreation(sheetId, { step1, step2, step3, step4, step5, finalize }, isGm = false) {
  return db.transaction(async (trx) => {
    const sheet = await trx('char_sheet').where({ id: sheetId }).first()
    if (!sheet) throw new AppError(404, 'Fiche introuvable')
    if (sheet.wizard_locked_at) throw new AppError(400, "Cette fiche a quitté l'assistant de création — modifications via la fiche personnage uniquement")
    const characterId = sheet.character_id

    await enforceWizardLocks(trx, sheetId, { step1, step2, step3, step4, step5 }, isGm)

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
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ genotype_id: genotypeId, is_deserter: isDeserter })
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step2: pc2 })
    }

    // ── STEP 3 : mutations ──────────────────────────────────────────────────────
    if (step3) {
      const { method: step3Method, mutations: step3Mutations, kept: step3Kept, pcSpent: pc3 } = step3
      if (!['chosen', 'random', 'none'].includes(step3Method)) {
        throw new AppError(400, `Méthode de mutation invalide : ${step3Method}`)
      }
      // Champs identité potentiellement sous influence d'une mutation ACTIVE avant ce resubmit —
      // garde pour recomputeIdentity ci-dessous (Lot 6, docs/PLAN_MUTATION2.md). Capturé AVANT le
      // .del() : ne recalcule que les champs réellement concernés, jamais en aveugle (un recompute
      // inconditionnel écraserait un `sex` choisi au Step1 dès qu'aucune mutation ne le concerne).
      const previouslyActiveMutations = await trx('char_mutations as cm')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where({ 'cm.char_sheet_id': sheetId, 'cm.status': 'active' })
        .select('rm.mod_sex', 'rm.mod_fertility')
      const identityFields = []
      if (previouslyActiveMutations.some(m => m.mod_sex)) identityFields.push('sex')
      if (previouslyActiveMutations.some(m => m.mod_fertility)) identityFields.push('is_fertile')

      await trx('char_mutations').where({ char_sheet_id: sheetId }).del()
      const mutationsToInsert = step3Method === 'random' ? (step3Kept ?? []) : (step3Mutations ?? [])
      const mutationSource = step3Method === 'random' ? 'random' : 'chosen'
      for (const { mutation_id, subtype_id } of mutationsToInsert) {
        const mutRef = await trx('ref_mutations').where({ mutation_id }).first()
        if (!mutRef) throw new AppError(400, `Mutation inconnue : ${mutation_id}`)
        await applyMutationIdentityGrant(trx, sheetId, mutRef)
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
      if (identityFields.length) {
        await recomputeIdentity(trx, sheetId, identityFields)
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
      // Le client (CareersAllocator.jsx handleAdd) interdit déjà d'ajouter deux fois le même
      // career_id — le serveur reste autoritaire (core.md) et ne doit pas se reposer sur cette
      // seule garde client. Même patron que seenSetbackBlocks/seenBlocks plus bas dans ce fichier.
      const seenCareerIds = new Set()
      for (const c of careersData) {
        if (seenCareerIds.has(c.career_id)) {
          throw new AppError(400, `Carrière en double : ${c.career_id}`)
        }
        seenCareerIds.add(c.career_id)
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

      // Mécanisation des Revers (Lot 4, PLAN_WIZARD_AVANTAGES.md §17) : résolution AVANT la boucle
      // carrières — les effets économiques (income_multiplier, points_cap) doivent être routés vers
      // le bon (carrière, tranche)/budget avant que ces calculs ne s'exécutent plus bas.
      // Force Polaris (§8.2) : vérifié ici par l'appelant, jamais par le résolveur lui-même — les
      // 3 variantes (dormante/incontrôlée/maîtrisée) comptent toutes comme "doté du Polaris".
      const forcePolarisRow = await trx('char_advantages')
        .whereIn('advantage_id', ['adv_077', 'adv_078', 'adv_079'])
        .where({ char_sheet_id: sheetId })
        .whereNull('removed_at')
        .first()
      const setbackContext = { force_polaris: !!forcePolarisRow }

      const characterEffectTotals = {
        attributes: {}, celebrity: 0, skillPoints: 0, traits: [], grantedMutations: [],
        grantedAdvantages: [], pendingChoices: [],
        // celebrityFractions (Lot 6, Diffamation "un quart de sa Célébrité") : jamais additionné
        // directement à `celebrity` (le résolveur ne connaît pas le total accumulé, §5bis du plan) —
        // appliqué une seule fois après coup via applyFractionalLoss, même principe que
        // shared/traitAggregation.js#aggregateTraitGauges pour les jauges char_traits.
        celebrityFractions: [],
      }
      let extraSkillBudgetDelta = 0
      const categoryBudgetDeltaByCareerIndex = new Map()
      const extraEffectsByCareerIndexAndBlock = new Map()

      // try/catch dédié : resolveSetbackEffects (shared/setbackEffects.js) lève des Error brutes
      // (Revers cible introuvable, option de choix invalide, jet hors plages, récursion trop
      // profonde, type inconnu) — jamais des AppError, contrairement à computeCareerBlockSavings
      // plus bas qui a déjà ce filet. Sans lui, une donnée de Revers mal formée (faute de saisie
      // Lot 6) remontait en 500 non géré au lieu d'un 400 propre.
      try {
      for (const sb of setbackRolls) {
        const result = resolveSetbackEffects(sb.roll, setbackRows, sb.answers || {}, setbackContext)
        if (result.status === 'pending') {
          throw new AppError(400, `Revers incomplet : ${result.kind === 'choice' ? 'un choix' : 'un jet'} manquant (${result.key})`)
        }
        const location = mapSetbackToCareerBlock(sb.blockIndex, careersData)
        if (!location) throw new AppError(400, 'Revers invalide : tranche au-delà des années de carrière')
        const { careerIndex, blockIndexWithinCareer } = location

        for (const effect of result.effects) {
          switch (effect.type) {
            case 'attribute':
              characterEffectTotals.attributes[effect.target] = (characterEffectTotals.attributes[effect.target] ?? 0) + effect.value
              break
            case 'celebrity':
              characterEffectTotals.celebrity += effect.value
              break
            case 'celebrity_fraction':
              characterEffectTotals.celebrityFractions.push(effect.value)
              break
            case 'skill_points':
              characterEffectTotals.skillPoints += effect.value
              break
            case 'trait':
              characterEffectTotals.traits.push({
                trait_type: effect.trait_type, op: effect.op, value: effect.value ?? null, note: effect.note ?? null,
              })
              break
            case 'grant_advantage':
              characterEffectTotals.grantedAdvantages.push({ advantage_id: effect.advantage_id })
              break
            case 'manual_grant_choice':
              characterEffectTotals.pendingChoices.push({ trait_type: effect.trait_type, candidates: effect.candidates })
              break
            case 'points_cap':
              // Ajustement ponctuel de budget (delta = plafond - taux normal), PAS un plafonnement
              // par bloc — §17 : computeSkillAllocation (10 pts/an, character-wide) et
              // computeProAdvantageAllocation (5 pts/an, PAR carrière) sont les seules autorités
              // budgétaires existantes, jamais un nouveau suivi "par année".
              if (effect.scope === 'skill_points') {
                extraSkillBudgetDelta += effect.value - 10
              } else if (effect.scope === 'category_points') {
                categoryBudgetDeltaByCareerIndex.set(
                  careerIndex, (categoryBudgetDeltaByCareerIndex.get(careerIndex) ?? 0) + (effect.value - 5)
                )
              } else {
                throw new AppError(400, `points_cap : portée inconnue (${effect.scope})`)
              }
              break
            case 'income_percent':
            case 'income_multiplier':
            case 'income_multiplier_permanent': {
              if (!extraEffectsByCareerIndexAndBlock.has(careerIndex)) extraEffectsByCareerIndexAndBlock.set(careerIndex, new Map())
              const byBlock = extraEffectsByCareerIndexAndBlock.get(careerIndex)
              if (!byBlock.has(blockIndexWithinCareer)) byBlock.set(blockIndexWithinCareer, [])
              byBlock.get(blockIndexWithinCareer).push(effect)
              break
            }
            case 'narrative':
              break
            default:
              throw new AppError(400, `Effet de Revers non géré côté serveur : ${effect.type}`)
          }
        }
      }
      } catch (err) {
        if (err instanceof AppError) throw err
        throw new AppError(400, `Revers invalide : ${err.message}`)
      }

      // Reset avant réapplication — char_skills/char_careers ne sont écrits que par ce
      // bloc pendant le Wizard (avant verrouillage) : wipe sûr, pas d'orphelin FK possible.
      await trx('char_skills').where({ char_sheet_id: sheetId }).del()
      await trx('char_careers').where({ char_sheet_id: sheetId }).del()
      // Idem char_traits (Lot 6, Allié/Contact/Ennemi/Opposant/Employer gagnés par tirage) :
      // aucun autre écrivain dans tout le code (§Lot C, PLAN_WIZARD_AVANTAGES.md), wipe sûr.
      await trx('char_traits').where({ char_sheet_id: sheetId }).del()
      // char_mutations : ne wipe QUE source='revers' — seul écrivain de cette valeur est la boucle
      // addMutation plus bas dans ce même bloc STEP4 (Revers/tirage carrière → grant_mutation).
      // 'campaign' (octroi MJ en jeu, AdvantagesPanel.jsx) n'est jamais écrit pendant le Wizard —
      // wizard_locked_at n'est pas encore posé à ce stade, donc aucun octroi 'campaign' légitime ne
      // peut exister sur cette fiche ; source='chosen'/'random' (STEP3) reste intact (§14 du plan).
      await trx('char_mutations').where({ char_sheet_id: sheetId, source: 'revers' }).del()
      // char_advantages : capturer AVANT le wipe les champs mod_identity des octrois 'revers'
      // qui vont disparaître (même patron que STEP5 l.818-828 ci-dessous) — recomputeIdentity()
      // recalcule intégralement à partir de ce qui reste actif, jamais une restauration de valeur
      // précédente (identityService.js) ; sans cet appel, un champ d'identité posé par un Revers
      // devenu obsolète (tirage changé, Revers retiré) resterait figé sur sa dernière valeur.
      const previouslyActiveTraumaAdvantages = await trx('char_advantages as ca')
        .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
        .whereNull('ca.removed_at')
        .where({ 'ca.char_sheet_id': sheetId, 'ca.acquired_during': 'revers' })
        .whereNotNull('ra.mod_identity')
        .select('ra.mod_identity')
      const reversIdentityFieldsSet = new Set()
      for (const { mod_identity } of previouslyActiveTraumaAdvantages) {
        const parsed = normalizeModIdentity(mod_identity)
        if (parsed) Object.keys(parsed).forEach((k) => reversIdentityFieldsSet.add(k))
      }
      // ne wipe QUE acquired_during='revers' — seul écrivain de cette valeur est la boucle
      // grantAdvantage plus bas dans ce même bloc STEP4 (Revers → grant_advantage). Sans ce wipe,
      // grantAdvantage (INSERT nu, contrainte unique (char_sheet_id, advantage_id) WHERE
      // removed_at IS NULL) lève AppError(409) dès le 2e reconcile qui retrouve le même octroi —
      // corrigé ici avec la même logique que char_traits/char_mutations ci-dessus, jamais
      // 'creation_step5'/'campaign'/'adjustment' (propriété d'autres blocs, cf. STEP5 plus bas).
      await trx('char_advantages').where({ char_sheet_id: sheetId, acquired_during: 'revers' }).del()

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
      // characterEffectTotals déclaré plus haut (avant la résolution des Revers) — rempli côté
      // Revers ci-dessus, complété côté tirages de carrière ci-dessous, consommé après la boucle.
      const careersCtx = []
      // "Mise à prix" (Lot 2, §Lot E point 5) : Map(career_id -> Map(roll -> montant sols de la
      // dernière occurrence)) — un sous-historique par carrière, jamais de fuite entre deux métiers
      // différents du même personnage. computeCareerBlockSavings ne connaît qu'une carrière à la fois.
      const miseAPrixHistory = new Map()
      for (const [careerIndex, career] of careersData.entries()) {
        const refCareer = await trx('ref_careers').where({ id: career.career_id }).first()
        if (!refCareer) throw new AppError(400, `Carrière inconnue : ${career.career_id}`)
        if (!career.years || career.years < 1) throw new AppError(400, `Années invalides pour ${refCareer.name}`)

        // Dérogation MJ par carrière (docs/PLAN_WIZARDCOLLAB.md, demande Saar) — distincte du
        // bypass global isGm (Lot B) : lève les prérequis pour CETTE carrière précise, quel que
        // soit le soumetteur, tant que le MJ a activé career_waive_<code>. Vérifiée avant l'appel
        // pour ne pas construire le contexte d'éligibilité si elle est de toute façon ignorée.
        const waived = await trx('wizard_locks')
          .where({ char_sheet_id: sheetId, step: 4, option_key: careerWaiveOptionKey(refCareer.code) })
          .first()
        if (!waived) {
          const eligCheck = await checkCareerEligibility(sheetId, career.career_id, trx)
          if (!eligCheck.valide) throw new AppError(400, eligCheck.erreur)
        }

        const titles = await trx('ref_career_titles').where({ career_id: career.career_id }).orderBy('min_years')
        const title = titles.find(t =>
          career.years >= t.min_years && (t.max_years === null || career.years <= t.max_years)
        )
        let salary = 0
        if (title) {
          if (title.salary_per_year) salary = title.salary_per_year
          else if (title.salary_formula) salary = evaluateSalaryFormula(title.salary_formula)
        }

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

        // Mécanisation (Lot 2, PLAN_WIZARD_AVANTAGES.md §Lot E) : économies calculées tranche de 5
        // ans par tranche, pas en un seul total plat — fonction pure extraite dans shared/ (réutilisable
        // client + serveur, même principe que resolveCareerRandomEffects). L'historique "Mise à prix"
        // est scopé par career_id ici (l'appelant), la fonction ne connaît qu'une carrière à la fois.
        let blockResult
        try {
          blockResult = computeCareerBlockSavings(randomPicks, randomBenefitRows, {
            salary,
            years: career.years,
            celebrityBefore: characterEffectTotals.celebrity,
            miseAPrixHistory: miseAPrixHistory.get(career.career_id) ?? new Map(),
            // Revers (Lot 4, §17) rattachés à cette carrière précise via mapSetbackToCareerBlock.
            extraEffectsByBlock: extraEffectsByCareerIndexAndBlock.get(careerIndex) ?? new Map(),
          })
        } catch (err) {
          throw new AppError(400, `Tirage 1D10 invalide pour ${refCareer.name} : ${err.message}`)
        }
        miseAPrixHistory.set(career.career_id, blockResult.miseAPrixHistory)
        const savings = blockResult.savings
        const resolvedEffects = { categories: blockResult.categories }
        for (const [attr, delta] of Object.entries(blockResult.attributes)) {
          characterEffectTotals.attributes[attr] = (characterEffectTotals.attributes[attr] ?? 0) + delta
        }
        characterEffectTotals.celebrity += blockResult.celebrity
        characterEffectTotals.skillPoints += blockResult.skillPoints
        characterEffectTotals.traits.push(...blockResult.traits)
        characterEffectTotals.grantedMutations.push(...blockResult.grantedMutations)

        // Q3 — validation par métier du coût avantages pro (shared/careerAdvantages.js, Lot 4).
        // Volontairement basée sur career.proAdvantages SEUL (allocation manuelle du joueur) —
        // resolvedEffects.categories (bonus gratuits gagnés par tirage) ne doit jamais entrer dans
        // ce calcul sous peine de fausser le budget validé ; stocké séparément (random_effects_applied)
        // et additionné uniquement côté lecture (fiche personnage), pas ici.
        const pointCatRows = await trx('ref_career_point_categories').where({ career_id: career.career_id })
        // Revers points_cap (Renvoi, §17) : ajustement ponctuel de CE budget-ci (5 pts/an, PAR
        // carrière) — additionné au delta déjà existant du tirage, jamais un plafond par tranche.
        const advResult = computeProAdvantageAllocation(career.proAdvantages || {}, {
          categories: pointCatRows.map(c => c.category),
          years: career.years,
          randomBudgetDelta: randomBudgetDelta + (categoryBudgetDeltaByCareerIndex.get(careerIndex) ?? 0),
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
          random_effects_applied: JSON.stringify(resolvedEffects.categories),
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

        // "Formation" (Lot 6, skill_choice) : la compétence choisie doit appartenir à la liste
        // professionnelle de CE métier (serveur autoritaire, jamais confiance au client) — même
        // patron de validation que openedSkills/validateChoiceGroups juste au-dessus. Un doublon
        // avec nonConditionalRows/openedConditionalIds est inoffensif (isProSkill/computeSkillAllocation,
        // shared/careerSkills.js, ne fait qu'un test d'appartenance, jamais un comptage) — pas besoin
        // de dédoublonner.
        const careerSkillIds = new Set([
          ...nonConditionalRows.map(s => s.skill_id),
          ...conditionalRows.map(s => s.skill_id),
        ])
        for (const skillId of blockResult.chosenSkills) {
          if (!careerSkillIds.has(skillId)) {
            throw new AppError(400, `Formation invalide pour ${refCareer.name} : compétence hors liste professionnelle (${skillId})`)
          }
        }

        careersCtx.push({
          skills: [
            ...nonConditionalRows.map(s => s.skill_id), ...openedConditionalIds,
            ...blockResult.chosenSkills, ...blockResult.grantedSkills,
          ],
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
        // Revers points_cap (Renvoi, §17) : ajustement ponctuel character-wide, jamais un nouveau
        // suivi par année — extraSkillBudgetDelta calculé plus haut lors de la résolution des Revers.
        extraBudgetDelta: extraSkillBudgetDelta,
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
      // Composé avec characterEffectTotals.attributes (tirages 1D10, résolus pendant la boucle
      // carrières ci-dessus) — même principe : set absolu, jamais un increment sur plusieurs appels.
      const ageEffects = getAgeEffects(finalAge, { attributes: ageAttrs, youngPenaltyEnabled: settings.young_penalty })
      for (const attr of ATTR_IDS_START) {
        const careerDelta = characterEffectTotals.attributes[attr] ?? 0
        await trx('char_attributes')
          .where({ char_sheet_id: sheetId, attr_id: attr })
          .update({ pc_modifier: (ageEffects[attr] ?? 0) + careerDelta })
      }
      await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ age: finalAge })
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step4: pc4 ?? 0 })

      // Célébrité / points de compétence gagnés par tirage — set absolu (aucun autre écrivain
      // pendant la création : xp_available n'est touché qu'en jeu via routes/character/char-sheet.js,
      // celebrity n'existe que depuis cette mécanisation).
      // celebrityFractions (Lot 6, Diffamation) appliquées ici, une seule fois, contre le total brut
      // déjà accumulé ci-dessus (shared/traitAggregation.js#applyFractionalLoss — le résolveur de
      // Revers n'a jamais accès à ce total, §5bis du plan).
      await trx('char_sheet').where({ id: sheetId }).update({
        celebrity: applyFractionalLoss(characterEffectTotals.celebrity, characterEffectTotals.celebrityFractions),
        xp_available: characterEffectTotals.skillPoints,
      })

      // Traits (Lot C : Allié/Contact/Ennemi/Opposant/Employer) — recalculés intégralement à partir
      // de characterEffectTotals.traits (jamais accumulés entre deux appels, même principe que
      // celebrity/skillPoints ci-dessus). Wipe déjà fait plus haut (char_traits.del()).
      // Agrégation (dont gauge_fraction_delta, Lot 6, Diffamation/Trahison) extraite en fonction pure
      // testée : shared/traitAggregation.js#aggregateTraitGauges.
      const { gauges: traitGauges, notes: traitNotes } = aggregateTraitGauges(characterEffectTotals.traits)
      // Conversion Opposant→Ennemi — seule valeur connue de ref_careers.enemy_rule en base
      // (§8.4, PLAN_WIZARD_AVANTAGES.md) : 3 Opposants échangés contre 1 Ennemi. Une autre valeur
      // de enemy_rule n'existe nulle part aujourd'hui ; ne pas généraliser sans l'avoir vue.
      if ((traitGauges.opponent ?? 0) >= 3) {
        const conversions = Math.floor(traitGauges.opponent / 3)
        traitGauges.opponent -= conversions * 3
        traitGauges.enemy = (traitGauges.enemy ?? 0) + conversions
      }
      for (const [traitType, gauge] of Object.entries(traitGauges)) {
        if (!gauge && !traitNotes[traitType]) continue
        await trx('char_traits').insert({
          char_sheet_id: sheetId,
          trait_type: traitType,
          params: JSON.stringify({ gauge, note: traitNotes[traitType] ?? null, pnj_id: null }),
        })
      }

      // Mutations accordées par tirage (grant_mutation) — même transaction que le reste de STEP4
      // (addMutation accepte un trxOpt depuis cette session, mutationService.js) : un rollback
      // plus tard dans ce même reconcile doit défaire l'octroi, pas le laisser commité isolément.
      // Wipe source='campaign' déjà fait plus haut.
      for (const { mutation_id, subtype_id } of characterEffectTotals.grantedMutations) {
        await addMutation(sheetId, mutation_id, subtype_id, 'revers', trx)
      }

      // Avantages/désavantages accordés par un Revers (grant_advantage — Ennemi, Recherché,
      // Infirmité, Allergie sévère... §Lot B/C) — sans compensation PC, acquired_during='revers'.
      // grantAdvantage accepte un trxOpt depuis cette session (advantageService.js), même raison
      // d'atomicité que addMutation. STEP5 ne wipe que acquired_during='creation_step5' (§14/§17) :
      // ces octrois survivent à la réconciliation de STEP5, jamais écrasés.
      for (const { advantage_id } of characterEffectTotals.grantedAdvantages) {
        await grantAdvantage(sheetId, advantage_id, 'revers', trx)
      }
      // Recompute des champs d'identité affectés par les octrois 'revers' retirés par le wipe
      // ci-dessus (reversIdentityFieldsSet) — grantAdvantage() vient de réappliquer directement
      // les mod_identity des NOUVEAUX octrois (applyIdentityGrant interne), mais rien ne recalcule
      // un champ qui n'est plus couvert par aucun octroi 'revers' de cette résolution. Appelé après
      // coup : recomputeIdentity relit l'état actuel (mutations puis avantages actifs) et retombe
      // sur le défaut si plus rien ne couvre le champ (identityService.js) — jamais une valeur
      // Step1 écrasée à tort, seuls les champs de reversIdentityFieldsSet sont concernés.
      if (reversIdentityFieldsSet.size) {
        await recomputeIdentity(trx, sheetId, [...reversIdentityFieldsSet])
      }

      // Choix manuels en attente (manual_grant_choice — Phobie/Déséquilibre mental, Recherché,
      // Infirmité : variante à définir à table, Joueur+MJ, §Lot B/§17) — persisté en char_traits
      // pour que le signal survive à la fermeture du Wizard, sinon perdu sans trace pour le MJ.
      // Dédoublonné par trait_type (trouvé en relecture critique, 2026-07-22, peuplement Lot 6) :
      // plusieurs Revers peuvent produire le même trait_type dans un seul reconcile (ex. Fugitif ET
      // Vendetta accordent tous deux 'wanted') — sans ce regroupement, deux lignes char_traits
      // `pending_wanted` distinctes auraient été insérées, jamais nettoyées entre elles (aucune
      // contrainte d'unicité sur char_traits).
      const pendingCandidatesByType = new Map()
      for (const { trait_type, candidates } of characterEffectTotals.pendingChoices) {
        const merged = new Set(pendingCandidatesByType.get(trait_type) ?? [])
        for (const c of candidates) merged.add(c)
        pendingCandidatesByType.set(trait_type, [...merged])
      }
      for (const [trait_type, candidates] of pendingCandidatesByType) {
        await trx('char_traits').insert({
          char_sheet_id: sheetId,
          trait_type: `pending_${trait_type}`,
          params: JSON.stringify({ candidates, note: 'à définir à table' }),
        })
      }
    }

    // ── STEP 5 : avantages/désavantages ────────────────────────────────────────
    // CRITIQUE : le ledger (pc_spent_step1..4) est rempli ci-dessus avant cet appel.
    // addAdvantage lit le ledger dans validateAdvantage pour vérifier sufficient_pc.
    if (step5) {
      const { advantages = [] } = step5
      // Champs identité potentiellement sous influence d'un avantage ACTIF avant ce resubmit — même
      // garde que STEP3 (Lot 6, docs/PLAN_MUTATION2.md). Capturé AVANT le .del().
      const previouslyActiveAdvantages = await trx('char_advantages as ca')
        .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
        .whereNull('ca.removed_at')
        .where('ca.char_sheet_id', sheetId)
        .whereNotNull('ra.mod_identity')
        .select('ra.mod_identity')
      const identityFieldsSet = new Set()
      for (const { mod_identity } of previouslyActiveAdvantages) {
        const parsed = normalizeModIdentity(mod_identity)
        if (parsed) Object.keys(parsed).forEach((k) => identityFieldsSet.add(k))
      }

      // Reset avant réapplication — ne wipe QUE acquired_during='creation_step5' : cette boucle
      // est le seul écrivain de cette valeur précise, mais char_advantages porte aussi 'revers'
      // (Revers, wipé/réécrit par le bloc STEP4 ci-dessus) et potentiellement 'campaign'/
      // 'adjustment' (post-Wizard, hors reconcile) — un .del() inconditionnel ici effacerait un
      // octroi 'revers' déjà réécrit dans la même transaction (§14/§17 du plan). Suppression
      // directe + remise à zéro du ledger, pas de décrémentation ligne-à-ligne via removeAdvantage.
      await trx('char_advantages').where({ char_sheet_id: sheetId, acquired_during: 'creation_step5' }).del()
      await trx('char_pc_ledger').where({ char_sheet_id: sheetId }).update({ pc_spent_step5: 0, pc_gained_desavantages: 0 })
      for (const advantageId of advantages) {
        await addAdvantage(sheetId, advantageId, 'creation_step5', trx)
      }
      if (identityFieldsSet.size) {
        await recomputeIdentity(trx, sheetId, [...identityFieldsSet])
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

    // finalize : verrouille dans la MÊME transaction que la réconciliation — évite la fenêtre où
    // creation_state passe à 'complete' sans que wizard_locked_at soit posé si le 2e appel réseau
    // séparé échoue (coupure, onglet fermé). Un seul appel client atomique pour "Terminer".
    if (finalize) {
      if (!isComplete) throw new AppError(400, 'Personnage incomplet — impossible de terminer le Wizard')
      await lockWizard(sheetId, trx)
    }

    return { ok: true, characterId, isComplete }
  })
}

// ─── Verrouillage : fin du Wizard, la fiche devient éditable en session ────────

// trxOpt : permet l'appel depuis une transaction externe (ex. vaultService.cloneCharacterDeep,
// qui vient d'insérer la ligne char_sheet dans la même transaction — sur la connexion `db` seule,
// cette ligne pas encore commitée serait invisible) ; sinon ouvre sa propre requête sur `db`
// (pattern trx-or-db, identique à advantageService.addAdvantage).
export async function lockWizard(sheetId, trxOpt) {
  const exec = trxOpt || db
  const sheet = await exec('char_sheet').where({ id: sheetId }).first()
  if (!sheet) throw new AppError(404, 'Fiche introuvable')
  if (sheet.creation_state !== 'complete') throw new AppError(400, 'Personnage non finalisé — impossible de verrouiller')
  await exec('char_sheet').where({ id: sheetId }).update({ wizard_locked_at: db.fn.now() })
  // Les verrous MJ n'ont plus de sens une fois le brouillon devenu personnage réel — le ON DELETE
  // CASCADE ne joue qu'à la suppression de char_sheet, jamais à cette bascule (docs/PLAN_WIZARDCOLLAB.md §2.4).
  await exec('wizard_locks').where({ char_sheet_id: sheetId }).del()
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
