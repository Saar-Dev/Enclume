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
  const { battlemap, battlemaps, setBattlemap, renameBattlemap, addBattlemap, removeBattlemap } = useMapStore()
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
    setShowCreateModal(true)
  }, [])

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
    try {
      const res = await api.post(`/campaigns/${campaignId}/battlemaps`, { name: createMapName.trim() })
      addBattlemap(res.data.battlemap)
      setCreateMapName('')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Erreur création carte :', err)
    }
  }, [createMapName, campaignId, addBattlemap])

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
    handleMapCreate,
  }
}
