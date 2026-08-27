// shared/world/distanceBands.js
//
// Primitive générique de palier par distance — dégression de dégâts/effets en fonction de la
// distance à un point de référence (centre d'une AOE, portée de tir...). Couche 4 de
// docs/PLANS/PLAN_AOE.md §4 : extrait l'ALGORITHME du dispatch munitions existant
// (shared/weaponAmmoDsl.js, dégression SHRAPNEL) sans réutiliser ses DONNÉES — les bandes RAW
// diffèrent par arme/pouvoir (portée de tir vs rayon d'explosion, seuils différents), seul le
// patron de recherche est commun. Ce fichier ne connaît rien du domaine combat : la charge utile de
// chaque palier (modificateur de dégât, Test de Chance...) appartient entièrement à l'appelant.
//
// Séparation volontaire, même patron que worldMetrics.js/createWorldMetrics : normalizeDistanceBands
// valide et fige une table une seule fois (au chargement de la définition d'arme/pouvoir),
// resolveDistanceBand ne fait plus que chercher dedans — pas de revalidation à chaque cible d'une
// même résolution AOE.
//
// Parenté avec shared/combatRange.js#resolveWeaponRangeBand (trouvé après coup, même session) : cette
// fonction fait déjà « comparer une distance à des seuils croissants, retourner le palier » avec les
// 5 mêmes noms RAW (bout_portant/courte/moyenne/longue/extreme). Volontairement NON fusionnées :
// resolveWeaponRangeBand tolère des seuils dégénérés (arme catalogue avec une seule valeur de portée
// → thresholds à 0 répétés) pour composer avec des données réelles incomplètes, alors que
// normalizeDistanceBands ci-dessous refuse tout seuil ≤0 ou non strictement croissant — une table de
// dégression AOE mal formée ne doit jamais être silencieusement tolérée (CLAUDE.md §1.9). Même
// algorithme de recherche, tolérance aux données volontairement différente.

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`${label} doit être un nombre fini`)
  return number
}

// Marqueur non énumérable posé sur le tableau retourné par normalizeDistanceBands — resolveDistanceBand
// le vérifie pour refuser tout tableau construit à la main (donc pas forcément trié). Sans ce garde,
// un appelant qui saute normalizeDistanceBands obtiendrait un résultat FAUX en silence : Array#find
// retourne la première entrée qui correspond dans l'ORDRE DU TABLEAU, pas la plus proche — sur des
// paliers non triés, ce n'est pas forcément le bon.
const NORMALIZED = Symbol('distanceBands.normalized')

// normalizeDistanceBands — valide une table de paliers triée par distance croissante. Chaque entrée
// porte au moins maxDistanceM ; le reste de la charge utile est laissé libre à l'appelant.
export function normalizeDistanceBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new TypeError('bands doit être un tableau non vide')
  }
  let previousMax = -Infinity
  const normalized = bands.map((band, index) => {
    if (!band || typeof band !== 'object' || Array.isArray(band)) {
      throw new TypeError(`bands[${index}] doit être un objet`)
    }
    const maxDistanceM = finiteNumber(band.maxDistanceM, `bands[${index}].maxDistanceM`)
    if (maxDistanceM <= 0) {
      throw new RangeError(`bands[${index}].maxDistanceM doit être strictement positif`)
    }
    if (maxDistanceM <= previousMax) {
      throw new RangeError('bands doit être trié par maxDistanceM strictement croissant')
    }
    previousMax = maxDistanceM
    return Object.freeze({ ...band, maxDistanceM })
  })
  Object.defineProperty(normalized, NORMALIZED, { value: true, enumerable: false })
  return Object.freeze(normalized)
}

// resolveDistanceBand — premier palier où distanceM <= maxDistanceM, sinon le dernier (portée
// extrême, RAW : au-delà de la dernière bande explicite, le dernier palier s'applique toujours).
// `bands` doit déjà être passé par normalizeDistanceBands — vérifié via le marqueur ci-dessus (O(1),
// pas une revalidation complète) pour rester bon marché dans une boucle multi-cibles tout en refusant
// net un tableau construit à la main.
export function resolveDistanceBand(distanceM, bands) {
  const distance = finiteNumber(distanceM, 'distanceM')
  if (distance < 0) throw new RangeError('distanceM doit être positif ou nul')
  if (!Array.isArray(bands) || bands.length === 0 || !bands[NORMALIZED]) {
    throw new TypeError('bands doit venir de normalizeDistanceBands (tableau non normalisé refusé)')
  }
  const match = bands.find(band => distance <= band.maxDistanceM)
  return match ?? bands[bands.length - 1]
}
