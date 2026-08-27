// Parenté avec shared/world/distanceBands.js#resolveDistanceBand (ajouté ultérieurement pour l'AOE,
// docs/PLANS/PLAN_AOE.md §4) : même algorithme de recherche par seuils croissants, volontairement pas
// fusionnés — ce fichier-ci tolère des seuils dégénérés (portée catalogue incomplète), l'autre les
// refuse par construction. Voir le commentaire de tête de distanceBands.js pour le détail.
export const RANGE_BANDS = Object.freeze([
  'bout_portant',
  'courte',
  'moyenne',
  'longue',
  'extreme',
])

function numberFromRangeToken(value) {
  const normalized = String(value || '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export function parseWeaponRangeBands(referenceRange) {
  const raw = String(referenceRange || '').trim()
  if (!raw) return null
  const [main] = raw.split('(')
  const core = main.split('/').map(numberFromRangeToken).filter(Number.isFinite)
  const parenthesized = raw.match(/\(([^)]+)\)/)
  const extreme = parenthesized ? numberFromRangeToken(parenthesized[1]) : null
  let thresholds
  if (core.length >= 4) {
    thresholds = [...core.slice(0, 4), Number.isFinite(extreme) ? extreme : core[3]]
  } else if (core.length === 1) {
    // Une portee unique ne permet pas d'inventer les bandes intermediaires : elle devient une
    // limite extreme, donc le serveur choisit le modificateur le moins favorable.
    thresholds = [0, 0, 0, 0, core[0]]
  } else {
    return null
  }
  for (let index = 1; index < thresholds.length; index++) {
    if (thresholds[index] < thresholds[index - 1]) return null
  }
  return Object.freeze(thresholds)
}

// Portée CaC = 3m (base LdB) + allonge de l'arme de contact équipée (ref_equipment.range).
// Formule dupliquée à 3 endroits (precheck humanoïde, résolution humanoïde, résolution drone) —
// source unique désormais, comportement inchangé (parseInt identique aux 3 sites d'origine).
export function resolveMeleeReachM(referenceRange) {
  return 3 + (parseInt(referenceRange) || 0)
}

export function resolveWeaponRangeBand(distanceM, referenceRange) {
  const distance = Number(distanceM)
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('La distance de tir doit etre positive ou nulle')
  const thresholds = parseWeaponRangeBands(referenceRange)
  if (!thresholds) return Object.freeze({ status: 'unsupported-range', band: null, distanceM: distance, thresholds: null })
  const index = thresholds.findIndex(limit => distance <= limit + 1e-9)
  if (index < 0) return Object.freeze({ status: 'out-of-range', band: null, distanceM: distance, thresholds })
  return Object.freeze({ status: 'ok', band: RANGE_BANDS[index], distanceM: distance, thresholds })
}

// Fusil à pompe — largeur de la zone d'effet + modificateur de dégât par palier RAW
// (docs/REGLES/REGLES_ARMES_SPECIALES.md). Trouvaille PLAN_AOE.md §4/v6 : ces paliers utilisent les
// 5 MÊMES NOMS que RANGE_BANDS ci-dessus, indexés sur les seuils propres à l'arme réellement équipée
// (Klauss : "2/7/14/28 (35)", ref_range) — pas une nouvelle table de seuils à part. Cette constante ne
// fournit donc que la charge utile par nom de palier, jamais une nouvelle classification de distance :
// `resolveWeaponRangeBand(distanceM, weapon.ref_range)` reste l'unique autorité de "quel palier".
//
// `widthM: null` pour bout_portant — RAW : "le tir ne touche qu'une cible", pas une zone géométrique
// (couche 1 n'est pas sollicitée pour ce palier, cible unique classique).
//
// Seule arme du catalogue à ce jour (Klauss, confirmé Saar 2026-08-26/27) — étendre à un futur
// deuxième fusil à pompe ne changerait rien ici (mêmes paliers RAW, seuils différents dans ref_range).
export const SHOTGUN_SPREAD_BY_BAND = Object.freeze({
  bout_portant: Object.freeze({ widthM: null, damageDice: '+1D10', savePossible: false }),
  courte:       Object.freeze({ widthM: 1, damageDice: '+0',    savePossible: false }),
  moyenne:      Object.freeze({ widthM: 2, damageDice: '-1D10', savePossible: false }),
  longue:       Object.freeze({ widthM: 3, damageDice: '-2D10', savePossible: true, saveBonus: 0 }),
  extreme:      Object.freeze({ widthM: 3, damageDice: '-3D10', savePossible: true, saveBonus: 5 }),
})

// resolveShotgunSpread — compose resolveWeaponRangeBand (classification) + SHOTGUN_SPREAD_BY_BAND
// (charge utile) en un seul appel, pour ne jamais laisser un appelant indexer directement la table
// avec un nom de palier mal orthographié.
export function resolveShotgunSpread(distanceM, referenceRange) {
  const range = resolveWeaponRangeBand(distanceM, referenceRange)
  if (range.status !== 'ok') return range
  return Object.freeze({ ...range, spread: SHOTGUN_SPREAD_BY_BAND[range.band] })
}
