import { useSessionStore } from '../stores/sessionStore'

// Bandeau transitoire « declaration de combat refusee » du pied des 3 fenetres de declaration
// (PLAN_RW_DECLARE_WINDOWS module 3). Presentation pure : lit sessionStore.declareError, pose par
// useCombatSocket#onDeclareError sur COMBAT_DECLARE_ERROR (le meme evenement alimente aussi le chat)
// et auto-efface au bout de 4 s par useCombatSocket. Aucun socket.on ici (REACT.md P57). Meme
// separation declenchement / rendu que CriticalEffectOverlay.jsx.
export default function CombatDeclareErrorBanner() {
  const declareError = useSessionStore(s => s.declareError)
  if (!declareError) return null
  return (
    <div key={declareError.id} className="combat-declare-error-banner" role="alert">
      ⚠ {declareError.message}
    </div>
  )
}
