import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { SEVERITY, LOC } from '../lib/combatResultLabels.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useChanceChoiceStore } from '../stores/chanceChoiceStore.js'
import { useChanceCountdown } from '../lib/useChanceCountdown.js'
import {
  selectWoundReactions, reactionTitleKey, optionLabel, remainingRatio, chanceAfterCheapest, splitStack,
} from '../lib/woundReactionModel.js'

// WoundReactionDock — « réaction de blessure » : LE seul endroit où s'affiche le choix de Chance d'une blessure (plus de carte
// flottante en haut à droite). Maquette de référence, validée par Saar : docs/PLANS/maquette-chance-reaction/preview.html
// (planches A-F, ancrage planche I). Toujours du côté du BLESSÉ : le joueur propriétaire pour un PJ, le MJ pour un PNJ (le filtrage
// d'audience est fait à l'alimentation du store, CatastropheChoiceQueue). Le serveur décide de tout (s'il y a une réaction, ce
// qu'elle coûte) ; ce composant ne fait que la présenter et renvoyer le choix (`choice: null` = « Accepter »).
//
// Ancrage : au-dessus du panneau « Résolution du tir » sur le même axe quand il est affiché (position mesurée, publiée par
// useResultPanelRect), sinon à l'endroit où ce panneau apparaîtrait (MJ : bas à gauche, joueur : bas au centre).
//  - MJ, plusieurs blessés (explosion) : pile compacte, une ligne par blessé, la plus grave d'abord (planche E) ; « Chance » déplie
//    la ligne en carte complète.
//  - Joueur, plusieurs réactions : une carte, la plus grave d'abord, « Réaction 1 / 2 » (planche F).
// Un choix disparaît de l'écran quand le serveur confirme (CHANCE_CHOICE_RESOLVED, retiré du store par CatastropheChoiceQueue) —
// jamais d'optimisme ; les boutons sont désactivés dès le clic pour éviter le double envoi.

const DOCK_WIDTH = 300
const DOCK_GAP = 8

export default function WoundReactionDock({ socket }) {
  const { t } = useTranslation('combat')
  const { isGm, characters } = useCharacterStore()
  const entries = useChanceChoiceStore(s => s.entries)
  const resultPanelRect = useChanceChoiceStore(s => s.resultPanelRect)
  const [expandedId, setExpandedId] = useState(null)

  const reactions = useMemo(() => selectWoundReactions(entries), [entries])
  if (reactions.length === 0) return null

  const resolve = (entry, choice) => socket?.emit(WS.CHANCE_CHOICE_RESOLVE, { pendingId: entry.id, choice })
  const isPnj = (entry) => characters.find(c => c.id === entry.characterId)?.type === 'pnj'

  // Position : au-dessus du panneau de résolution (même axe), sinon là où il apparaîtrait.
  const geometry = resultPanelRect
    ? {
      left: Math.max(8, isGm ? resultPanelRect.left : resultPanelRect.left + resultPanelRect.width / 2 - DOCK_WIDTH / 2),
      bottom: window.innerHeight - resultPanelRect.top + DOCK_GAP,
    }
    : { left: isGm ? 24 : `calc(50% - ${DOCK_WIDTH / 2}px)`, bottom: 24 }

  const stacked = isGm && reactions.length > 1
  const expanded = stacked ? reactions.find(r => r.id === expandedId) : null
  const { shown, hiddenCount } = splitStack(reactions)

  return (
    <div className="wound-reaction-dock" style={geometry} data-testid="wound-reaction-dock">
      {stacked ? (
        <>
          {expanded && (
            <ReactionCard key={expanded.id} entry={expanded} isGm isPnj={isPnj(expanded)} t={t} onResolve={resolve} />
          )}
          <div className="wound-reaction-stack">
            {shown.filter(r => r.id !== expanded?.id).map(entry => (
              <StackRow key={entry.id} entry={entry} t={t} onOpen={() => setExpandedId(entry.id)} />
            ))}
            {hiddenCount > 0 && <div className="wound-reaction-more">{t('chance.reaction.moreRows', { count: hiddenCount })}</div>}
          </div>
        </>
      ) : (
        <ReactionCard
          key={reactions[0].id}
          entry={reactions[0]}
          isGm={isGm}
          isPnj={isPnj(reactions[0])}
          t={t}
          onResolve={resolve}
          pager={reactions.length > 1 ? { index: 1, total: reactions.length, next: reactions[1] } : null}
        />
      )}
    </div>
  )
}

// Une ligne de la pile MJ (planche E) : nom, gravité, « Chance », temps restant.
function StackRow({ entry, t, onOpen }) {
  const remaining = useChanceCountdown(entry.rolledAt, entry.timeoutMs)
  const severityColor = SEVERITY[entry.woundSeverity]?.col
  return (
    <div className="wound-reaction-row" style={{ '--sev': severityColor }}>
      <span className="wound-reaction-row-name">{entry.subjectLabel}</span>
      <span className="wound-reaction-row-sev">{t(reactionTitleKey(entry))}</span>
      <button className="btn btn-gold" onClick={onOpen}>{t('chance.reaction.chanceButton')}</button>
      <span className="wound-reaction-row-time">{remaining != null ? t('chance.reaction.seconds', { seconds: remaining }) : ''}</span>
    </div>
  )
}

// La carte de réaction (planches A, C, D, F).
function ReactionCard({ entry, isGm, isPnj, t, onResolve, pager = null }) {
  const remaining = useChanceCountdown(entry.rolledAt, entry.timeoutMs)
  const [open, setOpen] = useState(entry.fatal) // une Mort n'a qu'une option de rachat : montrée d'emblée (planche A)
  const [busy, setBusy] = useState(false)

  const ratio = remainingRatio(remaining, entry.timeoutMs)
  const options = entry.options ?? []
  const after = chanceAfterCheapest(entry.chcAvailable, options)
  const send = (choice) => { setBusy(true); onResolve(entry, choice) }
  const severityColor = SEVERITY[entry.woundSeverity]?.col
  const locationKey = LOC[entry.woundLocation]

  return (
    <div className="wound-reaction" style={{ '--sev': severityColor }}>
      {pager && (
        <div className="wound-reaction-pager">
          <span>{t('chance.reaction.pager', { index: pager.index, total: pager.total })}</span>
          <span>{t('chance.reaction.pagerNext', {
            severity: t(reactionTitleKey(pager.next)),
            location: LOC[pager.next.woundLocation] ? t(LOC[pager.next.woundLocation]) : '',
          })}</span>
        </div>
      )}

      <div className="wound-reaction-head">
        <i className="wound-reaction-dot" />
        <b>{t(reactionTitleKey(entry))}</b>
        <span className="wound-reaction-loc">{locationKey ? t(locationKey) : ''}</span>
        <span className="wound-reaction-name">{entry.subjectLabel}</span>
      </div>

      {entry.fatal && !isGm && <div className="wound-reaction-line">{t('chance.reaction.fatalLine')}</div>}

      {open && (
        <div className="wound-reaction-opts">
          {options.map(option => {
            const label = optionLabel(entry, option)
            return (
              <button key={option.choice} className="wound-reaction-opt" disabled={busy} onClick={() => send(option.choice)}>
                <span>{t(label.key, { ...label.params, severity: label.params.severity ? t(`resultPanels.severity.${label.params.severity}`) : undefined })}</span>
                <span className="wound-reaction-cost">{t('chance.reaction.cost', { count: option.cost })}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="wound-reaction-actions">
        {!open && (
          <button className="btn btn-gold" disabled={busy} onClick={() => setOpen(true)}>{t('chance.reaction.chanceButton')} ▾</button>
        )}
        <button
          className={`btn ${entry.fatal ? 'btn-danger' : 'btn-ghost'}`}
          disabled={busy}
          onClick={() => send(null)}
        >
          {t(entry.fatal ? 'chance.choiceCard.acceptDeath' : 'chance.choiceCard.acceptWound')}
        </button>
      </div>

      {open && entry.chcAvailable != null && (
        <div className="wound-reaction-chc">
          {isPnj
            ? t('chance.reaction.chcPnj', { chc: entry.chcAvailable })
            : t('chance.reaction.chcPlayer', { chc: entry.chcAvailable, after })}
        </div>
      )}

      {ratio != null ? (
        <div className="wound-reaction-bar">
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
          <span>{t('chance.reaction.seconds', { seconds: remaining })}</span>
        </div>
      ) : (
        entry.fatal && <div className="wound-reaction-wait">{t('chance.reaction.waiting')}</div>
      )}
    </div>
  )
}
