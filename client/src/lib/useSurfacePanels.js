import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteSurfaceRoom, SURFACE_DATA_VERSION } from './surfaceData.js'

// État et logique des 3 panneaux flottants de l'éditeur de monde (connecteur/salle/mur) — extrait de
// Editor3D.jsx (§16, PLAN_WORLD_BUILDER_REWORK.md). N'entre jamais dans la pile d'annulation ni les
// files de sauvegarde : toute mutation de surfaceData passe par `onSurfaceDataChange`, fourni par
// l'appelant (reste `handleSurfaceDataChange` dans Editor3D.jsx, qui gère ça).
export function useSurfacePanels({ surfaceData, surfaceDataRef, surfaceTool, onSurfaceToolChange, onSurfaceDataChange }) {
  const [surfaceConnectorPanel, setSurfaceConnectorPanel] = useState(null)
  const [surfaceRoomPanel, setSurfaceRoomPanel] = useState(null)
  const [surfaceWallPanel, setSurfaceWallPanel] = useState(null)

  const selectedSurfaceConnector = useMemo(() => {
    const connectorId = surfaceConnectorPanel?.connectorId
    if (!connectorId) return null
    const connector = surfaceData.connectors?.[connectorId]
    return connector ? { id: connectorId, ...connector } : null
  }, [surfaceConnectorPanel?.connectorId, surfaceData.connectors])

  const selectedSurfaceRoom = useMemo(() => {
    const roomId = surfaceWallPanel?.roomId || surfaceRoomPanel?.roomId
    if (!roomId) return null
    const room = surfaceData.rooms?.[roomId]
    return room ? { id: roomId, ...room } : null
  }, [surfaceData.rooms, surfaceRoomPanel?.roomId, surfaceWallPanel?.roomId])

  const handleSurfaceConnectorSelect = useCallback((connectorId, clientX, clientY) => {
    if (!connectorId) return
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
    setSurfaceConnectorPanel({ connectorId, x: clientX, y: clientY })
  }, [])

  const handleSurfaceRoomSelect = useCallback((roomId) => {
    setSurfaceConnectorPanel(null)
    setSurfaceWallPanel(null)
    setSurfaceRoomPanel(roomId ? { roomId } : null)
  }, [])

  const handleSurfaceWallSelect = useCallback((roomId, count) => {
    setSurfaceConnectorPanel(null)
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(roomId && count > 0 ? { roomId } : null)
  }, [])

  const handleSurfaceSelectionToolPatch = useCallback(patch => {
    if (!patch) return
    onSurfaceToolChange?.({ ...surfaceTool, ...patch })
  }, [onSurfaceToolChange, surfaceTool])

  const handleSurfaceConnectorPatch = useCallback((connectorId, patch) => {
    if (!connectorId || !patch) return
    const currentSurfaceData = surfaceDataRef.current
    const connector = currentSurfaceData.connectors?.[connectorId]
    if (!connector) return

    onSurfaceDataChange({
      ...currentSurfaceData,
      version: SURFACE_DATA_VERSION,
      connectors: {
        ...(currentSurfaceData.connectors || {}),
        [connectorId]: {
          ...connector,
          ...patch,
        },
      },
    })
  }, [onSurfaceDataChange, surfaceDataRef])

  const handleSurfaceConnectorDelete = useCallback(connectorId => {
    if (!connectorId) return
    const currentSurfaceData = surfaceDataRef.current
    if (!currentSurfaceData.connectors?.[connectorId]) return
    const connectors = { ...(currentSurfaceData.connectors || {}) }
    delete connectors[connectorId]
    onSurfaceDataChange({ ...currentSurfaceData, version: SURFACE_DATA_VERSION, connectors })
    setSurfaceConnectorPanel(null)
    if (surfaceTool?.selectedConnectorId === connectorId) {
      onSurfaceToolChange?.({ ...surfaceTool, selectedConnectorId: null })
    }
  }, [onSurfaceDataChange, onSurfaceToolChange, surfaceDataRef, surfaceTool])

  const handleSurfaceRoomDelete = useCallback(roomId => {
    const nextSurfaceData = deleteSurfaceRoom(surfaceDataRef.current, roomId)
    if (nextSurfaceData === surfaceDataRef.current) return
    onSurfaceDataChange(nextSurfaceData)
    setSurfaceConnectorPanel(null)
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedConnectorId: null,
      selectedRoomId: null,
      selectedRoomIds: [],
      roomWallEdit: false,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [onSurfaceDataChange, onSurfaceToolChange, surfaceDataRef, surfaceTool])

  const closeSurfaceConnectorPanel = useCallback(() => {
    setSurfaceConnectorPanel(null)
    if (!surfaceTool?.selectedConnectorId) return
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedConnectorId: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  const closeSurfaceRoomPanel = useCallback(() => {
    setSurfaceRoomPanel(null)
    if (!surfaceTool?.selectedRoomId) return
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedRoomId: null,
      selectedRoomIds: [],
      roomWallEdit: false,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  const closeSurfaceWallPanel = useCallback(() => {
    setSurfaceWallPanel(null)
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  // react-hooks/set-state-in-effect : ces 4 effets synchronisent la visibilité des panneaux sur des
  // props externes (surfaceData/surfaceTool) — comportement relocalisé tel quel depuis Editor3D.jsx,
  // où la même règle ne se déclenchait pas (elle cible spécifiquement les fonctions `useXxx`). Les
  // convertir en dérivation au rendu serait un changement de comportement, pas une simple relocalisation
  // — hors périmètre de cette extraction (§16, PLAN_WORLD_BUILDER_REWORK.md), à revoir séparément si
  // besoin.
  useEffect(() => {
    const connectorId = surfaceConnectorPanel?.connectorId
    if (!connectorId) return
    if (surfaceData.connectors?.[connectorId]) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSurfaceConnectorPanel(null)
  }, [surfaceConnectorPanel?.connectorId, surfaceData.connectors])

  useEffect(() => {
    if (!surfaceConnectorPanel) return
    if (surfaceTool?.mode === 'select') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSurfaceConnectorPanel(null)
  }, [surfaceConnectorPanel, surfaceTool?.mode])

  useEffect(() => {
    const placingDoorOnSelectedWall = surfaceTool?.mode === 'connector'
      && surfaceTool?.connectorType === 'door'
      && (surfaceTool?.connectorWallEdgeKeys || []).length > 0
    // Remodeler (§13.4, PLAN_WORLD_BUILDER_REWORK.md) est un sous-outil du panneau Salle, pas un
    // mode de sidebar indépendant : le panneau doit rester ouvert pendant qu'on peint les cases,
    // même principe que l'exception porte ci-dessus (toujours la même salle sélectionnée).
    if (surfaceTool?.mode === 'select' || surfaceTool?.mode === 'reshape-room' || placingDoorOnSelectedWall) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
  }, [surfaceTool?.connectorType, surfaceTool?.connectorWallEdgeKeys, surfaceTool?.mode])

  useEffect(() => {
    const selectedRoomId = surfaceTool?.selectedRoomId
    if (surfaceRoomPanel && !surfaceData.rooms?.[surfaceRoomPanel.roomId]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSurfaceRoomPanel(selectedRoomId && surfaceData.rooms?.[selectedRoomId]
        ? { ...surfaceRoomPanel, roomId: selectedRoomId }
        : null)
    }
    if (surfaceWallPanel && !surfaceData.rooms?.[surfaceWallPanel.roomId]) {
      setSurfaceWallPanel(selectedRoomId && surfaceData.rooms?.[selectedRoomId]
        ? { ...surfaceWallPanel, roomId: selectedRoomId }
        : null)
    }
  }, [surfaceData.rooms, surfaceRoomPanel, surfaceTool?.selectedRoomId, surfaceWallPanel])

  return {
    surfaceConnectorPanel,
    surfaceRoomPanel,
    surfaceWallPanel,
    selectedSurfaceConnector,
    selectedSurfaceRoom,
    handleSurfaceConnectorSelect,
    handleSurfaceRoomSelect,
    handleSurfaceWallSelect,
    handleSurfaceSelectionToolPatch,
    handleSurfaceConnectorPatch,
    handleSurfaceConnectorDelete,
    handleSurfaceRoomDelete,
    closeSurfaceConnectorPanel,
    closeSurfaceRoomPanel,
    closeSurfaceWallPanel,
  }
}
