import { useTranslation } from 'react-i18next'
import { projectedInitiative } from '../../../shared/combatIniCost.js'

// Pastille « Initiative projetée » du pied des fenetres de declaration (PLAN_RW_DECLARE_WINDOWS
// module 2). Toujours affichee a cote du bouton DECLARER : le joueur voit d'un coup d'oeil
// l'Initiative qu'il aura apres l'action declaree, donc quand il agira en Resolution.
// Rouge (`.badge-fail`) quand l'Initiative projetee <= 0 : l'action serait perdue en Resolution
// (docs/SYSTEME/EXOARMURE.md §5, socketCombatHelpers.js#computeSeriesPositions). Survol -> tooltip
// CSS (`.has-tooltip`) recapitulant les postes de cout.
//
// Brique presentationnelle pure (REWORK-05) : la fenetre fournit `currentInitiative`, `delta`
// (calcIniDelta) et `breakdown` (calcIniBreakdown) deja calcules — aucune regle metier ici. Le
// total et le detail viennent du meme calcul partage (shared/combatIniCost.js), ils ne peuvent
// pas diverger.
export default function CombatDeclareIniWidget({ currentInitiative, delta, breakdown = [] }) {
  const { t } = useTranslation('combat')
  const { projected, willBeLost } = projectedInitiative(currentInitiative, delta)

  const tooltip = breakdown.length > 0
    ? [
        ...breakdown.map(l => `${l.label} : ${l.value > 0 ? `+${l.value}` : l.value}`),
        t('iniWidget.tooltipTotal', { value: projected }),
      ].join('\n')
    : t('iniWidget.tooltipNoChange', { value: projected })

  return (
    <span
      className={`badge has-tooltip combat-ini-widget${willBeLost ? ' badge-fail' : ''}`}
      data-tooltip={tooltip}
      aria-label={t('iniWidget.aria', { current: currentInitiative, projected })}
    >
      <span className="num">{t('iniWidget.pill', { current: currentInitiative, projected })}</span>
    </span>
  )
}
