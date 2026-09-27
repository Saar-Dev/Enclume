import { useTranslation } from 'react-i18next'
import OutcomeButtons from './OutcomeButtons.jsx'
import { locationLabel, severityLongLabel } from './woundLabels.js'
import { healingEntriesForLocation, successConsequence, lineStepLabels } from '../../lib/woundReviewGestures.js'

// Une localisation d'un personnage = UN Test de soins (RAW « Localisation par Localisation, quel que soit le nombre de cases cochées sur chaque ligne »,
// REGLEBLESSURES.md:386-392) : UNE seule réponse pour toutes ses blessures échues, quelle que soit la gravité (le serveur refuse toute autre forme). Le détail
// par gravité (cases, étapes, conséquence de « Réussite ») est en lecture seule. Le geste d'EXCEPTION du MJ : répondre localisation par localisation quand un
// personnage n'a pas eu tout son matériel de soin.
export default function WoundReviewLocation({ card, location, busy, onAnswer }) {
  const { t } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')

  return (
    <div className="wound-review-line" data-queued={!location.answerable}>
      <div className="wound-review-line-head">
        <strong>{locationLabel(tChar, location.location)}</strong>
        <span className="wound-review-meta">{location.answerable ? t('woundReview.card.dueCases', { count: location.dueCases }) : t('woundReview.queued')}</span>
      </div>

      {location.lines.map(line => <LineDetail key={line.severity} line={line} location={location.location} />)}

      {location.answerable && (
        <OutcomeButtons disabled={busy} onPick={outcome => onAnswer({ healing: healingEntriesForLocation(card, location, outcome) })} />
      )}
    </div>
  )
}

// Ce que « Réussite » fait à UNE gravité de la localisation (d'après les champs du serveur : le client ne calcule rien).
function LineDetail({ line, location }) {
  const { t } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')

  const steps = lineStepLabels(line)
  const consequence = successConsequence(line)
  const targetLabel = consequence?.target ? severityLongLabel(t, tChar, consequence.target, location) : null

  let consequenceText = null
  if (consequence?.kind === 'becomes') {
    consequenceText = targetLabel ? t('woundReview.location.consequence.becomes', { target: targetLabel }) : t('woundReview.location.consequence.gone')
  } else if (consequence?.kind === 'continues') {
    consequenceText = t('woundReview.location.consequence.continues', { steps: consequence.steps.join(' · ') })
  } else if (consequence?.kind === 'mixed') {
    consequenceText = targetLabel
      ? t('woundReview.location.consequence.mixed', { target: targetLabel })
      : t('woundReview.location.consequence.continues', { steps: consequence.steps.join(' · ') })
  }

  return (
    <div className="wound-review-meta">
      {t('woundReview.location.cases', { severity: severityLongLabel(t, tChar, line.severity, location), count: line.cases })}
      {line.dueCases > 0 && line.dueCases < line.cases && ` · ${t('woundReview.location.dueOf', { count: line.dueCases })}`}
      {steps.length > 0 && ` · ${t('woundReview.location.week', { steps: steps.join(' · ') })}`}
      {line.dueCases === 0 && ` · ${t('woundReview.queued')}`}
      {consequenceText && ` — ${consequenceText}`}
    </div>
  )
}
