import db from '../db/knex.js'
import { calcAttributeNA, calcSkillTotal } from '../lib/charStats.js'
import { calcAllures } from '../../../shared/polarisUtils.js'
import { getMutationEffects } from './mutationService.js'

export const MOVEMENT_GAITS = Object.freeze(['lente', 'moyenne', 'rapide', 'max'])

const GAIT_ALIASES = Object.freeze({
  slow: 'lente',
  normal: 'moyenne',
  run: 'rapide',
  sprint: 'max',
})

export function normalizeMovementGait(value) {
  const key = String(value || '').trim().toLowerCase()
  const gait = GAIT_ALIASES[key] || key
  if (!MOVEMENT_GAITS.includes(gait)) {
    throw new RangeError(`allure inconnue : ${value}`)
  }
  return gait
}

export function selectMovementBudget(allures, gait) {
  const normalizedGait = normalizeMovementGait(gait)
  const budgetM = Number(allures?.[normalizedGait])
  if (!Number.isFinite(budgetM) || budgetM < 0) {
    throw new RangeError(`budget invalide pour l'allure ${normalizedGait}`)
  }
  return Object.freeze({ gait: normalizedGait, budgetM })
}

export async function getCharacterMovementBudget(characterId, gait) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) throw new Error('Character sheet not found for movement budget')

  const [attributes, archetype, athletics, athleticsRef, mutationEffects] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    db('char_skills').where({ char_sheet_id: sheet.id, skill_id: 'ATHLETISME' }).first(),
    db('ref_skills').where({ id: 'ATHLETISME' }).first(),
    getMutationEffects(sheet.id),
  ])
  const genotype = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  const coordination = calcAttributeNA(attributes, 'COO', genotype, mutationEffects)
  const athleticsTotal = calcSkillTotal(
    attributes,
    athletics,
    athleticsRef,
    genotype,
    mutationEffects,
  )
  const allures = calcAllures(coordination, athleticsTotal)
  return Object.freeze({
    ...selectMovementBudget(allures, gait),
    allures: Object.freeze({ ...allures }),
    source: 'server-character-rules',
  })
}
