import { useTranslation } from 'react-i18next'
import { INFECTION_MODES } from '../../lib/woundReviewGestures.js'

// Les deux modes d'un Test d'infection : jet serveur (`auto`) ou jet du joueur (`player`). `modes` restreint l'offre : une infection déjà en attente
// d'un joueur ne propose plus que `auto` (le MJ peut débloquer un joueur absent).
const VARIANT = { auto: 'btn', player: 'btn btn-ghost' }

export default function InfectionModeButtons({ onPick, disabled = false, modes = INFECTION_MODES }) {
  const { t } = useTranslation('combat')
  return (
    <div className="wound-review-actions">
      {modes.map(mode => (
        <button key={mode} type="button" className={VARIANT[mode]} disabled={disabled} onClick={() => onPick(mode)}>
          {t(`woundReview.infectionMode.${mode}`)}
        </button>
      ))}
    </div>
  )
}
