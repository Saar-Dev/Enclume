// server/src/lib/woundReviewBatchService.js — Résolution GROUPÉE des échéances de l'écran de revue MJ (PLAN_REVUE_GUERISON.md §10-§11) :
// le MJ répond à plusieurs guérisons (ou infections) d'un coup — d'un personnage entier, de plusieurs, ou d'une seule blessure. Un seul contrat
// pour les deux gestes. Les routes (campaigns.js) restent minces : validation, appel de ce service, réponse.
//
// Garanties :
// - UNE transaction, mais un SAVEPOINT PAR ENTRÉE : le moteur d'échéances avale l'échec d'un handler et passerait l'échéance en `error` définitif
//   (une blessure sans échéance vivante, en silence) ; ici l'entrée est ANNULÉE — l'échéance reste en attente, le MJ peut recommencer — et
//   rapportée (`error: true`). Une échéance périmée (déjà résolue, annulée entre-temps) ou pas encore ouverte (`active`, prochaine ronde) est
//   rapportée `stale`, sans faire échouer le lot. Une erreur inattendue (SQL) annule TOUT le lot : jamais un état à moitié.
// - Les diffusions partent APRÈS la validation : `GAME_ECHEANCE_RESOLVED` pour chaque échéance résolue ET pour celles passées à `cancelled` pendant le
//   lot (annulées avec leur case par un handler : leur ligne reste sinon affichée), `WOUND_UPDATED` une fois par personnage touché.
import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { WS } from '../../../shared/events.js'
import { resolveEcheanceNow } from './echeanceService.js'
import { computeWoundInfectionThreshold } from './woundEvolutionService.js'
import { resolvePolarisTest } from './polarisTestService.js'
import { broadcastWoundUpdate } from './woundReviewService.js'
import { emitSystemNotice } from './systemNotice.js'

const MAX_CHOICES = 200
const HEALING_CHOICES = ['amelioration', 'echec', 'catastrophe']
const INFECTION_MODES = ['auto', 'player']
const CARE_PROVIDERS = ['none', 'character', 'npc', 'hospital', 'professional']
const CARE_EQUIPMENT = ['complete', 'partial', 'none']
const CARE_NAME_MAX_LENGTH = 60
const ANSWERABLE_STATUSES = ['pending_mj_review', 'awaiting_player_roll']
const LIVE_STATUSES = ['active', ...ANSWERABLE_STATUSES]
const WOUND_ECHEANCE_TYPES = ['wound_healing_check', 'wound_infection_check']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Signal interne : le moteur a signalé une erreur de handler pour cette entrée — on annule son savepoint.
class EntryRolledBack extends Error {}

// ─── Validation ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function parseChoices(choices, valueKey, allowed) {
  if (!Array.isArray(choices) || choices.length === 0) throw new AppError(400, 'choices : une liste non vide est requise')
  if (choices.length > MAX_CHOICES) throw new AppError(400, `choices : ${MAX_CHOICES} entrées au maximum`)
  const seen = new Set()
  return choices.map((choice) => {
    if (!choice || typeof choice.echeanceId !== 'string' || !UUID_PATTERN.test(choice.echeanceId)) {
      throw new AppError(400, 'choices : echeanceId invalide')
    }
    if (!allowed.includes(choice[valueKey])) throw new AppError(400, `choices : ${valueKey} invalide (${choice[valueKey]})`)
    if (seen.has(choice.echeanceId)) throw new AppError(400, `choices : échéance en double (${choice.echeanceId})`)
    seen.add(choice.echeanceId)
    return { echeanceId: choice.echeanceId, value: choice[valueKey] }
  })
}

// Toutes les échéances visées existent, sont de CETTE campagne et du bon type : sinon la demande entière est refusée (rien n'est écrit).
async function assertEcheancesBelong(campaignId, entries, conditionType) {
  const ids = entries.map(e => e.echeanceId)
  const rows = await db('game_echeances').whereIn('id', ids).where({ campaign_id: campaignId }).select('id', 'condition_type')
  if (rows.length !== ids.length) throw new AppError(404, 'Échéance introuvable pour cette campagne')
  if (rows.some(r => r.condition_type !== conditionType)) throw new AppError(400, `Toutes les échéances doivent être de type ${conditionType}`)
}

// Contexte de soins déclaré par le MJ (facultatif : absent = rien n'est déclaré, rien n'est raconté). Non stocké : le chat est la trace.
async function parseCare(care, campaignId) {
  if (care === undefined || care === null) return null
  if (typeof care !== 'object') throw new AppError(400, 'care : objet attendu')
  if (!CARE_PROVIDERS.includes(care.provider)) throw new AppError(400, `care.provider invalide (${care.provider})`)
  if (!CARE_EQUIPMENT.includes(care.equipment)) throw new AppError(400, `care.equipment invalide (${care.equipment})`)

  let providerLabel = ''
  if (care.provider === 'character') {
    if (typeof care.providerCharacterId !== 'string' || !UUID_PATTERN.test(care.providerCharacterId)) {
      throw new AppError(400, 'care.providerCharacterId invalide')
    }
    const provider = await db('characters').where({ id: care.providerCharacterId, campaign_id: campaignId }).first('name')
    if (!provider) throw new AppError(400, 'care.providerCharacterId : personnage inconnu de cette campagne')
    providerLabel = provider.name
  } else if (care.provider === 'npc') {
    // Texte libre écrit par le MJ, repris tel quel dans le chat : caractères de contrôle et sauts de ligne retirés, longueur bornée.
    providerLabel = String(care.providerName ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CARE_NAME_MAX_LENGTH)
    if (!providerLabel) throw new AppError(400, 'care.providerName requis pour un soignant PNJ')
  }
  return { provider: care.provider, equipment: care.equipment, providerLabel }
}

// ─── Exécution d'un lot ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function runBatch(campaignId, entries, applyEntry) {
  // Échéances vivantes AVANT le lot : celles qui passent à `cancelled` pendant le lot ont été annulées avec leur case par un handler.
  const liveBefore = await db('game_echeances')
    .where({ campaign_id: campaignId }).whereIn('condition_type', WOUND_ECHEANCE_TYPES).whereIn('status', LIVE_STATUSES).pluck('id')

  const results = []
  await db.transaction(async (trx) => {
    for (const entry of entries) {
      try {
        const outcome = await trx.transaction(savepoint => applyEntry(savepoint, campaignId, entry))
        results.push({ echeanceId: entry.echeanceId, ...outcome })
      } catch (err) {
        if (!(err instanceof EntryRolledBack)) throw err
        results.push({ echeanceId: entry.echeanceId, resolved: false, error: true })
      }
    }
  })

  const cancelledDuringBatch = liveBefore.length > 0
    ? await db('game_echeances').whereIn('id', liveBefore).where({ status: 'cancelled' }).pluck('id')
    : []
  return { results, cancelledDuringBatch }
}

async function lockAnswerable(savepoint, campaignId, echeanceId) {
  const row = await savepoint('game_echeances').where({ id: echeanceId, campaign_id: campaignId }).forUpdate().first()
  return row && ANSWERABLE_STATUSES.includes(row.status) ? row : null
}

const mergeIntoPayload = (savepoint, echeanceId, patch) => savepoint('game_echeances').where({ id: echeanceId })
  .update({ payload: savepoint.raw('payload || ?::jsonb', [JSON.stringify(patch)]) })

// Une guérison : fusion ATOMIQUE de l'issue dans le payload (jamais lire-puis-écrire), puis résolution par le moteur.
async function applyHealingEntry(savepoint, campaignId, { echeanceId, value: mjChoice }) {
  const row = await lockAnswerable(savepoint, campaignId, echeanceId)
  if (!row) return { resolved: false, stale: true }
  await mergeIntoPayload(savepoint, row.id, { mjChoice })
  const outcome = await resolveEcheanceNow(savepoint, row.id)
  if (outcome.error) throw new EntryRolledBack()
  return { resolved: Boolean(outcome.resolved), characterId: row.character_id, woundId: row.payload?.woundId ?? null, choice: mjChoice }
}

// Une infection : `player` bascule seulement le statut (le jet arrive par socket) ; `auto` calcule le seuil, lance le jet serveur et résout.
async function applyInfectionEntry(savepoint, campaignId, { echeanceId, value: mode }) {
  const row = await lockAnswerable(savepoint, campaignId, echeanceId)
  if (!row) return { resolved: false, stale: true }
  const woundId = row.payload?.woundId ?? null

  if (mode === 'player') {
    if (row.status === 'pending_mj_review') {
      await savepoint('game_echeances').where({ id: row.id }).update({ status: 'awaiting_player_roll' })
    }
    return { resolved: false, status: 'awaiting_player_roll' }
  }

  const wound = woundId ? await savepoint('character_wounds').where({ id: woundId }).first() : null
  if (wound) { // sans blessure, le handler termine l'échéance sans jet
    const threshold = await computeWoundInfectionThreshold(savepoint, wound, row.payload?.periodesSansSoin ?? 0)
    await mergeIntoPayload(savepoint, row.id, { rollResult: await resolvePolarisTest(threshold) })
  }
  const outcome = await resolveEcheanceNow(savepoint, row.id)
  if (outcome.error) throw new EntryRolledBack()
  return { resolved: Boolean(outcome.resolved), status: outcome.resolved ? 'resolved' : undefined, characterId: row.character_id, woundId }
}

// ─── Diffusions (APRÈS la validation) ───────────────────────────────────────────────────────────────────────────────────────────────

async function emitBatchEffects(io, campaignId, results, cancelledDuringBatch) {
  const resolved = results.filter(r => r.resolved)
  const resolvedIds = new Set(resolved.map(r => r.echeanceId))
  for (const echeanceId of [...resolvedIds, ...cancelledDuringBatch.filter(id => !resolvedIds.has(id))]) {
    io.to(campaignId).emit(WS.GAME_ECHEANCE_RESOLVED, { echeanceId })
  }

  // Une mise à jour de fiche par personnage touché (le client relit la liste des blessures à chaque diffusion).
  const woundIdByCharacter = new Map()
  for (const { characterId, woundId } of resolved) if (characterId && !woundIdByCharacter.has(characterId)) woundIdByCharacter.set(characterId, woundId)
  for (const [characterId, woundId] of woundIdByCharacter) {
    const sheet = await db('char_sheet').where({ character_id: characterId }).first('id')
    if (sheet) await broadcastWoundUpdate(io, campaignId, { characterId, charSheetIdForWorst: sheet.id, woundId })
  }
}

// Une ligne de chat par personnage ET par issue : qui a soigné, avec quel matériel, quel résultat (règle « le chat raconte toute décision »).
// Texte résolu côté client par `combat:woundCare.notice` (clés i18n, jamais de texte figé ici).
async function emitCareNotices(io, campaignId, results, care) {
  if (!care) return
  const counts = new Map()
  for (const { characterId, choice } of results.filter(r => r.resolved && r.characterId && r.choice)) {
    const key = `${characterId}|${choice}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return
  const characterIds = [...new Set([...counts.keys()].map(key => key.split('|')[0]))]
  const names = Object.fromEntries((await db('characters').whereIn('id', characterIds).select('id', 'name')).map(c => [c.id, c.name]))
  for (const [key, count] of counts) {
    const [characterId, outcome] = key.split('|')
    emitSystemNotice(io, campaignId, 'combat:woundCare.notice', {
      label: names[characterId] ?? '?', outcome, cases: count, provider: care.provider, providerName: care.providerLabel, equipment: care.equipment,
    })
  }
}

const publicResult = ({ echeanceId, resolved, stale, error, status }) => ({
  echeanceId, resolved, ...(stale ? { stale: true } : {}), ...(error ? { error: true } : {}), ...(status ? { status } : {}),
})

// ─── API ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// corps { choices: [{ echeanceId, mjChoice }], care? } — réponse { results: [{ echeanceId, resolved, stale?, error? }] }.
export async function resolveHealingChoices(io, campaignId, { choices, care } = {}) {
  const entries = parseChoices(choices, 'mjChoice', HEALING_CHOICES)
  const parsedCare = await parseCare(care, campaignId)
  await assertEcheancesBelong(campaignId, entries, 'wound_healing_check')

  const { results, cancelledDuringBatch } = await runBatch(campaignId, entries, applyHealingEntry)
  await emitBatchEffects(io, campaignId, results, cancelledDuringBatch)
  await emitCareNotices(io, campaignId, results, parsedCare)
  return { results: results.map(publicResult) }
}

// corps { choices: [{ echeanceId, mode }] } — mode `auto` (jet serveur, résolution immédiate) ou `player` (le joueur lance son jet).
export async function resolveInfectionModes(io, campaignId, { choices } = {}) {
  const entries = parseChoices(choices, 'mode', INFECTION_MODES)
  await assertEcheancesBelong(campaignId, entries, 'wound_infection_check')

  const { results, cancelledDuringBatch } = await runBatch(campaignId, entries, applyInfectionEntry)
  await emitBatchEffects(io, campaignId, results, cancelledDuringBatch)
  return { results: results.map(publicResult) }
}
