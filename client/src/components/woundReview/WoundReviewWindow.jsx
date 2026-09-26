import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../../stores/characterStore'
import { useDraggable } from '../../lib/useDraggable.js'
import { useWoundReview } from '../../lib/useWoundReview.js'
import { splitGameDuration } from '../../../../shared/gameTime.js'
import { splitByPlayerType, isWindowVisible, confirmState } from '../../lib/woundReviewGestures.js'
import WoundReviewCard from './WoundReviewCard.jsx'
import WoundReviewNpcBlock from './WoundReviewNpcBlock.jsx'

// Écran de revue des guérisons (MJ) — PLAN_REVUE_GUERISON.md §12-§13. Fenêtre flottante déplaçable montée par SessionPage (PAS par la barre latérale :
// la refermer ferait disparaître l'écran et ses boutons, B6). Le serveur construit la vue, cet écran l'affiche et envoie l'intention du MJ.
//
// Reste affiché TANT QU'UNE AVANCE EST EN ATTENTE, même quand plus rien n'attend de réponse : c'est alors le geste normal (« tout est répondu,
// confirmer l'avance »). L'ancien écran se cachait quand la liste était vide et emportait « Confirmer » / « Annuler » (B5).
const PANEL_W = 640

function durationText(t, minutes) {
  const { weeks, days, hours, minutes: mins } = splitGameDuration(minutes)
  const parts = [
    weeks && t('woundReview.duration.weeks', { count: weeks }),
    days && t('woundReview.duration.days', { count: days }),
    hours && t('woundReview.duration.hours', { count: hours }),
    mins && t('woundReview.duration.minutes', { count: mins }),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : t('woundReview.duration.zero')
}

// Ton du message : l'ouverture de la ronde suivante est une ÉTAPE NORMALE (l'infection d'un Échec naît déjà due), pas une erreur.
const noticeTone = (notice) => (notice.kind === 'refusal' && notice.reason === 'nextRound' ? 'info' : 'error')

// Ce que le MJ doit lire après une action (jamais une simple ligne de console).
function noticeText(t, notice) {
  switch (notice.kind) {
    case 'loadError': return t('woundReview.notice.loadError', { message: notice.message })
    case 'error': return t('woundReview.notice.error', { message: notice.message })
    case 'partial': return t('woundReview.notice.partial', { sent: notice.sent, total: notice.total, message: notice.message })
    case 'results': return [
      notice.stale > 0 && t('woundReview.notice.stale', { count: notice.stale }),
      notice.failed > 0 && t('woundReview.notice.failed', { count: notice.failed }),
    ].filter(Boolean).join(' ')
    case 'refusal': return t(`woundReview.notice.refusal.${notice.reason}`, { count: notice.count, message: notice.message })
    default: return null
  }
}

export default function WoundReviewWindow({ campaignId }) {
  const { t } = useTranslation('combat')
  const isGm = useCharacterStore(state => state.isGm)
  const { view, busy, notice, answer, confirm, cancel } = useWoundReview({ campaignId, isGm })
  const { pos, onHeaderMouseDown } = useDraggable(
    'wound-review-window-pos',
    { top: 80, left: Math.max(8, window.innerWidth / 2 - PANEL_W / 2) },
    PANEL_W,
  )
  const [collapsed, setCollapsed] = useState(false)
  const [askingCancel, setAskingCancel] = useState(false)

  if (!isGm || !isWindowVisible(view)) return null

  const { players, npcs } = splitByPlayerType(view.cards)
  const state = confirmState(view)
  const { answerableCount, awaitingPlayerCount, queuedCount } = view.summary
  const noticeMessage = notice ? noticeText(t, notice) : null

  const onConfirm = () => { setAskingCancel(false); confirm() }
  const onCancelYes = () => { setAskingCancel(false); cancel() }

  return createPortal(
    <div className="combat-win wound-review-win" style={{ width: PANEL_W, left: pos.left, top: pos.top }} role="dialog" aria-label={t('woundReview.title')}>
      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title">{t('woundReview.title')}</span>
        <button type="button" className="btn btn-ghost" onClick={() => setCollapsed(value => !value)}>
          {collapsed ? t('woundReview.expand') : t('woundReview.reduce')}
        </button>
      </div>

      <div className="wound-review-summary" aria-live="polite">
        {view.advance.pending && (
          <strong>
            {t(view.advance.deltaMinutes < 0 ? 'woundReview.advance.backward' : 'woundReview.advance.forward', {
              duration: durationText(t, view.advance.deltaMinutes),
            })}
          </strong>
        )}
        <span className="wound-review-meta">
          {answerableCount > 0 && t('woundReview.counters.answersLeft', { count: answerableCount })}
          {awaitingPlayerCount > 0 && ` · ${t('woundReview.counters.awaitingPlayers', { count: awaitingPlayerCount })}`}
          {queuedCount > 0 && `${answerableCount > 0 ? ' · ' : ''}${t('woundReview.counters.nextRound', { count: queuedCount })}`}
        </span>
      </div>

      {!collapsed && (
        <>
          <div className="wound-review-body">
            {players.map(card => <WoundReviewCard key={card.characterId} card={card} busy={busy} onAnswer={answer} />)}
            {npcs.length > 0 && <WoundReviewNpcBlock cards={npcs} busy={busy} onAnswer={answer} />}
          </div>

          <div className="combat-win-footer">
            {busy && <div className="wound-review-meta">{t('woundReview.busy')}</div>}
            {noticeMessage && <div className="wound-review-notice" data-tone={noticeTone(notice)} role="alert">{noticeMessage}</div>}
            {view.advance.pending && (
              <>
                <div className="wound-review-meta">
                  {state.reason === 'answersLeft' && t('woundReview.footer.answersLeft', { count: state.count })}
                  {state.canConfirm && t('woundReview.footer.ready')}
                  {state.nextRoundCount > 0 && ` ${t('woundReview.footer.nextRound', { count: state.nextRoundCount })}`}
                </div>
                {askingCancel ? (
                  <div className="wound-review-footer-row">
                    <span>{t('woundReview.footer.cancelAsk')}</span>
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={onCancelYes}>{t('woundReview.footer.cancelYes')}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAskingCancel(false)}>{t('woundReview.footer.cancelNo')}</button>
                  </div>
                ) : (
                  <div className="wound-review-footer-row">
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAskingCancel(true)}>{t('woundReview.footer.cancel')}</button>
                    <button type="button" className="btn btn-gold" disabled={!state.canConfirm || busy} onClick={onConfirm}>
                      {t(state.canConfirm && state.nextRoundCount > 0 ? 'woundReview.footer.confirmNextRound' : 'woundReview.footer.confirm')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
