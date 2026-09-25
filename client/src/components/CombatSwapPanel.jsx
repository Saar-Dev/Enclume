import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

// Extension « Permuter » de la colonne 2 des fenêtres de déclaration de combat (PLAN_PRISE_EN_MAIN.md, Lot B2b) : une action = une
// extension dédiée, ouverte par le bouton ⇄ d'une ligne (d'arme, « Mains nues », objet tenu). Elle liste les objets du Sac / de la
// Ceinture que le personnage peut prendre en main, avec leur coût. Présentation seule : les lignes (`buildGrabList`), leur
// avertissement (`swapWarning`, mêmes règles que le serveur) et le choix viennent de la fenêtre.
//
// Un avertissement (« ne rentre pas »…) est une INFORMATION : la ligne reste cliquable (décision de Saar, 2026-09-25 — le joueur assume,
// le serveur tranche à la résolution et le chat le dit).
//
// `rows` : lignes de `buildGrabList` (Ceinture avant Sac) + `warning` (`swapWarning` : { reason, container?, itemName? } | null).
// `replacedName` : nom de l'objet remplacé (la ligne où ⇄ a été cliqué) ; null = « Mains nues ».
// `afterName` : nom de l'objet choisi, pour la ligne « Après la permutation » ; null si rien n'est choisi ici.
// `onPick(row)` : choisit la ligne, ou l'annule si c'est déjà la ligne choisie.

export default function CombatSwapPanel({ rows, selectedItemId, replacedName, afterName, onPick }) {
  const { t } = useTranslation('combat')

  const warningText = (warning) => {
    if (!warning) return null
    const key = `swapPanel.warning.${warning.reason}`
    return t(key, {
      item: warning.itemName, container: warning.container,
      defaultValue: t('swapPanel.warning.generic'),
    })
  }

  return (
    <div className="decl-swap">
      <div className="decl-swap__head">
        <span aria-hidden="true">⇄</span>
        {replacedName ? t('swapPanel.title', { name: replacedName }) : t('swapPanel.titleBareHands')}
      </div>
      <div className="decl-swap__hint">
        {replacedName ? t('swapPanel.hintReplace', { name: replacedName }) : t('swapPanel.hintBareHands')}
      </div>
      {rows.length === 0 ? (
        <div className="decl-swap__empty">{t('swapPanel.empty')}</div>
      ) : (
        <div className="decl-swap__body">
          {rows.map((row, index) => {
            const header = index === 0 || rows[index - 1].container !== row.container
            const selected = selectedItemId === row.itemId
            const warning = warningText(row.warning)
            const sub = [row.count > 1 ? `×${row.count}` : null, row.occupiesAction ? t('swapPanel.bagNote') : t('swapPanel.beltNote')]
              .filter(Boolean).join(' · ')
            return (
              <Fragment key={row.key}>
                {header && (
                  <div className="decl-swap__group">
                    {row.occupiesAction ? t('swapPanel.groupBag') : t('swapPanel.groupBelt')}
                  </div>
                )}
                <div
                  className="decl-swap__cand"
                  data-sel={selected}
                  data-warn={warning ? '' : undefined}
                  onClick={() => onPick(row)}
                >
                  <span className="decl-swap__radio" aria-hidden="true" />
                  <span className="decl-swap__name">
                    {row.name}
                    <span className="decl-swap__sub">{sub}</span>
                    {warning && <span className="decl-swap__warn">{warning}</span>}
                  </span>
                  <span className="decl-swap__cost">{row.iniCost}</span>
                </div>
              </Fragment>
            )
          })}
          {afterName && <div className="decl-swap__after">{t('swapPanel.after', { item: afterName })}</div>}
        </div>
      )}
    </div>
  )
}
