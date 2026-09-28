// server/src/lib/zoneModifierService.js — Malus `modifier` d'une zone dangereuse (gaz, Z4,
// docs/PLANS/PLAN_ZONES_DANGER.md §2.A/§6). Domaine séparé d'environmentalHazardService.js : les
// zones `modifier` (gaz) n'ont JAMAIS de hazardCode (Z0, par construction — hazardCode:null couvre
// exclusivement les dangers à dégâts feu/acide/décompression) donc exposeToHazard/clearHazard
// (gardées par findHazardRegistryEntry) sont structurellement inapplicables ici. Même patron que
// iemSurvivalService.js (pose + tick dans un seul fichier, un seul domaine) — pas un registre
// {code→règle}, un seul statusService.applyModStatus/clearModStatus direct par ligne `modifier`.
//
// status_code = definition.key de la zone (ex. 'gaz:irritant') — unique par définition (catalogue +
// custom MJ), jamais réutilisé par un autre domaine (RAW dot 'burning'/'acid'/'decompression' ou
// 'iem_survival'). `data.kind:'zoneModifier'` marque explicitement une ligne posée par CE chemin
// (jamais déduit de la présence de `zoneInstanceId` seule, que les zones `damage` posent aussi via
// exposeToHazard) — c'est ce marqueur qui sépare les deux domaines dans sweepZoneExposure (sortie de
// zone) et dans le SELECT dédié de combatTurnEngine.js (jamais getAllHazardCodes(), qui ne connaît
// que les 3 hazardCode RAW).
import * as statusService from './statusService.js'

// applyZoneModifier — pose/rafraîchit le malus tant que le token reste dans la zone (appelée par
// sweepZoneExposure, 1×/Tour/membership, idempotent comme exposeToHazard). `escalation` (§2.E,
// {perTurn,cap} ou null) : la magnitude s'éloigne de zéro de `perTurn` par Tour de PRÉSENCE CONTINUE
// dans CETTE zone (stacks reparties à 0 sur une 1ère pose ou un changement de zoneInstanceId — jamais
// hérité d'une autre zone qui partagerait la même définition), plafonnée par `cap` si fourni. Sans
// escalation (ex. gaz:irritant), la magnitude reste `value` tel quel tant que la présence continue.
// `currentTurn` fourni par l'appelant (déjà résolu par startResolutionPhase, même raison que
// resolveIemSurvivalTicks : pas de second fetch ici) — écrit dans `data.lastRefreshedTurn`, seul
// signal qui distingue pour resolveZoneModifierTicks « encore dans sa zone ce Tour » (rien à faire)
// de « vient d'en sortir » (à faire décroître si remanence:'decay').
export async function applyZoneModifier(io, db, campaignId, tokenId, statusCode, {
  zoneInstanceId, target, value, escalation = null, remanence, remanenceParams, currentTurn,
}) {
  const existing = await db('token_statuses')
    .where({ token_id: tokenId, status_code: statusCode })
    .select('data')
    .first()
  const sameZone = existing?.data?.zoneInstanceId === zoneInstanceId
  const escalationStacks = escalation && sameZone ? (existing.data.escalationStacks ?? 0) + 1 : 0
  const growth = escalation ? Math.min(escalation.perTurn * escalationStacks, escalation.cap ?? Infinity) : 0
  const magnitude = value + Math.sign(value) * growth

  await statusService.applyModStatus(io, db, campaignId, tokenId, statusCode, {
    expiresAtTurn: null,
    data: {
      kind: 'zoneModifier', zoneInstanceId, target, value: magnitude, baseValue: value,
      escalation, escalationStacks, remanence, remanenceParams, lastRefreshedTurn: currentTurn,
    },
  })
}

// clearZoneModifier — retrait direct, jamais via clearHazard (son mode `linger` interroge
// findHazardRegistryEntry(...)?.lingersOnClear, qui ne connaît QUE les 3 hazardCode RAW — appeler
// clearHazard avec un status_code de définition gaz lèverait une AppError 400 pour un `linger` qui
// n'a jamais de sens ici ; le mode non-`linger` de clearHazard ne fait qu'un clearModStatus direct,
// mais autant appeler statusService directement plutôt que de dépendre d'un détail d'implémentation
// d'un autre domaine).
export async function clearZoneModifier(io, db, campaignId, tokenId, statusCode) {
  await statusService.clearModStatus(io, db, campaignId, tokenId, statusCode)
}

// resolveZoneModifierTicks — appelée depuis startResolutionPhase, juste après sweepZoneExposure (qui
// a déjà rafraîchi cette même ligne CE Tour si le token est encore dans sa zone — `lastRefreshedTurn
// === currentTurn` le signale, rien à faire alors). Ne traite QUE `remanence:'decay'` : 'none' est
// déjà nettoyé immédiatement par sweepZoneExposure (boucle Sortie), 'fixed'/'conditional' sur une
// ligne modifier n'ont aucune entrée au catalogue aujourd'hui (v2 tant qu'un cas concret ne le
// justifie — laissés tels quels, jamais une décroissance inventée pour eux).
export async function resolveZoneModifierTicks(io, db, campaignId, currentTurn, rows) {
  for (const row of rows) {
    if (row.data?.lastRefreshedTurn === currentTurn) continue
    if (row.data?.remanence !== 'decay') continue
    const perTurn = row.data.remanenceParams?.perTurn ?? 1
    const nextValue = Math.sign(row.data.value) * Math.max(0, Math.abs(row.data.value) - perTurn)
    if (nextValue === 0) {
      await clearZoneModifier(io, db, campaignId, row.token_id, row.status_code)
      continue
    }
    await statusService.applyModStatus(io, db, campaignId, row.token_id, row.status_code, {
      expiresAtTurn: null,
      data: { ...row.data, value: nextValue },
    })
  }
}

// resolveZoneModifierMalus — somme les malus `target:'actions'` actifs sur les tokens du personnage
// dans cette campagne (combatantContextService.js, patron `iemSurvivalMalus`, mais indexé par TOKEN —
// une position spatiale — jamais par personnage seul : `resolveCharacterTokens`, déjà exporté par
// statusService.js pour reconcileWoundDeath, résout les tokens actifs sans dupliquer ce JOIN).
// `target` autre que 'actions' (aucun au catalogue aujourd'hui) : ignoré ici, pas raccroché à
// calcActiveMalus — seul 'actions' correspond au malus de Test générique que ce registre porte.
export async function resolveZoneModifierMalus(db, campaignId, characterId) {
  const tokenIds = await statusService.resolveCharacterTokens(db, campaignId, characterId)
  if (!tokenIds.length) return 0
  const rows = await db('token_statuses')
    .whereIn('token_id', tokenIds)
    .whereRaw("data->>'kind' = 'zoneModifier'")
    .whereRaw("data->>'target' = 'actions'")
    .select('data')
  return rows.reduce((sum, row) => sum + (Number(row.data?.value) || 0), 0)
}
