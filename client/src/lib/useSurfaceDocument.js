import { useCallback, useEffect, useRef, useState } from 'react'
import { persistSurfaceDocument } from './surfacePersistence.js'
import { normalizeSurfaceData } from './surfaceData.js'

const cloneSurfaceData = (data) => JSON.parse(JSON.stringify(data))

// Le document Surface d'Editor3D.jsx : état courant, pile d'annulation/rétablissement fusionnable
// (§12.10 point 5, PLAN_WORLD_BUILDER_REWORK.md), file de sauvegarde fire-and-forget avec suivi de
// révision et base de résolution de conflit. Un seul hook plutôt que plusieurs (annulation / file de
// sauvegarde séparées envisagées au §16.2 du plan) — extrait de PLAN_WORLD_BUILDER_REWORK.md §16.11 :
// ces trois responsabilités partagent `surfaceDataRef`/`surfaceQueuedBaseRef` et s'appellent
// directement l'une l'autre (`handleSurfaceDataChange` appelle la sauvegarde à chaque commit) — les
// séparer aurait exigé une interface artificielle entre deux hooks pour un gain nul, plutôt qu'une
// vraie réduction de couplage.
export function useSurfaceDocument({
  battlemap,
  battlemapRef,
  setBattlemap,
  activeEditorTab,
  surfaceUndoRequest,
  surfaceRedoRequest,
  onSurfaceUndoStateChange,
  onSurfaceRedoStateChange,
}) {
  const [surfaceData, setSurfaceData] = useState(() => normalizeSurfaceData(null))
  const [surfaceSaveError, setSurfaceSaveError] = useState(null)
  const [surfaceUndoDepth, setSurfaceUndoDepth] = useState(0)
  const [surfaceRedoDepth, setSurfaceRedoDepth] = useState(0)

  const isSurfaceDirty = useRef(false)
  const surfaceUndoStackRef = useRef([])
  const surfaceRedoStackRef = useRef([])
  const surfaceUndoMergeRef = useRef(null)
  const surfaceSaveQueueRef = useRef(Promise.resolve())
  const surfaceSaveRevisionRef = useRef(0)
  const surfaceUndoRequestRef = useRef(surfaceUndoRequest)
  const surfaceRedoRequestRef = useRef(surfaceRedoRequest)
  const surfaceDataRef = useRef(surfaceData)
  const surfaceQueuedBaseRef = useRef(normalizeSurfaceData(null))
  useEffect(() => { surfaceDataRef.current = surfaceData }, [surfaceData])

  // react-hooks/set-state-in-effect (x2 ci-dessous) : synchronisent le document/la pile d'annulation
  // sur le battlemap chargé, relocalisés tel quel (§16.11/§16.12, PLAN_WORLD_BUILDER_REWORK.md) —
  // même raison que §16.10 (useSurfacePanels.js), pas un changement de comportement voulu ici.
  useEffect(() => {
    const normalized = normalizeSurfaceData(battlemap?.surface_data)
    surfaceQueuedBaseRef.current = cloneSurfaceData(normalized)
    surfaceDataRef.current = normalized
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSurfaceData(normalized)
    setSurfaceSaveError(null)
  }, [battlemap?.id, battlemap?.surface_data])

  useEffect(() => {
    surfaceUndoStackRef.current = []
    surfaceRedoStackRef.current = []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSurfaceUndoDepth(0)
    setSurfaceRedoDepth(0)
  }, [battlemap?.id])

  useEffect(() => {
    onSurfaceUndoStateChange?.(surfaceUndoDepth > 0)
  }, [onSurfaceUndoStateChange, surfaceUndoDepth])

  useEffect(() => {
    onSurfaceRedoStateChange?.(surfaceRedoDepth > 0)
  }, [onSurfaceRedoStateChange, surfaceRedoDepth])

  const saveSurfaceFireAndForget = useCallback((currentSurfaceData) => {
    const bm = battlemapRef.current
    if (!isSurfaceDirty.current || !bm?.id) return
    const battlemapId = bm.id
    const revision = surfaceSaveRevisionRef.current + 1
    surfaceSaveRevisionRef.current = revision

    const baseSurfaceData = cloneSurfaceData(surfaceQueuedBaseRef.current)
    surfaceQueuedBaseRef.current = cloneSurfaceData(currentSurfaceData)
    surfaceSaveQueueRef.current = surfaceSaveQueueRef.current
      .catch(() => {})
      .then(async () => {
        const currentBattlemap = battlemapRef.current
        return persistSurfaceDocument({
          apiBaseUrl: import.meta.env.VITE_API_URL,
          battlemapId,
          surfaceData: currentSurfaceData,
          expectedRevision: currentBattlemap?.surface_revision,
          baseSurfaceData,
        })
      })
      .then(({ data, remoteBattlemap }) => {
        if (remoteBattlemap) {
          battlemapRef.current = {
            ...battlemapRef.current,
            world_revision: remoteBattlemap.world_revision,
            surface_revision: remoteBattlemap.surface_revision,
          }
        }
        const isLatest = revision === surfaceSaveRevisionRef.current
        if (isLatest) surfaceQueuedBaseRef.current = cloneSurfaceData(data.surface_data)
        const nextBattlemap = {
          ...battlemapRef.current,
          world_revision: Math.max(
            Number(battlemapRef.current?.world_revision || 0),
            Number(data.world_revision || 0),
          ),
          surface_revision: data.surface_revision,
          ...(isLatest ? { surface_data: data.surface_data } : {}),
        }
        battlemapRef.current = nextBattlemap
        setBattlemap(nextBattlemap)
        setSurfaceSaveError(null)
        if (isLatest) isSurfaceDirty.current = false
      })
      .catch(err => {
        setSurfaceSaveError(err.message || 'La sauvegarde Surface a échoué.')
        console.error('[Editor3D] Sauvegarde surfaces échouée :', err)
      })
  }, [battlemapRef, setBattlemap])

  // `mergeKey` optionnel (§12.10 point 5, PLAN_WORLD_BUILDER_REWORK.md) : reprend `updatable` +
  // fenêtre de fusion de `History.js` (three.js editor) — un curseur glissé en continu (matériau,
  // profil d'élévation) ne doit produire qu'UNE entrée d'annulation, pas une par tick. Même
  // `mergeKey` dans les 500 ms du push précédent → pas de nouvelle entrée (l'état d'avant-geste
  // reste en haut de pile) ; sans `mergeKey`, comportement inchangé pour tous les autres appelants.
  const handleSurfaceDataChange = useCallback((nextSurfaceData, mergeKey = null) => {
    if (nextSurfaceData === surfaceDataRef.current) return
    const now = Date.now()
    const previousMerge = surfaceUndoMergeRef.current
    const canMerge = mergeKey != null
      && previousMerge?.key === mergeKey
      && now - previousMerge.timestamp < 500
    if (!canMerge) {
      surfaceUndoStackRef.current = [
        ...surfaceUndoStackRef.current.slice(-49),
        cloneSurfaceData(surfaceDataRef.current),
      ]
      surfaceRedoStackRef.current = []
      setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
      setSurfaceRedoDepth(0)
    }
    surfaceUndoMergeRef.current = mergeKey != null ? { key: mergeKey, timestamp: now } : null
    surfaceDataRef.current = nextSurfaceData
    setSurfaceData(nextSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(nextSurfaceData)
  }, [saveSurfaceFireAndForget])

  const handleSurfaceUndo = useCallback(() => {
    const previousSurfaceData = surfaceUndoStackRef.current.pop()
    if (!previousSurfaceData) return false
    surfaceRedoStackRef.current = [
      ...surfaceRedoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(surfaceRedoStackRef.current.length)
    surfaceDataRef.current = previousSurfaceData
    setSurfaceData(previousSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(previousSurfaceData)
    return true
  }, [saveSurfaceFireAndForget])

  const handleSurfaceRedo = useCallback(() => {
    const nextSurfaceData = surfaceRedoStackRef.current.pop()
    if (!nextSurfaceData) return false
    surfaceUndoStackRef.current = [
      ...surfaceUndoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(surfaceRedoStackRef.current.length)
    surfaceDataRef.current = nextSurfaceData
    setSurfaceData(nextSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(nextSurfaceData)
    return true
  }, [saveSurfaceFireAndForget])

  useEffect(() => {
    if (surfaceUndoRequest === surfaceUndoRequestRef.current) return
    surfaceUndoRequestRef.current = surfaceUndoRequest
    handleSurfaceUndo()
  }, [surfaceUndoRequest, handleSurfaceUndo])

  useEffect(() => {
    if (surfaceRedoRequest === surfaceRedoRequestRef.current) return
    surfaceRedoRequestRef.current = surfaceRedoRequest
    handleSurfaceRedo()
  }, [surfaceRedoRequest, handleSurfaceRedo])

  useEffect(() => {
    const handleUndoKeyDown = (e) => {
      if (activeEditorTab === 'entity') return
      const target = e.target
      const isTextInput = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable
      if (isTextInput) return

      const key = e.key.toLowerCase()
      const isModifier = e.ctrlKey || e.metaKey
      const isUndo = isModifier && !e.shiftKey && key === 'z'
      const isRedo = isModifier && (key === 'y' || (e.shiftKey && key === 'z'))
      if (!isUndo && !isRedo) return

      const didChange = isRedo ? handleSurfaceRedo() : handleSurfaceUndo()
      if (!didChange) return
      e.preventDefault()
    }

    document.addEventListener('keydown', handleUndoKeyDown)
    return () => document.removeEventListener('keydown', handleUndoKeyDown)
  }, [activeEditorTab, handleSurfaceRedo, handleSurfaceUndo])

  return {
    surfaceData,
    surfaceDataRef,
    surfaceSaveError,
    handleSurfaceDataChange,
    handleSurfaceUndo,
    handleSurfaceRedo,
    saveSurfaceFireAndForget,
  }
}
