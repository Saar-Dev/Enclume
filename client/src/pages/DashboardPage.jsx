import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

export default function DashboardPage() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/campaigns')
      .then(res => setCampaigns(res.data.campaigns))
      .catch(() => setError('Failed to load campaigns'))
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
      setError(err.response?.data?.error?.message || 'Error creating campaign')
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
      setError(err.response?.data?.error?.message || 'Error joining campaign')
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>Enclume</span>
        <div style={styles.headerRight}>
          <span style={styles.username}>{user?.username}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={styles.content}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>My Campaigns</h2>
          <div style={styles.actions}>
            <button style={styles.btnSecondary} onClick={() => { setShowJoin(true); setShowCreate(false) }}>
              Join with code
            </button>
            <button style={styles.btnPrimary} onClick={() => { setShowCreate(true); setShowJoin(false) }}>
              New campaign
            </button>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Formulaire création */}
        {showCreate && (
          <form onSubmit={handleCreate} style={styles.inlineForm}>
            <input
              style={styles.input}
              placeholder="Campaign name"
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
              required
              autoFocus
            />
            <button style={styles.btnPrimary} type="submit">Create</button>
            <button style={styles.btnGhost} type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </form>
        )}

        {/* Formulaire rejoindre */}
        {showJoin && (
          <form onSubmit={handleJoin} style={styles.inlineForm}>
            <input
              style={styles.input}
              placeholder="Invite code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
              autoFocus
            />
            <button style={styles.btnPrimary} type="submit">Join</button>
            <button style={styles.btnGhost} type="button" onClick={() => setShowJoin(false)}>Cancel</button>
          </form>
        )}

        {/* Liste campagnes */}
        {loading ? (
          <p style={styles.muted}>Loading...</p>
        ) : campaigns.length === 0 ? (
          <p style={styles.muted}>No campaigns yet. Create one or join with a code.</p>
        ) : (
          <div style={styles.grid}>
            {campaigns.map(campaign => (
              <div key={campaign.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.cardTitle}>{campaign.name}</span>
                  <span style={campaign.role === 'gm' ? styles.badgeGM : styles.badgePlayer}>
                    {campaign.role === 'gm' ? 'GM' : 'Player'}
                  </span>
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.inviteCode}>#{campaign.invite_code}</span>
                  <button style={styles.btnPrimary} onClick={() => navigate(`/session/${campaign.id}`)}>
  Launch
</button>
                </div>
              </div>
            ))}
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
  username: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
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
}