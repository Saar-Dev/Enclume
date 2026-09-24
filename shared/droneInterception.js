import { horizontalDistanceBetweenWorldPointsM, normalizeWorldPoint } from './world/worldMetrics.js'

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

// « S'il réussit [son test] et si la marge de réussite de ce test est supérieure à la marge de réussite de
// l'attaque » : Test RÉUSSI et marge STRICTEMENT supérieure. Une marge de succès est le jet lui-même, celle d'un
// échec est négative (resolveTestOutcome). Contre un tir touché la marge d'attaque est positive, un Test raté ne
// passe donc jamais ; contre une grenade dont le lancer est RATÉ elle est négative : sans l'exigence explicite de
// réussite, un Test raté « moins négatif » passerait à tort. `droneOutcome` = { isSuccess, mr } (resolveTestOutcome).
export function isInterposed(droneOutcome, attackMr) {
  if (!droneOutcome || droneOutcome.isSuccess !== true) return false
  if (!Number.isFinite(droneOutcome.mr) || !Number.isFinite(attackMr)) return false
  return droneOutcome.mr > attackMr
}

// Le drone interposé absorbe la moitié des dommages d'une explosion (RAW, REGLEDRONE.md « Drone bouclier » ; Q-A :
// lui seul). Décision Saar 2026-09-24 : la moitié des dommages BRUTS, avant blindage et RD du drone, arrondie à
// l'inférieur (même convention que getCriticalSuccessBonus).
export function halveExplosionDamage(rawDamage) {
  if (!Number.isFinite(rawDamage) || rawDamage < 0) throw new RangeError('rawDamage doit être un nombre positif ou nul')
  return Math.floor(rawDamage / 2)
}

// ── RÉGLAGE — « vise son protégé » pour une grenade ──────────────────────────────────────────────────────────
// Distance MAXIMALE (mètres, à l'horizontale) entre le point visé par une grenade et un protégé pour que la grenade
// compte comme « visant » ce protégé : son drone tente alors de l'attraper. Valeur de départ = une case (1,5 m),
// À AJUSTER selon les tests en jeu (décision Saar 2026-09-24 : le modèle « dans la case exacte » était ridicule —
// viser les pieds de sa cible ne déclenchait rien). C'est un réglage de règle maison (le RAW ne dit rien de la
// précision de la visée), à consigner dans docs/JOURNAL8.md avec sa valeur finale. Ne concerne PAS les tirs : un tir
// n'active le drone que si le protégé en est la cible (Q-I).
export const GRENADE_PROTECTION_AIM_RADIUS_M = 1.5

// « Vise son protégé » pour un tir en zone (grenade) : une grenade n'a aucun token cible, seulement un point visé ; il
// vise le protégé quand ce point tombe à moins de `radiusM` mètres (horizontalement, bornes comprises) de ses pieds.
// Même étage : l'altitude du point visé doit rester dans la hauteur du corps au-dessus des pieds du protégé.
// `metrics` : métriques de la battlemap (conversion mètres → unités monde), défaut du moteur si absentes.
export function aimedAtProtected(aimedPoint, protectedFeet, { bodyHeight, radiusM = GRENADE_PROTECTION_AIM_RADIUS_M, metrics } = {}) {
  const height = Number(bodyHeight)
  if (!Number.isFinite(height) || height <= 0) throw new RangeError('bodyHeight doit être un nombre positif (unités monde)')
  if (!Number.isFinite(radiusM) || radiusM < 0) throw new RangeError('radiusM doit être un nombre positif ou nul (mètres)')
  if (horizontalDistanceBetweenWorldPointsM(aimedPoint, protectedFeet, metrics) > radiusM + 1e-9) return false
  const dy = normalizeWorldPoint(aimedPoint, 'aimedPoint').y - normalizeWorldPoint(protectedFeet, 'protectedFeet').y
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
