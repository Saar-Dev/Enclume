import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

export default function RegisterPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/register', { email, password, username, inviteCode })
      setUser(res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('auth.registerError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <img src="/logo.svg" alt="Enclume" style={styles.logoImg} />
          <h1 style={styles.title}>Enclume</h1>
        </div>
        <p style={styles.subtitle}>{t('auth.registerSubtitle')}</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t('auth.username')}</label>
            <input
              style={styles.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t('auth.email')}</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t('auth.password')}</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t('auth.betaCode')}</label>
            <input
              style={styles.input}
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={t('auth.betaCodePlaceholder')}
              maxLength={8}
              required
            />
          </div>

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <p style={styles.footer}>
          {t('auth.alreadyAccount')}{' '}
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-app)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-normal)',
    borderRadius: '12px',
    padding: '40px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  logoImg: {
    width: '40px',
    height: 'auto',
    color: 'var(--text-primary)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: '0',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  button: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '11px',
    fontWeight: '500',
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '24px',
  },
}
