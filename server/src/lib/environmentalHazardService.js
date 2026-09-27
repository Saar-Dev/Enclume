import { parseDice, isValidDiceFormula } from './diceParser.js'
import * as statusService   from './statusService.js'
import { AppError }         from './AppError.js'
import { LOCATION_TO_SLOT } from '../../../shared/armorConstants.js'
import { findHazardRegistryEntry, ENVIRONMENTAL_HAZARD_REGISTRY } from '../../../shared/environmentalHazardRegistry.js'

// getAllHazardCodes() — même idiome que weaponModService.js:getAllModStatusCodes() : la boucle F.5
// (startResolutionPhase) lit ce service, jamais le registre brut directement (autorité unique, patron
// déjà établi pour WEAPON_MOD_REGISTRY/ECHEANCE_TYPE_REGISTRY dans ce projet).
export function getAllHazardCodes() {
  return ENVIRONMENTAL_HAZARD_REGISTRY.map(entry => entry.code)
}

// turnsFromNow — Tour futur (`current_turn` + un jet de dés + le `+1` de compensation de purge de fin
// de Tour). Primitive partagée par exposeToHazard (durationDice) et clearHazard (linger) — même
// formule dupliquée deux fois avant cette extraction (trouvée en résorbant la dette du Segment 1.5
// AOE, PLAN_ARMES_SPECIALES.md §1.4bis — sans lien de mécanisme avec l'AOE elle-même, juste la même
// session). `currentTurn` lu depuis `combat_state` ICI (jamais l'appelant — le serveur reste
// autoritaire, CLAUDE.md §7) : le `+1` compense la purge universelle de fin de Tour
// (`socketCombatHelpers.js`, condition `expires_at_turn <= newTurn` appliquée AVANT la résolution du
// Tour où ils s'égalent) — sans lui, un danger ne tickerait que `roll-1` fois au lieu des `roll` Tours
// RAW. Ne fait AUCUN max avec une expiry existante — ça reste au jugement de chaque appelant
// (exposeToHazard : ne jamais raccourcir un danger déjà posé ; clearHazard/linger : pas de notion
// d'expiry précédente, l'Acide vient d'être retiré).
async function turnsFromNow(db, campaignId, diceFormula) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
  const currentTurn = state?.current_turn ?? 1
  const { total: roll } = await parseDice(diceFormula)
  return currentTurn + roll + 1
}

// exposeToHazard — pose un danger environnemental (Acide/Décompression/Feu) sur un token, action MJ
// explicite (docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3, increment F.2). `forcedLocation` (point ouvert 10)
// : clé LOCATION_TO_SLOT choisie par le MJ pour Acide/petite flamme/feu moyen (RAW : "la Localisation
// exposée", variable par instance) — inutile pour Décompression (déjà fixée par le registre) ou pour
// un Feu qu'on veut aléatoire (Grand feu/Brasier, laisser `null`). Non fourni pour Acide/Feu = tirage
// aléatoire au lieu d'une localisation fixe, décision de jeu valide, pas une erreur (§9 point 10).
//
// `durationDice` (PLAN_ARMES_SPECIALES.md §1.4 segment 1c, décision G) : formule de dés d'une durée
// FINIE en Tours (lance-flammes : "2D6 Tours de combat", RAW). `null` (défaut) = danger permanent
// jusqu'au retrait MJ (`clearHazard`), comportement historique Acide/Décompression/Feu manuel. Quand
// fourni, on lit `combat_state.current_turn` ICI (jamais l'appelant — même autorité que `clearHazard`)
// et on pose `expires_at_turn = max(expiry_existant, currentTurn + roll(durationDice) + 1)` :
//  - le `+1` compense la purge universelle de fin de Tour (`socketCombatHelpers.js`, condition
//    `expires_at_turn <= newTurn` appliquée AVANT la résolution du Tour où ils s'égalent) — sans lui
//    le feu tickerait `roll-1` fois au lieu de `roll` (même raisonnement que `clearHazard` linger) ;
//  - le `max(...)` : `applyModStatus` fait `.onConflict().merge()` sans argument → il ÉCRASE
//    inconditionnellement `expires_at_turn`. Une 2ᵉ brûlure avec un `roll` faible RACCOURCIRAIT donc
//    un feu qui avait plus longtemps à courir. On ne peut que rendre le feu pire (décision G). Un vrai
//    stacking (double-tick) serait une refonte du système de dangers — hors périmètre.
export async function exposeToHazard(io, db, campaignId, tokenId, hazardCode, { formula, locations = 1, forcedLocation = null, durationDice = null } = {}) {
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
  if (durationDice != null && !isValidDiceFormula(durationDice)) {
    throw new AppError(400, `durationDice "${durationDice}" n'est pas une formule de dés valide`)
  }

  let expiresAtTurn = null
  if (durationDice != null) {
    const candidateTurn = await turnsFromNow(db, campaignId, durationDice)
    const existing = await db('token_statuses')
      .where({ token_id: tokenId, status_code: hazardCode })
      .select('expires_at_turn')
      .first()
    expiresAtTurn = Math.max(existing?.expires_at_turn ?? 0, candidateTurn)
  }

  await statusService.applyModStatus(io, db, campaignId, tokenId, hazardCode, {
    expiresAtTurn,
    data: { formula, locations, forcedLocation },
    throwOnFailure: true,
  })
}

// clearHazard — retire un danger environnemental (§9 F.3). `linger: true` réservé à l'Acide (RAW :
// "l'effet de l'acide peut alors persister pendant 1D6 Tour(s)" en sortie de zone) — Feu/Décompression
// n'ont pas cette mécanique RAW, retrait toujours immédiat pour eux. Expiry calculée par
// `turnsFromNow` ci-dessus (voir son commentaire pour le `+1` de compensation de purge de fin de Tour).
export async function clearHazard(io, db, campaignId, tokenId, hazardCode, { linger = false } = {}) {
  if (!linger) {
    await statusService.clearModStatus(io, db, campaignId, tokenId, hazardCode, { throwOnFailure: true })
    return
  }
  if (!findHazardRegistryEntry(hazardCode)?.lingersOnClear) {
    throw new AppError(400, `linger réservé à "acid" (RAW), pas applicable à "${hazardCode}"`)
  }
  const expiresAtTurn = await turnsFromNow(db, campaignId, '1d6')
  await db('token_statuses')
    .where({ token_id: tokenId, status_code: hazardCode })
    .update({ expires_at_turn: expiresAtTurn })
  await statusService.emitTokenStatusUpdated(io, db, campaignId, tokenId)
}

// resolveEnvironmentalHazardTicks a été remplacée par effectLineResolverService.js:resolveActiveEffects
// (docs/PLANS/PLAN_ZONES_DANGER.md §14.3, Z1.2, 2026-09-27) — même émission COMBAT_ATTACK_RESULT, même
// précédence de Localisation (entry.forcedLocation ?? data.forcedLocation ?? aléatoire), même lecture
// de `token_statuses.data` (jamais du catalogue danger, Z1.3+ absorbera cette source plus tard).
