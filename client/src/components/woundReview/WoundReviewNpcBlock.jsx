import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import OutcomeButtons from './OutcomeButtons.jsx'
import WoundReviewCard from './WoundReviewCard.jsx'
import { healingEntriesForCards, infectionEntriesForCards, cardAnswerableCount } from '../../lib/woundReviewGestures.js'

// Les PNJ sont REPLIÉS (le RAW réserve le système détaillé aux PJ et à leurs adversaires marquants) mais jamais ignorés : leurs échéances bloquent
// « Confirmer » comme les autres, donc le bloc affiche son nombre de réponses restantes et offre le même geste pour TOUS les PNJ.
// Les cartes ne sont pas rendues tant que le bloc est replié (la base en compte déjà des dizaines).
export default function WoundReviewNpcBlock({ cards, busy, onAnswer }) {
  const { t } = useTranslation('combat')
  const [open, setOpen] = useState(false)

  const remaining = cards.reduce((total, card) => total + cardAnswerableCount(card), 0)
  const canAnswerHealing = healingEntriesForCards(cards, 'amelioration').length > 0
  const autoInfections = infectionEntriesForCards(cards, 'auto')

  return (
    <section className="wound-review-npc">
      <header className="wound-review-npc-head">
        <strong>{t('woundReview.npc.title', { count: cards.length })}</strong>
        <span className="wound-review-meta">{t('woundReview.npc.remaining', { count: remaining })}</span>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(value => !value)}>
          {open ? t('woundReview.npc.hide') : t('woundReview.npc.show')}
        </button>
      </header>

      {canAnswerHealing && (
        <div className="wound-review-gesture">
          <span>{t('woundReview.npc.answerAll')}</span>
          <OutcomeButtons disabled={busy} onPick={outcome => onAnswer({ healing: healingEntriesForCards(cards, outcome) })} />
        </div>
      )}
      {autoInfections.length > 0 && (
        <div className="wound-review-gesture">
          <button type="button" className="btn" disabled={busy} onClick={() => onAnswer({ infection: autoInfections })}>
            {t('woundReview.npc.infectionsAuto')}
          </button>
        </div>
      )}

      {open && cards.map(card => <WoundReviewCard key={card.characterId} card={card} busy={busy} onAnswer={onAnswer} />)}
    </section>
  )
}
