import { useLayoutEffect } from 'react'
import { useChanceChoiceStore } from '../stores/chanceChoiceStore.js'

// useResultPanelRect — publie la position du panneau « Résolution du tir » (CombatResultGM / CombatResultPlayer) dans le store, pour
// que la réaction de blessure (WoundReactionDock) s'ancre AU-DESSUS, sur le même axe (maquette, planche I). Mesure réelle
// (getBoundingClientRect + ResizeObserver + resize fenêtre), jamais une hauteur supposée : le panneau varie (Choc, absorption…) et
// vit dans des conteneurs différents (CombatOverlay, EnvironmentalResultQueue). Retire sa mesure au démontage.
export function useResultPanelRect(ref) {
  const setResultPanelRect = useChanceChoiceStore(s => s.setResultPanelRect)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const publish = () => {
      const { left, top, width } = element.getBoundingClientRect()
      setResultPanelRect({ left, top, width })
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    window.addEventListener('resize', publish)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publish)
      setResultPanelRect(null)
    }
  }, [ref, setResultPanelRect])
}
