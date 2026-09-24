import { WS } from '../../../shared/events.js'

// Diffusion d'un déplacement de token déjà exécuté par `executeBattlemapTokenMovement`
// (worldMovementService.js). Extrait de la Résolution de déplacement de combat
// (socketCombatResolution.js) pour que tout autre acteur qui déplace un token en cours de combat — par
// ex. l'interposition d'un drone protecteur (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.3-2) — émette le
// MÊME message, jamais une copie de plus.
//
// Le client ne lit de TOKEN_MOVED que tokenId / pos_x / pos_y / pos_z / position_space / updated_at
// (useTokenSocket.js) ; `worldMovement` est un supplément informatif propre à chaque appelant. Tout
// WORLD_RUNTIME_UPDATED de `kind` autre que 'elevator-clock' rafraîchit l'état du monde côté client
// (useWorldRuntimeSync.js).

// Enveloppe TOKEN_MOVED : les six champs consommés par le client + le supplément de l'appelant.
export function buildTokenMovedPayload(token, worldMovement) {
  return {
    tokenId: token.id,
    pos_x: token.pos_x,
    pos_y: token.pos_y,
    pos_z: token.pos_z,
    position_space: token.position_space,
    updated_at: token.updated_at,
    worldMovement,
  }
}

// `outcome` : résultat de executeBattlemapTokenMovement. `movedKind` : `kind` du WORLD_RUNTIME_UPDATED
// quand le token a réellement bougé (l'horloge d'ascenseur seule émet toujours 'elevator-clock').
// `worldMovement` : supplément de l'appelant pour le TOKEN_MOVED du token déplacé.
// Ordre d'émission conservé à l'identique de la Résolution de combat : runtime → passagers d'ascenseur →
// token déplacé.
export function emitExecutedTokenMovement(io, campaignId, { battlemapId, outcome, movedKind, worldMovement }) {
  if (outcome?.moved || outcome?.elevatorRuntime?.changed) {
    io.to(campaignId).emit(WS.WORLD_RUNTIME_UPDATED, {
      battlemapId,
      runtimeRevision: outcome.runtimeRevision || outcome.elevatorRuntime.runtimeRevision,
      kind: outcome.moved ? movedKind : 'elevator-clock',
    })
  }
  for (const passenger of outcome?.elevatorPassengerTokens || []) {
    io.to(campaignId).emit(WS.TOKEN_MOVED, buildTokenMovedPayload(passenger, { kind: 'elevator-passenger' }))
  }
  if (outcome?.moved) {
    io.to(campaignId).emit(WS.TOKEN_MOVED, buildTokenMovedPayload(outcome.token, worldMovement))
  }
}
