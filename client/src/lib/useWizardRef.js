import { useCallback, useEffect } from 'react'
import { useCreationStore, wizardRefKey } from '../stores/creationStore.js'

// Façade React sur le cache des données de référence du Wizard (creationStore.refData) — même rôle
// que useInventoryData.js pour l'inventaire. `kind` : 'step4' | 'step5' | 'skills'. `data` reste null
// tant que le catalogue n'est pas arrivé (`loading`) ou si la requête a échoué (`failed`, relançable
// par `retry`) ; il ne repasse jamais à null une fois chargé, même si l'étape qui l'utilise est
// remontée (WizardCreation.jsx#gmSyncKey).
export function useWizardRef(kind, sheetId) {
  const needsSheet = kind !== 'skills'
  const key = wizardRefKey(kind, sheetId)
  const entry = useCreationStore(s => s.refData[key])
  const ensureRef = useCreationStore(s => s.ensureRef)
  const ready = !needsSheet || !!sheetId

  useEffect(() => {
    if (ready && !entry) ensureRef(kind, sheetId)
  }, [ready, entry, ensureRef, kind, sheetId])

  const retry = useCallback(() => ensureRef(kind, sheetId, true), [ensureRef, kind, sheetId])

  return {
    data: entry?.status === 'ready' ? entry.data : null,
    loading: !ready || !entry || entry.status === 'loading',
    failed: entry?.status === 'error',
    retry,
  }
}

// Vrai tant qu'au moins un des catalogues n'est pas utilisable (en chargement ou en échec).
export const wizardRefsPending = (refs) => refs.some(r => r.loading || r.failed)
