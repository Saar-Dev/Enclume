import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/sessionStore'

// Popup explicatif Réussite critique / Catastrophe (docs/PLANS/PLAN_TEST_CRITIQUE.md Lot 3).
// Texte seul pour l'instant, décision Saar 2026-08-04 — le déclenchement (sessionStore) est séparé
// du rendu : un futur vrai effet visuel ne remplacera que ce fichier, pas la plomberie qui l'appelle.
const DISPLAY_MS = 2200

export default function CriticalEffectOverlay() {
  const { criticalEffect, clearCriticalEffect } = useSessionStore()
  const { t } = useTranslation()
  const { t: tCombat } = useTranslation('combat')

  useEffect(() => {
    if (!criticalEffect) return
    const timer = setTimeout(clearCriticalEffect, DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [criticalEffect, clearCriticalEffect])

  if (!criticalEffect) return null

  const isCatastrophe = criticalEffect.kind === 'catastrophe_risk'

  return (
    <div
      key={criticalEffect.id}
      className={`critical-effect-banner ${isCatastrophe ? 'critical-effect-banner--catastrophe' : 'critical-effect-banner--success'}`}
      aria-live="polite"
    >
      {isCatastrophe ? tCombat('catastrophePopup') : t('dice.criticalSuccess')}
    </div>
  )
}
