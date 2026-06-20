// Events WS (client → serveur via socket.on) :
//   COMBAT_START, COMBAT_END, COMBAT_ANNOUNCE_START, COMBAT_ACTION_DECLARE,
//   COMBAT_SURPRISE_RESULT, COMBAT_SKIP_PLAYER, COMBAT_ACTION_CONFIRM,
//   COMBAT_MELEE_DEFENSE_CONFIRM, COMBAT_DAMAGE_CONFIRM, COMBAT_STUN_CONFIRM
//
// Pseudo-events internes (déclenchés dans les helpers serveur, jamais via socket.on) :
//   START_RESOLUTION, NEEDS_DEFENSE, NEEDS_DAMAGE, END_TURN
//
// COMBAT_INIT_STATE    : hors FSM — roster uniquement, pas de changement de phase. Pas de guard.
// COMBAT_ANNOUNCE_PREVIEW : relay éphémère combatPreviews — aucune transition. Pas de guard.
// COMBAT_APPLY_STUN    : action GM administrative sans transition. Pas de guard.
// COMBAT_ACTION_CONFIRM: guard only — état final (SLOT_ACTIVE/AWAITING_DEFENSE/AWAITING_DAMAGE)
//   décidé par les helpers, écrit directement via setFSMSubPhase(). Ne pas appeler nextState().
// AWAITING_STUN        : non-bloquant — sub_phase reste SLOT_ACTIVE, stun tracké via combat_pending.

const TRANSITIONS = {
  'null|null': {
    'COMBAT_START':                  { phase: 'ROSTER',       subPhase: null },
  },
  'ROSTER|null': {
    'COMBAT_ANNOUNCE_START':         { phase: 'ANNOUNCEMENT', subPhase: null },
    'COMBAT_END':                    { phase: null,            subPhase: null },
  },
  'ANNOUNCEMENT|null': {
    'COMBAT_ACTION_DECLARE':         { phase: 'ANNOUNCEMENT', subPhase: null },
    'COMBAT_SURPRISE_RESULT':        { phase: 'ANNOUNCEMENT', subPhase: null },
    'COMBAT_SKIP_PLAYER':            { phase: 'ANNOUNCEMENT', subPhase: null },
    'START_RESOLUTION':              { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'COMBAT_END':                    { phase: null,            subPhase: null },
  },
  'RESOLUTION|SLOT_ACTIVE': {
    'COMBAT_ACTION_CONFIRM':         { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'COMBAT_SKIP_PLAYER':            { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'NEEDS_DEFENSE':                 { phase: 'RESOLUTION',   subPhase: 'AWAITING_DEFENSE' },
    'NEEDS_DAMAGE':                  { phase: 'RESOLUTION',   subPhase: 'AWAITING_DAMAGE' },
    'END_TURN':                      { phase: 'ANNOUNCEMENT', subPhase: null },
    'COMBAT_END':                    { phase: null,            subPhase: null },
    'COMBAT_STUN_CONFIRM':           { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
  },
  'RESOLUTION|AWAITING_DEFENSE': {
    'COMBAT_MELEE_DEFENSE_CONFIRM':  { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'COMBAT_END':                    { phase: null,            subPhase: null },
  },
  'RESOLUTION|AWAITING_DAMAGE': {
    'COMBAT_DAMAGE_CONFIRM':         { phase: 'RESOLUTION',   subPhase: 'SLOT_ACTIVE' },
    'COMBAT_END':                    { phase: null,            subPhase: null },
  },
}

/**
 * Vérifie si la transition est autorisée depuis (phase, subPhase) pour cet event.
 * @param {string|null} phase
 * @param {string|null} subPhase  — toujours normalisé via `?? null` avant appel
 * @param {string}      event     — nom brut de l'event (ex: 'COMBAT_ACTION_CONFIRM', 'NEEDS_DEFENSE')
 * @returns {boolean}
 */
export function canTransition(phase, subPhase, event) {
  const key = `${phase}|${subPhase ?? null}`
  return !!(TRANSITIONS[key]?.[event])
}

/**
 * Retourne le prochain état après la transition.
 * NE PAS utiliser pour COMBAT_ACTION_CONFIRM — état final non-déterministe (décidé par helpers).
 * @returns {{ phase: string|null, subPhase: string|null } | null}
 */
export function nextState(phase, subPhase, event) {
  const key = `${phase}|${subPhase ?? null}`
  return TRANSITIONS[key]?.[event] ?? null
}

/**
 * Écrit sub_phase dans combat_state.
 * Nommé setFSMSubPhase pour éviter la confusion avec l'action Zustand setCombatSubPhase (client).
 * @returns {Promise<void>}
 */
export async function setFSMSubPhase(db, campaignId, subPhase) {
  await db('combat_state')
    .where({ campaign_id: campaignId })
    .update({ sub_phase: subPhase, updated_at: db.fn.now() })
}

/**
 * Debug uniquement — jamais utilisé comme guard.
 * @returns {string[]}
 */
export function allowedEvents(phase, subPhase) {
  const key = `${phase}|${subPhase ?? null}`
  return Object.keys(TRANSITIONS[key] ?? {})
}
