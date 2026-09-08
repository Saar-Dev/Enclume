// characterSizeService.js — Autorité serveur de la taille d'un combattant.
//
// Point d'entrée unique : resolveSizeCategory(db, character). Cascade
//   characters.size_category (explicite) > dérivée des dimensions de la fiche > 'moyenne'
// La LOGIQUE de cascade et de conversion cm → palier vit dans shared/sizeCategory.js
// (resolveSizeCategoryFrom, testable sans base) ; ce service n'est que la couche d'accès :
// il lit le bon champ de fiche selon le type de corps, puis délègue.
//
// docs/PLANS/PLAN_TAILLE.md S2. Consommé en S3 par les 5 sites de résolution combat à cible
// unique et en S4 par l'endpoint de préselection des fenêtres.

import { resolveSizeCategoryFrom } from '../../../shared/sizeCategory.js'

// db : instance knex ou transaction. characterOrId : la ligne `characters` (si déjà chargée)
// ou son id. preloaded : lignes de fiche déjà en main pour éviter un re-fetch (patron « re-fetch
// minimal » du combat) — passer explicitement `null` signifie « pas de fiche », `undefined`
// (ou absent) déclenche le fetch.
// Retour : { cm, category, source } — voir resolveSizeCategoryFrom.
export async function resolveSizeCategory(db, characterOrId, preloaded = {}) {
  const character = typeof characterOrId === 'string'
    ? await db('characters').where({ id: characterOrId }).first()
    : characterOrId
  if (!character) return { cm: null, category: 'moyenne', source: 'default' }

  const type = character.type
  const sizeCategory = character.size_category ?? null

  let heightM
  let droneTailleCm
  let exoCategory

  if (type === 'pj' || type === 'pnj') {
    let identity = preloaded.charIdentity
    if (identity === undefined) {
      const sheet = await db('char_sheet').where({ character_id: character.id }).first()
      identity = sheet
        ? await db('char_identity').where({ char_sheet_id: sheet.id }).first()
        : null
    }
    // char_identity.height : numeric(4,1) en mètres — node-postgres le renvoie en string.
    if (identity?.height != null) heightM = Number(identity.height)
  } else if (type === 'drone') {
    let drone = preloaded.droneSheet
    if (drone === undefined) drone = await db('drone_sheet').where({ character_id: character.id }).first()
    if (drone?.taille != null) droneTailleCm = Number(drone.taille)
  } else if (type === 'exo') {
    let exo = preloaded.exoSheet
    if (exo === undefined) exo = await db('exo_sheet').where({ character_id: character.id }).first()
    exoCategory = exo?.category ?? undefined
  }

  return resolveSizeCategoryFrom({ type, sizeCategory, heightM, droneTailleCm, exoCategory })
}

// Palier de taille retenu pour un jet d'attaque contre une cible.
// `confirmedModifiers.taille` n'est présent que si l'émetteur est MJ (filtré en amont par
// stripGmOnlyModifiers dans socketCombatResolution.js) — dans ce cas il fait foi (override MJ
// pour ce jet). Sinon, la taille est dérivée de la fiche de la cible.
// Retourne la clé de palier (une des 8 valeurs SIZE_CATEGORIES), directement utilisable comme
// TAILLE_MODS[…] / TAILLE_LABELS[…].
export async function resolveAttackTargetSize(db, targetCharacterOrId, confirmedModifiers, preloaded = {}) {
  if (confirmedModifiers?.taille) return confirmedModifiers.taille
  const { category } = await resolveSizeCategory(db, targetCharacterOrId, preloaded)
  return category
}
