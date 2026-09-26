import { useTranslation } from 'react-i18next'
import OutcomeButtons from './OutcomeButtons.jsx'
import { locationLabel, severityLongLabel } from './woundLabels.js'
import { healingEntriesForLine, successConsequence, lineStepLabels } from '../../lib/woundReviewGestures.js'

// Une ligne du compteur de blessures (localisation + gravité) = UN Test (RAW « Localisation par Localisation ») : la réponse vaut pour toutes ses cases
// échues. Le geste d'EXCEPTION du MJ : répondre ligne par ligne quand un personnage n'a pas eu tout son matériel de soin.
export default function WoundReviewLine({ line, busy, onAnswer }) {
  const { t } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')

  const steps = lineStepLabels(line)
  const consequence = successConsequence(line)
  const targetLabel = consequence?.target ? severityLongLabel(t, tChar, consequence.target, line.location) : null

  let consequenceText = null
  if (consequence?.kind === 'becomes') {
    consequenceText = targetLabel ? t('woundReview.line.consequence.becomes', { target: targetLabel }) : t('woundReview.line.consequence.gone')
  } else if (consequence?.kind === 'continues') {
    consequenceText = t('woundReview.line.consequence.continues', { steps: consequence.steps.join(' · ') })
  } else if (consequence?.kind === 'mixed') {
    consequenceText = targetLabel
      ? t('woundReview.line.consequence.mixed', { target: targetLabel })
      : t('woundReview.line.consequence.continues', { steps: consequence.steps.join(' · ') })
  }

  return (
    <div className="wound-review-line" data-queued={!line.answerable}>
      <div className="wound-review-line-head">
        <strong>
          {t('woundReview.line.title', {
            location: locationLabel(tChar, line.location),
            severity: severityLongLabel(t, tChar, line.severity, line.location),
          })}
        </strong>
        <span className="wound-review-meta">
          {t('woundReview.line.cases', { count: line.cases })}
          {line.answerable && line.dueCases < line.cases && ` · ${t('woundReview.line.dueOf', { count: line.dueCases })}`}
          {steps.length > 0 && ` · ${t('woundReview.line.week', { steps: steps.join(' · ') })}`}
        </span>
      </div>
      {line.answerable ? (
        <>
          {consequenceText && <div className="wound-review-meta">{consequenceText}</div>}
          <OutcomeButtons disabled={busy} onPick={outcome => onAnswer({ healing: healingEntriesForLine(line, outcome) })} />
        </>
      ) : (
        <div className="wound-review-meta">{t('woundReview.line.queued')}</div>
      )}
    </div>
  )
}
