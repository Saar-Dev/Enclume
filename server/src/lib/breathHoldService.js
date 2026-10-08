// server/src/lib/breathHoldService.js — Noyade/Asphyxie, Phase 1 (Souffle) et Phase 2 (Suffocation
// active) (docs/PLANS/PLAN_FATIGUE_DOMMAGES.md §12 Lot 6, docs/REGLES/FATIGUE&DOMMAGES.md:190-204).
// Même patron que server/src/lib/iemSurvivalService.js (pose + tick dans le même fichier, un seul
// statut par phase, pas de registre) — confirmé comme meilleur précédent lors du cadrage 2026-10-08 :
// statut unique, pas de dégâts, pas de deuxième consommateur qui justifierait une abstraction
// partagée au-delà de la requête de jointure déjà dupliquée deux fois (analyse à charge, acceptée).
//
// 3 phases, 2 status_code (docs/REGLES/FATIGUE&DOMMAGES.md:190-204) :
//   Phase 1 — Apnée volontaire     : `breath_hold` (nouveau), durée = calcSouffle (± Hyperventilation)
//   Phase 2 — Suffocation active   : `asphyxia` (déjà réservé, shared/tokenStatusRegistry.js), 2D6 Tours
//   Phase 3 — Inconscient          : `unconscious` (déjà existant, statusService.applyStunWithDuration)
// Transition automatique dans les 2 sens utiles (1→2 : jet 2D6 ; 2→3 : expiration) — jamais un jet de
// dégâts (analyse à charge §12 point 3, resolveActiveEffects/effectLineResolverService.js ne connaît
// que le type 'damage', structurellement incompatible avec cette cascade de statut pure).
import { parseDice } from './diceParser.js'
import { resolvePolarisTest } from './polarisTestService.js'
import { loadCharacterTestContext } from './characterTestContext.js'
import { calcSouffle, getAdvantageModForAttr } from '../../../shared/polarisUtils.js'
import * as statusService from './statusService.js'

export const BREATH_HOLD_STATUS_CODE = 'breath_hold'
export const ASPHYXIA_STATUS_CODE = 'asphyxia'

// resolveCharacterIdForToken — seule donnée que characterTestContext.js ne résout pas lui-même
// (il prend un characterId, jamais un tokenId — les deux autres consommateurs, MACRO_ROLL/`/t`,
// connaissent déjà le characterId du joueur qui lance sa macro).
async function resolveCharacterIdForToken(db, tokenId) {
  const token = await db('tokens').where({ id: tokenId }).first()
  return token?.character_id ?? null
}

// startBreathHold — pose la Phase 1 (docs/PLAN_FATIGUE_DOMMAGES.md §12, action déclarée par le
// propriétaire du token, jamais une exposition MJ — même garde que le reste de la fenêtre de
// déclaration, cf. socketCombatAnnouncement.js). `bonus` : modificateur signé appliqué au max/restant
// (Hyperventilation réussie/ratée, voir resolveHyperventilation ci-dessous) — 0 pour un "Retenir son
// souffle" simple. Idempotent côté appelant : un token déjà en breath_hold/asphyxia ne doit jamais être
// re-déclenché (vérifié par le handler de déclaration, pas ici — ce service reste agnostique de qui a
// le droit de l'appeler).
//
// `characterTestContext.js:loadCharacterTestContext` (pas effectLineResolverService.js:loadTargetContext,
// trop étroit — pensé pour une CIBLE de dégât, sans `advantages`) : même chargement que MACRO_ROLL/`/t`,
// 3ᵉ consommateur réel. Trouvé en relisant mon propre code (2026-10-08) : une première version
// appelait `calcSouffle(con_na, vol_na, 0)`, un `mod_advantage` codé en dur à 0 — alors que
// `getAdvantageModForAttr(advantages, 'breath')` est déjà LE calcul utilisé partout ailleurs
// (CharacterSheet.jsx, char-sheet.js, socketDice.js) pour afficher le Souffle d'un personnage. Codé
// en dur, un Avantage qui augmente le Souffle aurait affiché une valeur sur la fiche et appliqué une
// autre (plus courte) en combat — deux autorités pour le même fait, CLAUDE.md §1.3/§7.
export async function startBreathHold(io, db, campaignId, tokenId, { bonus = 0 } = {}) {
  const characterId = await resolveCharacterIdForToken(db, tokenId)
  if (!characterId) return null
  const ctx = await loadCharacterTestContext(db, campaignId, characterId)
  if (!ctx) return null
  const breathAdvantageMod = getAdvantageModForAttr(ctx.advantages, 'breath')
  const max = Math.max(0, calcSouffle(ctx.na('CON'), ctx.na('VOL'), breathAdvantageMod) + bonus)
  await statusService.applyModStatus(io, db, campaignId, tokenId, BREATH_HOLD_STATUS_CODE, {
    expiresAtTurn: null,
    data: { remaining: max, max },
  })
  console.log(`[DBG] breathHoldService — Retenir son souffle token:${tokenId} max:${max} (bonus:${bonus}, avantage Souffle:${breathAdvantageMod})`)
  return { max }
}

// resolveHyperventilation — Test d'Athlétisme secret AVANT de retenir son souffle (RAW, FATIGUE&
// DOMMAGES.md:50-57) : "le joueur ne doit pas être averti du résultat", réussite = +mr Tours de
// Souffle, échec = -mr (mr déjà signé négatif sur échec, shared/polarisTestResolution.js — aucune
// inversion de signe à faire ici, une addition suffit dans les deux cas). Seuil = AN(FOR)+AN(COO)+
// mastery Athlétisme + activeMalus, même formule que MACRO_ROLL (socketDice.js:200,
// `threshold = baseThreshold + activeMalus + macro.modifier`, ici sans `macro.modifier` — jet
// automatique, pas une saisie MJ/joueur) — pas shared/charStats.js:calcSkillTotal (qui interrogerait
// ref_skills pour rien, la paire d'Attributs de l'Athlétisme est un fait RAW fixe). Écart RAW assumé
// v1 (cadrage §12, 2026-08-06) : visibilité "secret" = patron déjà codé (lanceur+MJ, pas un vrai
// secret caché du lanceur lui-même) — l'appelant (socketCombatAnnouncement.js) diffuse le jet avec
// cette même règle de visibilité, ce service ne fait que la résolution + la pose.
export async function resolveHyperventilation(io, db, campaignId, tokenId) {
  const characterId = await resolveCharacterIdForToken(db, tokenId)
  if (!characterId) return null
  const ctx = await loadCharacterTestContext(db, campaignId, characterId)
  if (!ctx) return null
  const athletisme = await db('char_skills').where({ char_sheet_id: ctx.sheet.id, skill_id: 'ATHLETISME' }).first()
  const threshold = ctx.an('FOR') + ctx.an('COO') + (athletisme?.mastery ?? 0) + ctx.activeMalus

  const outcome = await resolvePolarisTest(threshold)
  await startBreathHold(io, db, campaignId, tokenId, { bonus: outcome.mr })
  console.log(`[DBG] breathHoldService — Hyperventilation (secrète) token:${tokenId} roll:${outcome.roll}/${threshold} mr:${outcome.mr} isSuccess:${outcome.isSuccess}`)
  return { ...outcome, threshold }
}

// clearBreathHold — retrait manuel (le personnage refait surface), Phase 1 ou 2 indifféremment
// (même action côté joueur — "je remonte respirer", peu importe la phase atteinte). Même patron que
// clearHazard (environmentalHazardService.js) : retrait immédiat, pas de linger (RAW muet sur un délai
// de récupération de Souffle après être remonté).
export async function clearBreathHold(io, db, campaignId, tokenId) {
  await statusService.clearModStatus(io, db, campaignId, tokenId, BREATH_HOLD_STATUS_CODE)
  await statusService.clearModStatus(io, db, campaignId, tokenId, ASPHYXIA_STATUS_CODE)
}

// resolveBreathHoldTicks — appelée depuis startResolutionPhase (combatTurnEngine.js), même site que
// resolveIemSurvivalTicks, boucle indépendante (deux domaines séparés, jamais fusionnés — même
// principe que la séparation hazards/mods/IEM déjà établie). `rows` : lignes token_statuses actives
// de la campagne dont le status_code ∈ {breath_hold, asphyxia} (jointure combat_roster, même forme que
// les 3 autres boucles de startResolutionPhase).
export async function resolveBreathHoldTicks(io, db, campaignId, currentTurn, rows) {
  for (const row of rows) {
    if (row.status_code === BREATH_HOLD_STATUS_CODE) {
      await tickBreathHold(io, db, campaignId, row)
    } else if (row.status_code === ASPHYXIA_STATUS_CODE) {
      await tickAsphyxia(io, db, campaignId, currentTurn, row)
    }
  }
}

async function tickBreathHold(io, db, campaignId, row) {
  const max = row.data?.max ?? 0
  const remaining = (row.data?.remaining ?? 0) - 1
  if (remaining > 0) {
    await statusService.applyModStatus(io, db, campaignId, row.token_id, BREATH_HOLD_STATUS_CODE, {
      expiresAtTurn: null,
      data: { remaining, max },
    })
    return
  }
  // Phase 1 → Phase 2 (RAW : "sombre dans l'inconscience en 2D6 Tours de combat") — un seul jet à la
  // transition, jamais un test répété par Tour (contrairement au "recovery check" d'autres jeux,
  // écarté lors de la recherche externe du 2026-10-08 : le RAW Polaris ne décrit qu'un jet unique).
  const { total: asphyxiaDuration } = await parseDice('2d6')
  await statusService.clearModStatus(io, db, campaignId, row.token_id, BREATH_HOLD_STATUS_CODE)
  await statusService.applyModStatus(io, db, campaignId, row.token_id, ASPHYXIA_STATUS_CODE, {
    expiresAtTurn: null,
    data: { remaining: asphyxiaDuration, max: asphyxiaDuration },
  })
  console.log(`[DBG] breathHoldService — Souffle épuisé token:${row.token_id}, Suffocation active ${asphyxiaDuration} Tours`)
}

async function tickAsphyxia(io, db, campaignId, currentTurn, row) {
  const max = row.data?.max ?? 0
  const remaining = (row.data?.remaining ?? 0) - 1
  if (remaining > 0) {
    await statusService.applyModStatus(io, db, campaignId, row.token_id, ASPHYXIA_STATUS_CODE, {
      expiresAtTurn: null,
      data: { remaining, max },
    })
    return
  }
  // Phase 2 → Phase 3 : inconscience sans expiration (réanimation/mort restent narratives/MJ, cadrage
  // §12 — même choix UX que l'évanoui de Fatigue palier 5, statusService.js). `currentTurn: null` force
  // `stunUntil: null` dans applyStunWithDuration quel que soit l'appelant (combat en cours ou non).
  await statusService.clearModStatus(io, db, campaignId, row.token_id, ASPHYXIA_STATUS_CODE)
  await statusService.applyStunWithDuration(io, db, campaignId, row.token_id, 'inconscient', 0, null, {
    statusCode: 'unconscious',
  })
  console.log(`[DBG] breathHoldService — Suffocation terminée token:${row.token_id}, Inconscient`)
}
