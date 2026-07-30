import { parseDice, isValidDiceFormula } from './diceParser.js'
import { calcAttributeNA }  from './charStats.js'
import { getMutationEffects } from '../services/mutationService.js'
import { resolveTargetHit } from './damageService.js'
import * as statusService   from './statusService.js'
import { AppError }         from './AppError.js'
import { LOCATION_TO_SLOT } from '../../../shared/armorConstants.js'
import { findHazardRegistryEntry, ENVIRONMENTAL_HAZARD_REGISTRY } from '../../../shared/environmentalHazardRegistry.js'
import { WS } from '../../../shared/events.js'

// getAllHazardCodes() — même idiome que weaponModService.js:getAllModStatusCodes() : la boucle F.5
// (startResolutionPhase) lit ce service, jamais le registre brut directement (autorité unique, patron
// déjà établi pour WEAPON_MOD_REGISTRY/ECHEANCE_TYPE_REGISTRY dans ce projet).
export function getAllHazardCodes() {
  return ENVIRONMENTAL_HAZARD_REGISTRY.map(entry => entry.code)
}

// exposeToHazard — pose un danger environnemental (Acide/Décompression/Feu) sur un token, action MJ
// explicite (docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3, increment F.2). `forcedLocation` (point ouvert 10)
// : clé LOCATION_TO_SLOT choisie par le MJ pour Acide/petite flamme/feu moyen (RAW : "la Localisation
// exposée", variable par instance) — inutile pour Décompression (déjà fixée par le registre) ou pour
// un Feu qu'on veut aléatoire (Grand feu/Brasier, laisser `null`). Non fourni pour Acide/Feu = tirage
// aléatoire au lieu d'une localisation fixe, décision de jeu valide, pas une erreur (§9 point 10).
export async function exposeToHazard(io, db, campaignId, tokenId, hazardCode, { formula, locations = 1, forcedLocation = null } = {}) {
  if (!findHazardRegistryEntry(hazardCode)) {
    throw new AppError(400, `Danger environnemental "${hazardCode}" absent de shared/environmentalHazardRegistry.js`)
  }
  // Validé ici (jamais un jet, isValidDiceFormula est pure) plutôt que laissé exploser au premier
  // Tick — une formule MJ invalide doit échouer immédiatement à l'exposition, pas casser toute la
  // résolution du Tour suivant pour l'ensemble de la campagne (resolveEnvironmentalHazardTicks tourne
  // dans le même bloc que la transition de phase de startResolutionPhase).
  if (!isValidDiceFormula(formula)) {
    throw new AppError(400, `formula "${formula}" n'est pas une formule de dés valide`)
  }
  if (typeof locations !== 'number' && !isValidDiceFormula(locations)) {
    throw new AppError(400, `locations "${locations}" doit être un nombre ou une formule de dés valide`)
  }
  if (forcedLocation != null && !(forcedLocation in LOCATION_TO_SLOT)) {
    throw new AppError(400, `forcedLocation "${forcedLocation}" inconnu de shared/armorConstants.js:LOCATION_TO_SLOT`)
  }
  await statusService.applyModStatus(io, db, campaignId, tokenId, hazardCode, {
    expiresAtTurn: null,
    data: { formula, locations, forcedLocation },
    throwOnFailure: true,
  })
}

// clearHazard — retire un danger environnemental (§9 F.3). `linger: true` réservé à l'Acide (RAW :
// "l'effet de l'acide peut alors persister pendant 1D6 Tour(s)" en sortie de zone) — Feu/Décompression
// n'ont pas cette mécanique RAW, retrait toujours immédiat pour eux. `currentTurn` lu depuis
// `combat_state` côté serveur (jamais fourni par l'appelant — le serveur reste autoritaire, CLAUDE.md
// §7) : `+1` nécessaire (pas juste `+roll`) car la purge universelle de fin de Tour
// (`socketCombatHelpers.js:1092-1114`, condition `expires_at_turn <= newTurn`) retire un statut
// **avant** la phase de résolution du Tour où `newTurn === expires_at_turn` — sans le `+1`, l'Acide ne
// tickerait que `roll-1` fois au lieu des `roll` Tours RAW.
export async function clearHazard(io, db, campaignId, tokenId, hazardCode, { linger = false } = {}) {
  if (!linger) {
    await statusService.clearModStatus(io, db, campaignId, tokenId, hazardCode, { throwOnFailure: true })
    return
  }
  if (hazardCode !== 'acid') {
    throw new AppError(400, `linger réservé à "acid" (RAW), pas applicable à "${hazardCode}"`)
  }
  const state = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
  const currentTurn = state?.current_turn ?? 1
  const { total: roll } = await parseDice('1d6')
  await db('token_statuses')
    .where({ token_id: tokenId, status_code: hazardCode })
    .update({ expires_at_turn: currentTurn + roll + 1 })
  await statusService.emitTokenStatusUpdated(io, db, campaignId, tokenId)
}

// resolveEnvironmentalHazardTicks — dispatch générique par ligne (§9 F.4, patron
// shared/echeanceTypeRegistry.js : un lookup par ligne, jamais d'agrégation entre plusieurs dangers
// d'un même token — voir shared/environmentalHazardRegistry.js). Appelée depuis startResolutionPhase
// avec les lignes token_statuses actives de la campagne (jointure combat_roster, §9 F.5). Pas
// d'armorReductionFactor ici (RAW ne le prévoit que pour la Chute, jamais pour Acide/Décompression/Feu
// — contrairement à `fallDamageService.js`, cf. analyse RAW du Lot 3).
export async function resolveEnvironmentalHazardTicks(io, db, campaignId, hazardRows) {
  const results = []
  for (const row of hazardRows) {
    const entry = findHazardRegistryEntry(row.status_code)
    if (!entry) continue // status_code inconnu du registre, neutre (jamais un throw ici)
    // data absente/malformée (ligne créée hors exposeToHazard, ex. legacy/manuel) — neutre plutôt que
    // de planter toute la boucle pour le reste de la campagne (exposeToHazard garantit data non-null
    // pour toute ligne créée par le flux normal).
    if (!row.data?.formula) continue

    const token = await db('tokens').where({ id: row.token_id }).first()
    if (!token?.character_id) continue
    const character = await db('characters').where({ id: token.character_id }).first()
    if (!character || character.type === 'drone') continue
    const sheet = await db('char_sheet').where({ character_id: character.id }).first()
    if (!sheet) continue

    const [attrs, archetype, mutationEffects] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheet.id }),
      db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
      getMutationEffects(sheet.id),
    ])
    const genotypeRow = archetype?.genotype_id
      ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
      : null
    const for_na_cible = calcAttributeNA(attrs, 'FOR', genotypeRow, mutationEffects)
    const con_na_cible = calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects)
    const vol_na_cible = calcAttributeNA(attrs, 'VOL', genotypeRow, mutationEffects)

    const degatsRoll = await parseDice(row.data.formula)
    const locationsCount = typeof row.data.locations === 'number'
      ? row.data.locations
      : (await parseDice(row.data.locations)).total

    // Précédence registre > instance > aléatoire (§9 point ouvert 10).
    const locKey = entry.forcedLocation ?? row.data?.forcedLocation ?? null
    const forcedSlotCode = locKey ? LOCATION_TO_SLOT[locKey] : null

    const hits = []
    for (let i = 0; i < locationsCount; i += 1) {
      const hit = await resolveTargetHit(io, db, campaignId, {
        degautsBruts: degatsRoll.total,
        characterIdCible: character.id,
        cibleType: character.type,
        char_sheet_id_cible: sheet.id,
        for_na_cible, con_na_cible, vol_na_cible,
        forcedSlotCode,
      })
      if (hit) {
        hits.push(hit)
        // Visible dans le panneau de résultat de combat (CombatResultGM/Player, réutilisé tel quel —
        // Saar, test navigateur : « dégâts environnementaux pas visibles dans le chat »). Pas de jet
        // d'attaque (dégât automatique) : tireurId null, sourceCode résolu côté client en libellé
        // (`status.${sourceCode}`, i18nKey jamais du texte FR figé serveur, i18n.md). isPnj:true réutilisé
        // pour son effet pratique dans useCombatSocket.js (montré au MJ ET au joueur ciblé), pas pour son
        // sens littéral "cible = PNJ".
        io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
          tireurId: null,
          sourceCode: row.status_code,
          cibleId: row.token_id,
          localisation: hit.localisation,
          degautsBruts: degatsRoll.total,
          degatsNets: hit.degatsNets,
          severity: hit.finalSeverity,
          is_lethal: hit.is_lethal,
          isSuccess: true,
          isPnj: true,
          shockResult: hit.shockResult,
        })
      }
    }
    results.push({ tokenId: row.token_id, statusCode: row.status_code, degatsRoll, locationsCount, hits })
  }
  return results
}
