import { useEffect } from 'react'
import { useCharacterStore } from '../stores/characterStore.js'
import { populateGauges } from './gaugesDataSync.js'

// PLAN_WIZARD_MATERIEL_GAUGES.md §6 — façade store pour StepMaterielEtBiens (Wizard) et GaugesPanel
// (fiche permanente), même patron que useInventoryData.js. Un seul fetch initial peuple le store si
// absent pour ce characterId ; les mutations ultérieures arrivent par setGauge (WS ou réponse HTTP),
// plus de fetch répété par panneau.
export function useGaugesData(characterId) {
  const gauges = useCharacterStore(s => s.gaugesByCharId[characterId])

  useEffect(() => {
    if (!characterId || gauges !== undefined) return
    populateGauges(characterId)
  }, [characterId, gauges])

  return {
    gauges: gauges ?? {},
    loading: gauges === undefined,
  }
}
