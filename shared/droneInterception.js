import { cellKey, cellOfPoint } from './world/gridCells.js'

// Décision d'interposition d'un drone protecteur — noyau PUR (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.2).
// Aucun accès base, aucun socket : la coquille serveur (lib/droneInterceptionService.js) rassemble les
// données d'un candidat, ce module décide. Toute règle d'éligibilité vit ICI, jamais dans un socket.
//
// RAW (docs/REGLES/REGLEDRONE.md, « Drone bouclier ») : test avec le niveau d'interception du drone ; si sa
// marge de réussite est supérieure à celle de l'attaque, le drone s'interpose ; jamais au corps à corps.

export const ATTACK_KINDS = Object.freeze(['ranged', 'melee'])

// Motifs d'inéligibilité, dans l'ordre où ils sont évalués (le premier qui échoue est retenu).
export const INELIGIBILITY_REASONS = Object.freeze([
  'melee',            // RAW : « ne sert à rien au corps à corps »
  'no_program',       // aucun programme `interception`
  'destroyed',        // intégrité épuisée
  'no_token',         // pas de token sur la battlemap
  'hidden',           // token sur la couche MJ (caché) : il ne se dévoilerait pas en s'interposant
  'other_battlemap',  // token sur une autre battlemap que le tir
  'is_target',        // le drone est la cible elle-même
  'telepiloted',      // RAW : réaction en mode autonome uniquement
  'speed_missing',    // Vitesse non renseignée sur la fiche (RAW « - »)
  'unreachable',      // aucune case de la trajectoire atteignable dans le budget
])

// Candidat : données brutes rassemblées par la coquille. `reachable` vaut `undefined` tant que la
// portée n'a pas été calculée (calcul coûteux, fait seulement pour les candidats qui passent le tri).
//  {
//    droneTokenId, droneCharacterId, level,          // niveau du programme `interception` (null = absent)
//    integrity,                                      // drone_sheet.integrite_actuelle
//    tokenBattlemapId, shotBattlemapId,              // null si pas de token
//    tokenHidden,                                    // token sur la couche MJ (`layer === 'gm'`)
//    isTarget, telepilotedThisTurn,
//    speedM,                                         // budget de déplacement (m/Tour), null si absent
//    reachable,                                      // true | false | undefined
//  }
export function ineligibilityReason(candidate, { attackKind } = {}) {
  if (!ATTACK_KINDS.includes(attackKind)) {
    throw new RangeError(`attackKind inconnu : ${attackKind} (attendu : ${ATTACK_KINDS.join(' | ')})`)
  }
  if (attackKind === 'melee') return 'melee'
  if (!Number.isFinite(candidate.level)) return 'no_program'
  if (!(candidate.integrity > 0)) return 'destroyed'
  if (!candidate.tokenBattlemapId) return 'no_token'
  if (candidate.tokenHidden) return 'hidden'
  if (candidate.tokenBattlemapId !== candidate.shotBattlemapId) return 'other_battlemap'
  if (candidate.isTarget) return 'is_target'
  if (candidate.telepilotedThisTurn) return 'telepiloted'
  if (!Number.isFinite(candidate.speedM)) return 'speed_missing'
  if (candidate.reachable === false) return 'unreachable'
  return null
}

// Tri en deux temps : `screened` = candidats qui passent toutes les vérifications SAUF la portée
// (`reachable` pas encore connu) ; `rejected` = motif explicite pour chacun des autres.
export function screenCandidates(candidates, { attackKind }) {
  const screened = []
  const rejected = []
  for (const candidate of candidates) {
    const reason = ineligibilityReason({ ...candidate, reachable: undefined }, { attackKind })
    if (reason) rejected.push({ droneTokenId: candidate.droneTokenId, reason })
    else screened.push(candidate)
  }
  return { screened, rejected }
}

// V1 : UN SEUL protecteur tente l'interposition — le plus haut niveau, égalité → `droneTokenId` croissant
// (déterministe). Pas de cascade vers le suivant en cas d'échec du Test (RAW muet, journalisé).
// N'accepte que des candidats dont la portée est confirmée (`reachable === true`).
export function pickProtector(candidates, { attackKind }) {
  const eligible = []
  const rejected = []
  for (const candidate of candidates) {
    const reason = ineligibilityReason(candidate, { attackKind })
    if (reason) rejected.push({ droneTokenId: candidate.droneTokenId, reason })
    else if (candidate.reachable !== true) rejected.push({ droneTokenId: candidate.droneTokenId, reason: 'unreachable' })
    else eligible.push(candidate)
  }
  eligible.sort((a, b) => (b.level - a.level) || String(a.droneTokenId).localeCompare(String(b.droneTokenId)))
  return { protector: eligible[0] ?? null, rejected }
}

// « Si la marge de réussite de ce test est supérieure à la marge de réussite de l'attaque » : STRICTEMENT
// supérieure. Une marge de succès est le jet lui-même, celle d'un échec est négative (resolveTestOutcome) :
// un Test raté n'est donc jamais supérieur à une attaque réussie.
export function isInterposed(droneMr, attackMr) {
  if (!Number.isFinite(droneMr) || !Number.isFinite(attackMr)) return false
  return droneMr > attackMr
}

// « Vise son protégé » pour un tir en zone (grenade) : une grenade n'a aucun token cible, seulement un
// point visé ; il vise le protégé quand ce point tombe dans SA case (modèle « à la case », Q-F). Même
// étage : l'altitude du point visé doit rester dans la hauteur du corps au-dessus des pieds du protégé.
export function aimedAtProtected(aimedPoint, protectedFeet, { bodyHeight }) {
  const height = Number(bodyHeight)
  if (!Number.isFinite(height) || height <= 0) throw new RangeError('bodyHeight doit être un nombre positif (unités monde)')
  const sameCell = cellKey(cellOfPoint(aimedPoint)) === cellKey(cellOfPoint(protectedFeet))
  if (!sameCell) return false
  const dy = aimedPoint.y - protectedFeet.y
  return dy >= -height && dy <= height
}

// ── Liens de protection (drone_interception_targets) ──────────────────────────────────────────────
// Validation d'un lien « ce drone protège ce personnage », noyau pur partagé par la route REST : la base
// garantit la PK, les FK et drone ≠ protégé (CHECK) ; elle ne peut PAS garantir « même campagne » ni
// « le protecteur est un drone » (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.6).
// Protégés admis (Q6) : personnage joueur, PNJ, exo-armure (l'exo protège déjà son pilote).
export const PROTECTABLE_TYPES = Object.freeze(['pj', 'pnj', 'exo'])

export const LINK_REJECTION_REASONS = Object.freeze(['not_a_drone', 'target_missing', 'self', 'other_campaign', 'target_type'])

export function linkRejectionReason(drone, target) {
  if (!drone || drone.type !== 'drone') return 'not_a_drone'
  if (!target) return 'target_missing'
  if (target.id === drone.id) return 'self'
  if (!drone.campaign_id || drone.campaign_id !== target.campaign_id) return 'other_campaign'
  if (!PROTECTABLE_TYPES.includes(target.type)) return 'target_type'
  return null
}
