import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import api from '../lib/api.js'
import { IconEyeOff } from './SidebarIcons.jsx'
import { styles } from './Sidebar.styles.js'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4b) — comportement inchangé.
export default function SidebarCharactersTab({ campaignId, onOpenCharacter }) {
  const { t } = useTranslation()
  const { characters, isGm, addCharacter } = useCharacterStore()

  // Formulaire de création de personnage
  const [showNewChar, setShowNewChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharType, setNewCharType] = useState('pnj')
  const [creating, setCreating] = useState(false)

  // ─── CRÉER UN PERSONNAGE ─────────────────────────────────────────────────
  const handleCreateCharacter = async (e) => {
    e.preventDefault()
    if (!newCharName.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/campaigns/${campaignId}/characters`, {
        name: newCharName.trim(),
        type: newCharType,
      })
      addCharacter(res.data.character)
      setNewCharName('')
      setNewCharType('pnj')
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
    onOpenCharacter?.(character)
  }

  return (
    <div style={styles.persosList}>

      {/* Bouton créer — GM uniquement */}
      {isGm && (
        <button
          className="btn"
          style={{ width: '100%', marginBottom: '8px' }}
          onClick={() => setShowNewChar(v => !v)}
        >
          {t('sidebar.newCharacter')}
        </button>
      )}

      {/* Formulaire création */}
      {isGm && showNewChar && (
        <form onSubmit={handleCreateCharacter} style={{ ...styles.newCharForm, flexDirection: 'column', gap: '6px' }}>
          <select
            className="sidebar-tool-field" style={styles.select}
            value={newCharType}
            onChange={e => setNewCharType(e.target.value)}
          >
            <option value="pnj">{t('drone.typeHumanoid')}</option>
            <option value="drone">{t('drone.typeDrone')}</option>
            <option value="armure" disabled>{t('drone.typeArmor')}</option>
          </select>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              className="sidebar-tool-field" style={styles.chatInput}
              placeholder={t('sidebar.characterNamePlaceholder')}
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              autoFocus
            />
            <button
              className="btn-icon"
              type="submit"
              disabled={creating || !newCharName.trim()}
              style={{ color: 'var(--color-primary)' }}
            >
              {creating ? '…' : '✓'}
            </button>
          </div>
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
          className="sidebar-glass"
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
  )
}
