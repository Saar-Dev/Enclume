import { WS } from '../../../shared/events.js'

// Dommages nets à partir desquels un drone est détruit d'un coup (LdB p.82-88) — règle propre au drone, la
// gravité en dessous vient de la table RAW partagée (woundSeverityForDamage, shared/woundConstants.js).
export const DRONE_DESTROYED_DAMAGE = 30

// Message de chat « un drone encaisse » : la SEULE construction de ce compte rendu, quel que soit l'appelant
// (tireur PNJ / PJ / drone / exo, corps à corps, drone interposé — docs/PLANS/PLAN_DRONE_INTERCEPTION.md §7ter).
// `outcome` = retour de resolveDroneIntegrityLoss. Retourne une émission { to, event, data } ; l'appelant la
// pousse dans son `emissions[]` (ou l'émet en direct) APRÈS ses propres messages — jamais depuis la fonction de
// dégâts, qui passerait avant « le drone s'interpose ».
// i18n (rules/i18n.md) : clés `session.droneDamaged*`, résolues côté client par t(i18nKey, params).
export function buildDroneDamageNotice({ droneName, degatsNets, outcome }) {
  const drone = droneName ?? '?'
  const from = outcome.previousIntegrite
  let i18nKey, params
  if (outcome.detruit) {
    i18nKey = 'session.droneDestroyed'
    params = { drone, net: degatsNets, from }
  } else if (outcome.severity) {
    i18nKey = 'session.droneDamaged'
    params = { drone, net: degatsNets, severity: outcome.severity, from, to: outcome.newIntegrite }
  } else {
    i18nKey = 'session.droneDamagedNoWound'
    params = { drone, net: degatsNets, from, to: outcome.newIntegrite }
  }
  return {
    to: 'room',
    event: WS.COMBAT_SYSTEM_NOTICE,
    data: { i18nKey, params, timestamp: new Date().toISOString() },
  }
}
