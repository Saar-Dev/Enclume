import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore'
import { useTokenStore } from '../stores/tokenStore'
import api from '../lib/api'
import Canvas3D from '../components/Canvas3D'
import Sidebar from '../components/Sidebar'

export default function SessionPage() {
  const { campaignId } = useParams()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { tokens, setTokens, addToken, removeToken, updateToken } = useTokenStore()

  const [campaign, setCampaign] = useState(null)
  const [battlemap, setBattlemap] = useState(null)
  const [characters, setCharacters] = useState([])
  const [members, setMembers] = useState([])
  const [isGm, setIsGm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [messages, setMessages] = useState([])

  const [mode, setMode] = useState('play')
  const [layer, setLayer] = useState('token')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeMaterial, setActiveMaterial] = useState(1)
  const [availableMaterials, setAvailableMaterials] = useState([])
  const [battlemaps, setBattlemaps] = useState([])

  // Menu contextuel barre GM — clic droit sur un bouton de carte
  const [mapContextMenu, setMapContextMenu] = useState(null) // { bm, x, y }
  const mapContextMenuRef = useRef(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null) // bm à renommer
  const [renameValue, setRenameValue] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMapName, setCreateMapName] = useState('')

  // ─── Chargement session — useCallback pour réutilisation lors de la reconnexion ──
  // Déclaré AVANT le useEffect socket qui l'utilise — ordre React obligatoire.
  const loadSession = useCallback(async () => {
    try {
      // Chargement campagne + membres
      const res = await api.get(`/campaigns/${campaignId}`)
      const campaignData = res.data.campaign
      const members = res.data.members || []
      setCampaign(campaignData)
      setMembers(members)

      // Calcul isGm depuis les membres
      const me = members.find(m => m.id === user?.id)
      setIsGm(me?.role === 'gm')

      // Chargement battlemap par défaut + ses tokens
      const mapId = campaignData.default_battlemap_id
      if (mapId) {
        const mapRes = await api.get(`/battlemaps/${mapId}`)
        setBattlemap(mapRes.data.battlemap)
        setTokens(mapRes.data.tokens || [])
      }

      // Chargement des personnages de la campagne
      const charsRes = await api.get(`/campaigns/${campaignId}/characters`)
      setCharacters(charsRes.data.characters || [])

      // Chargement de la liste des battlemaps (pour la barre GM)
      const mapsRes = await api.get(`/campaigns/${campaignId}/battlemaps`)
      setBattlemaps(mapsRes.data.battlemaps || [])

    } catch (err) {
      setError(t('session.connectionError'))
    } finally {
      setLoading(false)
    }
  }, [campaignId, user?.id])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // ─── Socket.io ────────────────────────────────────────────────────────────────
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [reconnectTrigger, setReconnectTrigger] = useState(0)

  // Chargement local d'une carte — GM uniquement, sans déplacer les joueurs
  // Utilisé : clic barre GM, suppression carte active
  const loadMap = useCallback(async (battlemapId) => {
    if (!isGm) return
    try {
      const mapRes = await api.get(`/battlemaps/${battlemapId}`)
      setBattlemap(mapRes.data.battlemap)
      setTokens(mapRes.data.tokens || [])
    } catch (err) {
      console.error('Erreur chargement carte :', err)
    }
  }, [isGm])

  // Déplacer tout le groupe vers une carte — charge localement + émet MAP_SWITCH
  // Utilisé : bouton "Déplacer le groupe ici" dans le menu contextuel barre GM
  const handleMapSwitch = useCallback(async (battlemapId) => {
    await loadMap(battlemapId)
    socket?.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
  }, [loadMap, socket])

  // Fermeture menu contextuel barre GM sur clic ailleurs
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

  // Renommer une carte
  const handleMapRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await api.put(`/battlemaps/${renameTarget.id}`, { name: renameValue.trim() })
      setBattlemaps(prev => prev.map(bm =>
        bm.id === renameTarget.id ? { ...bm, name: renameValue.trim() } : bm
      ))
      if (battlemap?.id === renameTarget.id) {
        setBattlemap(prev => ({ ...prev, name: renameValue.trim() }))
      }
      setShowRenameModal(false)
      setRenameTarget(null)
    } catch (err) {
      console.error('Erreur renommage carte :', err)
    }
  }, [renameTarget, renameValue, battlemap?.id])

  // Définir comme page d'accueil
  const handleSetDefault = useCallback(async (bm) => {
    try {
      await api.put(`/campaigns/${campaignId}`, { default_battlemap_id: bm.id })
      setCampaign(prev => ({ ...prev, default_battlemap_id: bm.id }))
    } catch (err) {
      console.error('Erreur définition page d\'accueil :', err)
    }
    setMapContextMenu(null)
  }, [campaignId])

  // Déplacer le groupe (tous joueurs + GM)
  const handleGroupMove = useCallback(async (bm) => {
    setMapContextMenu(null)
    await handleMapSwitch(bm.id)
  }, [handleMapSwitch])

  // Dupliquer une carte
  const handleMapDuplicate = useCallback(async (bm) => {
    setMapContextMenu(null)
    try {
      const res = await api.post(`/battlemaps/${bm.id}/duplicate`)
      setBattlemaps(prev => [...prev, res.data.battlemap])
    } catch (err) {
      console.error('Erreur duplication carte :', err)
    }
  }, [])

  // Supprimer une carte (avec confirmation)
  const handleMapDelete = useCallback(async (bm) => {
    setMapContextMenu(null)
    if (!window.confirm(t('session.deleteMapConfirm', { name: bm.name }))) return
    try {
      await api.delete(`/battlemaps/${bm.id}`)
      setBattlemaps(prev => prev.filter(m => m.id !== bm.id))
      // Si c'était la carte active, charger la première restante
      if (battlemap?.id === bm.id) {
        const remaining = battlemaps.filter(m => m.id !== bm.id)
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

  // Créer une nouvelle carte
  const handleMapCreate = useCallback(async () => {
    if (!createMapName.trim()) return
    try {
      const res = await api.post(`/campaigns/${campaignId}/battlemaps`, { name: createMapName.trim() })
      setBattlemaps(prev => [...prev, res.data.battlemap])
      setCreateMapName('')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Erreur création carte :', err)
    }
  }, [createMapName, campaignId])

  // Drop depuis la Sidebar — crée un token au centre de la carte
  // Le serveur broadcastera TOKEN_CREATED à toute la room — pas d'emit client.
  const handleCharacterDrop = useCallback(async (characterId) => {
    if (!battlemap?.id) return

    const character = characters.find(c => c.id === characterId)
    if (!character) return

    try {
      const res = await api.post(`/battlemaps/${battlemap.id}/tokens`, {
        character_id: characterId,
        label: character.name,
        pos_x: 0,
        pos_y: 0,
        pos_z: 0,
        color: character.color,
        layer: 'token',
      })
      addToken(res.data.token)
    } catch (err) {
      console.error('Erreur création token :', err)
    }
  }, [battlemap?.id, characters])

  // Déplacement d'un token — met à jour l'état local après confirmation serveur
  const handleTokenMove = useCallback((updatedToken) => {
    updateToken(updatedToken)
  }, [])

  // Suppression d'un token — retiré du tableau local
  const handleTokenDelete = useCallback((tokenId) => {
    removeToken(tokenId)
  }, [])

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { withCredentials: true })
    s.emit(WS.SESSION_JOIN, { campaignId })
    s.on(WS.SESSION_JOINED, ({ userId, onlineUserIds = [] }) => {
      setOnlineUsers(new Set([userId, ...onlineUserIds]))
    })
    s.on(WS.SESSION_USER_JOINED, ({ userId, username }) => {
      setOnlineUsers(prev => new Set([...prev, userId]))
      setMessages(prev => [...prev, {
        id: `sys-join-${userId}-${Date.now()}`,
        system: true,
        text: `${username} a rejoint la session`,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      }])
    })
    s.on(WS.SESSION_USER_LEFT, ({ userId, username }) => {
      setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
      setMessages(prev => [...prev, {
        id: `sys-left-${userId}-${Date.now()}`,
        system: true,
        text: `${username} a quitté la session`,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      }])
    })
    s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) => {
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, updated_at })
    })
    s.on(WS.TOKEN_CREATED, ({ token }) => {
      addToken(token)
    })
    s.on(WS.TOKEN_DELETED, ({ tokenId }) => {
      removeToken(tokenId)
    })
    s.on(WS.CHAT_MESSAGE, ({ userId, username, color, text, timestamp }) => {
      setMessages(prev => [...prev, {
        id: `${userId}-${timestamp}`,
        user: username,
        color,
        text,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      }])
    })
    s.on(WS.CHARACTER_UPDATED, (updatedCharacter) => {
      setCharacters(prev => {
        const exists = prev.find(c => c.id === updatedCharacter.id)
        if (!exists) {
          // Character nouvellement visible pour un joueur
          return [...prev, updatedCharacter]
        }
        return prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c)
      })
    })
    s.on(WS.MAP_SWITCH, ({ battlemapId, userIds }) => {
      // Le GM charge la carte qu'il switche.
      // Les joueurs chargent si ils sont dans userIds (vide = tous).
      const concerned = userIds.length === 0 || userIds.includes(user?.id)
      if (!concerned) return
      api.get(`/battlemaps/${battlemapId}`)
        .then(res => {
          setBattlemap(res.data.battlemap)
          setTokens(res.data.tokens || [])
        })
        .catch(err => console.error('Erreur chargement carte MAP_SWITCH :', err))
    })
    // Chantier 4 — loadSession disponible pour la reconnexion
    // La reconnexion automatique post-redémarrage serveur est traitée au Chantier 5
    // (nécessite SESSION_STATE côté serveur + store Zustand côté client)
    setSocket(s)
    return () => s.disconnect()
  }, [campaignId, reconnectTrigger, loadSession])

  // ─── Menu contextuel clic droit token ────────────────────────────────────────
  // { token, x, y } ou null. x/y = coordonnées souris au moment du clic droit.
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  // Ouverture — vérifie que l'utilisateur est propriétaire du token OU GM
  const handleTokenDoubleClick = useCallback((token, x, y) => {
    const character = characters.find(c => c.id === token.character_id)
    const isOwner = character?.user_id === user?.id
    if (!isOwner && !isGm) return
    setContextMenu({ token, x, y })
  }, [characters, user?.id, isGm])

  // Fermeture sur clic ailleurs — cleanup à chaque changement de contextMenu
  useEffect(() => {
    if (!contextMenu) return
    const handleMouseDown = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [contextMenu])

  // Suppression depuis le menu contextuel
  // Le serveur broadcastera TOKEN_DELETED à toute la room — pas d'emit client.
  const handleContextMenuDelete = useCallback(async () => {
    if (!contextMenu) return
    const tokenId = contextMenu.token.id
    setContextMenu(null)
    try {
      await api.delete(`/tokens/${tokenId}`)
      handleTokenDelete(tokenId)
    } catch (err) {
      console.error('Erreur suppression token (menu) :', err)
    }
  }, [contextMenu, handleTokenDelete])

  if (loading) return (
    <div style={styles.loading}>
      <p>{t('session.loading')}</p>
    </div>
  )

  if (error) return (
    <div style={styles.loading}>
      <p>{error}</p>
      <button onClick={() => navigate('/dashboard')}>← Dashboard</button>
    </div>
  )

  return (
    <div style={styles.container}>

      {/* ─── Barre GM supérieure ─────────────────────────────────────────── */}
      {isGm && (
        <div style={styles.gmBar}>
          <span style={styles.gmBarLabel}>{t('session.battlemaps')}</span>
          <div style={styles.gmBarMaps}>
            {battlemaps.map(bm => (
              <button
                key={bm.id}
                style={{
                  ...styles.gmBarBtn,
                  ...(bm.id === battlemap?.id ? styles.gmBarBtnActive : {}),
                }}
                onClick={() => loadMap(bm.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMapContextMenu({ bm, x: e.clientX, y: e.clientY })
                }}
                title={bm.name}
              >
                {bm.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={styles.mainArea}>
      <div
        style={styles.canvas}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const characterId = e.dataTransfer.getData('characterId')
          if (characterId) handleCharacterDrop(characterId)
        }}
      >
        <Canvas3D
          battlemap={battlemap}
          tokens={tokens}
          mode={mode}
          activeMaterial={activeMaterial}
          onVoxelDataChange={(data) => setBattlemap(prev => ({ ...prev, voxel_data: data }))}
          onPackLoaded={setAvailableMaterials}
          onTokenMove={handleTokenMove}
          onTokenDelete={handleTokenDelete}
          onTokenDoubleClick={handleTokenDoubleClick}
          isGm={isGm}
          socket={socket}
          user={user}
          characters={characters}
        />
      </div>

      {sidebarVisible && (
        <Sidebar
          isGm={isGm}
          mode={mode}
          onModeChange={setMode}
          layer={layer}
          onLayerChange={setLayer}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onClose={() => setSidebarVisible(false)}
          activeMaterial={activeMaterial}
          onMaterialChange={setActiveMaterial}
          availableMaterials={availableMaterials}
          characters={characters}
          onCharactersChange={setCharacters}
          campaignId={campaignId}
          messages={messages}
          socket={socket}
          campaignMembers={members}
          onlineUsers={onlineUsers}
          onReconnectSocket={() => setReconnectTrigger(n => n + 1)}
        />
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          title="Ouvrir la sidebar"
          style={styles.reopenBtn}
        >
          ‹
        </button>
      )}
      </div>

      {/* ─── Menu contextuel clic droit token ─────────────────────────────── */}
      {/* Rendu HORS du Canvas R3F — position fixed par-dessus tout.          */}
      {/* S'ouvre du bon côté selon la position du curseur dans la fenêtre.   */}
      {contextMenu && (() => {
        const MENU_W = 180
        const MENU_H = 136
        const x = contextMenu.x + MENU_W > window.innerWidth
          ? contextMenu.x - MENU_W
          : contextMenu.x
        const y = contextMenu.y + MENU_H > window.innerHeight
          ? contextMenu.y - MENU_H
          : contextMenu.y
        return (
          <div ref={contextMenuRef} style={{ ...styles.contextMenu, left: x, top: y }}>
            <button style={styles.contextMenuItem} onClick={handleContextMenuDelete}>
              {t('token.removeFromMap')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.measure')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.lineOfSight')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.range')}
            </button>
          </div>
        )
      })()}

      {/* ─── Menu contextuel barre GM ─────────────────────────────────────── */}
      {mapContextMenu && (() => {
        const MENU_W = 200
        const MENU_H = 200
        const x = mapContextMenu.x + MENU_W > window.innerWidth
          ? mapContextMenu.x - MENU_W
          : mapContextMenu.x
        const y = mapContextMenu.y + MENU_H > window.innerHeight
          ? mapContextMenu.y - MENU_H
          : mapContextMenu.y
        return (
          <div ref={mapContextMenuRef} style={{ ...styles.contextMenu, left: x, top: y }}>
            <button style={styles.contextMenuItem} onClick={() => {
              setRenameTarget(mapContextMenu.bm)
              setRenameValue(mapContextMenu.bm.name)
              setShowRenameModal(true)
              setMapContextMenu(null)
            }}>
              {t('session.mapRename')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleSetDefault(mapContextMenu.bm)}>
              {t('session.mapSetDefault')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleGroupMove(mapContextMenu.bm)}>
              {t('session.mapMoveGroup')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleMapDuplicate(mapContextMenu.bm)}>
              {t('session.mapDuplicate')}
            </button>
            <button style={{ ...styles.contextMenuItem, color: 'var(--color-danger)' }}
              onClick={() => handleMapDelete(mapContextMenu.bm)}>
              {t('session.mapDelete')}
            </button>
            <div style={styles.contextMenuDivider} />
            <button style={styles.contextMenuItem} onClick={() => {
              setMapContextMenu(null)
              setCreateMapName('')
              setShowCreateModal(true)
            }}>
              {t('session.mapCreate')}
            </button>
          </div>
        )
      })()}

      {/* ─── Modale renommage carte ───────────────────────────────────────── */}
      {showRenameModal && (
        <div style={styles.modalOverlay} onMouseDown={() => setShowRenameModal(false)}>
          <div style={styles.modalBox} onMouseDown={e => e.stopPropagation()}>
            <p style={styles.modalTitle}>{t('session.mapRename')}</p>
            <input
              style={styles.modalInput}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMapRename() }}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setShowRenameModal(false)}>
                {t('common.cancel')}
              </button>
              <button style={styles.btnPrimary} onClick={handleMapRename}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modale création carte ────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onMouseDown={() => setShowCreateModal(false)}>
          <div style={styles.modalBox} onMouseDown={e => e.stopPropagation()}>
            <p style={styles.modalTitle}>{t('session.mapCreate')}</p>
            <input
              style={styles.modalInput}
              value={createMapName}
              onChange={e => setCreateMapName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMapCreate() }}
              placeholder={t('session.mapNamePlaceholder')}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button style={styles.btnPrimary} onClick={handleMapCreate}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0f',
    overflow: 'hidden',
  },
  gmBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 16px',
    height: '40px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #2a2a3e',
    flexShrink: 0,
    zIndex: 100,
  },
  gmBarLabel: {
    fontSize: '11px',
    color: '#5b8dee',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  gmBarMaps: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    flex: 1,
  },
  gmBarBtn: {
    background: 'none',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8888a8',
    fontSize: '12px',
    padding: '3px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  gmBarBtnActive: {
    backgroundColor: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
    color: '#5b8dee',
  },
  mainArea: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  canvas: {
    flex: 1,
    height: '100%',
    minWidth: 0,
  },
  loading: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    color: '#9090a8',
    fontFamily: 'monospace',
    gap: '16px',
  },
  reopenBtn: {
    position: 'fixed',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 9999,
    background: '#16162a',
    border: '1px solid #5b8dee',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    color: '#5b8dee',
    cursor: 'pointer',
    padding: '14px 8px',
    fontSize: '18px',
    lineHeight: 1,
    boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
  },
  contextMenu: {
    position: 'fixed',
    zIndex: 9999,
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    overflow: 'hidden',
    minWidth: '180px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #1e1e2e',
    color: '#c0c0d0',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
  },
  contextMenuItemDisabled: {
    color: '#4a4a60',
    cursor: 'default',
  },
  contextMenuDivider: {
    height: '1px',
    backgroundColor: '#2a2a3e',
    margin: '4px 0',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalBox: {
    backgroundColor: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    padding: '24px',
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#c0c0d0',
    margin: 0,
  },
  modalInput: {
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '9px 12px',
    color: '#c0c0d0',
    fontSize: '14px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  btnPrimary: {
    backgroundColor: '#5b8dee',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'none',
    border: 'none',
    color: '#8888a8',
    fontSize: '13px',
    padding: '7px 8px',
    cursor: 'pointer',
  },
}
