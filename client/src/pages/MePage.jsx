import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

// Page profil autonome, accessible depuis le Dashboard (pas seulement depuis l'onglet Profil de la
// Sidebar en session, SidebarProfileTab.jsx, qui ne couvre que username/couleur). Couvre les 4
// champs déjà supportés par PUT /me (routes/users.js) : username, email, color, password.
export default function MePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState('#4A90D9')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = 'Enclume — Mon compte' }, [])

  useEffect(() => {
    if (!user) return
    setUsername(user.username || '')
    setEmail(user.email || '')
    setColor(user.color || '#4A90D9')
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSuccess(false)
    setError(null)

    const body = {}
    if (username.trim() && username.trim() !== user?.username) body.username = username.trim()
    if (email.trim() && email.trim() !== user?.email) body.email = email.trim()
    if (color && color !== user?.color) body.color = color

    const wantsPasswordChange = currentPassword || newPassword || newPasswordConfirm
    if (wantsPasswordChange) {
      if (!currentPassword) {
        setError(t('me.currentPasswordRequired'))
        return
      }
      if (newPassword !== newPasswordConfirm) {
        setError(t('me.passwordMismatch'))
        return
      }
      body.password = newPassword
      body.current_password = currentPassword
    }

    if (Object.keys(body).length === 0) {
      setError(t('me.nothingToSave'))
      return
    }

    setSaving(true)
    try {
      const res = await api.put('/users/me', body)
      setUser(res.data.user)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('me.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/dashboard')} style={S.backBtn}>← {t('me.backToDashboard')}</span>
      </div>

      <div style={S.body}>
        <h1 style={S.pageTitle}>{t('me.title')}</h1>

        {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}
        {success && <div style={S.successBanner}>{t('me.saved')}</div>}

        <form onSubmit={handleSave} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>{t('me.username')}</label>
            <input style={S.input} value={username} onChange={e => setUsername(e.target.value)} />
          </div>

          <div style={S.field}>
            <label style={S.label}>{t('me.email')}</label>
            <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div style={S.field}>
            <label style={S.label}>{t('me.color')}</label>
            <div style={S.colorRow}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={S.colorInput} />
              <span style={{ color }}>{color}</span>
            </div>
          </div>

          <div style={S.separator} />

          <h2 style={S.sectionTitle}>{t('me.passwordSectionTitle')}</h2>

          <div style={S.field}>
            <label style={S.label}>{t('me.currentPassword')}</label>
            <input style={S.input} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>

          <div style={S.field}>
            <label style={S.label}>{t('me.newPassword')}</label>
            <input style={S.input} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>

          <div style={S.field}>
            <label style={S.label}>{t('me.newPasswordConfirm')}</label>
            <input style={S.input} type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} autoComplete="new-password" />
          </div>

          <button className="btn" type="submit" disabled={saving} style={{ marginTop: '8px' }}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>

    </div>
  )
}

// ─── Styles (même patron que AdminUsersPage.jsx/VaultPage.jsx) ────────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 22px' },
  sectionTitle: { fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },
  successBanner: { backgroundColor: 'rgba(92,224,140,0.12)', border: '1px solid var(--color-success)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-success)', fontSize: '13px', margin: '0 0 16px' },

  body: { flex: 1, maxWidth: '420px', width: '100%', margin: '0 auto', padding: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', color: 'var(--text-muted)' },
  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' },
  colorRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  colorInput: { width: '40px', height: '30px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '6px', cursor: 'pointer', background: 'none' },
  separator: { height: '1px', backgroundColor: 'var(--border-subtle)', margin: '8px 0' },
}
