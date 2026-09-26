import { useTranslation } from 'react-i18next'
import OutcomeButtons from './OutcomeButtons.jsx'
import InfectionModeButtons from './InfectionModeButtons.jsx'
import WoundReviewLine from './WoundReviewLine.jsx'
import WoundReviewInfection from './WoundReviewInfection.jsx'
import { locationLabel, severityShortLabel } from './woundLabels.js'
import { SEVERITY_COLORS } from '../../../../shared/woundConstants.js'
import {
  healingEntriesForCard, infectionEntriesForCard, orphanEntries, cardDueCases,
} from '../../lib/woundReviewGestures.js'

// Une carte par personnage : son ÉTAT en texte, puis le geste PAR DÉFAUT (une issue pour toutes ses blessures échues — 90 % des cas : un personnage
// soigné guérit partout), puis le geste d'EXCEPTION replié (« Détail par blessure »). La carte dit toujours ce qu'elle va faire (« 6 cases de blessure »).
export default function WoundReviewCard({ card, busy, onAnswer }) {
  const { t } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')
  const { t: tStatus } = useTranslation() // `status.*` : namespace commun

  const dueCases = cardDueCases(card)
  const answerableInfections = infectionEntriesForCard(card, 'auto')
  const askablePlayers = infectionEntriesForCard(card, 'player')
  const orphans = orphanEntries(card)
  const orphanCount = orphans.healing.length + orphans.infection.length
  const hasDetail = card.lines.length > 0 || card.infections.length > 0
  const { wounds, woundPenalty, testBlocked, statuses } = card.state

  return (
    <section className="wound-review-card">
      <header className="wound-review-card-head">
        <strong className="wound-review-name">{card.name}</strong>
        {statuses.map(code => (
          <span key={code} className="wound-review-status">{tStatus(`status.${code}`, { defaultValue: code })}</span>
        ))}
      </header>

      <div className="wound-review-state">
        {wounds.length === 0 && <span className="wound-review-meta">{t('woundReview.card.noWound')}</span>}
        {wounds.map(w => (
          <span key={`${w.location}:${w.severity}`} className="wound-review-wound" style={{ '--wound-color': SEVERITY_COLORS[w.severity] }}>
            {t('woundReview.card.wound', {
              location: locationLabel(tChar, w.location), severity: severityShortLabel(tChar, w.severity, w.location), count: w.cases,
            })}
          </span>
        ))}
        {woundPenalty < 0 && <span className="wound-review-meta">{t('woundReview.card.penalty', { value: woundPenalty })}</span>}
        {testBlocked && <span className="wound-review-warning">{t('woundReview.card.testBlocked')}</span>}
      </div>

      {dueCases > 0 && (
        <div className="wound-review-gesture">
          <span>{t('woundReview.card.dueCases', { count: dueCases })}</span>
          <OutcomeButtons disabled={busy} onPick={outcome => onAnswer({ healing: healingEntriesForCard(card, outcome) })} />
        </div>
      )}

      {answerableInfections.length > 0 && (
        <div className="wound-review-gesture">
          <span>{t('woundReview.card.infections', { count: answerableInfections.length })}</span>
          <InfectionModeButtons
            disabled={busy}
            modes={askablePlayers.length > 0 ? undefined : ['auto']}
            onPick={mode => onAnswer({ infection: infectionEntriesForCard(card, mode) })}
          />
        </div>
      )}

      {orphanCount > 0 && (
        <div className="wound-review-gesture wound-review-anomaly">
          <span>
            {[...orphans.healing.map(() => 'healing'), ...orphans.infection.map(() => 'infection')]
              .map((type, index) => <span key={index} className="wound-review-warning">{t('woundReview.card.anomaly', { type: t(`woundReview.card.anomalyType.${type}`) })}</span>)}
          </span>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onAnswer(orphans)}>
            {t('woundReview.card.closeAnomalies')}
          </button>
        </div>
      )}

      {dueCases === 0 && answerableInfections.length === 0 && orphanCount === 0 && (
        <div className="wound-review-meta">{t('woundReview.card.nothingDue')}</div>
      )}

      {hasDetail && (
        <details className="wound-review-details">
          <summary>{t('woundReview.card.details')}</summary>
          {card.lines.map(line => <WoundReviewLine key={line.key} line={line} busy={busy} onAnswer={onAnswer} />)}
          {card.infections.map(infection => (
            <WoundReviewInfection key={infection.echeanceId} infection={infection} busy={busy} onAnswer={onAnswer} />
          ))}
        </details>
      )}
    </section>
  )
}
