// Parenté avec shared/world/distanceBands.js#resolveDistanceBand (ajouté ultérieurement pour l'AOE,
// docs/PLANS/PLAN_AOE.md §4) : même algorithme de recherche par seuils croissants, volontairement pas
// fusionnés — ce fichier-ci tolère des seuils dégénérés (portée catalogue incomplète), l'autre les
// refuse par construction. Voir le commentaire de tête de distanceBands.js pour le détail.

import { normalizeDistanceBands, resolveDistanceBand } from './world/distanceBands.js'

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

// L'identification « cette arme est-elle une arme de zone (AOE) ? » a migré vers
// `shared/combatAoe.js` (segment 0b, PLAN_ARMES_SPECIALES.md §1.6) — c'est désormais une donnée
// catalogue (`ref_equipment.aoe_profile`), plus un Set de noms en dur ici.
// `resolveShotgunSpread` / `SHOTGUN_SPREAD_BY_BAND` ci-dessus restent la table mécanique RAW du
// mécanisme `shotgun_spread`, vers lequel `aoe_profile.mechanic` pointe.

// ─── Grenade à fragmentation — dégression par distance au point d'explosion (mécanisme grenade_frag) ─
//
// Table mécanique RAW (docs/REGLES/REGLES_ARMES_SPECIALES.md § « Grenades et mines »), partagée ici
// pour la même raison que SHOTGUN_SPREAD_BY_BAND ci-dessus : le résolveur serveur
// (server/src/lib/aoeMechanisms/grenadeFrag.js) ET l'aperçu client (client/src/lib/aoePreviewShape.js,
// anneaux concentriques) la lisent — jamais deux copies qui dérivent (PLAN_GRENADES.md §10.2).
//
// Différence avec le fusil à pompe : ici les seuils sont des rayons ABSOLUS depuis le point d'impact
// (pas les seuils de portée propres à l'arme). Le RAW exprime les paliers en DIAMÈTRE ; lecture retenue
// (PLAN_GRENADES.md §1, [HYPOTHÈSE] — seule lecture cohérente) : cible à distance `r` du point
// d'explosion → palier de diamètre `2r`, donc `maxDistanceM` = rayon.
//   centre  (Ø < 2 m,   r ≤ 1 m)    : 1D3 Localisations, dégâts +1D10.
//   courte  (Ø 2-5 m,   r ≤ 2,5 m)  : dégâts normaux.
//   moyenne (Ø 5-10 m,  r ≤ 5 m)    : -1D10.
//   longue  (Ø 10-20 m, r ≤ 10 m)   : -2D10, Test de Chance.
//   extreme (Ø 20-30 m, r ≤ 15 m)   : -3D10, Test de Chance (+5).
//   au-delà de r = 15 m : « Rien d'autre n'est affecté » (la cible est exclue par la forme AOE
//   `isPointInAoeShape(circle, GRENADE_FRAG_MAX_RADIUS_M)` AVANT tout appel à resolveGrenadeBand).
//
// `damageDice` : chaîne SIGNÉE pour `rollSignedDie` (comme SHOTGUN_SPREAD_BY_BAND). `+0` = neutre.
// `chanceTest` / `chanceBonus` : donnée RAW LATENTE, pas consommée en v1 (chantier Chance,
// docs/PLANS/PLAN_CHANCE.md) — portée ici comme `savePossible`/`saveBonus` côté fusil à pompe.
// `locationsDice` : présent uniquement au palier centre (1D3 Localisations) ; absent ailleurs → 1.
export const GRENADE_FRAG_BANDS = normalizeDistanceBands([
  { name: 'centre',  maxDistanceM: 1,   damageDice: '+1D10', locationsDice: '1D3', chanceTest: false, chanceBonus: 0 },
  { name: 'courte',  maxDistanceM: 2.5, damageDice: '+0',                          chanceTest: false, chanceBonus: 0 },
  { name: 'moyenne', maxDistanceM: 5,   damageDice: '-1D10',                       chanceTest: false, chanceBonus: 0 },
  { name: 'longue',  maxDistanceM: 10,  damageDice: '-2D10',                       chanceTest: true,  chanceBonus: 0 },
  { name: 'extreme', maxDistanceM: 15,  damageDice: '-3D10',                       chanceTest: true,  chanceBonus: 5 },
])

// Rayon maximal d'effet = borne du dernier palier — une seule source de vérité (jamais un `15` en dur
// à côté de la table). Doit valoir la valeur `radiusM` figée par la migration 325 dans
// `ref_equipment.aoe_profile` (garde : shared/combatRange.test.mjs).
export const GRENADE_FRAG_MAX_RADIUS_M = GRENADE_FRAG_BANDS[GRENADE_FRAG_BANDS.length - 1].maxDistanceM

// resolveGrenadeBand — palier de dégression pour une distance au point d'explosion. `GRENADE_FRAG_BANDS`
// est déjà normalisée au chargement du module → `resolveDistanceBand` ne fait que chercher (bon marché
// en boucle multi-cibles). Frère de `resolveShotgunSpread` : la table + son accès au même endroit.
export function resolveGrenadeBand(distanceM) {
  return resolveDistanceBand(distanceM, GRENADE_FRAG_BANDS)
}
