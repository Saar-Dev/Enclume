// shared/setbackEffects.js — Lot 3 (PLAN_WIZARD_AVANTAGES.md §13/§4) — résolveur récursif des
// effets mécaniques des 27 Revers (ref_setbacks.effects, JSONB). Fonction pure, sans accès DB,
// sans jet de dé interne (§14, §15 : le serveur reste autoritaire via le circuit DICE_ROLL/
// DICE_RESULT déjà en place, le résolveur ne consomme que des jets déjà déterminés — même
// principe que money_reward, careerAdvantages.js).
//
// Contrairement à resolveCareerRandomEffects (Lot 1/2, complet en un seul passage), ce résolveur
// peut être INTERROMPU : un `chained_setback` ou un `subroll` a besoin d'une réponse (jet ou choix)
// pas encore connue. Le résolveur ne "sait" jamais lui-même ce qui a été déjà répondu — l'appelant
// (client pour l'aperçu progressif, serveur pour la validation finale) lui fournit `answers`, une
// map { [key]: valeur } construite au fil des interactions déjà résolues.
//
// Types d'effets gérés ici (au-delà de ceux déjà couverts par careerAdvantages.js — attribute,
// celebrity, skill_points, category, income_percent, income_multiplier, trait, grant_advantage,
// grant_mutation, points_cap, narrative) :
//   chained_setback { target, chance:{die,hit}, key, condition? } — jet de "suspense" joueur-initié.
//     condition (ex. 'force_polaris') : si le contexte ne le satisfait pas, effet sauté sans même
//     demander de jet (§8.2, §15 point 2).
//   subroll        { key, die, outcomes:[{range:[min,max], effects:[...]}], condition? } — jet de
//     "détail" auto-résolu (même circuit DICE_ROLL/DICE_RESULT, différence purement UX). `condition`
//     (Lot 6, Polaris tier 2 "Culte du Trident") : même sémantique que chained_setback ci-dessous.
//   irradiation_reward { key, die } — jet de "suspense" (2D10, Irradiation) dont le résultat brut
//     devient directement `{type:'trait', trait_type:'irradiation', op:'gauge_delta', value}` — pas
//     un choix entre issues nommées (contrairement à subroll), juste le nombre obtenu. Même principe
//     que money_reward (careerAdvantages.js) : jamais un jet lancé par le résolveur lui-même.
//   apply_setback  { target } — redirige vers les effects[] d'un autre Revers, résolus inline
//     (jamais un nouveau jet 1D100) ; valide dans un outcome de subroll OU une option de choice
//     (`[CORRIGÉ]` 2026-07-22 : restreint à tort au seul subroll dans une version antérieure du
//     plan — Emprisonnement/refuse en a besoin depuis une option de `choice`, pas un subroll).
//   reroll_table   { count } — uniquement valide à l'intérieur d'un outcome de subroll : relance LE
//     MÊME subroll `count` fois de plus ("Deux jets sur cette table", Complot/Faute lourde), jamais
//     un simple remplacement — clés dérivées `${subroll.key}#2`, `${subroll.key}#3`, etc.
//   choice         { key, options:[{effects, label?}] } — décision du joueur, pas un jet (même
//     `answers`, valeur = index de l'option). `label` optionnel (Lot 6) : texte affiché au joueur,
//     transmis tel quel dans le pending ci-dessous, jamais résolu ici.
//   manual_grant_choice — inerte ici aussi (comme grant_advantage), juste transmis dans la liste
//     plate ; l'appelant route vers l'écran d'octroi manuel (§Lot B).
//   celebrity_fraction { value } — inerte ici (comme trait/op:'gauge_fraction_delta', Lot 6) : une
//     fraction (ex. -0.25) de la Célébrité déjà accumulée, appliquée par l'appelant (jamais ce
//     résolveur, qui n'a pas accès au total) via shared/traitAggregation.js#applyFractionalLoss.
//     Couvre Diffamation ("perd un quart de sa Célébrité") — seul cas parmi les 27 Revers.
//
// Sortie : { status: 'done', effects: [...], history } (liste plate, jamais agrégée — §8.3,
// contrairement à resolveCareerRandomEffects) ou, dès que la première réponse manquante est
// rencontrée (résolution arrêtée net, l'appelant redemande avec `answers` complété) :
//   { status: 'pending', kind: 'roll', key, die, origin: 'chained_setback'|'subroll', history } —
//     `origin` (Lot 5, 2026-07-22) dit à l'UI si le jet doit être joueur-initié (chained_setback) ou
//     auto-tiré (subroll) ; même circuit DICE_ROLL/DICE_RESULT dans les deux cas, différence UX pure.
//   { status: 'pending', kind: 'choice', key, options: [{label}], history } — `options` porte
//     désormais les libellés (Lot 5), plus seulement un compte, pour que l'UI affiche un vrai texte
//     par bouton.
//
// `history` (Lot 5, 2026-07-23 — trouvé en testant en conditions réelles : Attentat enchaîne 2
// chained_setback sans qu'aucun résultat de dé ne soit jamais montré au joueur, Choc psychologique
// pareil pour son subroll) : liste plate des jets déjà répondus (`answers`), reconstruite à chaque
// appel (fonction toujours pure — pas un état accumulé entre deux appels, même philosophie que le
// reste du résolveur) au fil de la MÊME traversée que la résolution elle-même, jamais une 2e passe
// dupliquée. Entrées :
//   { type:'chained_setback', key, target, die, value, hit } — target = nom exact du Revers ciblé
//     (déjà la bonne chaîne d'affichage, résolu via findSetbackByName), hit = jet dans effect.chance.hit.
//   { type:'subroll', key, die, value }
//   { type:'irradiation_reward', key, die, value }

import { resolveSetback } from './careerSetbacks.js'

const MAX_RECURSION = 20 // garde-fou défensif (reroll_table en chaîne, cascade chained_setback) —
// jamais une vraie limite de jeu, juste une protection contre une donnée corrompue en boucle.

function findSetbackByName(name, setbackRows) {
  const row = (setbackRows ?? []).find(r => r.name === name)
  if (!row) throw new Error(`Revers cible introuvable : ${name}`)
  return row
}

function resolveEffectsList(effectsList, state, depth) {
  if (depth > MAX_RECURSION) throw new Error('Récursion de Revers trop profonde (données corrompues ?)')
  const collected = []
  for (const effect of effectsList ?? []) {
    const result = resolveEffect(effect, state, depth)
    if (result.status === 'pending') return result
    collected.push(...result.effects)
  }
  return { status: 'done', effects: collected }
}

function resolveEffect(effect, state, depth) {
  switch (effect.type) {
    case 'chained_setback': {
      if (effect.condition && !state.context[effect.condition]) return { status: 'done', effects: [] }
      const value = state.answers[effect.key]
      // origin : distingue pour l'appelant (Lot 5, UI) un jet de suspense joueur-initié d'un jet de
      // détail auto-tiré (subroll, ci-dessous) — même forme `{kind:'roll', key, die}` sinon,
      // impossible à distinguer sans reparcourir effects[] côté client (piège 5, résolveur = seule
      // autorité de traversée).
      if (value == null) return { status: 'pending', kind: 'roll', key: effect.key, die: effect.chance.die, origin: 'chained_setback' }
      const hit = effect.chance.hit.includes(value)
      state.history.push({ type: 'chained_setback', key: effect.key, target: effect.target, die: effect.chance.die, value, hit })
      if (!hit) return { status: 'done', effects: [] }
      const targetRow = findSetbackByName(effect.target, state.setbackRows)
      return resolveEffectsList(targetRow.effects ?? [], state, depth + 1)
    }
    case 'subroll': {
      // `condition` (Lot 6, Polaris tier 2 — "Culte du Trident" n'est pas un Revers nommé, donc pas
      // représentable via chained_setback+target ; un subroll direct avec ses propres outcomes/choice
      // convient mieux) : même sémantique que chained_setback ci-dessus — sauté sans jet si absent.
      if (effect.condition && !state.context[effect.condition]) return { status: 'done', effects: [] }
      const value = state.answers[effect.key]
      if (value == null) return { status: 'pending', kind: 'roll', key: effect.key, die: effect.die, origin: 'subroll' }
      state.history.push({ type: 'subroll', key: effect.key, die: effect.die, value })
      const outcome = (effect.outcomes ?? []).find(o => value >= o.range[0] && value <= o.range[1])
      if (!outcome) throw new Error(`Résultat ${value} hors plages définies pour ${effect.key}`)
      return resolveOutcome(outcome, effect, state, depth)
    }
    case 'irradiation_reward': {
      // Nouveau (Lot 6, Irradiation) : même principe que money_reward (careerAdvantages.js) — le
      // résolveur ne lance jamais ce dé lui-même (fonction pure), la valeur (2D10) est déjà connue
      // via le même circuit chained_setback/subroll (DICE_ROLL/DICE_RESULT), transmise dans `answers`.
      // Un seul cas parmi les 27 Revers — pas de langage de formule générique (même principe que le
      // rejet d'un évaluateur générique pour money_reward, §8.1 du plan).
      const value = state.answers[effect.key]
      if (value == null) return { status: 'pending', kind: 'roll', key: effect.key, die: effect.die, origin: 'chained_setback' }
      state.history.push({ type: 'irradiation_reward', key: effect.key, die: effect.die, value })
      return { status: 'done', effects: [{ type: 'trait', trait_type: 'irradiation', op: 'gauge_delta', value }] }
    }
    case 'apply_setback': {
      // Valide n'importe où (option de choice, outcome de subroll) — seul reroll_table est
      // restreint à l'intérieur d'un outcome de subroll (§8.1), pas apply_setback.
      const targetRow = findSetbackByName(effect.target, state.setbackRows)
      return resolveEffectsList(targetRow.effects ?? [], state, depth + 1)
    }
    case 'reroll_table':
      // Traité par resolveOutcome (a besoin du subroll parent pour dériver les clés) — atteindre
      // ce point signifie un reroll_table hors d'un outcome de subroll, erreur de données (§8.1).
      throw new Error('reroll_table doit être résolu via son subroll parent (jamais isolé)')
    case 'choice': {
      const chosenIndex = state.answers[effect.key]
      // `label` (texte affiché au joueur pour cette option) est un champ optionnel du schéma de
      // données (Lot 6) — passé tel quel, jamais résolu/deviné ici (fonction pure, aucune I/O de
      // texte). `null` si l'auteur de contenu ne l'a pas encore renseigné ; c'est à l'appelant UI
      // de décider d'un repli d'affichage (ex. "Option {n}"), pas au résolveur.
      if (chosenIndex == null) {
        return {
          status: 'pending', kind: 'choice', key: effect.key,
          options: (effect.options ?? []).map(o => ({ label: o.label ?? null })),
        }
      }
      const chosen = effect.options?.[chosenIndex]
      if (!chosen) throw new Error(`Option de choix invalide pour ${effect.key} : ${chosenIndex}`)
      return resolveEffectsList(chosen.effects ?? [], state, depth + 1)
    }
    // Types simples, déjà couverts par le vocabulaire careerAdvantages.js (attribute, celebrity,
    // skill_points, category, income_percent, income_multiplier) + ceux propres aux Revers
    // (points_cap, trait, grant_advantage, manual_grant_choice, narrative) : jamais de résolution
    // récursive, juste transmis tel quel dans la liste plate de sortie.
    case 'attribute':
    case 'celebrity':
    case 'celebrity_fraction':
    case 'skill_points':
    case 'category':
    case 'income_percent':
    case 'income_multiplier':
    case 'points_cap':
    case 'trait':
    case 'grant_advantage':
    case 'manual_grant_choice':
    case 'narrative':
      return { status: 'done', effects: [effect] }
    default:
      throw new Error(`Type d'effet inconnu ou hors périmètre Revers : ${effect.type}`)
  }
}

// "Deux jets sur cette table" (reroll_table, Complot=10/Faute lourde=20) : relance LE MÊME subroll
// `count` fois de plus, clés dérivées ${key}#2, ${key}#3... — jamais un simple remplacement du
// résultat, les effets de chaque relance s'additionnent à ceux déjà obtenus (§4, §12).
function resolveOutcome(outcome, subrollEffect, state, depth) {
  const effects = outcome.effects ?? []
  const rerollEffect = effects.find(e => e.type === 'reroll_table')
  const normalEffects = effects.filter(e => e.type !== 'reroll_table')
  const normalResult = resolveEffectsList(normalEffects, state, depth + 1)
  if (normalResult.status === 'pending') return normalResult
  if (!rerollEffect) return normalResult

  const collected = [...normalResult.effects]
  for (let n = 2; n <= 1 + rerollEffect.count; n++) {
    const rerollKey = `${subrollEffect.key}#${n}`
    const value = state.answers[rerollKey]
    if (value == null) return { status: 'pending', kind: 'roll', key: rerollKey, die: subrollEffect.die, origin: 'subroll' }
    state.history.push({ type: 'subroll', key: rerollKey, die: subrollEffect.die, value })
    const rerollOutcome = (subrollEffect.outcomes ?? []).find(o => value >= o.range[0] && value <= o.range[1])
    if (!rerollOutcome) throw new Error(`Résultat ${value} hors plages définies pour ${rerollKey}`)
    const sub = resolveOutcome(rerollOutcome, { ...subrollEffect, key: rerollKey }, state, depth + 1)
    if (sub.status === 'pending') return sub
    collected.push(...sub.effects)
  }
  return { status: 'done', effects: collected }
}

/**
 * @param {number} roll — résultat 1D100 déjà déterminé (validé en amont, comme aujourd'hui)
 * @param {{roll_min:number, roll_max:number, name:string, effects: object[]}[]} setbackRows — ref_setbacks
 * @param {Record<string, number>} answers — réponses déjà connues { [key]: valeur (jet ou index de choix) }
 * @param {{force_polaris?: boolean}} context — conditions externes (§8.2), jamais lues en DB ici
 * @returns {{status:'pending', kind:'roll', key:string, die:string, origin:'chained_setback'|'subroll'}
 *          | {status:'pending', kind:'choice', key:string, options:{label:string|null}[]}
 *          | {status:'done', effects: object[]}}
 */
export function resolveSetbackEffects(roll, setbackRows, answers = {}, context = {}) {
  const row = resolveSetback(roll, setbackRows)
  if (!row) throw new Error(`Revers introuvable pour le jet ${roll}`)
  const state = { setbackRows, answers, context, history: [] }
  const result = resolveEffectsList(row.effects ?? [], state, 0)
  return { ...result, history: state.history }
}
