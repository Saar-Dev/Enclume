// client/src/components/creation/WizardStepErrorBoundary.jsx
import { Component } from 'react'

// Filet de sécurité (docs/EN_COURS.md) : un rendu qui plante dans une sous-étape du Wizard faisait
// disparaître toute l'application (React démonte l'arbre sur une exception non catchée) — écran
// blanc, aucune stack visible pour l'utilisateur, bug réel signalé par Saar mais non reproductible
// en lecture statique. Ce filet logue la stack complète en console (marqueur [DBG-WIZCRASH], à
// retirer une fois la vraie cause identifiée) et affiche un message récupérable au lieu de l'écran
// blanc — jamais de reset du store ni de perte de données côté serveur. `key={step}` posé par
// l'appelant (WizardCreation.jsx) remonte ce composant à chaque changement d'étape, effaçant l'état
// d'erreur sans qu'il ne reste bloqué sur une étape que l'utilisateur a quittée.
export default class WizardStepErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[DBG-WIZCRASH]', error, error?.stack, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wiz-error">
          {this.props.message}{' '}
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>
            {this.props.reloadLabel}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
