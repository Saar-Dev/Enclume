import { useTranslation } from 'react-i18next'

// Bandeau de titre des fenêtres de déclaration de combat (PLAN_RW_DECLARE_DESIGN, maquette) :
// [pastille initiales · accent famille] [nom de l'acteur actif] … [N / N déclarés].
// Partagé PJ / MJ / Exo. La couleur d'accent vient de `data-family` porté par la racine de la
// fenêtre (le bandeau en hérite). `baseClass` = la classe de header propre au type de fenêtre
// (`.combat-float-header` pour PJ/Exo, `.combat-win-header` pour MJ) — elle fournit fond, bordure,
// padding et la poignée de drag.

function initialsOf(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function CombatDeclareHeader({
  name,
  declared,
  total,
  onMouseDown,
  baseClass = 'combat-float-header',
}) {
  const { t } = useTranslation('combat')
  return (
    <div className={`${baseClass} combat-declare-header`} onMouseDown={onMouseDown}>
      <span className="combat-declare-header__badge" aria-hidden="true">{initialsOf(name)}</span>
      <span className="combat-declare-header__name">{name}</span>
      <span className="combat-declare-header__progress">
        {t('gmDeclareWindow.declaredProgress', { done: declared, total })}
      </span>
    </div>
  )
}
