import { normalizeWorldPoint } from './world/worldMetrics.js'

const GAITS = Object.freeze([
  Object.freeze({ gait: 'lente', actionKey: 'move_lente', initiativeModifier: -3, actionType: 'move_short', color: '#3b82f6' }),
  Object.freeze({ gait: 'moyenne', actionKey: 'move_moyenne', initiativeModifier: -5, actionType: 'move_long', color: '#22c55e' }),
  Object.freeze({ gait: 'rapide', actionKey: 'move_rapide', initiativeModifier: -7, actionType: 'move_long', color: '#f97316' }),
  Object.freeze({ gait: 'max', actionKey: 'move_max', initiativeModifier: 0, actionType: 'move_long', color: '#ef4444' }),
])

export const COMBAT_MOVEMENT_GAITS = GAITS

function finiteCost(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new RangeError('Le coût de déplacement doit être positif ou nul')
  return number
}

export function selectCombatMovementForCost(costM, allures) {
  const cost = finiteCost(costM)
  for (const descriptor of GAITS) {
    const budgetM = Number(allures?.[descriptor.gait])
    if (Number.isFinite(budgetM) && budgetM >= 0 && cost <= budgetM + 1e-9) {
      return Object.freeze({ ...descriptor, costM: cost, budgetM })
    }
  }
  return null
}

export function combatMovementFromGait(gait) {
  return GAITS.find(descriptor => descriptor.gait === gait) || null
}

export function combatMovementFromActionKey(actionKey) {
  return GAITS.find(descriptor => descriptor.actionKey === actionKey) || null
}

export function getCombatPathColor(costM, allures) {
  return selectCombatMovementForCost(costM, allures)?.color || '#444455'
}

// Adaptateur temporaire du payload PE14 vers les axes canoniques du monde.
// DB/client pos_y = profondeur Z ; DB/client pos_z = altitude Y.
export function combatDestinationFromPayload(move) {
  return normalizeWorldPoint({
    x: Number(move?.targetPosX),
    y: Number(move?.targetPosZ),
    z: Number(move?.targetPosY),
  }, 'destination combat')
}
