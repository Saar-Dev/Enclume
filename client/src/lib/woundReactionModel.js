// client/src/lib/woundReactionModel.js — logique PURE du composant « réaction de blessure » (WoundReactionDock.jsx).
// Maquette de référence : docs/PLANS/maquette-chance-reaction/preview.html (planches A-F). Aucune décision de règle ici : le
// serveur décide s'il y a une réaction et ce qu'elle coûte (woundService.js:openWoundReaction) ; ce module ne fait que présenter.
import { WOUND_SEVERITIES } from '../../../shared/woundConstants.js'

export const WOUND_REACTION_SITE = 'wound_severity'
// Pile compacte du MJ (planche E) : au-delà, « + N autres blessures ».
export const STACK_MAX_ROWS = 3

const severityRank = (severity) => WOUND_SEVERITIES.indexOf(severity)

// Les réactions de blessure de l'audience, la plus GRAVE d'abord (planche F : « la plus grave est en premier »), à gravité égale la
// plus ancienne d'abord.
export function selectWoundReactions(entries) {
  return (entries ?? [])
    .filter(entry => entry.site === WOUND_REACTION_SITE)
    .sort((a, b) => (severityRank(b.woundSeverity) - severityRank(a.woundSeverity))
      || (new Date(a.rolledAt).getTime() - new Date(b.rolledAt).getTime()))
}

// Clé i18n du titre : « Mort subite » (Mort), « Membre détruit » (6ᵉ ligne sur un membre), sinon la gravité elle-même.
export function reactionTitleKey(entry) {
  if (entry.fatal) return 'chance.reaction.titleDeath'
  if (entry.woundSeverity === 'mort_subite') return 'chance.reaction.titleLimb'
  return `resultPanels.severity.${entry.woundSeverity}`
}

// Libellé d'une option : { key, params } à passer à t(). Le COÛT est distinct du nombre de degrés pour la 6ᵉ ligne (rachat :
// 1 cran pour 3 points) — un libellé « Réduire de 1 » cacherait le prix, on parle alors de survie.
export function optionLabel(entry, option) {
  const severity = option.targetSeverity
  if (option.cost !== option.degree) {
    return { key: entry.fatal ? 'chance.reaction.rescueDeath' : 'chance.reaction.rescueLimb', params: { severity } }
  }
  return option.degree === 1
    ? { key: 'chance.reaction.reduceOne', params: { severity } }
    : { key: 'chance.reaction.reduceMany', params: { degree: option.degree, severity } }
}

// Fraction de temps restant pour la barre (0..1). `null` : aucun minuteur (le Tour attend la décision, lot 6a-3).
export function remainingRatio(remainingSeconds, timeoutMs) {
  if (remainingSeconds == null || !timeoutMs) return null
  return Math.min(1, Math.max(0, (remainingSeconds * 1000) / timeoutMs))
}

// Chance restante si l'option la moins chère est prise (« Chance : 8 → 5 si tu dépenses »).
export function chanceAfterCheapest(chcAvailable, options) {
  if (chcAvailable == null || !options?.length) return null
  return chcAvailable - Math.min(...options.map(option => option.cost))
}

// Pile compacte du MJ : les premières lignes + le nombre de celles qu'on masque.
export function splitStack(reactions, max = STACK_MAX_ROWS) {
  return { shown: reactions.slice(0, max), hiddenCount: Math.max(0, reactions.length - max) }
}
