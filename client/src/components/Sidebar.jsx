import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 500
const SIDEBAR_CLOSE_THRESHOLD = 160

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

export default function Sidebar({
  mode, onModeChange,
  layer, onLayerChange,
  width, onWidthChange,
  onClose,
  activeMaterial, onMaterialChange, availableMaterials = [],
}) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isGM = true

  const [activeTab, setActiveTab] = useState('chat')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // ─── RESIZE ─────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()
  }

  useEffect(() => {
    //console.log('VITE_API_URL:', import.meta.env.VITE_API_URL)
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
    setMessages(prev => [...prev, {
      id: Date.now(),
      user: user?.username || '?',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }])
    setChatInput('')
  }

  return (
    <div style={{ ...styles.sidebar, width }}>

      {/* Poignée de redimensionnement */}
      <div style={styles.resizeHandle} onMouseDown={onMouseDown} />

      {/* Bouton fermeture */}
      <button style={styles.closeBtn} onClick={onClose} title="Réduire">›</button>

      {/* ─── OUTILS ─────────────────────────────────────────────────────── */}
      <div style={styles.toolsRow}>
        {isGM && (
          <button
            style={{ ...styles.toolBtn, ...(mode === 'edit' ? styles.toolBtnActive : {}) }}
            onClick={() => onModeChange(mode === 'edit' ? 'play' : 'edit')}
            title={mode === 'edit' ? 'Mode jeu' : 'Mode édition'}
          >
            {mode === 'edit' ? <IconEdit /> : <IconPlay />}
            <span style={styles.toolLabel}>{mode === 'edit' ? 'Édition' : 'Jeu'}</span>
          </button>
        )}

        {isGM && (
          <button
            style={{ ...styles.toolBtn, ...(layer === 'gm' ? styles.toolBtnActive : {}) }}
            onClick={() => onLayerChange(layer === 'gm' ? 'token' : 'gm')}
            title={layer === 'gm' ? 'Calque token' : 'Calque GM'}
          >
            {layer === 'gm' ? <IconEyeOff /> : <IconEye />}
            <span style={styles.toolLabel}>{layer === 'gm' ? 'GM' : 'Token'}</span>
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.toolBtn, ...(toolsOpen ? styles.toolBtnActive : {}) }}
            onClick={() => setToolsOpen(o => !o)}
            title="Outils de mesure"
          >
            <IconRuler />
            <span style={styles.toolLabel}>Mesure</span>
          </button>
          {toolsOpen && (
            <div style={styles.toolsDropdown}>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>📏 Règle / distance</button>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>⭕ Portée / aura</button>
              <button style={styles.dropdownItem} onClick={() => setToolsOpen(false)}>👁 Ligne de visée</button>
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
        {['chat', 'biblio', 'params'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'chat' && 'Chat'}
            {tab === 'biblio' && 'Biblio'}
            {tab === 'params' && 'Params'}
          </button>
        ))}
      </div>

      {/* ─── CONTENU ─────────────────────────────────────────────────────── */}
      <div style={styles.tabContent}>
        {activeTab === 'chat' && (
          <>
            <div style={styles.messages}>
              {messages.length === 0 && (
                <p style={styles.emptyMsg}>Aucun message pour l'instant.</p>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={styles.message}>
                  <span style={styles.msgUser}>{msg.user}</span>
                  <span style={styles.msgTime}> · {msg.time}</span>
                  <p style={styles.msgText}>{msg.text}</p>
                </div>
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
        {activeTab === 'biblio' && <p style={styles.emptyMsg}>Bibliothèque — Phase 3</p>}
        {activeTab === 'params' && <p style={styles.emptyMsg}>Paramètres — à venir</p>}
      </div>
    </div>
  )
}

const styles = {
  sidebar: {
    position: 'relative',
    height: '100vh',
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
  msgUser: { color: '#5b8dee', fontSize: '11px', fontWeight: '600' },
  msgTime: { color: '#4a4a60', fontSize: '10px' },
  msgText: { width: '100%', color: '#c0c0d0', fontSize: '12px', lineHeight: '1.5', margin: 0 },
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
}