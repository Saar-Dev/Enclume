// Logique PURE de l'écran de revue des guérisons (PLAN_REVUE_GUERISON.md §12-§13) : de la sélection d'identifiants d'après la vue serveur,
// aucune règle de jeu. Le serveur construit la vue (`getReviewCardsForGm`) et applique les réponses ; ici on transforme un geste du MJ
// (« Réussite pour toute la carte ») en entrées envoyées, on découpe les envois à la limite du serveur et on décide de l'état de « Confirmer ».
// Aucun accès au DOM, à React ni au réseau (le transport est injecté) : testé par `node --test` (woundReviewGestures.test.mjs).
import { HEALING_OUTCOMES, INFECTION_MODES, REVIEW_BATCH_MAX_ENTRIES } from '../../../shared/woundConstants.js'

export { HEALING_OUTCOMES, INFECTION_MODES }

// `group` (entrées de guérison) : le Test auquel appartient l'entrée — personnage + localisation. Il ne part pas au serveur (`entryForServer`) : il sert au
// découpage en lots (`chunkEntries`), qui ne sépare jamais un Test (le serveur refuse une localisation à moitié répondue).
const healingEntry = (echeanceId, mjChoice, group) => ({ echeanceId, mjChoice, ...(group === undefined ? {} : { group }) })
const infectionEntry = (echeanceId, mode) => ({ echeanceId, mode })

// Ce que le serveur reçoit d'une entrée (jamais les champs propres au client).
export const entryForServer = ({ echeanceId, mjChoice, mode }) => (mjChoice === undefined ? { echeanceId, mode } : { echeanceId, mjChoice })

// ─── Entrées envoyées ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Une localisation = UN Test (RAW « Localisation par Localisation », REGLEBLESSURES.md:386-392) : la réponse vaut pour toutes ses échéances échues, quelle
// que soit la gravité (le serveur refuse toute autre forme).
export function healingEntriesForLocation(card, location, outcome) {
  const group = `${card.characterId}:${location.location}`
  return location.answerable ? location.dueEcheanceIds.map(id => healingEntry(id, outcome, group)) : []
}

export function healingEntriesForCard(card, outcome) {
  return card.locations.flatMap(location => healingEntriesForLocation(card, location, outcome))
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

// Le serveur refuse tout le lot au-delà de REVIEW_BATCH_MAX_ENTRIES : un geste sur beaucoup de personnages est envoyé en plusieurs lots. Un Test (des entrées
// consécutives du même `group`) n'est JAMAIS coupé entre deux lots ; une entrée sans groupe est seule.
export function chunkEntries(entries, size = REVIEW_BATCH_MAX_ENTRIES) {
  const units = []
  for (const entry of entries) {
    const last = units[units.length - 1]
    if (last && entry?.group !== undefined && last[0]?.group === entry.group) last.push(entry)
    else units.push([entry])
  }
  const chunks = []
  let current = []
  for (const unit of units) {
    if (current.length > 0 && current.length + unit.length > size) { chunks.push(current); current = [] }
    current.push(...unit)
  }
  if (current.length > 0) chunks.push(current)
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
  return card.locations.reduce((total, location) => total + location.dueEcheanceIds.length, 0)
    + card.infections.filter(i => i.answerable).length
    + card.orphans.filter(o => o.answerable).length
}

// Cases de blessure concernées par la réponse « toute la carte » (phrase de la carte : « 6 cases de blessure »).
export function cardDueCases(card) {
  return card.locations.reduce((total, location) => total + location.dueCases, 0)
}

export function splitByPlayerType(cards) {
  return { players: cards.filter(c => c.isPlayer), npcs: cards.filter(c => !c.isPlayer) }
}

// ─── Conséquence de « Réussite » ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Ce que fait « Réussite » sur une gravité d'une localisation (`line` = le détail par gravité de la vue), d'après les champs du serveur (le client ne calcule rien) :
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

// « semaine n/N » d'une gravité : les étapes distinctes de ses cases échues (elle peut mêler des étapes différentes).
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
