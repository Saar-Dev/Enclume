import { useTranslation } from 'react-i18next'

// Colonne 1 des fenêtres de déclaration de combat (PLAN_RW_DECLARE_DESIGN module 4, D5/D6/D13) :
// une ligne Déplacement cumulable + la liste d'armes groupée Distance / Contact où choisir une arme
// = déclarer cette attaque. Partagé PJ / MJ / Exo (D1 « une seule structure visuelle ») — chaque
// fenêtre garde son propre câblage d'état et le passe en callbacks.
//
// Look : classes `.decl-*` d'index.css, tokens `--decl-*` (portés par `[data-decl]` sur la racine
// de la fenêtre). Rendu de référence : docs/PLANS/maquette-declare/Main.dc.html.
//
// `groups` = sortie de buildWeaponList (client/src/lib/weaponList.js) : { distance: WeaponRow[],
//   contact: WeaponRow[] }. Chaque ligne : { id, kind, group, name, slotLabel, fireMode, reachM,
//   formula, requiresGrapple, ammoLabel, ammoStatus, mixed, permanent, disabled, disabledReason }.
//
// `extras` = slot rendu sous la liste (rechargement / mode de tir intérimaires au corps tant que la
//   colonne 2 n'est pas réagencée — spécifique à chaque fenêtre).

const DISABLED_KEY = {
  mortallyWounded: 'declareList.disabledMortallyWounded',
  stunned: 'declareList.disabledStunned',
  ammoEmpty: 'declareList.disabledAmmoEmpty',
}

export default function CombatDeclareActionList({
  move,                 // { on, disabled, valueLabel, tooltip, onToggle } | null
  groups,               // { distance: WeaponRow[], contact: WeaponRow[] }
  selectedRowId,        // id de la ligne sélectionnée (surbrillance) | null
  onPick,               // (row) => void
  extras = null,        // ReactNode rendu sous la liste
}) {
  const { t } = useTranslation('combat')

  const renderRow = (row) => {
    const bits = []
    if (row.slotLabel) bits.push(row.slotLabel)
    if (row.fireMode) bits.push(row.fireMode)
    if (row.kind === 'melee') bits.push(t('declareList.reachAllonge', { m: row.reachM ?? 0 }))
    if (row.formula) bits.push(row.formula)
    if (row.requiresGrapple) bits.push(t('declareList.requiresGrapple'))
    if (row.permanent) bits.push(t('declareList.permanentTag'))
    const reasonKey = row.disabledReason && DISABLED_KEY[row.disabledReason]
    return (
      <div
        key={row.id}
        className={`decl-wpn${row.permanent ? ' decl-wpn--permanent' : ''}`}
        data-sel={selectedRowId === row.id}
        aria-disabled={row.disabled || undefined}
        title={reasonKey ? t(reasonKey) : undefined}
        onClick={() => onPick(row)}
      >
        <span className="decl-wpn__name">
          {row.name ?? t('declareList.bareHands')}
          {bits.length > 0 && <span className="decl-wpn__sub">{bits.join(' · ')}</span>}
        </span>
        {row.ammoLabel && (
          <span className="decl-wpn__ammo" data-status={row.ammoStatus}>{row.ammoLabel}</span>
        )}
      </div>
    )
  }

  return (
    <>
      {move && (
        <div
          className="decl-move"
          data-on={move.on}
          aria-disabled={move.disabled || undefined}
          title={move.tooltip}
          onClick={() => { if (!move.disabled) move.onToggle() }}
        >
          <span className="decl-move__plus">+</span>
          <span className="decl-move__label">{t('declareList.moveLabel')}</span>
          <span className="decl-move__val">{move.valueLabel}</span>
        </div>
      )}

      <div className="decl-list">
        <div className="decl-list__eyebrow">
          {t('declareList.actionEyebrow')}
          <span className="hint">{t('declareList.actionHint')}</span>
        </div>
        {[
          { key: 'distance', rows: groups.distance, label: t('declareList.groupDistance') },
          { key: 'contact',  rows: groups.contact,  label: t('declareList.groupContact') },
        ].map(g => g.rows.length === 0 ? null : (
          <div key={g.key}>
            <div className={`decl-group decl-group--${g.key}`}>
              <span className="decl-group__glyph" />{g.label}
            </div>
            {g.rows.map(renderRow)}
          </div>
        ))}
      </div>

      {extras}
    </>
  )
}
