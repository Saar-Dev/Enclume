import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

export default function LoginPage() {
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await api.post('/auth/login', { email, password })
      setUser(res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.response?.data?.error?.message || t('auth.loginError')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

  <div className="login-card">

    <div className="login-header">
      <h1 className="login-title">Enclume</h1>
      <p className="login-subtitle">{t('auth.subtitle')}</p>
    </div>

    {error && <div className="login-error">{error}</div>}

    <form onSubmit={handleSubmit} className="login-form">
      <div className="login-field">
        <label>{t('auth.email')}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>

      <div className="login-field">
        <label>{t('auth.password')}</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? t('common.loading') : t('auth.login')}
      </button>
    </form>

    <p className="login-footer">
      <Link to="/register">{t('auth.register')}</Link>
    </p>

  </div>
</div>
  )
}