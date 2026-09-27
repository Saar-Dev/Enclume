// server/src/services/effectLineResolverService.js — Résolveurs serveur des lignes d'effet de danger
// (docs/PLANS/PLAN_ZONES_DANGER.md §2.A, §14.2/§14.3, incréments Z1.1 + Z1.2). Patron server/src/
// services/weaponModService.js (`RESOLVERS` + `findModRegistryEntry`) : une carte { type → fonction },
// jamais un throw pour un type sans résolveur. `findEffectLineResolver` renvoie `undefined` pour les 9
// types encore v2 (§9 du plan) — ils restent no-op tant que leur propre incrément ne leur donne pas de
// fonction ici. La forme d'une ligne (contrat, validation) vient de shared/world/dangerEffectLines.js
// (Z0) : ce fichier ne revalide rien, il RÉSOUT une ligne déjà normalisée.
//
// Z1.2 : `resolveActiveEffects` remplace `resolveEnvironmentalHazardTicks` dans combatTurnEngine.js.
// Non-régression stricte (§14.1) : la donnée qui pilote le dégât reste `token_statuses.data`
// (formula/locations/forcedLocation posés par exposeToHazard, MJ) — JAMAIS relue depuis
// shared/world/dangerCatalog.js ici. Absorber le catalogue comme source de ces chiffres est Z1.3+ ;
// changer ça maintenant serait ignorer une formule personnalisée qu'un MJ a posée à l'exposition.
// Seul `entry.forcedLocation` (registre, inchangé) continue de primer, exactement comme avant.

import { parseDice } from '../lib/diceParser.js'
import { calcAttributeNA } from '../lib/charStats.js'
import { getMutationEffects } from './mutationService.js'
import { resolveTargetHit } from '../lib/damageService.js'
import { WS } from '../../../shared/events.js'
import { SLOT_TO_WOUND_LOCATION, LOCATION_TO_SLOT } from '../../../shared/armorConstants.js'
import { findHazardRegistryEntry } from '../../../shared/environmentalHazardRegistry.js'

// Les 6 Localisations RAW (LOC_TABLE), jamais les slots main/deux-mains/tripode de LOCATION_TO_SLOT
// (qui n'existent que pour l'armure/l'équipement) — locationMode:'all' (feu:brasier) doit toucher
// "TOUTES les Localisations", pas les slots d'équipement.
const ALL_WOUND_SLOT_CODES = Object.keys(SLOT_TO_WOUND_LOCATION)

async function loadTargetContext(db, tokenId) {
  const token = await db('tokens').where({ id: tokenId }).first()
  if (!token?.character_id) return null
  const character = await db('characters').where({ id: token.character_id }).first()
  if (!character || character.type === 'drone') return null
  const sheet = await db('char_sheet').where({ character_id: character.id }).first()
  if (!sheet) return null

  const [attrs, archetype, mutationEffects] = await Promise.all([
    db('char_attributes').where({ char_sheet_id: sheet.id }),
    db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
    getMutationEffects(sheet.id),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  return {
    character, sheet,
    for_na_cible: calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects),
    con_na_cible: calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects),
    vol_na_cible: calcAttributeNA(attrs, 'VOL', genotypeRow, mutationEffects),
  }
}

// Précédence des Localisations — §3 du plan : la définition (ex. decompression → 'corps') prime sur
// TOUT ; sinon la ligne peut fixer la sienne ; sinon le mode tranche — 'exposed' lit le choix MJ posé
// sur l'instance, 'random' reste aléatoire même si un choix existe (texte du plan, littéral, pas une
// omission). 'all' est structurellement différent : chaque Localisation une fois, `locations` de la
// ligne est ignoré (convention §13.3, pas de valeur magique 0).
function resolveForcedSlotCodes(line, definitionForcedLocation, instanceForcedLocation) {
  if (line.locationMode === 'all') return { isAllMode: true, slotCodes: ALL_WOUND_SLOT_CODES }
  const forcedLocationKey = definitionForcedLocation
    ?? line.forcedLocation
    ?? (line.locationMode === 'exposed' ? instanceForcedLocation : null)
    ?? null
  // Conversion clé de Localisation (LOCATION_TO_SLOT, ex. 'bras_gauche') → slotCode ('BG') attendu par
  // resolveTargetHit — même conversion que l'ancien chemin (`LOCATION_TO_SLOT[locKey]`). Sans elle,
  // `damageService.js:354` (`SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'`) retombe SILENCIEUSEMENT sur
  // 'corps' pour toute clé qui n'est pas déjà un slotCode — bug trouvé par le test Acide/bras_gauche.
  const forcedSlotCode = forcedLocationKey != null ? (LOCATION_TO_SLOT[forcedLocationKey] ?? null) : null
  return { isAllMode: false, slotCodes: [forcedSlotCode] }
}

// resolveDamageLine — copie fidèle de environmentalHazardService.js:resolveEnvironmentalHazardTicks
// (même émission COMBAT_ATTACK_RESULT, même isPnj:true) pour UN token / UNE ligne déjà résolue (le
// dispatch multi-tokens/multi-lignes est Z1.2). `armorReductionFactor` vient de `line.armorFactor`
// (Z0) — 1 par défaut sur toutes les entrées du catalogue actuel, donc AUCUN effet observable
// aujourd'hui (damageService.js n'applique une réduction que si armorReductionFactor !== 1) ; c'est
// le même « aucun armorReductionFactor » que l'ancien chemin, juste câblé plutôt qu'oublié pour v2.
// `puissance` (§2.E, toujours additif) s'ajoute au jet.
export async function resolveDamageLine(io, db, campaignId, {
  line, definitionForcedLocation = null, instanceForcedLocation = null,
  sourceCode, tokenId, puissance = 0,
}) {
  const target = await loadTargetContext(db, tokenId)
  if (!target) return { tokenId, sourceCode, hits: [] }

  const degatsRoll = await parseDice(line.formula)
  const degautsBruts = degatsRoll.total + puissance

  const { isAllMode, slotCodes } = resolveForcedSlotCodes(line, definitionForcedLocation, instanceForcedLocation)
  const locationsCount = isAllMode
    ? slotCodes.length
    : (typeof line.locations === 'number' ? line.locations : (await parseDice(line.locations)).total)

  const hits = []
  for (let i = 0; i < locationsCount; i += 1) {
    const forcedSlotCode = isAllMode ? slotCodes[i] : slotCodes[0]
    const hit = await resolveTargetHit(io, db, campaignId, {
      degautsBruts,
      characterIdCible: target.character.id,
      cibleType: target.character.type,
      char_sheet_id_cible: target.sheet.id,
      for_na_cible: target.for_na_cible,
      con_na_cible: target.con_na_cible,
      vol_na_cible: target.vol_na_cible,
      forcedSlotCode,
      armorReductionFactor: line.armorFactor,
    })
    if (hit) {
      hits.push(hit)
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: null,
        sourceCode,
        cibleId: tokenId,
        localisation: hit.localisation,
        degautsBruts,
        degatsNets: hit.degatsNets,
        severity: hit.finalSeverity,
        isSuccess: true,
        isPnj: true,
        shockResult: hit.shockResult,
      })
    }
  }
  return { tokenId, sourceCode, degatsRoll, locationsCount, hits }
}

const RESOLVERS = { damage: resolveDamageLine }

// type sans résolveur → undefined, jamais un throw (patron weaponModService.js/findModRegistryEntry).
export function findEffectLineResolver(type) {
  return RESOLVERS[type]
}

// resolveActiveEffects — appelée depuis startResolutionPhase (combatTurnEngine.js) avec les lignes
// token_statuses actives déjà filtrées par getAllHazardCodes() (même jointure qu'avant, inchangée).
// Z1.2 ne traite que le cas déjà couvert par Lot 3 : une ligne `damage` `onTurn` reconstruite depuis
// `row.data`, jamais depuis le catalogue (voir note d'en-tête). `status_code` sans entrée registre ou
// sans `data.formula` : neutre, jamais un throw — même comportement que resolveEnvironmentalHazardTicks.
export async function resolveActiveEffects(io, db, campaignId, rows) {
  const results = []
  for (const row of rows) {
    const entry = findHazardRegistryEntry(row.status_code)
    if (!entry) continue
    if (!row.data?.formula) continue

    const line = {
      type: 'damage', phase: 'onTurn',
      formula: row.data.formula,
      locations: row.data.locations,
      locationMode: 'random', // §3 : 'random' ignore data.forcedLocation ; on le lit nous-mêmes via
      // line.forcedLocation ci-dessous pour préserver EXACTEMENT la précédence historique
      // (entry.forcedLocation ?? row.data?.forcedLocation ?? aléatoire, jamais un throw).
      forcedLocation: row.data.forcedLocation ?? null,
      armorFactor: 1,
    }
    const result = await resolveDamageLine(io, db, campaignId, {
      line, definitionForcedLocation: entry.forcedLocation,
      sourceCode: row.status_code, tokenId: row.token_id,
    })
    results.push(result)
  }
  return results
}
