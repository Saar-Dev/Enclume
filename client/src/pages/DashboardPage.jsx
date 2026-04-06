import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

export default function DashboardPage() {
  const { user, clearUser, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ username: '', email: '', color: '', password: '', current_password: '' })
  const [profileError, setProfileError] = useState(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    api.get('/campaigns')
      .then(res => setCampaigns(res.data.campaigns))
      .catch(() => setError(t('dashboard.errorLoad')))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await api.post('/auth/logout')
    clearUser()
    navigate('/login')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/campaigns', { name: newCampaignName })
      setCampaigns(prev => [...prev, { ...res.data.campaign, role: 'gm' }])
      setNewCampaignName('')
      setShowCreate(false)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.errorCreate'))
    }
  }

  const handleOpenProfile = () => {
    setProfileForm({ username: user?.username || '', email: user?.email || '', color: user?.color || '', password: '', current_password: '' })
    setProfileError(null)
    setProfileSuccess(false)
    setShowProfile(true)
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    setProfileLoading(true)

    // Construire le body — seulement les champs modifiés
    const body = {}
    if (profileForm.username && profileForm.username !== user?.username) body.username = profileForm.username
    if (profileForm.email && profileForm.email !== user?.email) body.email = profileForm.email
    if (profileForm.color && profileForm.color !== user?.color) body.color = profileForm.color
    if (profileForm.password) {
      body.password = profileForm.password
      body.current_password = profileForm.current_password
    }

    if (Object.keys(body).length === 0) {
      setProfileLoading(false)
      setShowProfile(false)
      return
    }

    try {
      const res = await api.put('/users/me', body)
      setUser(res.data.user)
      setProfileSuccess(true)
      setProfileForm(prev => ({ ...prev, password: '', current_password: '' }))
    } catch (err) {
      setProfileError(err.response?.data?.error?.message || t('profile.errorSave'))
    } finally {
      setProfileLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/campaigns/join', { invite_code: inviteCode })
      setCampaigns(prev => [...prev, { ...res.data.campaign, role: 'player' }])
      setInviteCode('')
      setShowJoin(false)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.errorJoin'))
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>Enclume</span>
        <div style={styles.headerRight}>
          <button style={styles.usernameBtn} onClick={handleOpenProfile}>
            {user?.username}
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={styles.content}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>{t('dashboard.title')}</h2>
          <div style={styles.actions}>
            <button style={styles.btnSecondary} onClick={() => { setShowJoin(true); setShowCreate(false) }}>
              {t('dashboard.joinWithCode')}
            </button>
            <button style={styles.btnPrimary} onClick={() => { setShowCreate(true); setShowJoin(false) }}>
              {t('dashboard.createCampaign')}
            </button>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Formulaire création */}
        {showCreate && (
          <form onSubmit={handleCreate} style={styles.inlineForm}>
            <input
              style={styles.input}
              placeholder={t('dashboard.campaignName')}
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
              required
              autoFocus
            />
            <button style={styles.btnPrimary} type="submit">{t('dashboard.create')}</button>
            <button style={styles.btnGhost} type="button" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
          </form>
        )}

        {/* Formulaire rejoindre */}
        {showJoin && (
          <form onSubmit={handleJoin} style={styles.inlineForm}>
            <input
              style={styles.input}
              placeholder={t('dashboard.inviteCode')}
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
              autoFocus
            />
            <button style={styles.btnPrimary} type="submit">{t('dashboard.join')}</button>
            <button style={styles.btnGhost} type="button" onClick={() => setShowJoin(false)}>{t('common.cancel')}</button>
          </form>
        )}

        {/* Liste campagnes */}
        {loading ? (
          <p style={styles.muted}>{t('common.loading')}</p>
        ) : campaigns.length === 0 ? (
          <p style={styles.muted}>{t('dashboard.noCampaigns')}</p>
        ) : (
          <div style={styles.grid}>
            {campaigns.map(campaign => (
              <div key={campaign.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.cardTitle}>{campaign.name}</span>
                  <span style={campaign.role === 'gm' ? styles.badgeGM : styles.badgePlayer}>
                  {campaign.role === 'gm' ? t('dashboard.roleGM') : t('dashboard.rolePlayer')}
                  </span>
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.inviteCode}>#{campaign.invite_code}</span>
                  <button style={styles.btnPrimary} onClick={() => navigate(`/session/${campaign.id}`)}>
                    {t('dashboard.launch')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale profil */}
      {showProfile && (
        <div style={styles.profileOverlay} onMouseDown={() => setShowProfile(false)}>
          <div style={styles.profileModal} onMouseDown={e => e.stopPropagation()}>
            <h3 style={styles.profileTitle}>{t('profile.title')}</h3>

            {profileError && <div style={styles.error}>{profileError}</div>}
            {profileSuccess && <div style={styles.profileSuccessMsg}>{t('profile.saved')}</div>}

            <form onSubmit={handleProfileSave}>
              <div style={styles.profileField}>
                <label style={styles.profileLabel}>{t('profile.username')}</label>
                <input
                  style={styles.profileInput}
                  value={profileForm.username}
                  onChange={e => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div style={styles.profileField}>
                <label style={styles.profileLabel}>{t('profile.email')}</label>
                <input
                  style={styles.profileInput}
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div style={styles.profileField}>
                <label style={styles.profileLabel}>{t('profile.color')}</label>
                <div style={styles.profileColorRow}>
                  <input
                    type="color"
                    value={profileForm.color}
                    onChange={e => setProfileForm(prev => ({ ...prev, color: e.target.value }))}
                    style={styles.colorPicker}
                  />
                  <span style={{ ...styles.profileLabel, color: profileForm.color }}>{profileForm.color}</span>
                </div>
              </div>

              <div style={styles.profileField}>
                <label style={styles.profileLabel}>{t('profile.currentPassword')}</label>
                <input
                  style={styles.profileInput}
                  type="password"
                  placeholder={t('profile.currentPasswordHint')}
                  value={profileForm.current_password}
                  onChange={e => setProfileForm(prev => ({ ...prev, current_password: e.target.value }))}
                />
              </div>

              <div style={styles.profileField}>
                <label style={styles.profileLabel}>{t('profile.password')}</label>
                <input
                  style={styles.profileInput}
                  type="password"
                  value={profileForm.password}
                  onChange={e => setProfileForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>

              <div style={styles.profileActions}>
                <button style={styles.btnGhost} type="button" onClick={() => setShowProfile(false)}>
                  {t('common.cancel')}
                </button>
                <button style={styles.btnPrimary} type="submit" disabled={profileLoading}>
                  {profileLoading ? t('common.loading') : t('profile.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    height: '56px',
    backgroundColor: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  logo: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  usernameBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 32px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '22px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  inlineForm: {
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  input: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '8px',
    padding: '9px 14px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '14px',
    minWidth: '240px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '10px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCode: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  badgeGM: {
    fontSize: '11px',
    fontWeight: '500',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(91,141,238,0.2)',
    color: '#5b8dee',
  },
  badgePlayer: {
    fontSize: '11px',
    fontWeight: '500',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(76,175,119,0.2)',
    color: '#4caf77',
  },
  btnPrimary: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontWeight: '500',
    fontSize: '13px',
  },
  btnSecondary: {
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
  },
  btnGhost: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    padding: '8px',
  },
  error: {
    backgroundColor: 'rgba(224,92,92,0.12)',
    border: '1px solid var(--color-danger)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: 'var(--color-danger)',
    fontSize: '13px',
    marginBottom: '20px',
  },
  muted: {
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  profileOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  profileModal: {
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--border-normal)',
    borderRadius: '12px',
    padding: '28px 32px',
    width: '380px',
    maxWidth: '90vw',
  },
  profileTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: '20px',
  },
  profileField: {
    marginBottom: '16px',
  },
  profileLabel: {
    display: 'block',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  profileInput: {
    width: '100%',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '8px',
    padding: '9px 14px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  profileColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  colorPicker: {
    width: '40px',
    height: '36px',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    padding: '2px',
    backgroundColor: 'var(--bg-card)',
    cursor: 'pointer',
  },
  profileActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
  },
  profileSuccessMsg: {
    backgroundColor: 'rgba(76,175,119,0.12)',
    border: '1px solid #4caf77',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#4caf77',
    fontSize: '13px',
    marginBottom: '16px',
  },
}