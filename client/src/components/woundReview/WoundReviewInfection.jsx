import { useTranslation } from 'react-i18next'
import InfectionModeButtons from './InfectionModeButtons.jsx'
import { locationLabel, severityShortLabel } from './woundLabels.js'
import { infectionEntryFor } from '../../lib/woundReviewGestures.js'

// Un Test d'infection né d'un Échec / d'une Catastrophe : le MJ choisit qui lance le dé (serveur ou joueur). Une infection déjà envoyée au joueur
// dit « en attente du joueur » et ne propose plus que le lancer automatique (débloquer un joueur absent).
export default function WoundReviewInfection({ infection, busy, onAnswer }) {
  const { t } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')
  const waiting = infection.status === 'awaiting_player_roll'

  return (
    <div className="wound-review-line" data-queued={!infection.answerable}>
      <div className="wound-review-line-head">
        <strong>
          {t('woundReview.infection.title', {
            location: locationLabel(tChar, infection.location),
            severity: severityShortLabel(tChar, infection.severity, infection.location),
          })}
        </strong>
        <span className="wound-review-meta">
          {t('woundReview.infection.rolls', { count: infection.rollsNeeded })}
          {waiting && ` · ${t('woundReview.infection.awaitingPlayer')}`}
        </span>
      </div>
      {infection.answerable ? (
        <InfectionModeButtons
          disabled={busy}
          modes={waiting ? ['auto'] : undefined}
          onPick={mode => onAnswer({ infection: [infectionEntryFor(infection, mode)] })}
        />
      ) : (
        <div className="wound-review-meta">{t('woundReview.line.queued')}</div>
      )}
    </div>
  )
}
