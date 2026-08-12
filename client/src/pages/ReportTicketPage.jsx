import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// PLAN_TICKETS.md Lot 1 — formulaire de signalement (bug/déséquilibre/suggestion). Champ volontairement
// minimal (§2 du plan, bonnes pratiques externes) : ni priorité ni sévérité, posées par l'admin au
// triage, jamais par le rapporteur. `origin` n'est jamais envoyé — calculé serveur (ticketService.js)
// à partir de users.role/campaign_members.role, un joueur ne peut pas se déclarer admin.
const DOMAIN_KEYS = ['monde', 'combat', 'personnage', 'wizard', 'marchands', 'editeur', 'infrastructure', 'autre']
const CATEGORY_KEYS = ['bug', 'balance', 'suggestion', 'other']

export default function ReportTicketPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t: tt } = useTranslation('tickets')

  const [category, setCategory] = useState('bug')
  const [domain, setDomain] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => { document.title = 'Enclume — Signaler un problème' }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError(tt('form.errorRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/tickets', {
        category,
        domain: domain || null,
        title,
        description,
        context: {
          path: location.state?.fromPath ?? null,
          user_agent: navigator.userAgent,
        },
      })
      setSuccess(true)
      setTitle('')
      setDescription('')
    } catch {
      setError(tt('form.errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/dashboard')} style={S.backBtn}>← {tt('form.backToDashboard')}</span>
      </div>

      <div style={S.body}>
        <h1 style={S.pageTitle}>{tt('form.title')}</h1>
        <p style={S.muted}>{tt('form.intro')}</p>

        {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}
        {success && <div style={S.successBanner}>{tt('form.success')}</div>}

        <form onSubmit={handleSubmit} style={S.form}>

          <label style={S.field}>
            <span style={S.label}>{tt('form.category')}</span>
            <select style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORY_KEYS.map(key => (
                <option key={key} value={key}>{tt(`form.categoryOptions.${key}`)}</option>
              ))}
            </select>
          </label>

          <label style={S.field}>
            <span style={S.label}>{tt('form.domain')}</span>
            <select style={S.select} value={domain} onChange={e => setDomain(e.target.value)}>
              <option value="">{tt('form.domainPlaceholder')}</option>
              {DOMAIN_KEYS.map(key => (
                <option key={key} value={key}>{tt(`form.domainOptions.${key}`)}</option>
              ))}
            </select>
          </label>

          <label style={S.field}>
            <span style={S.label}>{tt('form.titleLabel')}</span>
            <input
              style={S.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={tt('form.titlePlaceholder')}
              maxLength={200}
              required
            />
          </label>

          <label style={S.field}>
            <span style={S.label}>{tt('form.description')}</span>
            <textarea
              style={S.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={tt('form.descriptionPlaceholder')}
              rows={6}
              required
            />
          </label>

          <div style={S.formFooter}>
            <button type="submit" style={S.btnPrimary} disabled={submitting}>
              {submitting ? tt('form.submitting') : tt('form.submit')}
            </button>
          </div>

        </form>
      </div>

    </div>
  )
}

// ─── Styles (même patron que AdminUsersPage.jsx / VaultPage.jsx) ──────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 22px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },
  successBanner: { backgroundColor: 'rgba(58,170,106,0.12)', border: '1px solid #3aaa6a', borderRadius: '6px', padding: '8px 16px', color: '#3aaa6a', fontSize: '13px', margin: '0 0 16px' },

  body: { flex: 1, maxWidth: '520px', width: '100%', margin: '0 auto', padding: '24px' },

  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', color: 'var(--text-secondary)' },
  select: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px' },
  input: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px' },
  textarea: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' },

  formFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: '4px' },
  btnPrimary: { backgroundColor: 'var(--bg-button-primary)', border: 'none', borderRadius: '6px', padding: '8px 18px', color: '#fff', fontSize: '13px', cursor: 'pointer' },
}
