import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { sweepDueEcheances, previewDueEcheances } from './echeanceService.js'

function assertValidDelta(deltaMinutes) {
  if (!Number.isInteger(deltaMinutes) || deltaMinutes === 0) {
    throw new AppError(400, 'deltaMinutes doit être un entier signé non nul')
  }
}

// game_time_minutes / game_time_resolved_minutes sont des colonnes `integer` Postgres (migration 217)
// — écrire hors de ce range fait planter la requête SQL (erreur Postgres brute, remontée telle quelle
// au client par errorHandler.js sur un 500). Vérifié ici, au point unique où displayedAfter/
// resolvedAfter sont réellement calculés avant écriture (performTimeAdjustment, partagé par les 3
// points d'entrée qui écrivent ces colonnes) plutôt que sur deltaMinutes seul : c'est la somme, pas le
// delta isolé, qui doit tenir dans la colonne.
const PG_INTEGER_MIN = -2147483648
const PG_INTEGER_MAX = 2147483647

function assertWithinPgInteger(value, label) {
  if (value < PG_INTEGER_MIN || value > PG_INTEGER_MAX) {
    throw new AppError(400, `${label} dépasserait les bornes de l'entier Postgres (${PG_INTEGER_MIN} à ${PG_INTEGER_MAX})`)
  }
}

// Mutation brute (campagne déjà verrouillée par l'appelant, FOR UPDATE) — jamais exportée seule,
// aucun garde ici : adjustGameTime et confirmPendingAdvance ont chacun leur propre condition
// d'appel légitime (l'un refuse un saut pendant qu'un autre est en attente, l'autre est précisément
// en train de le résoudre — un garde unique partagé se contredirait entre les deux).
async function performTimeAdjustment(trx, campaign, deltaMinutes) {
  const displayedBefore = campaign.game_time_minutes
  const resolvedBefore = campaign.game_time_resolved_minutes
  const displayedAfter = displayedBefore + deltaMinutes
  const resolvedAfter = Math.max(resolvedBefore, displayedAfter)
  assertWithinPgInteger(displayedAfter, 'game_time_minutes')
  assertWithinPgInteger(resolvedAfter, 'game_time_resolved_minutes')

  await trx('campaigns').where({ id: campaign.id }).update({
    game_time_minutes: displayedAfter,
    game_time_resolved_minutes: resolvedAfter,
  })

  // Balayage automatique appelé depuis l'intérieur de cette transaction, jamais depuis la route
  // après coup (docs/PLAN_FATIGUE_DOMMAGES.md §8, analyse à charge point 1).
  // effects (§11 Lot 5, Trou A) : les 3 appelants de performTimeAdjustment retournent ou étalent déjà
  // cet objet tel quel — rien d'autre à changer dans ce fichier pour que ça remonte jusqu'à la route.
  const effects = await sweepDueEcheances(trx, campaign.id, resolvedAfter)

  return { displayedBefore, displayedAfter, resolvedBefore, resolvedAfter, effects }
}

// docs/PLAN_FATIGUE_DOMMAGES.md §7 (Lot 1) — mutateur unique de l'horloge de campagne.
// game_time_minutes = compteur affiché/narratif, déplaçable dans les deux sens par le MJ.
// game_time_resolved_minutes = repère mécanique, strictement non-décroissant (GREATEST), jamais
// affiché — c'est resolvedBefore/resolvedAfter que le balayage du Lot 2 consomme, jamais
// displayed*. Un recul (deltaMinutes < 0) ou une avance qui reste sous resolved déjà atteint laisse
// resolved inchangé -> aucun effet mécanique, aucune double résolution (analyse à charge point 8).
// Garde ajoutée en Lot 2 : refuse tant qu'une avance est déjà en attente de revue pour cette
// campagne (pending_advance_delta_minutes) — un appel direct ne doit jamais court-circuiter le
// verrou "un seul saut à la fois" posé par requestGameTimeAdvance.
export async function adjustGameTime(campaignId, deltaMinutes) {
  assertValidDelta(deltaMinutes)

  return db.transaction(async (trx) => {
    const campaign = await trx('campaigns').where({ id: campaignId }).forUpdate().first()
    if (!campaign) throw new AppError(404, 'Campaign not found')
    if (campaign.pending_advance_delta_minutes !== null) {
      throw new AppError(409, 'Une avance de temps est déjà en attente de revue pour cette campagne')
    }
    return performTimeAdjustment(trx, campaign, deltaMinutes)
  })
}

// Point d'entrée recommandé pour le widget MJ (Lot 2) — remplace un appel direct à adjustGameTime.
// Chemin rapide inchangé (aucune échéance interactive due) : le widget ne voit pas la différence
// dans le cas courant. Sinon : pose l'avance en attente, marque les échéances dues pour revue,
// n'avance jamais le compteur tant que la revue n'est pas confirmée.
export async function requestGameTimeAdvance(campaignId, deltaMinutes) {
  assertValidDelta(deltaMinutes)

  return db.transaction(async (trx) => {
    const campaign = await trx('campaigns').where({ id: campaignId }).forUpdate().first()
    if (!campaign) throw new AppError(404, 'Campaign not found')
    if (campaign.pending_advance_delta_minutes !== null) {
      throw new AppError(409, 'Une avance de temps est déjà en attente de revue pour cette campagne')
    }

    const displayedAfter = campaign.game_time_minutes + deltaMinutes
    const resolvedAfter = Math.max(campaign.game_time_resolved_minutes, displayedAfter)
    // Vérifié avant previewDueEcheances (pas seulement dans performTimeAdjustment plus bas) : sinon
    // un delta hors bornes serait comparé tel quel à next_due_minutes (colonne integer) par cette
    // requête, ou pire, silencieusement posé en pending_advance_delta_minutes pour échouer seulement
    // plus tard à la confirmation.
    assertWithinPgInteger(displayedAfter, 'game_time_minutes')
    assertWithinPgInteger(resolvedAfter, 'game_time_resolved_minutes')
    const dueInteractive = await previewDueEcheances(campaignId, resolvedAfter)

    if (dueInteractive.length === 0) {
      const result = await performTimeAdjustment(trx, campaign, deltaMinutes)
      return { pending: false, ...result }
    }

    await trx('campaigns').where({ id: campaignId }).update({ pending_advance_delta_minutes: deltaMinutes })
    const ids = dueInteractive.map((e) => e.id)
    // pending_mj_review par défaut pour toutes — aucun consommateur actuel ne demande encore le
    // contournement "awaiting_player_roll direct" évoqué au plan (§8) ; à ajouter via le registre
    // (ex. entry.defaultToPlayerRoll) le jour où un consommateur réel en a besoin, pas avant.
    await trx('game_echeances').whereIn('id', ids).update({ status: 'pending_mj_review' })
    const echeances = await trx('game_echeances').whereIn('id', ids).select('*')
    return { pending: true, echeances }
  })
}

// Revérifie previewDueEcheances à l'instant de la confirmation — toute échéance nouvellement due
// depuis la proposition rejoint le lot en pending_mj_review, confirmation refusée (pas de perte
// silencieuse d'une échéance apparue entre-temps). N'appelle plus aucun handler interactif : ils
// sont déjà résolus un par un via resolveEcheanceNow au fil de l'eau — seule l'avance du compteur
// reste à faire ici.
export async function confirmPendingAdvance(campaignId) {
  // Tout se joue dans une seule transaction/un seul verrou — y compris le marquage `pending_mj_review`
  // d'une échéance nouvellement due en cas de refus. Correction 2026-07-30 (trouvée en testant) :
  // une version antérieure levait l'AppError *à l'intérieur* du db.transaction() dès qu'un refus
  // était détecté — knex fait alors un ROLLBACK complet, y compris le marquage qu'on venait de faire
  // juste avant. Corrigé en ne levant jamais d'erreur depuis l'intérieur du callback transactionnel :
  // le callback retourne un descripteur d'issue, la transaction committe toujours (le marquage
  // survit), l'AppError n'est levée qu'après coup, sur la base du descripteur retourné.
  const outcome = await db.transaction(async (trx) => {
    const campaign = await trx('campaigns').where({ id: campaignId }).forUpdate().first()
    if (!campaign) throw new AppError(404, 'Campaign not found')
    if (campaign.pending_advance_delta_minutes === null) {
      throw new AppError(409, 'Aucune avance de temps en attente pour cette campagne')
    }

    const stillUnresolved = await trx('game_echeances')
      .where({ campaign_id: campaignId })
      .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
      .select('id')
    if (stillUnresolved.length > 0) {
      return { refused: 'unresolved', count: stillUnresolved.length }
    }

    // Requête équivalente à previewDueEcheances, mais sur trx (pas db) : ce contrôle doit rester
    // sous le même verrou que tout le reste de cette transaction, previewDueEcheances ne le permet
    // pas (elle interroge db exprès, lecture seule hors transaction — voir sa propre définition).
    const displayedAfter = campaign.game_time_minutes + campaign.pending_advance_delta_minutes
    const resolvedAfter = Math.max(campaign.game_time_resolved_minutes, displayedAfter)
    const newlyDue = await trx('game_echeances')
      .where({ campaign_id: campaignId, status: 'active', interactive: true })
      .where('next_due_minutes', '<=', resolvedAfter)
      .select('id')
    if (newlyDue.length > 0) {
      const ids = newlyDue.map((e) => e.id)
      await trx('game_echeances').whereIn('id', ids).update({ status: 'pending_mj_review' })
      return { refused: 'newlyDue', count: newlyDue.length }
    }

    const result = await performTimeAdjustment(trx, campaign, campaign.pending_advance_delta_minutes)
    await trx('campaigns').where({ id: campaignId }).update({
      pending_advance_delta_minutes: null,
      pending_advance_undo_log: null,
    })
    return { result }
  })

  if (outcome.refused === 'unresolved') {
    throw new AppError(409, `${outcome.count} échéance(s) encore en attente d'une réponse`)
  }
  if (outcome.refused === 'newlyDue') {
    throw new AppError(409, 'De nouvelles échéances interactives sont dues depuis la proposition — revue à refaire')
  }
  return outcome.result
}

// Rejoue pending_advance_undo_log en sens inverse (dernière entrée d'abord) — algorithme générique
// à 3 cas basé uniquement sur { table, rowId, previousValues }, aucune connaissance métier requise
// (docs/PLAN_FATIGUE_DOMMAGES.md §8, correction point 9).
async function replayUndoEntry(trx, { table, rowId, previousValues }) {
  const existing = await trx(table).where({ id: rowId }).first()
  if (previousValues !== null && existing) {
    await trx(table).where({ id: rowId }).update(previousValues)
  } else if (previousValues === null && existing) {
    await trx(table).where({ id: rowId }).del()
  } else if (previousValues !== null && !existing) {
    await trx(table).insert(previousValues)
  }
  // previousValues === null && !existing : rien à faire, déjà cohérent.
}

// Défait les effets déjà appliqués par resolveEcheanceNow (pas seulement l'avance du compteur,
// décidé Saar 2026-07-29) puis repasse tout à active.
export async function cancelPendingAdvance(campaignId) {
  return db.transaction(async (trx) => {
    const campaign = await trx('campaigns').where({ id: campaignId }).forUpdate().first()
    if (!campaign) throw new AppError(404, 'Campaign not found')
    if (campaign.pending_advance_delta_minutes === null) {
      throw new AppError(409, 'Aucune avance de temps en attente pour cette campagne')
    }

    const undoLog = campaign.pending_advance_undo_log ?? []
    for (const entry of [...undoLog].reverse()) {
      await replayUndoEntry(trx, entry)
    }

    await trx('game_echeances')
      .where({ campaign_id: campaignId })
      .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
      .update({ status: 'active' })

    await trx('campaigns').where({ id: campaignId }).update({
      pending_advance_delta_minutes: null,
      pending_advance_undo_log: null,
    })
  })
}
