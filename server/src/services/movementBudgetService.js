import db from '../db/knex.js'
import { calcAttributeNA, calcSkillTotal } from '../lib/charStats.js'
import { calcAllures } from '../../../shared/polarisUtils.js'
import { getMutationEffects } from './mutationService.js'
import { getInventory } from './inventoryService.js'

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
  const character = await db('characters').where({ id: characterId }).first()
  if (!character) throw new Error('Character not found for movement budget')

  if (character.type === 'exo') return getExoMovementBudget(characterId, gait)

  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) throw new Error('Character sheet not found for movement budget')

  const [attributes, archetype, athletics, athleticsRef, mutationEffects, inventory] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    db('char_skills').where({ char_sheet_id: sheet.id, skill_id: 'ATHLETISME' }).first(),
    db('ref_skills').where({ id: 'ATHLETISME' }).first(),
    getMutationEffects(sheet.id),
    getInventory(characterId, character.campaign_id),
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
  // RAW REGLES_LdB.md:286-292 — l'Allure rapide est déjà "la vitesse d'un personnage qui court tout
  // en étant chargé et/ou encombré" ; l'Allure maximale exige explicitement d'être "sans être
  // encombré d'aucune manière". ini_penalty (inventoryService.js) est déjà l'autorité unique de
  // "ce personnage est chargé" (poids porté > FOR × multiplier, 0 si encumbrance_enabled=false pour
  // la campagne) — réutilisé tel quel plutôt qu'un second seuil : au-delà, l'Allure max retombe sur
  // l'Allure rapide (aucun coût de déplacement ne peut plus la sélectionner, cf. selectMovementBudget).
  if (inventory.ini_penalty > 0) allures.max = allures.rapide
  return Object.freeze({
    ...selectMovementBudget(allures, gait),
    allures: Object.freeze({ ...allures }),
    source: 'server-character-rules',
  })
}

// Exo-armure — la Vitesse (VIT) remplace à la fois la Coordination (base) et l'Athlétisme/Hybride
// (plafond) des humains pour la capacité de déplacement (RAW, REGLEARMURE.md:107-122 : "comparable
// à l'Agilité et aux Compétences Athlétisme et Hybride ... utilisez simplement la Vitesse").
// calcAllures(vit, vit) est donc réutilisé tel quel, sans nouvelle formule — coo_na et
// athletisme_total prennent la même valeur.
//
// Vérifié contre 16 armures RAW réelles (REGLEARMURE.md p.339-348) : un simple entier par milieu ne
// suffit pas toujours — 3 modes possibles par milieu (ref_exo_templates.*_movement_mode) :
//   - 'vit'     : cas normal, base_speed_* alimente calcAllures.
//   - 'pilot'   : "capacité de déplacement du personnage" (ex. Armure Explora, à terre) — le
//     mouvement délègue entièrement au budget humain du pilote (récursion sur cette même fonction).
//   - 'blocked' : "-" (ex. Armure Vulcain, incapable de se déplacer hors de l'eau) — milieu sauté.
async function getExoMovementBudget(characterId, gait) {
  const exo = await db('exo_sheet')
    .where({ 'exo_sheet.character_id': characterId })
    .leftJoin('ref_exo_templates', 'exo_sheet.template_id', 'ref_exo_templates.id')
    .select(
      'exo_sheet.template_id',
      'exo_sheet.pilot_character_id',
      'ref_exo_templates.base_speed_underwater',
      'ref_exo_templates.base_speed_surface',
      'ref_exo_templates.underwater_movement_mode',
      'ref_exo_templates.surface_movement_mode',
    )
    .first()
  if (!exo) throw new Error('Exo sheet not found for movement budget')
  if (!exo.template_id) throw new Error('Exo-suit has no template assigned — movement undefined')

  // Choix du milieu : Surface par défaut, puis Sous-marine en repli. Le moteur monde n'a aujourd'hui
  // aucun signal d'immersion en temps réel (EAU1, docs/EN_COURS.md — nappe d'eau ambiante retirée)
  // pour choisir dynamiquement entre les deux milieux d'un template hybride — limitation documentée,
  // à corriger quand ce signal existera (un seul point de bascule : l'ordre du tableau ci-dessous).
  const milieux = [
    { mode: exo.surface_movement_mode, speed: exo.base_speed_surface },
    { mode: exo.underwater_movement_mode, speed: exo.base_speed_underwater },
  ]
  for (const { mode, speed } of milieux) {
    if (mode === 'blocked') continue
    if (mode === 'pilot') {
      if (!exo.pilot_character_id) {
        throw new Error('Exo-suit movement delegates to pilot, but no pilot is assigned')
      }
      return getCharacterMovementBudget(exo.pilot_character_id, gait)
    }
    if (mode === 'vit' && speed != null) {
      const allures = calcAllures(speed, speed)
      return Object.freeze({
        ...selectMovementBudget(allures, gait),
        allures: Object.freeze({ ...allures }),
        source: 'server-exo-rules',
      })
    }
  }
  throw new Error('Exo-suit cannot move in any environment (blocked or undefined)')
}
