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
// `swap` = « Permuter » (PLAN_PRISE_EN_MAIN.md, Lot B2b) : { isActive(row), isChosen(row), incomingId, onOpen(row) } | null. Chaque ligne
//   d'arme à distance, de contact et « Mains nues » reçoit un bouton ⇄ à côté de ↻ : il ouvre l'extension « Permuter » en colonne 2 (une
//   action = une extension). `isActive` = l'extension est ouverte pour cette ligne, `isChosen` = une permutation est déjà choisie
//   pour elle, `incomingId` = l'objet mis en main par la permutation choisie (étiquette « permutée »). Absent (null) = aucune permutation
//   (fenêtre Exo). Fenêtres joueur et MJ : les candidats (Sac / Ceinture) sont listés par CombatSwapPanel, en colonne 2.
// `heldRows` = objets en main auxquels la liste n'a aucune ligne d'action (bouclier…) — lignes d'inventaire, avec `slot` : leur corps ne
//   fait rien, seul ⇄ agit. Sans `swap`, jamais rendues.
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
  swap = null,          // { isActive, isChosen, incomingId, onOpen } | null — cf. en-tête
  heldRows = [],        // objets en main sans ligne d'action — cf. en-tête
  reload = null,        // { active, onToggle, onQuickReload } — ↻ permanent sur chaque arme à distance
                        //   (quel que soit son état de munitions) : onQuickReload(row) sélectionne
                        //   l'arme et active Recharger en un clic ; onToggle désactive Recharger sur
                        //   l'arme déjà active.
  extras = null,        // ReactNode rendu sous la liste
}) {
  const { t } = useTranslation('combat')

  // ⇄ : ouvre l'extension « Permuter » de cette ligne ; le clic ne sélectionne pas l'action de la ligne.
  const renderSwapButton = (row) => (
    <button
      type="button"
      className="decl-wpn__reload decl-wpn__swap"
      data-active={swap.isActive(row) || undefined}
      data-chosen={swap.isChosen(row) || undefined}
      title={t('declareList.swapButton')}
      onClick={e => { e.stopPropagation(); swap.onOpen(row) }}
    >⇄</button>
  )

  const renderRow = (row) => {
    const bits = []
    if (row.slotLabel) bits.push(row.slotLabel)
    if (row.fireMode) bits.push(row.fireMode)
    if (row.kind === 'melee') bits.push(t('declareList.reachAllonge', { m: row.reachM ?? 0 }))
    if (row.formula) bits.push(row.formula)
    if (row.requiresGrapple) bits.push(t('declareList.requiresGrapple'))
    if (row.permanent) bits.push(t('declareList.permanentTag'))
    const reasonKey = row.disabledReason && DISABLED_KEY[row.disabledReason]
    // Recharger (retour Saar) : icône permanente sur toute ligne à distance, jamais conditionnée à
    // la sélection ni à l'état des munitions — le grisage "chargeur vide" ne bloque que le Tir
    // (corps de la ligne), jamais l'accès à Recharger. Ligne déjà l'arme en cours de Recharger →
    // le clic désactive ; sinon il sélectionne cette arme et active Recharger directement.
    const isReloadingThis = selectedRowId === row.id && reload?.active
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
        {swap && swap.incomingId === row.id && <span className="decl-wpn__tag">{t('declareList.swappedTag')}</span>}
        {row.ammoLabel && (
          <span className="decl-wpn__ammo" data-status={row.ammoStatus}>{row.ammoLabel}</span>
        )}
        {reload && row.group === 'distance' && (
          <button
            type="button"
            className="decl-wpn__reload"
            data-active={isReloadingThis || undefined}
            title={t('actionWindow.reloadButtonLabel')}
            onClick={e => { e.stopPropagation(); isReloadingThis ? reload.onToggle() : reload.onQuickReload(row) }}
          >↻</button>
        )}
        {swap && (row.kind === 'ranged' || row.kind === 'melee' || row.kind === 'bare') && renderSwapButton(row)}
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
          <span className="decl-move__glyph" aria-hidden="true" />
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

      {swap && heldRows.length > 0 && (
        <div className="decl-list">
          {heldRows.map(item => {
            const row = { id: item.id, kind: 'held' }
            return (
              <div key={item.id} className="decl-wpn" data-held>
                <span className="decl-wpn__name">
                  {item.custom_name || item.ref_name}
                  {item.slot && <span className="decl-wpn__sub">{item.slot}</span>}
                </span>
                {swap.incomingId === item.id && <span className="decl-wpn__tag">{t('declareList.swappedTag')}</span>}
                {renderSwapButton(row)}
              </div>
            )
          })}
        </div>
      )}

      {extras}
    </>
  )
}
