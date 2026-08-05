import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import api from '../lib/api.js'
import { styles } from './Sidebar.styles.js'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4c) — comportement inchangé.
// L'effet de préremplissage tournait sur activeTab==='profil' && user ; ce composant n'étant monté
// que quand cet onglet est actif, un effet au montage (dép. [user]) est équivalent.
export default function SidebarProfileTab({ onReconnectSocket }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const { characters, members } = useCharacterStore()
  const { onlineUsers } = useSessionStore()

  const [configUsername, setConfigUsername] = useState('')
  const [configColor, setConfigColor] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    setConfigUsername(user.username || '')
    setConfigColor(user.color || '#4A90D9')
    setConfigSuccess(false)
  }, [user])

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

  return (
    <>
      {/* Réglages compte */}
      <div style={styles.configContent}>
        {configSuccess && (
          <p className="sidebar-config-success">{t('sidebar.configSaved')}</p>
        )}
        <form onSubmit={handleConfigSave}>
          <div style={styles.configField}>
            <label style={styles.configLabel}>{t('sidebar.configUsername')}</label>
            <input
              className="sidebar-tool-field" style={styles.configInput}
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
                className="sidebar-tool-color-input sidebar-config-color-picker"
              />
              <span style={{ ...styles.configLabel, color: configColor }}>{configColor}</span>
            </div>
          </div>
          <button className="btn" style={{ width:'100%', marginTop:'8px' }} type="submit" disabled={configSaving}>
            {configSaving ? '…' : t('common.save')}
          </button>
        </form>
      </div>

      {/* Séparateur */}
      <div className="sidebar-separator" style={styles.profilSeparator} />

      {/* Liste des connectés */}
      <div style={styles.playersList}>
        {members.length === 0 && (
          <p style={styles.emptyMsg}>{t('sidebar.noPlayers')}</p>
        )}
        {members.map(member => {
          const isOnline = onlineUsers.has(member.id)
          const character = characters.find(c => c.user_id === member.id)
          return (
            <div key={member.id} className="sidebar-glass" style={styles.playerCard}>
              <div style={{
                ...styles.onlineDot,
                background: isOnline ? 'var(--color-success-soft)' : 'var(--border-session-2)',
              }} />
              <div style={styles.playerInfo}>
                <div style={styles.playerNameRow}>
                  <span style={styles.playerName}>{member.username}</span>
                  <span className={member.role === 'gm' ? 'badge badge-gm' : 'badge badge-player'}>
                    {member.role === 'gm' ? t('sidebar.roleGM') : t('sidebar.rolePlayer')}
                  </span>
                </div>
                {character && (
                  <span style={styles.playerCharacter}>↳ {character.name}</span>
                )}
              </div>
              <span style={{ ...styles.onlineLabel, color: isOnline ? 'var(--color-success-soft)' : 'var(--border-session-2)' }}>
                {isOnline ? t('sidebar.online') : t('sidebar.offline')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Quitter la session */}
      <div style={{ padding: '8px 12px 12px' }}>
        <button className="btn btn-ghost" style={{ width:'100%', padding:'8px 0' }} onClick={() => navigate('/dashboard')}>
          {t('sidebar.quit')}
        </button>
      </div>
    </>
  )
}
