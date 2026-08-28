import db from '../db/knex.js'
import { calcAttributeNA, calcSkillTotal } from '../lib/charStats.js'
import { calcAllures } from '../../../shared/polarisUtils.js'
import { getMutationEffects } from './mutationService.js'
import { getInventory } from './inventoryService.js'

// Levée quand un acteur EXISTE mais que sa capacité de déplacement ne peut pas être déterminée à
// partir de sa configuration actuelle — cas réparable côté fiche par le MJ/joueur (drone sans
// Vitesse, exo sans modèle/pilote, milieu bloqué...). Distincte d'une `Error` nue (bug/incohérence
// de données → 500 assumé, ex. token pointant un `characters.id` inexistant). Tous les appelants
// (routes HTTP, handlers socket) la traduisent en réponse claire à l'utilisateur (400 /
// COMBAT_DECLARE_ERROR / TOKEN_MOVE_REJECTED) plutôt qu'en 500 opaque — le `message` est en français
// et destiné à être affiché tel quel.
export class MovementBudgetError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MovementBudgetError'
  }
}

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
  if (character.type === 'drone') return getDroneMovementBudget(characterId, gait)

  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) throw new MovementBudgetError("Ce personnage n'a pas de fiche renseignée — impossible de calculer son déplacement.")

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
// suffit pas toujours — 3 modes possibles par milieu (exo_sheet.*_movement_mode) :
//   - 'vit'     : cas normal, base_speed_* alimente calcAllures.
//   - 'pilot'   : "capacité de déplacement du personnage" (ex. Armure Explora, à terre) — le
//     mouvement délègue entièrement au budget humain du pilote (récursion sur cette même fonction).
//   - 'blocked' : "-" (ex. Armure Vulcain, incapable de se déplacer hors de l'eau) — milieu sauté.
//
// Lot B (PLAN_EXOARMURE.md §13.3, 2026-08-20) — plus de leftJoin ref_exo_templates : ces 4 colonnes
// vivent désormais nativement sur exo_sheet (copiées par applyExoTemplate au moment de la sélection
// du modèle), lues directement sur la ligne. Sentinelle "non configurée" : `category IS NULL`
// (remplace l'ancien `template_id IS NULL` du Lot 1 §6.5).
async function getExoMovementBudget(characterId, gait) {
  const exo = await db('exo_sheet')
    .where({ character_id: characterId })
    .select(
      'category', 'pilot_character_id',
      'base_speed_underwater', 'base_speed_surface',
      'underwater_movement_mode', 'surface_movement_mode',
    )
    .first()
  if (!exo) throw new MovementBudgetError("Cette exo-armure n'a pas de fiche renseignée — impossible de calculer son déplacement.")
  if (!exo.category) throw new MovementBudgetError("Cette exo-armure n'a aucun modèle assigné — assigne un modèle sur sa fiche pour définir son déplacement.")

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
        throw new MovementBudgetError("Cette exo-armure délègue son déplacement à son pilote, mais aucun pilote n'est assigné.")
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
  throw new MovementBudgetError("Cette exo-armure ne peut se déplacer dans aucun milieu (déplacement bloqué ou indéfini pour ce modèle).")
}

// Drone — REGLEDRONE.md : chaque drone a une unique valeur « Déplacement / Vitesse : X m/Tour »,
// stockée telle quelle dans `drone_sheet.vitesse` (déjà en mètres, PAS un attribut à passer dans
// calcAllures contrairement à l'exo). Un drone n'a donc qu'UNE allure : sa Vitesse, qu'il ne peut
// pas dépasser (décision Saar 2026-08-28). Jamais encombré (pas de plafond `max → rapide`).
//
// Les 4 clés d'allure sont renseignées à la même valeur : `selectMovementBudget` /
// `selectCombatMovementForCost` (shared/combatMovement.js) et la légende de déplacement attendent la
// forme `{ lente, moyenne, rapide, max }`. Un déplacement in-range est classé « lente » par
// `selectCombatMovementForCost` (premier palier satisfait) ; l'`initiativeModifier` associé est de
// toute façon ignoré pour les drones (`socketCombatAnnouncement.js`, bloc `if (!isDrone)` —
// base_ini = 12 immuable, LdB p.320). L'UI collapse l'affichage en une seule ligne « Déplacement »
// quand les 4 allures sont égales.
//
// `mode_deplacement` (roues / magnétique / aérien / sous-marin) reste purement narratif — non
// consommé ici (décision Saar 2026-08-28).
export function buildDroneAllures(vitesse) {
  // `Number(null)` / `Number('')` valent 0 — un champ jamais renseigné (colonne nullable, aucune
  // valeur par défaut) doit lever, pas être traité comme un drone immobile. Seul un 0 explicite est
  // accepté (RAW « Déplacement : - »).
  const v = vitesse == null || vitesse === '' ? NaN : Number(vitesse)
  if (!Number.isFinite(v) || v < 0) {
    throw new MovementBudgetError(
      "Ce drone n'a pas de Vitesse renseignée sur sa fiche (en m/Tour) — renseigne-la pour permettre son déplacement.",
    )
  }
  return Object.freeze({ lente: v, moyenne: v, rapide: v, max: v })
}

async function getDroneMovementBudget(characterId, gait) {
  const drone = await db('drone_sheet')
    .where({ character_id: characterId })
    .select('vitesse')
    .first()
  if (!drone) throw new MovementBudgetError("Cette fiche de drone est introuvable — impossible de calculer son déplacement.")

  const allures = buildDroneAllures(drone.vitesse)
  return Object.freeze({
    ...selectMovementBudget(allures, gait),
    allures: Object.freeze({ ...allures }),
    source: 'server-drone-rules',
  })
}
