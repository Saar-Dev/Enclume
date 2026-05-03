import { useState, useEffect, useRef } from 'react'
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

  const [copiedId, setCopiedId] = useState(null)
  const [uploadingCoverId, setUploadingCoverId] = useState(null)
  const coverInputRef = useRef(null)
  const pendingCoverIdRef = useRef(null)

  useEffect(() => {
    api.get('/campaigns')
      .then(res => setCampaigns(res.data.campaigns))
      .catch(() => setError(t('dashboard.errorLoad')))
      .finally(() => setLoading(false))
  }, [])

  // Vrai si l'utilisateur est GM dans au moins une campagne
  const isGmAnywhere = campaigns.some(c => c.role === 'gm')

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

  const handleCoverClick = (campaignId) => {
    pendingCoverIdRef.current = campaignId
    coverInputRef.current.click()
  }

  const handleCoverChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const campaignId = pendingCoverIdRef.current
    setUploadingCoverId(campaignId)
    try {
      const formData = new FormData()
      formData.append('cover', file)
      const res = await api.post(`/campaigns/${campaignId}/cover`, formData)
      setCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, cover_url: res.data.campaign.cover_url } : c
      ))
    } catch (err) {
      setError(err.response?.data?.error?.message || t('dashboard.coverErrorUpload'))
    } finally {
      setUploadingCoverId(null)
      e.target.value = ''
    }
  }

  const handleCopy = async (e, code, id) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  return (
    <div style={styles.container}>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleCoverChange}
      />

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <img src="/logo.svg" alt="Enclume" style={styles.logoImg} />
          <span style={styles.logo}>Enclume</span>
        </div>

        <div style={styles.headerRight}>
          {/* Lien Packs de textures — visible uniquement si GM dans au moins une campagne */}
          {isGmAnywhere && (
            <button
              style={styles.texturePacksBtn}
              onClick={() => navigate('/workshop')}
            >
              Atelier
            </button>
          )}

          <button style={styles.usernameBtn}>
            {user?.username}
          </button>

          <button style={styles.logoutBtn} onClick={handleLogout}>
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={styles.content}>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <p style={styles.muted}>{t('common.loading')}</p>
        ) : (
          <div className="campaign-grid">

            {/* EMPTY STATE */}
            {campaigns.length === 0 && (
              <div className="card campaign-create" onClick={() => setShowCreate(true)}>
                <div className="create-label">Créer une campagne</div>
                <div className="create-plus">+</div>
              </div>
            )}

            {/* CAMPAIGNS */}
            {campaigns.map(campaign => (
              <div key={campaign.id} className="card campaign-card">

                {/* COVER */}
                <div
                  className="campaign-cover"
                  onClick={campaign.role === 'gm' ? () => handleCoverClick(campaign.id) : undefined}
                  style={campaign.role === 'gm' ? { cursor: uploadingCoverId === campaign.id ? 'wait' : 'pointer' } : undefined}
                  title={campaign.role === 'gm'
                    ? (uploadingCoverId === campaign.id ? t('dashboard.coverUploading') : t('dashboard.coverUpload'))
                    : undefined}
                >
                  {campaign.cover_url
                    ? <img src={`${import.meta.env.VITE_API_URL}/api/assets/${campaign.cover_url}`} alt={campaign.name} />
                    : <div className="campaign-cover-placeholder" />
                  }
                </div>

                {/* HEADER */}
                <div style={styles.cardHeader}>
                  <span style={styles.cardTitle}>{campaign.name}</span>

                  <span style={campaign.role === 'gm' ? styles.badgeGM : styles.badgePlayer}>
                    {campaign.role === 'gm'
                      ? t('dashboard.roleGM')
                      : t('dashboard.rolePlayer')}
                  </span>
                </div>

                {/* FOOTER */}
                <div style={styles.cardFooter}>

                  <div className="invite-wrapper">
                    <span style={styles.inviteCode}>
                      #{campaign.invite_code}
                    </span>

                    <button
                      className="copy-btn"
                      onClick={(e) => handleCopy(e, campaign.invite_code, campaign.id)}
                    >
                      {copiedId === campaign.id ? "Copié !" : "📋"}
                    </button>
                  </div>

                  <button
                    style={styles.btnPrimary}
                    onClick={() => navigate(`/session/${campaign.id}`)}
                  >
                    Jouer
                  </button>

                </div>

                {/* SETTINGS GM */}
                {campaign.role === 'gm' && (
                  <div style={styles.cardActions}>
                    <button
                      style={styles.btnSettings}
                      onClick={() => navigate(`/campaigns/${campaign.id}/settings`)}
                    >
                      {t('dashboard.settings')}
                    </button>
                  </div>
                )}

              </div>
            ))}

            {/* CREATE CARD LAST */}
            {campaigns.length > 0 && (
              <div className="card campaign-create" onClick={() => setShowCreate(true)}>
                <div className="create-label">Créer une campagne</div>
                <div className="create-plus">+</div>
              </div>
            )}

          </div>
        )}

      </div>
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

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  logoImg: {
    width: '28px',
    height: 'auto',
    color: 'var(--text-primary)',
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

  texturePacksBtn: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px 8px',
  },

  usernameBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },

  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
  },

  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 32px',
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

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: '15px',
    fontWeight: '500',
  },

  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardActions: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '12px',
  },

  inviteCode: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
  },

  badgeGM: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(91,141,238,0.2)',
    color: '#5b8dee',
  },

  badgePlayer: {
    fontSize: '11px',
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
    fontSize: '13px',
    cursor: 'pointer',
  },
}
