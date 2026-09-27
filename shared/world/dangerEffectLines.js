// shared/world/dangerEffectLines.js — Contrat d'une LIGNE d'effet portée par une définition de danger
// (shared/world/dangerCatalog.js pour les builtins, world_effect_definitions pour le custom MJ).
// Fichier séparé de worldEffects.js (docs/PLANS/PLAN_ZONES_DANGER.md §13.7 pt1) : ce dernier mêle déjà
// géométrie + propagation + hooks legacy ; une ligne d'effet est de la résolution de RÈGLE, pas de la
// géométrie. Patron worldEffects.js : validation pure, throw TypeError/RangeError, deepFreeze — jamais
// un jet de dés ni un accès base (shared/, invariant "code observé" AGENTS.md).
//
// v1 (Z1, server/src/services/effectLineResolverService.js) ne résout que damage/status/modifier/note.
// Les 9 autres types sont validés ICI dès Z0 (contrat complet, §13.1) mais n'ont pas de résolveur avant
// leur incrément v2 (§9 du plan) : une ligne d'un type non résolu passe la validation, le dispatcher Z1
// logue "type non résolu (v2)" et ne fait rien — jamais un throw pour un type simplement pas encore câblé.
//
// Corrections apportées ici à des exemples du plan qui divergeaient de son propre contrat générique
// (trouvées en écrivant Z0, à consigner dans PLAN_ZONES_DANGER.md §11) :
// - `modifier` (§4 gaz:irritant, ligne `test.onFail`) porte `valueFromFailMargin`/`cumulative` en plus
//   de `value` — nécessaire quand un modifier est imbriqué sous un `test` (v2) dont la magnitude dépend
//   de la marge d'échec, pas d'un chiffre fixe au catalogue. `value` devient optionnel dans ce cas.
// - `attenuations` (§4 gaz:irritant, entrée `behavior`) utilise `tag`+`cost` au lieu de `key` — `tag` est
//   accepté comme synonyme de `key` (plus naturel pour by:'behavior'), `cost` est une extension optionnelle
//   (ressource dépensée, ex. 'souffle' pour "retenir sa respiration", §5.5).

import { LOCATION_TO_SLOT } from '../armorConstants.js'

export const EFFECT_LINE_PHASES = new Set(['onEnter', 'onExit', 'onTraverse', 'onTurn'])

export const EFFECT_LINE_TYPES = new Set([
  'damage', 'status', 'modifier', 'note',
  'test', 'statLoss', 'chance', 'drainResource', 'skillOverride',
  'forcedMove', 'accumulateLevel', 'corrodeEquipment', 'chain',
])

// v1 = résolus par server/src/services/effectLineResolverService.js dès Z1 ; les autres membres de
// EFFECT_LINE_TYPES sont validés mais no-op jusqu'à leur résolveur v2 respectif (§9 du plan).
export const RESOLVED_EFFECT_LINE_TYPES_V1 = new Set(['damage', 'status', 'modifier', 'note'])

const REMANENCE_MODES = new Set(['none', 'conditional', 'decay', 'fixed'])
const LOCATION_MODES = new Set(['random', 'exposed', 'all'])
const SKILL_OVERRIDE_MODES = new Set(['disable', 'swap'])
const CORRODE_SLOT_MODES = new Set(['hit', 'worn', 'all'])
const ATTENUATION_BY = new Set(['protectionKey', 'trait', 'behavior'])
const ATTENUATION_EFFECTS = new Set(['immune', 'halve', 'partial', 'arbitrate'])

// Types dont la ligne porte escalade/rémanence (§13.3 : seuls damage/status/modifier les listent —
// note est descriptif one-shot, les lignes imbriquées test/chance/drainResource portent leur transverse
// sur onFail/onSuccess/onEmpty, jamais sur elles-mêmes).
const TRANSVERSE_TYPES = new Set(['damage', 'status', 'modifier'])

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function nonEmptyString(value, path, maxLength = 160) {
  const text = String(value ?? '').trim()
  if (!text) throw new RangeError(`${path} est obligatoire`)
  return text.slice(0, maxLength)
}

function optionalString(value, maxLength = 160) {
  return value ? String(value).trim().slice(0, maxLength) : null
}

// Un compte/montant est soit un entier ≥1, soit une formule de dés portée en chaîne — jamais validée
// ICI (regex dupliquée de server/src/lib/diceParser.js créerait une 2ᵉ autorité, invariant 3). Patron
// shared/fallDamageConstants.js : la chaîne est portée telle quelle, parseDice (serveur) est seul
// autoritaire sur sa validité ; dangerCatalog.test.mjs pin chaque valeur par égalité littérale, comme
// fallDamageConstants.test.mjs.
function positiveIntOrDiceString(value, path) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${path} doit être un entier ≥ 1`)
    return value
  }
  return nonEmptyString(value, path, 32)
}

// Comme positiveIntOrDiceString, mais le nombre n'a pas besoin d'être entier (ex. forcedMove.distance
// en mètres fractionnaires) — §13.3 note "distance (num|dés)", pas "int".
function nonNegativeNumberOrDiceString(value, path) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${path} doit être un nombre ≥ 0`)
    return value
  }
  return nonEmptyString(value, path, 32)
}

function nonNegativeInt(value, path) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${path} doit être un entier ≥ 0`)
  return n
}

// diceFormula — comme positiveIntOrDiceString mais toujours une chaîne (jamais un nombre nu) : formula
// n'a pas de forme numérique valide (une formule EST une chaîne de dés, "1d6", jamais un scalaire).
function diceFormula(value, path) {
  return nonEmptyString(value, path, 32)
}

function normalizeEscalation(value, path) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} doit être null ou un objet`)
  return deepFreeze({
    perTurn: finite(value.perTurn, 0),
    cap: value.cap == null ? null : finite(value.cap, 0),
  })
}

function normalizeRemanenceParams(remanence, value, path) {
  const params = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  if (remanence === 'decay') {
    return deepFreeze({ perTurn: finite(params.perTurn, 1) })
  }
  if (remanence === 'fixed') {
    return deepFreeze({
      turns: params.turns == null ? null : positiveIntOrDiceString(params.turns, `${path}.turns`),
      earlyStop: optionalString(params.earlyStop, 80),
    })
  }
  if (remanence === 'conditional') {
    return deepFreeze({ label: optionalString(params.label, 160) })
  }
  return deepFreeze({})
}

function normalizeTransverse(value, path) {
  const remanence = value.remanence ?? 'none'
  if (!REMANENCE_MODES.has(remanence)) throw new RangeError(`${path}.remanence inconnue : ${remanence}`)
  return {
    escalation: normalizeEscalation(value.escalation, `${path}.escalation`),
    remanence,
    remanenceParams: normalizeRemanenceParams(remanence, value.remanenceParams, `${path}.remanenceParams`),
  }
}

function normalizeDamageLine(value, path) {
  const locationMode = value.locationMode ?? 'random'
  if (!LOCATION_MODES.has(locationMode)) throw new RangeError(`${path}.locationMode inconnu : ${locationMode}`)
  const forcedLocation = value.forcedLocation ?? null
  if (forcedLocation != null && !(forcedLocation in LOCATION_TO_SLOT)) {
    throw new RangeError(`${path}.forcedLocation inconnue de LOCATION_TO_SLOT : ${forcedLocation}`)
  }
  // Convention §13.3 : locationMode:'all' ⟹ locations ignoré, jamais une valeur magique 0.
  const locations = locationMode === 'all' ? null : positiveIntOrDiceString(value.locations ?? 1, `${path}.locations`)
  const armorFactor = finite(value.armorFactor, 1)
  if (armorFactor < 0) throw new RangeError(`${path}.armorFactor doit être ≥ 0`)
  return {
    formula: diceFormula(value.formula, `${path}.formula`),
    locations,
    locationMode,
    forcedLocation,
    damageType: nonEmptyString(value.damageType, `${path}.damageType`, 40),
    // Passe-plat vers resolveTargetHit({ armorReductionFactor }) en Z1 (damageService.js:319-335) :
    // 1 = armure normale (défaut, tous les exemples §4), 0 = armure ignorée, 0.5 = "réduite de moitié"
    // (patron Chute). Aucune borne haute inventée : un multiplicateur > 1 (armure amplifiée) reste
    // un choix de définition valide tant que rien n'en démontre l'absurdité.
    armorFactor,
  }
}

function normalizeStatusLine(value, path) {
  // statusCode : existence vérifiée contre shared/tokenStatusRegistry.js en Z1 (§13.3), pas ici — Z0
  // ne valide que la FORME du slug.
  return { statusCode: nonEmptyString(value.statusCode, `${path}.statusCode`, 64) }
}

function normalizeModifierLine(value, path) {
  const target = nonEmptyString(value.target, `${path}.target`, 64)
  const valueFromFailMargin = value.valueFromFailMargin === true
  const cumulative = value.cumulative === true
  if (valueFromFailMargin) {
    // Ligne imbriquée sous un test.onFail (v2, §4 gaz:irritant) : la magnitude vient de la marge
    // d'échec au moment de la résolution, jamais un chiffre fixe au catalogue.
    return { target, value: null, valueFromFailMargin, cumulative }
  }
  const raw = Number(value.value)
  if (!Number.isInteger(raw)) throw new RangeError(`${path}.value doit être un entier signé`)
  return { target, value: raw, valueFromFailMargin: false, cumulative }
}

function normalizeNoteLine(value, path) {
  return {
    label: nonEmptyString(value.label, `${path}.label`, 160),
    text: optionalString(value.text, 2000) ?? '',
  }
}

function normalizeTestLine(value, path) {
  const skill = optionalString(value.skill, 64)
  const attribute = optionalString(value.attribute, 64)
  if (!skill && !attribute) throw new RangeError(`${path} exige skill ou attribute`)
  return {
    skill,
    attribute,
    difficulty: finite(value.difficulty, 0),
    onFail: value.onFail ? normalizeNestedEffectLine(value.onFail, `${path}.onFail`) : null,
  }
}

function normalizeStatLossLine(value, path) {
  return {
    stat: nonEmptyString(value.stat, `${path}.stat`, 40),
    amount: positiveIntOrDiceString(value.amount, `${path}.amount`),
    recovery: optionalString(value.recovery, 160),
  }
}

function normalizeChanceLine(value, path) {
  return {
    onSuccess: value.onSuccess ? normalizeNestedEffectLine(value.onSuccess, `${path}.onSuccess`) : null,
    onFail: value.onFail ? normalizeNestedEffectLine(value.onFail, `${path}.onFail`) : null,
  }
}

function normalizeDrainResourceLine(value, path) {
  return {
    resource: nonEmptyString(value.resource, `${path}.resource`, 40),
    rate: positiveIntOrDiceString(value.rate, `${path}.rate`),
    onEmpty: value.onEmpty ? normalizeNestedEffectLine(value.onEmpty, `${path}.onEmpty`) : null,
  }
}

function normalizeSkillOverrideLine(value, path) {
  const mode = value.mode
  if (!SKILL_OVERRIDE_MODES.has(mode)) throw new RangeError(`${path}.mode inconnu : ${mode}`)
  const swapTo = mode === 'swap' ? nonEmptyString(value.swapTo, `${path}.swapTo`, 64) : null
  return { skill: nonEmptyString(value.skill, `${path}.skill`, 64), mode, swapTo }
}

function normalizeForcedMoveLine(value, path) {
  return {
    direction: nonEmptyString(value.direction, `${path}.direction`, 40),
    distance: nonNegativeNumberOrDiceString(value.distance, `${path}.distance`),
  }
}

function normalizeAccumulateLevelLine(value, path) {
  return {
    track: nonEmptyString(value.track, `${path}.track`, 40),
    formula: diceFormula(value.formula, `${path}.formula`),
  }
}

function normalizeCorrodeEquipmentLine(value, path) {
  const slotMode = value.slotMode ?? 'hit'
  if (!CORRODE_SLOT_MODES.has(slotMode)) throw new RangeError(`${path}.slotMode inconnu : ${slotMode}`)
  return { slotMode, amount: positiveIntOrDiceString(value.amount, `${path}.amount`) }
}

// Champs partagés par la ligne `chain` et par une entrée `chaining[]` de la définition (§3 : même
// forme, la ligne ajoute juste l'enveloppe type/phase) — une seule fonction, réutilisée aux deux
// endroits (invariant 3, pas de 2ᵉ validation de la même forme).
export function normalizeChainingRule(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} doit être un objet`)
  return {
    engendre: nonEmptyString(value.engendre, `${path}.engendre`, 64),
    délai: nonNegativeInt(value.délai ?? value.delai, `${path}.délai`),
    condition: optionalString(value.condition, 160),
    géométrie: optionalString(value.géométrie ?? value.geometrie, 160),
  }
}

function normalizeChainLine(value, path) {
  return normalizeChainingRule(value, path)
}

const TYPE_NORMALIZERS = {
  damage: normalizeDamageLine,
  status: normalizeStatusLine,
  modifier: normalizeModifierLine,
  note: normalizeNoteLine,
  test: normalizeTestLine,
  statLoss: normalizeStatLossLine,
  chance: normalizeChanceLine,
  drainResource: normalizeDrainResourceLine,
  skillOverride: normalizeSkillOverrideLine,
  forcedMove: normalizeForcedMoveLine,
  accumulateLevel: normalizeAccumulateLevelLine,
  corrodeEquipment: normalizeCorrodeEquipmentLine,
  chain: normalizeChainLine,
}

// Une ligne IMBRIQUÉE (test.onFail, chance.onSuccess/onFail, drainResource.onEmpty) n'est jamais
// planifiée par sa propre `phase` : elle s'exécute en conséquence synchrone de la résolution de sa
// ligne parente (le Test, le Tirage de Chance…), qui porte SA phase. §3/§4 ne donnent d'ailleurs
// aucune `phase` à ces lignes imbriquées (ex. gaz:irritant, onFail d'un test) — l'exiger casserait le
// contrat déjà écrit. `phase` sort donc `null` pour une ligne imbriquée, jamais une valeur inventée.
function buildEffectLine(value, path, { nested = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} doit être un objet`)
  }
  const type = value.type
  if (!EFFECT_LINE_TYPES.has(type)) throw new RangeError(`${path}.type inconnu : ${type}`)
  const phase = nested ? null : value.phase
  if (!nested && !EFFECT_LINE_PHASES.has(phase)) throw new RangeError(`${path}.phase inconnue : ${phase}`)

  const specific = TYPE_NORMALIZERS[type](value, path)
  const transverse = TRANSVERSE_TYPES.has(type) ? normalizeTransverse(value, path) : {}

  return deepFreeze({ type, phase, ...specific, ...transverse })
}

export function normalizeEffectLine(value, path = 'effect') {
  return buildEffectLine(value, path, { nested: false })
}

export function normalizeNestedEffectLine(value, path) {
  return buildEffectLine(value, path, { nested: true })
}

export function normalizeEffectLines(values, path = 'effects') {
  if (!Array.isArray(values)) throw new TypeError(`${path} doit être un tableau`)
  return deepFreeze(values.map((line, index) => normalizeEffectLine(line, `${path}[${index}]`)))
}

// normalizeAttenuation — §2.F : interaction/immunité par TAGS, jamais par matrice. `key` est le nom
// canonique ; `tag` est accepté en synonyme (plus naturel pour by:'behavior', §4 gaz:irritant) et
// toujours renvoyé sous `key`. `cost` est optionnel (ressource dépensée par l'atténuation, ex. 'souffle'
// pour "retenir sa respiration", §5.5) — absent = null, aucune ressource consommée.
export function normalizeAttenuation(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} doit être un objet`)
  const by = value.by
  if (!ATTENUATION_BY.has(by)) throw new RangeError(`${path}.by inconnu : ${by}`)
  const effect = value.effect
  if (!ATTENUATION_EFFECTS.has(effect)) throw new RangeError(`${path}.effect inconnu : ${effect}`)
  return deepFreeze({
    by,
    key: nonEmptyString(value.key ?? value.tag, `${path}.key`, 64),
    effect,
    scope: Array.isArray(value.scope) ? deepFreeze(value.scope.map(s => String(s).trim())) : null,
    when: optionalString(value.when, 160),
    cost: optionalString(value.cost, 40),
  })
}

export function normalizeAttenuations(values, path = 'attenuations') {
  if (!Array.isArray(values)) throw new TypeError(`${path} doit être un tableau`)
  return deepFreeze(values.map((entry, index) => normalizeAttenuation(entry, `${path}[${index}]`)))
}

export function normalizeChainingRules(values, path = 'chaining') {
  if (!Array.isArray(values)) throw new TypeError(`${path} doit être un tableau`)
  return deepFreeze(values.map((entry, index) => normalizeChainingRule(entry, `${path}[${index}]`)))
}

// corrodes — matériaux affectés par un résolveur corrodeEquipment (v2, Usure & Intégrité L5). Aucun
// vocabulaire fermé aujourd'hui (seuls 'chair'/'métal' apparaissent au catalogue, §2.D) : validation de
// FORME seule (chaîne non vide), pas d'énumération inventée sans second exemple qui la justifie.
export function normalizeCorrodes(values, path = 'corrodes') {
  if (!Array.isArray(values)) throw new TypeError(`${path} doit être un tableau`)
  return deepFreeze(values.map((entry, index) => nonEmptyString(entry, `${path}[${index}]`, 40)))
}
