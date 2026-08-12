import { useTranslation } from 'react-i18next'

// Bandeau explicatif permanent en haut de chaque étape (bug #18, docs/BUG WIZARD.md) — distinct
// des tooltips ponctuels déjà existants. Un seul point d'intégration (WizardCreation.jsx) plutôt
// qu'un <StepTutorial> dupliqué dans chaque composant d'étape : la clé `stepN.tutorial` couvre
// tous les cas, y compris les sous-étapes (Step4Experience) qui ne remontent pas leur navigation
// interne ici. Absence de clé (ex. step6, "Matériel et biens", texte pas encore rédigé) = aucun
// rendu, pas de fallback affiché.
export default function StepTutorial({ step }) {
  const { t } = useTranslation('creation')
  const text = t(`step${step}.tutorial`, { defaultValue: '' })
  if (!text) return null
  return (
    <div className="wiz-tutorial">
      <span className="wiz-tutorial-icon" aria-hidden="true">ⓘ</span>
      <p className="wiz-tutorial-text">{text}</p>
    </div>
  )
}
