import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

const SERVICES = ['enclume-server', 'enclume-client']
const LINE_OPTIONS = [50, 200, 500, 2000]

// Lit journald via server/src/routes/adminLogs.js (journalctl -u <service>, whitelist stricte) —
// journald reste l'autorité des logs en prod, pas de stockage de logs dupliqué côté Node. Pas de
// tail temps réel dans ce premier lot (rafraîchissement manuel), pas de recherche plein texte.
export default function AdminLogsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [service, setService] = useState(SERVICES[0])
  const [lines, setLines] = useState(200)
  const [refreshToken, setRefreshToken] = useState(0)
  const [result, setResult] = useState({ available: true, reason: null, entries: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = 'Enclume — Logs serveur' }, [])

  // Fetch inline + drapeau `ignore` (patron React docs "You Might Not Need An Effect" — fetch basé
  // sur des props/state) : écarte la réponse d'une requête devenue obsolète si service/lines changent
  // avant qu'elle ne revienne. `refreshToken` permet au bouton Rafraîchir de redéclencher le même effet.
  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.get('/admin/logs', { params: { service, lines } })
      .then(res => {
        if (ignore) return
        setResult({ available: res.data.available, reason: res.data.reason || null, entries: res.data.entries || [] })
        setError(null)
      })
      .catch(err => {
        if (ignore) return
        setError(err.response?.data?.error?.message || t('adminLogs.errorLoad'))
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [service, lines, refreshToken, t])

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/admin')} style={S.backBtn}>← {t('adminLogs.backToAdmin')}</span>
      </div>

      <div style={S.body}>
        <h1 style={S.pageTitle}>{t('adminLogs.title')}</h1>

        <div style={S.toolbar}>
          <select value={service} onChange={e => setService(e.target.value)} style={S.select}>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={lines} onChange={e => setLines(Number(e.target.value))} style={S.select}>
            {LINE_OPTIONS.map(n => <option key={n} value={n}>{t('adminLogs.lineCount', { count: n })}</option>)}
          </select>
          <button className="btn" onClick={() => setRefreshToken(n => n + 1)} disabled={loading}>
            {loading ? t('common.loading') : t('adminLogs.refresh')}
          </button>
        </div>

        {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}

        {!loading && !result.available && (
          <p style={S.muted}>
            {result.reason === 'not_linux' ? t('adminLogs.unavailableNotLinux') : t('adminLogs.unavailableGeneric')}
          </p>
        )}

        {!loading && result.available && result.entries.length === 0 && !error && (
          <p style={S.muted}>{t('adminLogs.empty')}</p>
        )}

        {result.available && result.entries.length > 0 && (
          <div style={S.logBox}>
            {result.entries.map((entry, i) => (
              <div key={i} style={S.logLine}>
                <span style={S.logTimestamp}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                </span>
                <span style={priorityStyle(entry.priority)}>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// Priorité syslog (0-7, journalctl -o json) : pas d'hypothèse sur le mapping exact stdout/stderr de
// systemd — juste un dégradé visuel générique (0-3 grave, 4-5 attention, 6-7 neutre).
function priorityStyle(priority) {
  if (priority != null && priority <= 3) return { ...S.logMessage, color: 'var(--color-danger)' }
  if (priority != null && priority <= 5) return { ...S.logMessage, color: 'var(--color-warning, #d9a441)' }
  return S.logMessage
}

// ─── Styles (même patron que AdminUsersPage.jsx) ──────────────────────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 22px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px' },

  toolbar: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  select: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px' },

  logBox: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 14px', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' },
  logLine: { display: 'flex', gap: '10px', padding: '2px 0', borderBottom: '1px solid var(--border-subtle)' },
  logTimestamp: { color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' },
  logMessage: { color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
}
