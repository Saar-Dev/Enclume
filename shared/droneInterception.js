import { distanceBetweenWorldPointsM, horizontalDistanceBetweenWorldPointsM, normalizeWorldPoint } from './world/worldMetrics.js'

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
  'saturated',        // CRD : plafond d'interceptions simultanées atteint ce Tour (RAW : « pas plus de 4 »)
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
//    maxSimultaneous, usesThisTurn,                  // CRD : plafond (null = bouclier personnel, sans règle) et usages du Tour
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
  if (isSaturated(candidate)) return 'saturated'
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
  // Le meilleur Seuil EFFECTIF : un CRD déjà sollicité ce Tour (malus) peut passer derrière un drone plus frais.
  eligible.sort((a, b) => (effectiveLevel(b) - effectiveLevel(a)) || String(a.droneTokenId).localeCompare(String(b.droneTokenId)))
  return { protector: eligible[0] ?? null, rejected }
}

// ── Interceptions simultanées et rayon d'action (CRD, Lot 3) ─────────────────────────────────────────────────
// RAW (REGLEDRONE.md « Drones multi-fonctions Neptune et Artémis ») : le CRD « peut gérer plusieurs interceptions
// simultanément [...] mais pour chaque interception supplémentaire, son test subit une pénalité de 1. Le système
// ne peut contrer plus de 4 attaques simultanément » ; les mini-drones « ne peuvent s'éloigner de plus de 10
// mètres de l'armure ». Ce sont deux CHAMPS de la fiche drone (drone_sheet.interception_max_simultaneous et
// interception_leash_m), jamais déduits du nom ni de la charge utile du drone ; vides = drone bouclier personnel :
// aucune règle de simultanéité, aucune limite de rayon. « Simultané » est lu « dans le même Tour » (JOURNAL8).
export const SIMULTANEOUS_INTERCEPTION_PENALTY = 1 // RAW : −1 par interception supplémentaire

// Le drone applique-t-il la règle de simultanéité ? (plafond renseigné, entier ≥ 1)
export function hasSimultaneityRule(candidate) {
  return Number.isInteger(candidate?.maxSimultaneous) && candidate.maxSimultaneous >= 1
}

// Plafond atteint : `usesThisTurn` interceptions déjà engagées ce Tour, au plus `maxSimultaneous` autorisées.
export function isSaturated(candidate) {
  return hasSimultaneityRule(candidate) && (candidate.usesThisTurn ?? 0) >= candidate.maxSimultaneous
}

// Malus du Test de la `rank`-ième interception du Tour (1 = la première, sans malus). Sans règle de simultanéité : 0.
export function simultaneityPenalty(rank) {
  if (!Number.isInteger(rank) || rank < 1) throw new RangeError('rank doit être un entier ≥ 1')
  return (rank - 1) * SIMULTANEOUS_INTERCEPTION_PENALTY
}

// Seuil du Test d'Interception du PROCHAIN engagement du candidat : niveau du programme moins le malus dû aux
// interceptions déjà engagées ce Tour (null si le niveau est absent). Autorité du tri de `pickProtector` ; le
// service recalcule le Seuil réel depuis le rang renvoyé par la base à l'engagement (source atomique).
export function effectiveLevel(candidate) {
  if (!Number.isFinite(candidate?.level)) return null
  if (!hasSimultaneityRule(candidate)) return candidate.level
  return candidate.level - simultaneityPenalty((candidate.usesThisTurn ?? 0) + 1)
}

// Rayon d'action : `point` (monde) est-il à `leashM` mètres au plus (distance 3D, altitude comprise — un étage compte)
// d'au moins un des `anchors` (pieds des protégés visés) ? `leashM` null/undefined = pas de limite. Une limite sans
// aucun ancrage ne peut pas être vérifiée : refus, jamais un passage silencieux.
export function withinLeash(point, anchors, leashM, metrics) {
  if (leashM == null) return true
  if (!Number.isFinite(leashM) || leashM <= 0) throw new RangeError('leashM doit être un nombre strictement positif (mètres)')
  return (anchors ?? []).some(anchor => distanceBetweenWorldPointsM(point, anchor, metrics) <= leashM + 1e-9)
}

// Validation des deux champs de la fiche drone, autorité unique de la route REST (la base garde les mêmes bornes en
// CHECK). `null` = champ vidé (bouclier personnel). Retourne { ok: true, value } ou { ok: false, reason }.
export const INTERCEPTION_LIMIT_FIELDS = Object.freeze(['interception_max_simultaneous', 'interception_leash_m'])

export function parseInterceptionLimit(field, raw) {
  if (!INTERCEPTION_LIMIT_FIELDS.includes(field)) throw new RangeError(`champ inconnu : ${field}`)
  if (raw === null || raw === '') return { ok: true, value: null }
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
  if (field === 'interception_max_simultaneous') {
    return Number.isInteger(value) && value >= 1 ? { ok: true, value } : { ok: false, reason: 'not_a_positive_integer' }
  }
  return Number.isFinite(value) && value > 0 ? { ok: true, value } : { ok: false, reason: 'not_a_positive_number' }
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
