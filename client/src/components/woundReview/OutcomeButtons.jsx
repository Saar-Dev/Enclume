import { useTranslation } from 'react-i18next'
import { HEALING_OUTCOMES } from '../../lib/woundReviewGestures.js'

// Les trois issues d'un Test de guérison. Un seul composant pour tous les niveaux de geste (toute la carte, tous les PNJ, une ligne) :
// libellé « Réussite » (le RAW parle du résultat du Test) — la valeur envoyée au serveur reste `amelioration` (shared/woundConstants.js).
const VARIANT = { amelioration: 'btn', echec: 'btn btn-ghost', catastrophe: 'btn btn-danger' }

export default function OutcomeButtons({ onPick, disabled = false }) {
  const { t } = useTranslation('combat')
  return (
    <div className="wound-review-actions">
      {HEALING_OUTCOMES.map(outcome => (
        <button key={outcome} type="button" className={VARIANT[outcome]} disabled={disabled} onClick={() => onPick(outcome)}>
          {t(`woundReview.outcome.${outcome}`)}
        </button>
      ))}
    </div>
  )
}
