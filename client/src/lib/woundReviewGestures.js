// Logique PURE de l'écran de revue des guérisons (PLAN_REVUE_GUERISON.md §12-§13) : de la sélection d'identifiants d'après la vue serveur,
// aucune règle de jeu. Le serveur construit la vue (`getReviewCardsForGm`) et applique les réponses ; ici on transforme un geste du MJ
// (« Réussite pour toute la carte ») en entrées envoyées, on découpe les envois à la limite du serveur et on décide de l'état de « Confirmer ».
// Aucun accès au DOM, à React ni au réseau (le transport est injecté) : testé par `node --test` (woundReviewGestures.test.mjs).
import { HEALING_OUTCOMES, INFECTION_MODES, REVIEW_BATCH_MAX_ENTRIES } from '../../../shared/woundConstants.js'

export { HEALING_OUTCOMES, INFECTION_MODES }

const healingEntry = (echeanceId, mjChoice) => ({ echeanceId, mjChoice })
const infectionEntry = (echeanceId, mode) => ({ echeanceId, mode })

// ─── Entrées envoyées ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Une ligne du compteur = UN Test (RAW « Localisation par Localisation ») : la réponse vaut pour toutes ses cases échues.
export function healingEntriesForLine(line, outcome) {
  return line.answerable ? line.dueEcheanceIds.map(id => healingEntry(id, outcome)) : []
}

export function healingEntriesForCard(card, outcome) {
  return card.lines.flatMap(line => healingEntriesForLine(line, outcome))
}

export function healingEntriesForCards(cards, outcome) {
  return cards.flatMap(card => healingEntriesForCard(card, outcome))
}

// Passer en mode `player` sur une infection déjà en attente d'un joueur ne change rien : on ne l'envoie pas. `auto` marche dans les deux états
// (le MJ peut débloquer un joueur absent).
export function infectionEntriesForCard(card, mode) {
  return card.infections
    .filter(infection => infection.answerable && (mode === 'auto' || infection.status === 'pending_mj_review'))
    .map(infection => infectionEntry(infection.echeanceId, mode))
}

export function infectionEntriesForCards(cards, mode) {
  return cards.flatMap(card => infectionEntriesForCard(card, mode))
}

export function infectionEntryFor(infection, mode) {
  return infectionEntry(infection.echeanceId, mode)
}

// Une échéance sans blessure (anomalie) se clôt par le même chemin que les autres : le handler la termine sans effet.
// Une guérison orpheline part par la route des guérisons, une infection orpheline par celle des infections.
export function orphanEntries(card) {
  const answerable = card.orphans.filter(orphan => orphan.answerable)
  return {
    healing: answerable.filter(o => o.conditionType === 'wound_healing_check').map(o => healingEntry(o.echeanceId, 'amelioration')),
    infection: answerable.filter(o => o.conditionType !== 'wound_healing_check').map(o => infectionEntry(o.echeanceId, 'auto')),
  }
}

// Le serveur refuse tout le lot au-delà de REVIEW_BATCH_MAX_ENTRIES : un geste sur beaucoup de personnages est envoyé en plusieurs lots.
export function chunkEntries(entries, size = REVIEW_BATCH_MAX_ENTRIES) {
  const chunks = []
  for (let i = 0; i < entries.length; i += size) chunks.push(entries.slice(i, i + size))
  return chunks
}

// Envoie les lots l'un APRÈS l'autre (chaque lot est atomique côté serveur) et s'arrête au premier échec de transport : le MJ voit ce qui a été
// appliqué et ce qui reste. `send(chunk)` renvoie `{ results }` ; il est injecté (axios côté écran, un faux dans les tests).
export async function sendInChunks(entries, send, size = REVIEW_BATCH_MAX_ENTRIES) {
  const results = []
  let sent = 0
  for (const chunk of chunkEntries(entries, size)) {
    try {
      const response = await send(chunk)
      results.push(...(response?.results ?? []))
      sent += chunk.length
    } catch (error) {
      return { results, sent, total: entries.length, failure: error }
    }
  }
  return { results, sent, total: entries.length, failure: null }
}

// Bilan lisible d'un envoi : `stale` = déjà traitée entre-temps ; `failed` = le serveur a annulé l'entrée (elle reste à répondre).
export function summarizeResults(results) {
  const summary = { resolved: 0, waiting: 0, stale: 0, failed: 0 }
  for (const result of results) {
    if (result.error) summary.failed += 1
    else if (result.stale) summary.stale += 1
    else if (result.resolved) summary.resolved += 1
    else summary.waiting += 1 // ex. infection passée en attente d'un jet joueur : pas résolue, pas en erreur
  }
  return summary
}

// ─── Comptes par carte et par bloc ───────────────────────────────────────────────────────────────────────────────────────────────────────

// Nombre d'échéances auxquelles le MJ peut répondre sur une carte — même définition que `summary.answerableCount` du serveur.
export function cardAnswerableCount(card) {
  return card.lines.reduce((total, line) => total + line.dueEcheanceIds.length, 0)
    + card.infections.filter(i => i.answerable).length
    + card.orphans.filter(o => o.answerable).length
}

// Cases de blessure concernées par la réponse « toute la carte » (phrase de la carte : « 6 cases de blessure »).
export function cardDueCases(card) {
  return card.lines.reduce((total, line) => total + line.dueCases, 0)
}

export function splitByPlayerType(cards) {
  return { players: cards.filter(c => c.isPlayer), npcs: cards.filter(c => !c.isPlayer) }
}

// ─── Conséquence de « Réussite » ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Ce que fait « Réussite » sur une ligne, d'après les champs du serveur (le client ne calcule rien) :
//   - toutes les cases échues sont à leur dernier Test → `becomes` (gravité d'arrivée, null = la blessure disparaît) ;
//   - aucune n'y est → `continues` (la gravité ne change pas : semaine n/N) ;
//   - un mélange → `mixed`.
export function successConsequence(line) {
  const due = line.items.filter(item => item.answerable)
  const finishing = due.filter(item => item.isLastStep)
  const steps = [...new Set(due.filter(item => item.step && !item.isLastStep).map(item => `${item.step.n}/${item.step.total}`))]
  if (due.length === 0) return null
  if (finishing.length === due.length) return { kind: 'becomes', target: line.targetSeverity }
  if (finishing.length === 0) return { kind: 'continues', steps }
  return { kind: 'mixed', target: line.targetSeverity, steps }
}

// « semaine n/N » d'une ligne : les étapes distinctes de ses cases échues (une ligne peut mêler des étapes différentes).
export function lineStepLabels(line) {
  return [...new Set(line.items.filter(item => item.answerable && item.step).map(item => `${item.step.n}/${item.step.total}`))]
}

// ─── Visibilité et bouton « Confirmer » ──────────────────────────────────────────────────────────────────────────────────────────────────

// L'écran reste affiché tant qu'une avance est en attente OU qu'une réponse attend : jamais « caché parce que la liste est vide »
// (l'ancien écran emportait alors « Confirmer » / « Annuler », PLAN_REVUE_GUERISON.md §12.1).
export function isWindowVisible(view) {
  return Boolean(view) && (view.advance.pending || view.summary.answerableCount > 0)
}

// « Confirmer » n'a de sens que pour une avance en attente, et seulement quand il ne reste aucune réponse à donner (le serveur refuse sinon, 409).
// `reason` est un code que l'écran traduit ; `queuedCount > 0` annonce une ronde suivante (des échéances déjà dues seront ouvertes par « Confirmer »).
export function confirmState(view) {
  if (!view?.advance.pending) return { canConfirm: false, reason: 'noAdvance', count: 0, awaitingPlayerCount: 0, nextRoundCount: 0 }
  const { answerableCount, awaitingPlayerCount, queuedCount } = view.summary
  return {
    canConfirm: answerableCount === 0,
    reason: answerableCount > 0 ? 'answersLeft' : null,
    count: answerableCount,
    awaitingPlayerCount,
    nextRoundCount: queuedCount,
  }
}

// Après un refus du serveur (409), l'écran relit la vue ; ce code dit pourquoi : `nextRound` = des échéances déjà dues (souvent les infections d'un
// Échec) viennent de s'ouvrir — on l'inférait avant le clic par `queuedCount`, la vue relue le confirme ; `answersLeft` = il reste des réponses ;
// `unknown` = rien de visible dans la vue (afficher le message du serveur).
export function explainConfirmRefusal(viewBefore, viewAfter) {
  if (viewAfter?.summary.answerableCount > 0) {
    return viewBefore?.summary.queuedCount > 0 && viewBefore.summary.answerableCount === 0 ? 'nextRound' : 'answersLeft'
  }
  return 'unknown'
}
