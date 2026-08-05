import { useEffect, useMemo } from 'react'
import { useCharacterStore } from '../stores/characterStore.js'
import { populateInventory } from './inventoryDataSync.js'
import { computeTotalWeight } from '../../../shared/inventoryMath.js'

// PLAN_INVENTORY_UX.md §3.2 — façade store pour ArmorWoundPanel/WeaponPanel/InventoryPanel
// (fiche permanente et Wizard/StepMaterielEtBiens, même composant InventoryPanel.jsx réutilisé).
// Un seul fetch initial peuple le store si absent pour ce characterId (dédup dans inventoryDataSync.js) ;
// les mutations ultérieures arrivent par upsert/remove incrémental (WS ou réponse HTTP locale), plus de
// fetch répété par panneau.
export function useInventoryData(characterId) {
  const items      = useCharacterStore(s => s.inventoryByCharId[characterId])
  const threshold  = useCharacterStore(s => s.thresholdByCharId[characterId] ?? 0)
  const iniPenalty = useCharacterStore(s => s.iniPenaltyByCharId[characterId] ?? 0)
  const sols       = useCharacterStore(s => s.solsByCharId[characterId] ?? 0)
  const handPref   = useCharacterStore(s => s.handPrefByCharId[characterId] ?? 'R')

  useEffect(() => {
    if (!characterId || items !== undefined) return
    populateInventory(characterId)
  }, [characterId, items])

  // total_weight est une pure somme sur les items déjà en store (shared/inventoryMath.js, même
  // formule que le serveur) — pas besoin d'attendre un round-trip réseau pour rester à jour après
  // un upsert/remove incrémental.
  const totalWeight = useMemo(() => computeTotalWeight(items ?? []), [items])

  return {
    items: items ?? [],
    totalWeight,
    threshold,
    iniPenalty,
    sols,
    handPref,
    loading: items === undefined,
  }
}
