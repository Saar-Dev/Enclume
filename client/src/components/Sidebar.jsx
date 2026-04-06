import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 500
const SIDEBAR_CLOSE_THRESHOLD = 160

// ─── Icônes ───────────────────────────────────────────────────────────────────
const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const IconRuler = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.3 8.7L8.7 21.3a2.121 2.121 0 0 1-3 0L2.7 18.3a2.121 2.121 0 0 1 0-3L15.3 2.7a2.121 2.121 0 0 1 3 0l3 3a2.121 2.121 0 0 1 0 3z"/>
    <line x1="7.5" y1="10.5" x2="10" y2="13"/>
    <line x1="10.5" y1="7.5" x2="13" y2="10"/>
    <line x1="13.5" y1="4.5" x2="16" y2="7"/>
  </svg>
)
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── Modale fiche personnage ──────────────────────────────────────────────────
// Accessible à tous les membres. visible=false → le joueur ne voit pas le character
// dans la liste → ne peut pas ouvrir la modale. Le filtrage est fait côté liste.
// gm_notes : reçu uniquement si isGm (filtré côté serveur).
function CharacterModal({ character, isGm, isOwner, onClose, onCharactersChange, onCharacterUpdate, socket, campaignMembers = [] }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('sheet')
  const [description, setDescription] = useState(character.description || '')
  const [gmNotes, setGmNotes] = useState(character.gm_notes || '')
  const [saving, setSaving] = useState(false)

  const canEditDescription = isGm || isOwner
  const canEditGmNotes = isGm

  // Sauvegarde au blur — évite une sauvegarde à chaque frappe
  const handleDescriptionBlur = useCallback(async () => {
    if (description === (character.description || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { description })
      onCharactersChange(prev => prev.map(c => c.id === character.id ? { ...c, description: res.data.character.description } : c))
    } catch (err) {
      console.error('Erreur sauvegarde description :', err)
    } finally {
      setSaving(false)
    }
  }, [description, character.id, character.description, onCharactersChange])

  const handleGmNotesBlur = useCallback(async () => {
    if (gmNotes === (character.gm_notes || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { gm_notes: gmNotes })
      onCharactersChange(prev => prev.map(c => c.id === character.id ? { ...c, gm_notes: res.data.character.gm_notes } : c))
    } catch (err) {
      console.error('Erreur sauvegarde notes MJ :', err)
    } finally {
      setSaving(false)
    }
  }, [gmNotes, character.id, character.gm_notes, onCharactersChange])

  // Toggle visibilité — GM uniquement
  // onCharacterUpdate reçoit le character complet depuis la réponse serveur
  // et met à jour selectedCharacter dans Sidebar sans dépendre du tableau stale.
  // Le serveur broadcastera CHARACTER_UPDATED à toute la room — pas d'emit client.
  const handleToggleVisible = useCallback(async () => {
    try {
      const res = await api.put(`/characters/${character.id}`, { visible: !character.visible })
      const updated = res.data.character
      onCharactersChange(prev => prev.map(c => c.id === updated.id ? { ...c, visible: updated.visible } : c))
      onCharacterUpdate(updated)
    } catch (err) {
      console.error('Erreur toggle visible :', err)
    }
  }, [character.id, character.visible, onCharactersChange, onCharacterUpdate])

  // Suppression — GM uniquement
  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('character.deleteConfirm'))) return
    try {
      await api.delete(`/characters/${character.id}`)
      onCharactersChange(prev => prev.filter(c => c.id !== character.id))
      onClose()
    } catch (err) {
      console.error('Erreur suppression character :', err)
    }
  }, [character.id, onCharactersChange, onClose, t])

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalPanel} onClick={e => e.stopPropagation()}>

        {/* ── Header modale ── */}
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleRow}>
            <div style={{ ...styles.charColor, background: character.color, width: '14px', height: '14px' }} />
            <span style={styles.modalTitle}>{character.name}</span>
            {saving && <span style={styles.savingIndicator}>…</span>}
          </div>
          <div style={styles.modalHeaderActions}>
            {/* Toggle visible — GM uniquement, tous onglets */}
            {isGm && (
              <button
                style={{ ...styles.modalActionBtn, color: character.visible ? '#4caf77' : '#4a4a60' }}
                onClick={handleToggleVisible}
                title={character.visible ? t('character.toggleHidden') : t('character.toggleVisible')}
              >
                {character.visible ? <IconEye /> : <IconEyeOff />}
              </button>
            )}
            <button style={styles.modalCloseBtn} onClick={onClose} title={t('common.close')}>
              <IconX />
            </button>
          </div>
        </div>

        {/* ── Placeholder illustration ── */}
        <div style={styles.illustrationPlaceholder}>
          <span style={styles.illustrationText}>{t('character.illustrationPlaceholder')}</span>
        </div>

        {/* ── Onglets ── */}
        <div style={styles.modalTabs}>
          {['sheet', 'notes', 'settings'].map(tab => (
            <button
              key={tab}
              style={{ ...styles.modalTab, ...(activeTab === tab ? styles.modalTabActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'sheet' && t('character.tabSheet')}
              {tab === 'notes' && t('character.tabNotes')}
              {tab === 'settings' && t('character.tabSettings')}
            </button>
          ))}
        </div>

        {/* ── Contenu onglets ── */}
        <div style={styles.modalContent}>

          {/* Onglet Fiche */}
          {activeTab === 'sheet' && (
            <p style={styles.modalPlaceholder}>{t('character.sheetPlaceholder')}</p>
          )}

          {/* Onglet Notes */}
          {activeTab === 'notes' && (
            <div style={styles.notesContent}>
              <label style={styles.fieldLabel}>{t('character.descriptionLabel')}</label>
              <textarea
                style={styles.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder={t('character.descriptionPlaceholder')}
                readOnly={!canEditDescription}
              />
              {/* gm_notes — GM uniquement, jamais affiché aux joueurs */}
              {isGm && (
                <>
                  <label style={{ ...styles.fieldLabel, marginTop: '12px', color: '#5b8dee' }}>
                    {t('character.gmNotesLabel')}
                  </label>
                  <textarea
                    style={{ ...styles.textarea, borderColor: 'rgba(91,141,238,0.3)' }}
                    value={gmNotes}
                    onChange={e => setGmNotes(e.target.value)}
                    onBlur={handleGmNotesBlur}
                    placeholder={t('character.gmNotesPlaceholder')}
                  />
                </>
              )}
            </div>
          )}

          {/* Onglet Paramètres */}
          {activeTab === 'settings' && (
            <div style={styles.settingsContent}>
              <div style={styles.settingsRow}>
                <span style={styles.fieldLabel}>{t('character.ownerLabel')}</span>
                {isGm ? (
                  <select
                    style={styles.select}
                    value={character.user_id || ''}
                    onChange={async (e) => {
                      const user_id = e.target.value || null
                      try {
                        const res = await api.put(`/characters/${character.id}`, { user_id })
                        const updated = res.data.character
                        onCharactersChange(prev => prev.map(c => c.id === updated.id ? updated : c))
                        onCharacterUpdate(updated)
                        // Le serveur broadcastera CHARACTER_UPDATED à toute la room — pas d'emit client.
                      } catch (err) {
                        console.error('Erreur assignation propriétaire :', err)
                      }
                    }}
                  >
                    <option value="">{t('character.noOwner')}</option>
                    {campaignMembers
                      .filter(m => m.role === 'player')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.username}</option>
                      ))
                    }
                  </select>
                ) : (
                  <span style={styles.settingsValue}>
                    {character.owner_username || t('character.noOwner')}
                  </span>
                )}
              </div>
              {isGm && (
                <button style={styles.deleteCharBtn} onClick={handleDelete}>
                  {t('character.deleteCharacter')}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Sidebar principale ───────────────────────────────────────────────────────
export default function Sidebar({
  isGm,
  mode, onModeChange,
  layer, onLayerChange,
  width, onWidthChange,
  onClose,
  activeMaterial, onMaterialChange, availableMaterials = [],
  characters = [], onCharactersChange,
  campaignId,
  messages = [],
  socket,
  campaignMembers = [],
  onlineUsers = new Set(),
  onReconnectSocket,
}) {
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()

  const [activeTab, setActiveTab] = useState('chat')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')

  // Formulaire de création de personnage
  const [showNewChar, setShowNewChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [creating, setCreating] = useState(false)

  // Modale character — null = fermée, sinon objet character sélectionné
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  // Onglet Config — profil utilisateur
  const [configUsername, setConfigUsername] = useState('')
  const [configColor, setConfigColor] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Initialiser les champs config quand on ouvre l'onglet
  useEffect(() => {
    if (activeTab === 'config' && user) {
      setConfigUsername(user.username || '')
      setConfigColor(user.color || '#4A90D9')
      setConfigSuccess(false)
    }
  }, [activeTab, user])

  // ─── CONFIG — Sauvegarde profil ──────────────────────────────────────────
  const handleConfigSave = useCallback(async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    setConfigSuccess(false)
    const body = {}
    if (configUsername.trim() && configUsername.trim() !== user?.username) body.username = configUsername.trim()
    if (configColor && configColor !== user?.color) body.color = configColor
    if (Object.keys(body).length === 0) {
      setConfigSaving(false)
      return
    }
    try {
      const res = await api.put('/users/me', body)
      setUser(res.data.user)
      setConfigSuccess(true)
      // Si le username a changé, forcer reconnexion socket via SessionPage
      // pour que le nouveau JWT soit lu (socket.user.username mis à jour)
      if (body.username) {
        onReconnectSocket?.()
      }
    } catch (err) {
      console.error('Erreur sauvegarde config :', err)
    } finally {
      setConfigSaving(false)
    }
  }, [configUsername, configColor, user, setUser, onReconnectSocket])

  // ─── RESIZE ─────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()
  }

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = startWidth.current + delta
      if (newWidth < SIDEBAR_CLOSE_THRESHOLD) {
        isDragging.current = false
        onClose()
      } else {
        onWidthChange(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)))
      }
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onClose, onWidthChange])

  // ─── CHAT ────────────────────────────────────────────────────────────────
  const sendMessage = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    socket?.emit(WS.CHAT_MESSAGE, { text: chatInput.trim() })
    setChatInput('')
  }

  // ─── CRÉER UN PERSONNAGE ─────────────────────────────────────────────────
  const handleCreateCharacter = async (e) => {
    e.preventDefault()
    if (!newCharName.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/campaigns/${campaignId}/characters`, {
        name: newCharName.trim(),
      })
      onCharactersChange(prev => [...prev, res.data.character])
      setNewCharName('')
      setShowNewChar(false)
    } catch (err) {
      console.error('Erreur création personnage :', err)
    } finally {
      setCreating(false)
    }
  }

  // ─── DRAG CHARACTER ──────────────────────────────────────────────────────
  const handleDragStart = (e, character) => {
    e.dataTransfer.setData('characterId', character.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // ─── OUVRIR MODALE CHARACTER ─────────────────────────────────────────────
  // La charCard est draggable. On distingue clic (modale) de drag (canvas).
  // dragStartPos stocke la position au mousedown pour détecter si c'est un vrai clic.
  const dragStartPos = useRef(null)

  const handleCardMouseDown = (e) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleCardClick = (e, character) => {
    if (!dragStartPos.current) return
    const dx = Math.abs(e.clientX - dragStartPos.current.x)
    const dy = Math.abs(e.clientY - dragStartPos.current.y)
    // Si la souris a bougé de plus de 4px, c'est un drag — pas un clic
    if (dx > 4 || dy > 4) return
    setSelectedCharacter(character)
  }

  return (
    <div style={{ ...styles.sidebar, width }}>

      {/* Modale character — rendue dans la sidebar, position fixed donc par-dessus tout */}
      {selectedCharacter && (
        <CharacterModal
          character={selectedCharacter}
          isGm={isGm}
          isOwner={selectedCharacter.user_id === user?.id}
          onClose={() => setSelectedCharacter(null)}
          onCharactersChange={onCharactersChange}
          onCharacterUpdate={setSelectedCharacter}
          socket={socket}
          campaignMembers={campaignMembers}
        />
      )}

      {/* Poignée de redimensionnement */}
      <div style={styles.resizeHandle} onMouseDown={onMouseDown} />

      {/* Bouton fermeture */}
      <button style={styles.closeBtn} onClick={onClose} title={t('common.close')}>›</button>

      {/* ─── OUTILS ─────────────────────────────────────────────────────── */}
      <div style={styles.toolsRow}>
        {isGm && (
          <button
            style={{ ...styles.toolBtn, ...(mode === 'edit' ? styles.toolBtnActive : {}) }}
            onClick={() => onModeChange(mode === 'edit' ? 'play' : 'edit')}
            title={mode === 'edit' ? t('session.modePlay') : t('session.modeEdit')}
          >
            {mode === 'edit' ? <IconEdit /> : <IconPlay />}
            <span style={styles.toolLabel}>{mode === 'edit' ? t('session.modeEdit') : t('session.modePlay')}</span>
          </button>
        )}

        {isGm && (
          <button
            style={{ ...styles.toolBtn, ...(layer === 'gm' ? styles.toolBtnActive : {}) }}
            onClick={() => onLayerChange(layer === 'gm' ? 'token' : 'gm')}
            title={layer === 'gm' ? t('session.layerToken') : t('session.layerGM')}
          >
            {layer === 'gm' ? <IconEyeOff /> : <IconEye />}
            <span style={styles.toolLabel}>{layer === 'gm' ? t('session.layerGM') : t('session.layerToken')}</span>
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.toolBtn, ...(toolsOpen ? styles.toolBtnActive : {}) }}
            onClick={() => setToolsOpen(o => !o)}
            title={t('sidebar.measureRule')}
          >
            <IconRuler />
            <span style={styles.toolLabel}>Mesure</span>
          </button>
          {toolsOpen && (
            <div style={styles.toolsDropdown}>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>📏 {t('sidebar.measureRule')}</button>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>⭕ {t('sidebar.measureRange')}</button>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>👁 {t('sidebar.measureSight')}</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── PALETTE MATIÈRES (mode édition) ─────────────────────────────── */}
      {mode === 'edit' && availableMaterials.length > 0 && (
        <div style={styles.palette}>
          <div style={styles.paletteTitle}>Matière</div>
          <div style={styles.paletteGrid}>
            {availableMaterials.map(mat => (
              <button
                key={mat.id}
                onClick={() => onMaterialChange(mat.id)}
                title={mat.label}
                style={{
                  ...styles.matBtn,
                  backgroundImage: `url(${import.meta.env.VITE_API_URL}/api/textures/hard-sf/${mat.top})`,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: activeMaterial === mat.id ? '#3b82f6' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={styles.separator} />

      {/* ─── ONGLETS ─────────────────────────────────────────────────────── */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'chat' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('chat')}
        >
          {t('sidebar.chat')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'persos' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('persos')}
        >
          {t('sidebar.characters')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'joueurs' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('joueurs')}
        >
          {t('sidebar.players')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'biblio' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('biblio')}
        >
          {t('sidebar.library')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'config' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('config')}
        >
          {t('sidebar.config')}
        </button>
      </div>

      {/* ─── CONTENU ─────────────────────────────────────────────────────── */}
      <div style={styles.tabContent}>

        {/* ── Chat ── */}
        {activeTab === 'chat' && (
          <>
            <div style={styles.messages}>
              {messages.length === 0 && (
                <p style={styles.emptyMsg}>{t('chat.placeholder')}</p>
              )}
              {messages.map(msg => (
                msg.system ? (
                  <div key={msg.id} style={styles.messageSystem}>
                    <span style={styles.msgSystemText}>{msg.text}</span>
                    <span style={styles.msgTime}>{msg.time}</span>
                  </div>
                ) : (
                  <div key={msg.id} style={styles.message}>
                    <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
                    <span style={styles.msgTime}> · {msg.time}</span>
                    <p style={styles.msgText}>{msg.text}</p>
                  </div>
                )
              ))}
            </div>
            <form onSubmit={sendMessage} style={styles.chatForm}>
              <input
                style={styles.chatInput}
                placeholder={t('chat.placeholder')}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button style={styles.sendBtn} type="submit">➤</button>
            </form>
          </>
        )}

        {/* ── Persos ── */}
        {activeTab === 'persos' && (
          <div style={styles.persosList}>

            {/* Bouton créer — GM uniquement */}
            {isGm && (
              <div style={styles.persosHeader}>
                <button
                  style={styles.newCharBtn}
                  onClick={() => setShowNewChar(v => !v)}
                >
                  <IconPlus /> {t('sidebar.newCharacter')}
                </button>
              </div>
            )}

            {/* Formulaire création */}
            {isGm && showNewChar && (
              <form onSubmit={handleCreateCharacter} style={styles.newCharForm}>
                <input
                  style={styles.chatInput}
                  placeholder={t('sidebar.characterNamePlaceholder')}
                  value={newCharName}
                  onChange={e => setNewCharName(e.target.value)}
                  autoFocus
                />
                <button
                  style={styles.sendBtn}
                  type="submit"
                  disabled={creating || !newCharName.trim()}
                >
                  {creating ? '…' : '✓'}
                </button>
              </form>
            )}

            {/* Liste des personnages */}
            {characters.length === 0 && (
              <p style={styles.emptyMsg}>{t('sidebar.noCharacters')}</p>
            )}

            {characters.map(char => (
              <div
                key={char.id}
                draggable
                onMouseDown={handleCardMouseDown}
                onDragStart={e => handleDragStart(e, char)}
                onClick={e => handleCardClick(e, char)}
                style={styles.charCard}
                title={t('sidebar.dragToMap')}
              >
                {/* Pastille couleur */}
                <div style={{ ...styles.charColor, background: char.color }} />
                <div style={styles.charInfo}>
                  <span style={styles.charName}>{char.name}</span>
                  {char.owner_username && (
                    <span style={styles.charOwner}>{char.owner_username}</span>
                  )}
                </div>
                {/* Indicateur visibilité — GM uniquement */}
                {isGm && !char.visible && (
                  <span style={styles.charHidden} title={t('sidebar.hiddenFromPlayers')}>
                    <IconEyeOff />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Joueurs ── */}
        {activeTab === 'joueurs' && (
          <div style={styles.playersList}>
            {campaignMembers.length === 0 && (
              <p style={styles.emptyMsg}>{t('sidebar.noPlayers')}</p>
            )}
            {campaignMembers.map(member => {
              const isOnline = onlineUsers.has(member.id)
              const character = characters.find(c => c.user_id === member.id)
              return (
                <div key={member.id} style={styles.playerCard}>
                  {/* Indicateur en ligne */}
                  <div style={{
                    ...styles.onlineDot,
                    background: isOnline ? '#4caf77' : '#2a2a3e',
                  }} />
                  <div style={styles.playerInfo}>
                    <div style={styles.playerNameRow}>
                      <span style={styles.playerName}>{member.username}</span>
                      <span style={member.role === 'gm' ? styles.badgeGM : styles.badgePlayer}>
                        {member.role === 'gm' ? t('sidebar.roleGM') : t('sidebar.rolePlayer')}
                      </span>
                    </div>
                    {character && (
                      <span style={styles.playerCharacter}>
                        ↳ {character.name}
                      </span>
                    )}
                  </div>
                  <span style={{ ...styles.onlineLabel, color: isOnline ? '#4caf77' : '#2a2a3e' }}>
                    {isOnline ? t('sidebar.online') : t('sidebar.offline')}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Biblio ── */}
        {activeTab === 'biblio' && (
          <p style={styles.emptyMsg}>{t('sidebar.libraryPlaceholder')}</p>
        )}

        {/* ── Config ── */}
        {activeTab === 'config' && (
          <div style={styles.configContent}>
            <p style={styles.configTitle}>{t('sidebar.configTitle')}</p>
            {configSuccess && (
              <p style={styles.configSuccess}>{t('sidebar.configSaved')}</p>
            )}
            <form onSubmit={handleConfigSave}>
              <div style={styles.configField}>
                <label style={styles.configLabel}>{t('sidebar.configUsername')}</label>
                <input
                  style={styles.configInput}
                  value={configUsername}
                  onChange={e => setConfigUsername(e.target.value)}
                />
              </div>
              <div style={styles.configField}>
                <label style={styles.configLabel}>{t('sidebar.configColor')}</label>
                <div style={styles.configColorRow}>
                  <input
                    type="color"
                    value={configColor}
                    onChange={e => setConfigColor(e.target.value)}
                    style={styles.configColorPicker}
                  />
                  <span style={{ ...styles.configLabel, color: configColor }}>{configColor}</span>
                </div>
              </div>
              <button
                style={styles.configSaveBtn}
                type="submit"
                disabled={configSaving}
              >
                {configSaving ? '…' : t('common.save')}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  sidebar: {
    position: 'relative',
    height: '100%',
    background: '#0f0f1a',
    borderLeft: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    userSelect: 'none',
  },
  resizeHandle: {
    position: 'absolute',
    left: '-3px',
    top: 0,
    width: '6px',
    height: '100%',
    cursor: 'col-resize',
    zIndex: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '18px',
    lineHeight: 1,
    zIndex: 10,
  },
  toolsRow: {
    display: 'flex',
    gap: '6px',
    padding: '12px 12px 8px 16px',
    flexWrap: 'wrap',
  },
  toolBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '8px 10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    color: '#9090a8',
    cursor: 'pointer',
    minWidth: '52px',
    transition: 'all 0.15s',
  },
  toolBtnActive: {
    background: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
    color: '#5b8dee',
  },
  toolLabel: {
    fontSize: '9px',
    letterSpacing: '0.5px',
  },
  toolsDropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    minWidth: '160px',
    zIndex: 50,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '9px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #1e1e2e',
    color: '#9090a8',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
  },
  palette: {
    padding: '10px 12px',
    borderBottom: '1px solid #1e1e2e',
  },
  paletteTitle: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  paletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  matBtn: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '4px',
    cursor: 'pointer',
    background: '#1e293b',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: 0,
  },
  separator: {
    height: '1px',
    background: '#1e1e2e',
    margin: '0 12px',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e2e',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    transition: 'color 0.15s',
  },
  tabActive: {
    color: '#9090a8',
    borderBottom: '2px solid #5b8dee',
  },
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  emptyMsg: {
    color: '#4a4a60',
    fontSize: '12px',
    textAlign: 'center',
    padding: '24px 12px',
    margin: 0,
  },
  message: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'baseline',
  },
  msgUser: { fontSize: '11px', fontWeight: '600' },
  msgTime: { color: '#4a4a60', fontSize: '10px' },
  msgText: { width: '100%', color: '#c0c0d0', fontSize: '12px', lineHeight: '1.5', margin: 0 },
  messageSystem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '2px 0',
  },
  msgSystemText: {
    color: '#4a4a60',
    fontSize: '11px',
    fontStyle: 'italic',
    flex: 1,
  },
  chatForm: {
    display: 'flex',
    gap: '6px',
    padding: '10px 12px',
    borderTop: '1px solid #1e1e2e',
  },
  chatInput: {
    flex: 1,
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
  },
  sendBtn: {
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: '6px',
    color: '#5b8dee',
    cursor: 'pointer',
    padding: '8px 12px',
    fontSize: '12px',
  },
  // ── Joueurs ──
  playersList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
  },
  onlineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  playerInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  playerNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  playerName: {
    color: '#c0c0d0',
    fontSize: '12px',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerCharacter: {
    color: '#4a4a60',
    fontSize: '10px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgeGM: {
    fontSize: '9px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(91,141,238,0.2)',
    color: '#5b8dee',
    flexShrink: 0,
  },
  badgePlayer: {
    fontSize: '9px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(76,175,119,0.2)',
    color: '#4caf77',
    flexShrink: 0,
  },
  onlineLabel: {
    fontSize: '9px',
    flexShrink: 0,
  },
  // ── Persos ──
  persosList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
  },
  persosHeader: {
    padding: '4px 0 8px',
  },
  newCharBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(91,141,238,0.1)',
    border: '1px dashed #5b8dee',
    borderRadius: '6px',
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: '12px',
  },
  newCharForm: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  },
  charCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  charColor: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  charInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  charName: {
    color: '#c0c0d0',
    fontSize: '12px',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  charOwner: {
    color: '#4a4a60',
    fontSize: '10px',
  },
  charHidden: {
    color: '#4a4a60',
    flexShrink: 0,
  },
  // ── Modale character ──
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPanel: {
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '12px',
    width: '480px',
    maxWidth: '95vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid #1e1e2e',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#c0c0d0',
  },
  savingIndicator: {
    fontSize: '12px',
    color: '#4a4a60',
  },
  modalHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalActionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  illustrationPlaceholder: {
    height: '100px',
    background: '#16162a',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationText: {
    fontSize: '11px',
    color: '#4a4a60',
    fontStyle: 'italic',
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e2e',
  },
  modalTab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  modalTabActive: {
    color: '#9090a8',
    borderBottom: '2px solid #5b8dee',
  },
  modalContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  modalPlaceholder: {
    color: '#4a4a60',
    fontSize: '12px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },
  notesContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '10px',
    color: '#c0c0d0',
    fontSize: '12px',
    lineHeight: '1.5',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  settingsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  settingsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  settingsValue: {
    fontSize: '13px',
    color: '#c0c0d0',
  },
  deleteCharBtn: {
    marginTop: '8px',
    padding: '10px 16px',
    background: 'rgba(224,92,92,0.12)',
    border: '1px solid rgba(224,92,92,0.4)',
    borderRadius: '6px',
    color: '#e05c5c',
    cursor: 'pointer',
    fontSize: '13px',
    width: '100%',
  },
  select: {
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  // ── Config ──
  configContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  configTitle: {
    fontSize: '11px',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '500',
    margin: 0,
  },
  configSuccess: {
    fontSize: '12px',
    color: '#4caf77',
    backgroundColor: 'rgba(76,175,119,0.1)',
    border: '1px solid rgba(76,175,119,0.3)',
    borderRadius: '6px',
    padding: '8px 10px',
    margin: 0,
  },
  configField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  configLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  configInput: {
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
  },
  configColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  configColorPicker: {
    width: '36px',
    height: '32px',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '2px',
    backgroundColor: '#16162a',
    cursor: 'pointer',
  },
  configSaveBtn: {
    marginTop: '4px',
    width: '100%',
    padding: '9px 0',
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid #5b8dee',
    borderRadius: '6px',
    color: '#5b8dee',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
}
