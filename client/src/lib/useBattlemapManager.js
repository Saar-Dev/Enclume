import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useSocket } from './SocketContext'
import { useMapStore } from '../stores/mapStore'
import { useTokenStore } from '../stores/tokenStore'
import { useEntityStore } from '../stores/entityStore'
import { useCampaignStore } from '../stores/campaignStore'
import api from './api'

export function useBattlemapManager({ campaignId, isGm }) {
  const socket = useSocket()
  const { t } = useTranslation()
  const {
    battlemap, battlemaps, setBattlemap, renameBattlemap, updateBattlemap, addBattlemap, removeBattlemap,
  } = useMapStore()
  const { setTokens } = useTokenStore()
  const { setEntities } = useEntityStore()
  const { updateCampaign } = useCampaignStore()

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [mapContextMenu, setMapContextMenu] = useState(null)  // { bm, x, y } | null
  const mapContextMenuRef = useRef(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMapName, setCreateMapName] = useState('')
  // docs/PLAN_BATTLEMAP2D.md §8 (Lot 3) — choix 2D/3D + upload d'image, affiché seulement si 2D.
  const [createRenderMode, setCreateRenderMode] = useState('3d')
  const [createImageFile, setCreateImageFile] = useState(null)
  const [createError, setCreateError] = useState(null)

  // ─── Modale "Paramètres" (docs/PLAN_BATTLEMAP2D.md §8) — grille + réupload image après création ──
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState(null)
  const [settingsGridEnabled, setSettingsGridEnabled] = useState(true)
  const [settingsGridSize, setSettingsGridSize] = useState(64)
  const [settingsGridOffsetX, setSettingsGridOffsetX] = useState(0)
  const [settingsGridOffsetY, setSettingsGridOffsetY] = useState(0)
  const [settingsImageFile, setSettingsImageFile] = useState(null)
  const [settingsError, setSettingsError] = useState(null)

  // ─── Fermeture mapContextMenu sur clic extérieur ──────────────────────────
  useEffect(() => {
    if (!mapContextMenu) return
    const handleMouseDown = (e) => {
      if (mapContextMenuRef.current && !mapContextMenuRef.current.contains(e.target)) {
        setMapContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [mapContextMenu])

  // ─── Helpers ouverture modaux ────────────────────────────────────────────────
  const openRenameModal = useCallback((bm) => {
    setRenameTarget(bm)
    setRenameValue(bm.name)
    setShowRenameModal(true)
    setMapContextMenu(null)
  }, [])

  const openCreateModal = useCallback(() => {
    setMapContextMenu(null)
    setCreateMapName('')
    setCreateRenderMode('3d')
    setCreateImageFile(null)
    setCreateError(null)
    setShowCreateModal(true)
  }, [])

  // Réutilise exactement les champs du formulaire de création (docs/PLAN_BATTLEMAP2D.md §8,
  // "Modification après création") — même patron que openRenameModal.
  const openSettingsModal = useCallback((bm) => {
    setSettingsTarget(bm)
    setSettingsGridEnabled(bm.grid_enabled !== false)
    setSettingsGridSize(bm.grid_size || 64)
    setSettingsGridOffsetX(bm.grid_offset_x || 0)
    setSettingsGridOffsetY(bm.grid_offset_y || 0)
    setSettingsImageFile(null)
    setSettingsError(null)
    setShowSettingsModal(true)
    setMapContextMenu(null)
  }, [])

  // Dimensions lues côté client (API navigateur standard) — le serveur en a besoin pour dimensionner
  // la salle triviale d'une carte 2D à la taille réelle de l'image (docs/PLAN_BATTLEMAP2D.md §8).
  const readImageDimensions = useCallback((file) => new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  }), [])

  // ─── loadMap — REST GET battlemap + tokens + entités ───────────────────────
  const loadMap = useCallback(async (battlemapId) => {
    if (!isGm) return
    try {
      const mapRes = await api.get(`/battlemaps/${battlemapId}`)
      setBattlemap(mapRes.data.battlemap)
      setTokens(mapRes.data.tokens || [])
      try {
        const entitiesRes = await api.get(`/battlemaps/${battlemapId}/entities`)
        setEntities(entitiesRes.data.entities || [])
      } catch (err) {
        console.error('Erreur chargement entités :', err)
        setEntities([])
      }
    } catch (err) {
      console.error('Erreur chargement carte :', err)
    }
  }, [isGm])

  // ─── handleMapSwitch — interne (appelé par handleGroupMove uniquement) ──────
  const handleMapSwitch = useCallback(async (battlemapId) => {
    await loadMap(battlemapId)
    socket?.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
  }, [loadMap, socket])

  // ─── CRUD handlers ────────────────────────────────────────────────────────────
  const handleMapRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await api.put(`/battlemaps/${renameTarget.id}`, { name: renameValue.trim() })
      renameBattlemap(renameTarget.id, renameValue.trim())
      setShowRenameModal(false)
      setRenameTarget(null)
    } catch (err) {
      console.error('Erreur renommage carte :', err)
    }
  }, [renameTarget, renameValue, renameBattlemap])

  const handleSetDefault = useCallback(async (bm) => {
    try {
      await api.put(`/campaigns/${campaignId}`, { default_battlemap_id: bm.id })
      updateCampaign({ default_battlemap_id: bm.id })
    } catch (err) {
      console.error("Erreur définition page d'accueil :", err)
    }
    setMapContextMenu(null)
  }, [campaignId, updateCampaign])

  const handleGroupMove = useCallback(async (bm) => {
    setMapContextMenu(null)
    await handleMapSwitch(bm.id)
  }, [handleMapSwitch])

  const handleMapDuplicate = useCallback(async (bm) => {
    setMapContextMenu(null)
    try {
      const res = await api.post(`/battlemaps/${bm.id}/duplicate`)
      addBattlemap(res.data.battlemap)
    } catch (err) {
      console.error('Erreur duplication carte :', err)
    }
  }, [addBattlemap])

  const handleMapDelete = useCallback(async (bm) => {
    setMapContextMenu(null)
    if (!window.confirm(t('session.deleteMapConfirm', { name: bm.name }))) return
    try {
      await api.delete(`/battlemaps/${bm.id}`)
      const remaining = battlemaps.filter(m => m.id !== bm.id)
      removeBattlemap(bm.id)
      if (battlemap?.id === bm.id) {
        if (remaining.length > 0) {
          await loadMap(remaining[0].id)
        } else {
          setBattlemap(null)
          setTokens([])
        }
      }
    } catch (err) {
      console.error('Erreur suppression carte :', err)
    }
  }, [battlemap?.id, battlemaps, loadMap, t])

  const handleMapCreate = useCallback(async () => {
    if (!createMapName.trim()) return
    if (createRenderMode === '2d' && !createImageFile) {
      setCreateError(t('session.mapCreate2dImageRequired'))
      return
    }
    try {
      const formData = new FormData()
      formData.append('name', createMapName.trim())
      formData.append('render_mode', createRenderMode)
      if (createRenderMode === '2d' && createImageFile) {
        const { width, height } = await readImageDimensions(createImageFile)
        formData.append('image', createImageFile)
        formData.append('image_width', String(width))
        formData.append('image_height', String(height))
        // docs/PLAN_BATTLEMAP2D.md §8 (Lot 3, correction 2026-07-29) — grille désactivée par défaut
        // pour une carte 2D, le MJ l'active lui-même via "Paramètres" s'il le souhaite.
        formData.append('grid_enabled', 'false')
      }
      const res = await api.post(`/campaigns/${campaignId}/battlemaps`, formData)
      addBattlemap(res.data.battlemap)
      setCreateMapName('')
      setCreateRenderMode('3d')
      setCreateImageFile(null)
      setCreateError(null)
      setShowCreateModal(false)
    } catch (err) {
      console.error('Erreur création carte :', err)
      setCreateError(t('session.mapCreateError'))
    }
  }, [createMapName, createRenderMode, createImageFile, campaignId, addBattlemap, readImageDimensions, t])

  const handleMapSettingsSave = useCallback(async () => {
    if (!settingsTarget) return
    try {
      const formData = new FormData()
      formData.append('grid_enabled', String(settingsGridEnabled))
      formData.append('grid_size', String(settingsGridSize))
      formData.append('grid_offset_x', String(settingsGridOffsetX))
      formData.append('grid_offset_y', String(settingsGridOffsetY))
      if (settingsImageFile) {
        const { width, height } = await readImageDimensions(settingsImageFile)
        formData.append('image', settingsImageFile)
        formData.append('image_width', String(width))
        formData.append('image_height', String(height))
      }
      const res = await api.put(`/battlemaps/${settingsTarget.id}`, formData)
      updateBattlemap(settingsTarget.id, res.data.battlemap)
      setShowSettingsModal(false)
      setSettingsTarget(null)
      setSettingsImageFile(null)
      setSettingsError(null)
    } catch (err) {
      console.error('Erreur mise à jour paramètres carte :', err)
      setSettingsError(t('session.mapCreateError'))
    }
  }, [settingsTarget, settingsGridEnabled, settingsGridSize, settingsGridOffsetX, settingsGridOffsetY, settingsImageFile, readImageDimensions, updateBattlemap, t])

  return {
    // Chargement — exposé pour gmBar (onClick={() => loadMap(bm.id)})
    loadMap,
    // Context menu
    mapContextMenu,
    setMapContextMenu,
    mapContextMenuRef,
    // Helpers modaux (remplacent les séquences multi-setters inline)
    openRenameModal,
    openCreateModal,
    // Handlers CRUD (utilisés dans le menu contextuel)
    handleSetDefault,
    handleGroupMove,
    handleMapDuplicate,
    handleMapDelete,
    // Rename modal
    showRenameModal,
    setShowRenameModal,
    renameValue,
    setRenameValue,
    handleMapRename,
    // Create modal
    showCreateModal,
    setShowCreateModal,
    createMapName,
    setCreateMapName,
    createRenderMode,
    setCreateRenderMode,
    createImageFile,
    setCreateImageFile,
    createError,
    handleMapCreate,
    // Settings modal ("Paramètres")
    openSettingsModal,
    showSettingsModal,
    setShowSettingsModal,
    settingsGridEnabled,
    setSettingsGridEnabled,
    settingsGridSize,
    setSettingsGridSize,
    settingsGridOffsetX,
    setSettingsGridOffsetX,
    settingsGridOffsetY,
    setSettingsGridOffsetY,
    settingsImageFile,
    setSettingsImageFile,
    settingsError,
    handleMapSettingsSave,
  }
}
