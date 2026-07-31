import { Router } from 'express'
import { randomUUID } from 'crypto'
import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { multerUpload, multerGlb } from '../middleware/upload.js'
import getMinioClient, { BUCKET } from '../lib/minio.js'
import { WS } from '../../../shared/events.js'
import { SETTINGS_SCHEMA, mergeWithDefaults } from '../lib/campaignSettingsService.js'
import { adjustGameTime, requestGameTimeAdvance, confirmPendingAdvance, cancelPendingAdvance } from '../lib/gameTimeService.js'
import { resolveEcheanceNow } from '../lib/echeanceService.js'
import { computeWoundInfectionThreshold } from '../lib/woundEvolutionService.js'
import { getWorstWoundSeverity } from '../lib/woundUtils.js'
import { resolvePolarisTest } from '../lib/polarisTestService.js'
import { getPendingReviewForGm, getPendingRollsForPlayer, broadcastWoundUpdate } from '../lib/woundReviewService.js'
import { resolveFall } from '../lib/fallDamageService.js'
import { exposeToHazard, clearHazard } from '../lib/environmentalHazardService.js'
import { applyStunWithDuration } from '../lib/statusService.js'
import {
  declareColdExposure, clearColdExposure, getColdExposureState, applyColdDamageHits,
} from '../lib/coldExposureService.js'

const router = Router()

// ─── Constantes dés ────────────────────────────────────────────────────────────
const VALID_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

/**
 * Valide la structure dice_config avant toute écriture en base.
 *
 * Structure attendue :
 * {
 *   "d20": { "success": { "min": 18, "max": 20 }, "fail": { "min": 1, "max": 1 } },
 *   "d6":  { "success": { "min": 6,  "max": 6  }, "fail": null },
 *   "d100":{ "success": null, "fail": { "min": 1, "max": 5 } }
 * }
 *
 * Règles :
 * - null accepté (désactive tous les critiques)
 * - objet : seules les clés VALID_DICE sont acceptées
 * - success et fail : null ou { min, max } avec 1 <= min <= max <= faces du dé
 *
 * @param {any} config
 * @throws {AppError} si la structure est invalide
 */
function validateDiceConfig(config) {
  if (config === null || config === undefined) return

  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new AppError(400, 'dice_config must be an object or null')
  }

  for (const [die, value] of Object.entries(config)) {
    if (!VALID_DICE.includes(die)) {
      throw new AppError(400, `dice_config: unknown die type "${die}". Valid types: ${VALID_DICE.join(', ')}`)
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError(400, `dice_config.${die} must be an object`)
    }

    const faces = DICE_FACES[die]

    for (const critType of ['success', 'fail']) {
      const crit = value[critType]
      if (crit === null || crit === undefined) continue

      if (typeof crit !== 'object' || Array.isArray(crit)) {
        throw new AppError(400, `dice_config.${die}.${critType} must be an object or null`)
      }

      const { min, max } = crit

      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new AppError(400, `dice_config.${die}.${critType}: min and max must be integers`)
      }

      if (min < 1) {
        throw new AppError(400, `dice_config.${die}.${critType}.min must be >= 1`)
      }

      if (max > faces) {
        throw new AppError(400, `dice_config.${die}.${critType}.max must be <= ${faces} (faces of ${die})`)
      }

      if (min > max) {
        throw new AppError(400, `dice_config.${die}.${critType}: min (${min}) must be <= max (${max})`)
      }
    }
  }
}

async function removeCampaignAssets(campaignId) {
  const client = getMinioClient()
  const bucket = BUCKET()
  const prefix = `campaigns/${campaignId}/`
  const objectNames = []

  await new Promise((resolve, reject) => {
    const stream = client.listObjectsV2(bucket, prefix, true)
    stream.on('data', obj => {
      if (obj?.name) objectNames.push(obj.name)
    })
    stream.on('error', reject)
    stream.on('end', resolve)
  })

  if (objectNames.length > 0) {
    await client.removeObjects(bucket, objectNames)
  }
}

// GET /api/campaigns — liste des campagnes de l'utilisateur
router.get('/', requireAuth, async (req, res) => {
  const campaigns = await db('campaigns')
    .join('campaign_members', 'campaigns.id', 'campaign_members.campaign_id')
    .where('campaign_members.user_id', req.user.id)
    .select(
      'campaigns.id',
      'campaigns.name',
      'campaigns.status',
      'campaigns.invite_code',
      'campaigns.cover_url',
      'campaigns.created_at',
      'campaign_members.role'
    )
  res.json({ campaigns })
})

// POST /api/campaigns — créer une campagne
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name) throw new AppError(400, 'Campaign name is required')

  const invite_code = randomUUID().split('-')[0]

  // Transaction : campagne + battlemap vide + default_battlemap_id en une seule opération
  const campaign = await db.transaction(async (trx) => {
    // 1. Créer la campagne
    const [newCampaign] = await trx('campaigns')
      .insert({ name, gm_id: req.user.id, invite_code })
      .returning(['id', 'name', 'status', 'invite_code', 'created_at'])

    // 2. Créer le membre GM
    await trx('campaign_members').insert({
      campaign_id: newCampaign.id,
      user_id: req.user.id,
      role: 'gm',
    })

    // 3. Créer la battlemap d'accueil par défaut
    const [defaultMap] = await trx('battlemaps')
      .insert({
        campaign_id: newCampaign.id,
        name: "Carte d'accueil",
      })
      .returning(['id'])

    // 4. Définir cette battlemap comme carte d'accueil de la campagne
    await trx('campaigns')
      .where({ id: newCampaign.id })
      .update({ default_battlemap_id: defaultMap.id })

    return { ...newCampaign, default_battlemap_id: defaultMap.id }
  })

  res.status(201).json({ campaign })
})

// GET /api/campaigns/:id — détail d'une campagne
// Accessible à tous les membres (GM et joueurs)
router.get('/:id', requireAuth, async (req, res) => {
  const member = await db('campaign_members')
    .where({ campaign_id: req.params.id, user_id: req.user.id })
    .first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')

  const campaign = await db('campaigns')
    .where({ 'campaigns.id': req.params.id })
    .first()
  if (!campaign) throw new AppError(404, 'Campaign not found')
  // game_time_resolved_minutes est un repère mécanique interne (docs/PLAN_FATIGUE_DOMMAGES.md §7,
  // Lot 1) — jamais montré au MJ, à retirer explicitement avant toute réponse client.
  delete campaign.game_time_resolved_minutes
  // Merge avec les défauts du schéma (source unique campaignSettingsService.js) — sans ça, toute
  // clé jamais sauvegardée par le MJ est absente du JSONB et force chaque consommateur client à
  // dupliquer sa propre copie clé→défaut (cause racine UI4, docs/BUGIDENTIFIE.md).
  campaign.settings = mergeWithDefaults(campaign.settings)

  const members = await db('campaign_members')
    .join('users', 'campaign_members.user_id', 'users.id')
    .where('campaign_members.campaign_id', req.params.id)
    .select(
      'users.id',
      'users.username',
      'campaign_members.role',
      'campaign_members.character_name'
    )

  res.json({ campaign, members })
})

// PUT /api/campaigns/:id — modifier une campagne
router.put('/:id', requireAuth, requireRole('gm'), async (req, res) => {
  const { name, status, default_battlemap_id, dice_config, default_token_glb_url, settings } = req.body
  const updates = {}
  if (name !== undefined) updates.name = name
  if (status !== undefined) updates.status = status
  if (default_battlemap_id !== undefined) updates.default_battlemap_id = default_battlemap_id

  // dice_config — validation avant écriture
  if (dice_config !== undefined) {
    validateDiceConfig(dice_config)
    updates.dice_config = dice_config === null ? null : JSON.stringify(dice_config)
  }

  if (default_token_glb_url !== undefined) {
    updates.default_token_glb_url = default_token_glb_url === null ? null : String(default_token_glb_url)
  }

  // settings — validation par clé contre SETTINGS_SCHEMA (source unique, partagée avec campaignSettingsService)
  if (settings !== undefined) {
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new AppError(400, 'settings must be a JSON object')
    }

    for (const [key, value] of Object.entries(settings)) {
      const schema = SETTINGS_SCHEMA[key]
      if (!schema) throw new AppError(400, `Clé settings inconnue : ${key}`)

      if (typeof value !== schema.type) {
        throw new AppError(400, `Type invalide pour settings.${key} : attendu ${schema.type}, reçu ${typeof value}`)
      }
      if (schema.enum && !schema.enum.includes(value)) {
        throw new AppError(400, `settings.${key} doit être l'une des valeurs : ${schema.enum.join(', ')}`)
      }
      if (key === 'action_timer_sec' && (!Number.isInteger(value) || value < 0)) {
        throw new AppError(400, 'settings.action_timer_sec doit être un entier ≥ 0')
      }
      if (key === 'encumbrance_multiplier' && !(value > 0)) {
        throw new AppError(400, 'settings.encumbrance_multiplier doit être > 0')
      }
      if (key === 'calendar_start_year' && (!Number.isInteger(value) || value < 1 || value > 9999)) {
        throw new AppError(400, 'settings.calendar_start_year doit être un entier entre 1 et 9999')
      }
      if (key === 'calendar_start_month' && (!Number.isInteger(value) || value < 1 || value > 12)) {
        throw new AppError(400, 'settings.calendar_start_month doit être un entier entre 1 et 12')
      }
      if (key === 'calendar_start_day' && (!Number.isInteger(value) || value < 1 || value > 31)) {
        throw new AppError(400, 'settings.calendar_start_day doit être un entier entre 1 et 31')
      }
    }

    // Merge JSONB atomique côté DB — évite une race condition entre deux sauvegardes concurrentes (pattern PC39)
    updates.settings = db.raw('settings || ?::jsonb', [JSON.stringify(settings)])
  }

  // updated_at systématique sur tout PUT
  updates.updated_at = db.fn.now()

  const [campaign] = await db('campaigns')
    .where({ id: req.params.id })
    .update(updates)
    .returning(['id', 'name', 'status', 'invite_code', 'default_battlemap_id', 'dice_config', 'default_token_glb_url', 'settings', 'created_at', 'updated_at'])
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_SETTINGS_UPDATED, { campaign })
  res.json({ campaign })
})

// processGameTimeEffects — consomme les `effects` remontés par adjustGameTime/requestGameTimeAdvance/
// confirmPendingAdvance (docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5, Trou A + correction "trouvée en
// codant") — appelé après le commit de la transaction d'ajustement d'horloge, jamais avant. Dispatch
// par `kind`, connaissance métier volontairement ici (le moteur d'échéances reste agnostique, voir
// echeanceService.js "ne connaît aucune règle métier").
async function processGameTimeEffects(io, campaignId, effects = []) {
  for (const effect of effects) {
    if (effect.kind === 'fatigueTestResult') {
      if (effect.applyStun) {
        for (const tokenId of effect.applyStun.tokenIds) {
          await applyStunWithDuration(
            io, db, campaignId, tokenId, effect.applyStun.statusOutcome, effect.applyStun.stunDuration,
            effect.applyStun.currentTurn, { statusCode: effect.applyStun.statusCode },
          )
        }
      }
      io.to(campaignId).emit(WS.FATIGUE_TEST_RESULT, effect.payload)
    } else if (effect.kind === 'coldDamageHits') {
      await applyColdDamageHits(io, effect.campaignId, effect.characterId, effect.hitSpecs)
    }
  }
}

// POST /api/campaigns/:id/game-time/adjust — ajuste l'horloge de campagne (docs/PLAN_FATIGUE_DOMMAGES.md §7)
// GM uniquement. minutes : entier signé non nul (positif = avance, négatif = recul).
// game_time_resolved_minutes ne quitte jamais le serveur (invariant de non-fuite) — ni ici, ni sur GET /:id.
router.post('/:id/game-time/adjust', requireAuth, requireRole('gm'), async (req, res) => {
  const { minutes } = req.body
  const { displayedAfter, effects } = await adjustGameTime(req.params.id, minutes)
  await processGameTimeEffects(req.app.get('io'), req.params.id, effects)
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_GAME_TIME_ADJUSTED, {
    campaignId: req.params.id,
    gameTimeMinutes: displayedAfter,
  })
  res.json({ gameTimeMinutes: displayedAfter })
})

// docs/PLAN_BLESSURES_GUERISON.md §6.1 (Lot 2, premier consommateur interactif) — remplace
// progressivement l'usage de /game-time/adjust par le widget une fois le client migré ; laissé en
// place tel quel pour l'instant (fonctionnel, testé, aucune raison de casser un appelant existant
// avant que le client soit prêt).
// POST /api/campaigns/:id/game-time/request-advance — GM uniquement, body { minutes }.
router.post('/:id/game-time/request-advance', requireAuth, requireRole('gm'), async (req, res) => {
  const { minutes } = req.body
  const result = await requestGameTimeAdvance(req.params.id, minutes)

  if (result.pending) {
    req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_ADVANCE_PENDING, { campaignId: req.params.id })
    return res.json({ pending: true })
  }

  await processGameTimeEffects(req.app.get('io'), req.params.id, result.effects)
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_GAME_TIME_ADJUSTED, {
    campaignId: req.params.id,
    gameTimeMinutes: result.displayedAfter,
  })
  res.json({ pending: false, gameTimeMinutes: result.displayedAfter })
})

// POST /api/campaigns/:id/game-time/confirm-advance — GM uniquement, sans body. Chaque échéance du
// lot a déjà été résolue individuellement (healing-choice/infection-mode/WOUND_INFECTION_ROLL, qui
// diffusent chacune leur propre WOUND_UPDATED) — ici, seul le compteur d'horloge avance.
router.post('/:id/game-time/confirm-advance', requireAuth, requireRole('gm'), async (req, res) => {
  let result
  try {
    result = await confirmPendingAdvance(req.params.id)
  } catch (err) {
    // Trouvé en traçant le flux Guérison→Infection de bout en bout (analyse à charge du chantier,
    // pas au premier passage) : un Échec de Guérison peut faire naître un wound_infection_check
    // *pendant* la revue en cours — confirmPendingAdvance le détecte et le marque pending_mj_review
    // en base (gameTimeService.js), mais sans ce broadcast, aucun client (y compris le MJ qui vient
    // de cliquer Confirmer) n'apprend qu'une nouvelle ligne vient d'apparaître : le panneau reste
    // affiché comme si de rien n'était jusqu'à un rechargement de page. Rejoue sur tout refus 409,
    // pas seulement ce cas précis — un rafraîchissement de trop est inoffensif, un manqué ne l'est pas.
    if (err.statusCode === 409) {
      req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_ADVANCE_PENDING, { campaignId: req.params.id })
    }
    throw err
  }

  await processGameTimeEffects(req.app.get('io'), req.params.id, result.effects)
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_GAME_TIME_ADJUSTED, {
    campaignId: req.params.id,
    gameTimeMinutes: result.displayedAfter,
  })
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_ADVANCE_RESOLVED, { campaignId: req.params.id })
  res.json({ gameTimeMinutes: result.displayedAfter })
})

// POST /api/campaigns/:id/game-time/cancel-advance — GM uniquement, sans body. Rejoue les undoEntries
// (Lot 2) en base silencieusement — contrairement à confirm-advance, aucun WOUND_UPDATED individuel
// n'a été émis pour ces restaurations. CAMPAIGN_ADVANCE_CANCELLED reste un signal générique (pas de
// liste de characterId précise pour l'instant — point non-bloquant déjà noté §6.1, différé) : les
// clients avec une fiche personnage ouverte doivent la rafraîchir par précaution à sa réception.
router.post('/:id/game-time/cancel-advance', requireAuth, requireRole('gm'), async (req, res) => {
  await cancelPendingAdvance(req.params.id)
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_ADVANCE_CANCELLED, { campaignId: req.params.id })
  res.json({ cancelled: true })
})

// GET /api/campaigns/:id/game-echeances/pending-review — GM uniquement. Enrichi (personnage,
// blessure) pour un écran humain — voir woundReviewService.js. Appelé au montage du panneau de revue
// et à la (re)connexion, pas seulement poussé par CAMPAIGN_ADVANCE_PENDING (sinon un MJ qui se
// reconnecte après l'ouverture d'une revue ne la découvre jamais).
router.get('/:id/game-echeances/pending-review', requireAuth, requireRole('gm'), async (req, res) => {
  const echeances = await getPendingReviewForGm(req.params.id)
  res.json({ echeances })
})

// GET /api/campaigns/:id/game-echeances/my-pending-rolls — tout membre. Un joueur ne voit que les
// jets de ses propres personnages ; un GM voit tous les jets en attente de la campagne.
router.get('/:id/game-echeances/my-pending-rolls', requireAuth, async (req, res) => {
  const member = await db('campaign_members').where({ campaign_id: req.params.id, user_id: req.user.id }).first()
  if (!member) throw new AppError(403, 'You are not a member of this campaign')
  const echeances = await getPendingRollsForPlayer(req.params.id, req.user.id, { isGm: member.role === 'gm' })
  res.json({ echeances })
})

// POST /api/campaigns/:id/game-echeances/:echeanceId/healing-choice — GM uniquement.
// body { mjChoice: 'amelioration'|'echec'|'catastrophe', soinsContinues?: boolean }.
router.post('/:id/game-echeances/:echeanceId/healing-choice', requireAuth, requireRole('gm'), async (req, res) => {
  const { mjChoice, soinsContinues } = req.body
  if (!['amelioration', 'echec', 'catastrophe'].includes(mjChoice)) {
    throw new AppError(400, `mjChoice invalide : ${mjChoice}`)
  }

  const echeance = await db('game_echeances').where({ id: req.params.echeanceId, campaign_id: req.params.id }).first()
  if (!echeance) throw new AppError(404, 'Échéance introuvable pour cette campagne')
  if (echeance.condition_type !== 'wound_healing_check') {
    throw new AppError(400, 'Cette échéance n\'est pas une Guérison')
  }
  const woundBefore = await db('character_wounds').where({ id: echeance.payload.woundId }).first()

  const patch = { mjChoice, ...(soinsContinues !== undefined ? { soinsContinues } : {}) }
  const result = await db.transaction(async (trx) => {
    // Fusion atomique — jamais lire-puis-écrire en JS, même patron que pending_advance_undo_log
    // (echeanceService.js) et le merge settings (PUT /:id ci-dessus).
    await trx('game_echeances').where({ id: echeance.id })
      .update({ payload: trx.raw('payload || ?::jsonb', [JSON.stringify(patch)]) })
    return resolveEcheanceNow(trx, echeance.id)
  })

  req.app.get('io').to(req.params.id).emit(WS.GAME_ECHEANCE_RESOLVED, { echeanceId: echeance.id })
  if (result.resolved && woundBefore) {
    await broadcastWoundUpdate(req.app.get('io'), req.params.id, {
      characterId: echeance.character_id, charSheetIdForWorst: woundBefore.char_sheet_id, woundId: echeance.payload.woundId,
    })
  }
  res.json({ resolved: result.resolved })
})

// POST /api/campaigns/:id/game-echeances/:echeanceId/infection-mode — GM uniquement.
// body { mode: 'auto' | 'player' }. `auto` résout immédiatement (seuil calculé, jet serveur).
// `player` bascule seulement le statut — le jet réel arrive via l'événement socket
// WOUND_INFECTION_ROLL (socketDice.js), pas par cette route.
router.post('/:id/game-echeances/:echeanceId/infection-mode', requireAuth, requireRole('gm'), async (req, res) => {
  const { mode } = req.body
  if (!['auto', 'player'].includes(mode)) throw new AppError(400, `mode invalide : ${mode}`)

  const echeance = await db('game_echeances').where({ id: req.params.echeanceId, campaign_id: req.params.id }).first()
  if (!echeance) throw new AppError(404, 'Échéance introuvable pour cette campagne')
  if (echeance.condition_type !== 'wound_infection_check') {
    throw new AppError(400, 'Cette échéance n\'est pas une Infection')
  }

  if (mode === 'player') {
    const updated = await db('game_echeances').where({ id: echeance.id, status: 'pending_mj_review' })
      .update({ status: 'awaiting_player_roll' })
    if (!updated) throw new AppError(409, `Échéance "${echeance.id}" n'est pas en attente de revue (status: ${echeance.status})`)
    return res.json({ status: 'awaiting_player_roll' })
  }

  const wound = await db('character_wounds').where({ id: echeance.payload.woundId }).first()
  if (!wound) throw new AppError(404, 'Blessure introuvable')

  const { rollResult, resolution } = await db.transaction(async (trx) => {
    const threshold = await computeWoundInfectionThreshold(trx, wound, echeance.payload.periodesSansSoin ?? 0)
    const roll = await resolvePolarisTest(threshold)
    await trx('game_echeances').where({ id: echeance.id })
      .update({ payload: trx.raw('payload || ?::jsonb', [JSON.stringify({ rollResult: roll })]) })
    const resolved = await resolveEcheanceNow(trx, echeance.id)
    return { rollResult: roll, resolution: resolved }
  })

  req.app.get('io').to(req.params.id).emit(WS.GAME_ECHEANCE_RESOLVED, { echeanceId: echeance.id })
  if (resolution.resolved) {
    await broadcastWoundUpdate(req.app.get('io'), req.params.id, {
      characterId: echeance.character_id, charSheetIdForWorst: wound.char_sheet_id, woundId: echeance.payload.woundId,
    })
  }
  res.json({ status: 'resolved', rollResult })
})

// ─── Lot 3 — Dommages environnementaux de combat (docs/PLAN_FATIGUE_DOMMAGES.md §9) ───────────────
// resolveCampaignToken — vérifie qu'un token appartient bien à cette campagne (tokens.battlemap_id ->
// battlemaps.campaign_id, tokens n'a pas de campaign_id propre) avant toute mutation ; utilisé par
// les 3 routes ci-dessous plutôt que dupliqué (une seule information, un seul endroit).
async function resolveCampaignToken(campaignId, tokenId) {
  const token = await db('tokens as t')
    .join('battlemaps as bm', 't.battlemap_id', 'bm.id')
    .where({ 't.id': tokenId, 'bm.campaign_id': campaignId })
    .select('t.id', 't.character_id')
    .first()
  if (!token) throw new AppError(404, 'Token introuvable pour cette campagne')
  return token
}

// POST /api/campaigns/:id/hazards/fall — GM uniquement. body { tokenId, heightMeters?, groundTrigger?,
// terrainAccidente?, attemptTest? } — heightMeters/groundTrigger mutuellement exclusifs, validés par
// resolveFall lui-même (fallDamageService.js).
router.post('/:id/hazards/fall', requireAuth, requireRole('gm'), async (req, res) => {
  const { tokenId, heightMeters, groundTrigger, terrainAccidente, attemptTest } = req.body
  const token = await resolveCampaignToken(req.params.id, tokenId)
  if (!token.character_id) throw new AppError(400, 'Ce token n\'a pas de personnage associé')
  const sheet = await db('char_sheet').where({ character_id: token.character_id }).first()
  if (!sheet) throw new AppError(404, 'Fiche de personnage introuvable pour ce token')

  const result = await resolveFall(req.app.get('io'), db, req.params.id, {
    characterId: token.character_id,
    charSheetId: sheet.id,
    tokenId: token.id,
    heightMeters: heightMeters ?? null,
    groundTrigger: !!groundTrigger,
    terrainAccidente: !!terrainAccidente,
    attemptTest: !!attemptTest,
  })
  res.json(result)
})

// POST /api/campaigns/:id/tokens/:tokenId/hazards/:code/expose — GM uniquement.
// body { formula, locations?, forcedLocation? }.
router.post('/:id/tokens/:tokenId/hazards/:code/expose', requireAuth, requireRole('gm'), async (req, res) => {
  await resolveCampaignToken(req.params.id, req.params.tokenId)
  const { formula, locations, forcedLocation } = req.body
  await exposeToHazard(req.app.get('io'), db, req.params.id, req.params.tokenId, req.params.code, {
    formula, locations, forcedLocation,
  })
  res.json({ exposed: true })
})

// POST /api/campaigns/:id/tokens/:tokenId/hazards/:code/clear — GM uniquement. body { linger? }
// (réservé à "acid", rejeté par clearHazard sinon).
router.post('/:id/tokens/:tokenId/hazards/:code/clear', requireAuth, requireRole('gm'), async (req, res) => {
  await resolveCampaignToken(req.params.id, req.params.tokenId)
  const { linger } = req.body
  await clearHazard(req.app.get('io'), db, req.params.id, req.params.tokenId, req.params.code, { linger: !!linger })
  res.json({ cleared: true })
})

// Froid (docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5) — URL scopée token (même convention que les routes
// hazards ci-dessus, patron déjà appelé par TokenStatusPanel.jsx) mais mécanique scopée personnage :
// le handler résout characterId depuis token.character_id, jamais fourni par le client.
// GET /api/campaigns/:id/tokens/:tokenId/cold-exposure — état courant (tier/extremeSteps/wet), null
// si pas exposé — alimente le pré-remplissage du sous-formulaire à l'ouverture.
router.get('/:id/tokens/:tokenId/cold-exposure', requireAuth, requireRole('gm'), async (req, res) => {
  const token = await resolveCampaignToken(req.params.id, req.params.tokenId)
  if (!token.character_id) throw new AppError(400, 'Ce token n\'a pas de personnage associé')
  const state = await getColdExposureState(token.character_id)
  res.json({ state })
})

// POST /api/campaigns/:id/tokens/:tokenId/cold-exposure — déclare/change la tranche. GM uniquement.
// body { tier, extremeSteps?, wet? }. Idempotent (déclarer alors qu'une exposition existe déjà =
// changer de tranche, docs/PLAN_FATIGUE_DOMMAGES.md §11 "Contrat declareColdExposure").
router.post('/:id/tokens/:tokenId/cold-exposure', requireAuth, requireRole('gm'), async (req, res) => {
  const token = await resolveCampaignToken(req.params.id, req.params.tokenId)
  if (!token.character_id) throw new AppError(400, 'Ce token n\'a pas de personnage associé')
  const { tier, extremeSteps, wet } = req.body
  await declareColdExposure(req.app.get('io'), req.params.id, token.character_id, { tier, extremeSteps, wet })
  res.json({ declared: true })
})

// DELETE /api/campaigns/:id/tokens/:tokenId/cold-exposure — retire l'exposition. GM uniquement.
router.delete('/:id/tokens/:tokenId/cold-exposure', requireAuth, requireRole('gm'), async (req, res) => {
  const token = await resolveCampaignToken(req.params.id, req.params.tokenId)
  if (!token.character_id) throw new AppError(400, 'Ce token n\'a pas de personnage associé')
  await clearColdExposure(req.app.get('io'), req.params.id, token.character_id)
  res.json({ cleared: true })
})

// DELETE /api/campaigns/:id — supprimer définitivement une campagne
// GM uniquement. Les données liées en base sont supprimées par cascade.
router.delete('/:id', requireAuth, requireRole('gm'), async (req, res) => {
  const campaignId = req.params.id

  const campaign = await db.transaction(async (trx) => {
    const existing = await trx('campaigns')
      .where({ id: campaignId })
      .select('id', 'name')
      .first()
    if (!existing) throw new AppError(404, 'Campaign not found')

    // Coupe la référence circulaire campagne → battlemap d'accueil avant
    // suppression. Les battlemaps et leurs enfants partent ensuite en cascade.
    await trx('campaigns')
      .where({ id: campaignId })
      .update({ default_battlemap_id: null })

    await trx('campaigns')
      .where({ id: campaignId })
      .del()

    return existing
  })

  // Nettoyage MinIO best-effort : la campagne est déjà supprimée en base,
  // un éventuel échec de stockage ne doit pas bloquer l'action utilisateur.
  try {
    await removeCampaignAssets(campaignId)
  } catch (err) {
    console.warn(`[campaigns] assets cleanup failed for ${campaignId}:`, err.message)
  }

  res.json({ ok: true, campaign })
})

// POST /api/campaigns/join — rejoindre via invite_code
router.post('/join', requireAuth, async (req, res) => {
  const { invite_code } = req.body
  if (!invite_code) throw new AppError(400, 'Invite code is required')

  const campaign = await db('campaigns').where({ invite_code }).first()
  if (!campaign) throw new AppError(404, 'Campaign not found')

  const existing = await db('campaign_members')
    .where({ campaign_id: campaign.id, user_id: req.user.id })
    .first()
  if (existing) throw new AppError(409, 'You are already a member of this campaign')

  await db('campaign_members').insert({
    campaign_id: campaign.id,
    user_id: req.user.id,
    role: 'player',
  })

  res.status(201).json({ campaign: { id: campaign.id, name: campaign.name } })
})

// POST /api/campaigns/:id/cover — upload illustration de campagne (GM uniquement)
// Chemin MinIO : campaigns/<id>/cover — nom fixe, écrasement automatique, Content-Type via metadata
// cover_url en base = chemin MinIO relatif (P18) — pas une URL complète
router.post('/:id/cover', requireAuth, requireRole('gm'), multerUpload.single('cover'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'No file uploaded')

  const objectName = `campaigns/${req.params.id}/cover`
  const minio = getMinioClient()

  // MinIO avant base — P25
  await minio.putObject(
    BUCKET(),
    objectName,
    req.file.buffer,
    req.file.size,
    { 'Content-Type': req.file.mimetype }
  )

  const [campaign] = await db('campaigns')
    .where({ id: req.params.id })
    .update({ cover_url: objectName, updated_at: db.fn.now() })
    .returning(['id', 'name', 'cover_url'])

  res.json({ campaign })
})

// POST /api/campaigns/:id/default-token — upload GLB token par défaut (GM uniquement)
// Chemin MinIO : campaigns/<id>/default-token — nom fixe, écrasement automatique
// default_token_glb_url stocke le chemin MinIO relatif avec ?v=<timestamp> (P18 + cache-busting)
router.post('/:id/default-token', requireAuth, requireRole('gm'), multerGlb.single('glb'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'No file uploaded')

  const objectName = `campaigns/${req.params.id}/default-token`
  const minio = getMinioClient()

  // MinIO avant base — P25
  await minio.putObject(
    BUCKET(),
    objectName,
    req.file.buffer,
    req.file.size,
    { 'Content-Type': 'model/gltf-binary' }
  )

  const glbUrl = `${objectName}?v=${Date.now()}`

  const [campaign] = await db('campaigns')
    .where({ id: req.params.id })
    .update({ default_token_glb_url: glbUrl, updated_at: db.fn.now() })
    .returning(['id', 'default_token_glb_url'])

  res.json({ campaign })
})

// GET /api/campaigns/:id/members — liste des membres
router.get('/:id/members', requireAuth, requireRole('gm'), async (req, res) => {
  const members = await db('campaign_members')
    .join('users', 'campaign_members.user_id', 'users.id')
    .where('campaign_members.campaign_id', req.params.id)
    .select(
      'users.id',
      'users.username',
      'campaign_members.role',
      'campaign_members.character_name'
    )
  res.json({ members })
})

export default router
