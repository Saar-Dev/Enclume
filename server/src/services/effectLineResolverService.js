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
import { exposeToHazard, clearHazard } from '../lib/environmentalHazardService.js'
import { applyZoneModifier, clearZoneModifier } from '../lib/zoneModifierService.js'
import { loadWorldEffectDefinitions } from './worldEffectService.js'
import { tokensInsideEffectVolume } from './worldSpatialQueryService.js'
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
      // puissance (§2.E, Z2 étape 4) : posée par sweepZoneExposure quand la source est une zone
      // (data.puissance) ; absente pour une exposition MJ-manuelle (jamais posée par ce chemin) →
      // défaut 0, aucun changement de comportement pour l'exposition manuelle historique.
      puissance: row.data.puissance ?? 0,
    })
    results.push(result)
  }
  return results
}

// sweepZoneExposure — Z2 étape 2 (§2.H point 1) : balayage de présence, appelé 1×/Tour depuis
// startResolutionPhase, JUSTE AVANT le tick `resolveActiveEffects` ci-dessus. Réutilise
// exposeToHazard/clearHazard (Lot 3, MJ-manuel) plutôt qu'une 2ᵉ voie d'écriture de
// `token_statuses` — une zone qui expose un token EST la même mécanique qu'un MJ qui l'expose à la
// main, seule la source diffère. Ne résout AUCUN dégât ici : poser/retirer la condition seulement,
// `resolveActiveEffects` (déjà appelée juste après, inchangée) fait le tick.
//
// Provenance (`data.zoneInstanceId`) : ajoutée à `exposeToHazard` pour que la sortie de zone sache
// quelle zone avait posé la condition, sans jamais relire `world_effect_instances` au moment de la
// sortie. Limite connue et acceptée (même logique que le commentaire « décision G » d'exposeToHazard
// pour deux expositions manuelles du même hazardCode) : si un token est DANS DEUX zones qui partagent
// le même hazardCode (ex. deux feux qui se recouvrent), une seule ligne `token_statuses` existe pour
// ce hazardCode — sortir de l'une des deux zones peut éteindre la condition même si l'autre continue
// de le couvrir. Le système n'a jamais agrégé plusieurs dangers d'un même token (§2 architecture,
// "zéro agrégation") ; ce n'est pas une régression introduite ici.
//
// `feu:brasier` (locationMode:'all') : `resolveActiveEffects` ne lit pas encore `locationMode` (elle
// force `'random'`, §14.3) — un brasier expose donc comme un feu à Localisation unique aujourd'hui,
// EXACTEMENT le même écart que l'exposition manuelle "inferno" du presets UI existant
// (`environmentalHazardPresets.js`, `locations:1`). Pas une régression : même écart déjà noté §5.1,
// déjà rattaché à Z6 (absorption des presets UI). `locations: null` (valeur catalogue pour 'all',
// ignorée par ce mode) est donc replié sur `1` ici pour rester une valeur valide pour exposeToHazard.
// `currentTurn` (Z4) : fourni par l'appelant (startResolutionPhase l'a déjà résolu) — écrit dans
// data.lastRefreshedTurn par applyZoneModifier, seul signal qui distingue pour
// resolveZoneModifierTicks « encore dans sa zone ce Tour » de « vient d'en sortir ».
export async function sweepZoneExposure(io, db, campaignId, battlemapId, currentTurn) {
  if (!battlemapId) return

  const [rosterTokenIds, memberships, definitions] = await Promise.all([
    db('combat_roster').where({ campaign_id: campaignId, status: 'active' }).pluck('token_id'),
    tokensInsideEffectVolume({ battlemapId, database: db }),
    loadWorldEffectDefinitions(campaignId, db),
  ])
  if (!rosterTokenIds.length) return

  const rosterSet = new Set(rosterTokenIds)
  const definitionByKey = new Map(definitions.map(definition => [definition.key, definition]))

  const membershipsByToken = new Map()
  for (const membership of memberships) {
    if (!rosterSet.has(membership.tokenId)) continue
    if (!membershipsByToken.has(membership.tokenId)) membershipsByToken.set(membership.tokenId, [])
    membershipsByToken.get(membership.tokenId).push(membership)
  }

  // Entrée / rafraîchissement — idempotent : reposer la même zone chaque Tour ne fait que réécrire
  // les mêmes valeurs (comportement voulu, cf. commentaire exposeToHazard sur expiresAtTurn=null).
  for (const [tokenId, tokenMemberships] of membershipsByToken) {
    for (const membership of tokenMemberships) {
      const definition = definitionByKey.get(membership.definitionKey)
      if (!definition) continue

      if (definition.hazardCode && findHazardRegistryEntry(definition.hazardCode)) {
        const damageLine = definition.effects.find(effect => effect.type === 'damage' && effect.phase === 'onTurn')
        if (damageLine) {
          await exposeToHazard(io, db, campaignId, tokenId, definition.hazardCode, {
            formula: damageLine.formula,
            locations: damageLine.locations ?? 1,
            forcedLocation: damageLine.forcedLocation ?? null,
            zoneInstanceId: membership.instanceId,
            remanence: damageLine.remanence,
            // puissance (§2.E, Z2 étape 4) : scalaire de l'INSTANCE de zone (jamais de la définition —
            // c'est le MJ qui renforce une zone précise, pas le catalogue). Réécrite chaque Tour comme le
            // reste (idempotent) : si le MJ change la puissance d'une zone déjà posée, le prochain
            // rafraîchissement la reprend automatiquement, aucune resynchronisation manuelle nécessaire.
            puissance: membership.puissance,
          })
        }
      }

      // modifier (Z4, gaz) : AUCUN hazardCode par construction (Z0) — chemin d'écriture séparé
      // (zoneModifierService.js), jamais exposeToHazard/hazardCode. Une définition peut en principe
      // porter les deux lignes (aucun cas réel au catalogue aujourd'hui) : les deux branches sont
      // indépendantes, pas un elseif.
      const modifierLine = definition.effects.find(effect => effect.type === 'modifier' && effect.phase === 'onTurn')
      if (modifierLine) {
        await applyZoneModifier(io, db, campaignId, tokenId, definition.key, {
          zoneInstanceId: membership.instanceId,
          target: modifierLine.target,
          value: modifierLine.value,
          escalation: modifierLine.escalation,
          remanence: modifierLine.remanence,
          remanenceParams: modifierLine.remanenceParams,
          currentTurn,
        })
      }
    }
  }

  // Sortie — tout statut posé par une zone (`data.zoneInstanceId`) que le token ne recouvre plus.
  const zoneSourcedRows = await db('token_statuses')
    .whereIn('token_id', rosterTokenIds)
    .whereRaw("data->>'zoneInstanceId' is not null")
  for (const row of zoneSourcedRows) {
    const stillInside = membershipsByToken.get(row.token_id)
      ?.some(membership => membership.instanceId === row.data.zoneInstanceId)
    if (stillInside) continue
    if (row.data.kind === 'zoneModifier') {
      // modifier (Z4) : jamais clearHazard (son mode `linger` interroge findHazardRegistryEntry, qui
      // ne connaît que les 3 hazardCode RAW — lèverait pour un status_code de définition gaz). 'none'
      // seul se retire ici ; 'decay' tique seul via resolveZoneModifierTicks (combatTurnEngine.js,
      // juste après ce balayage) ; 'fixed'/'conditional' sur une ligne modifier : aucune entrée au
      // catalogue aujourd'hui, laissés tels quels (v2 tant qu'un cas concret ne le justifie).
      if (row.data.remanence === 'none') await clearZoneModifier(io, db, campaignId, row.token_id, row.status_code)
      continue
    }
    if (row.data.remanence === 'fixed') {
      await clearHazard(io, db, campaignId, row.token_id, row.status_code, { linger: true })
    } else if (row.data.remanence === 'none') {
      await clearHazard(io, db, campaignId, row.token_id, row.status_code)
    }
    // remanence 'decay'/'conditional' (ligne damage) : hors zone, tique seul via resolveActiveEffects
    // (Z4) — rien à faire ici. Aujourd'hui inatteignable (les entrées gaz correspondantes portent
    // leur ligne sur `damage` UNIQUEMENT pour gaz:decomposant, qui a hazardCode:null comme les autres
    // gaz — donc jamais posées par la boucle d'entrée ci-dessus non plus ; seule gaz:irritant, une
    // ligne `modifier`, est aujourd'hui réellement posée par ce balayage).
  }
}
