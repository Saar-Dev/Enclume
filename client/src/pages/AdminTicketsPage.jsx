import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

const ORIGINS = ['player', 'gm', 'admin', 'log']
const STATUSES = ['new', 'triaged', 'in_progress', 'suspended', 'resolved', 'wont_fix', 'duplicate']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

// PLAN_TICKETS.md Lot 1 — écran de triage admin. `cluster_label` est un texte libre édité inline
// (décision Saar §4.1 : "juste organiser des filtres", pas de table de référence séparée) — filtrer
// dessus reproduit la recherche "Cluster N" qu'on ferait aujourd'hui dans BUGIDENTIFIE.md. Le client
// ne prédit jamais de rejet serveur : toute erreur de sauvegarde s'affiche telle quelle (même
// principe que AdminUsersPage.jsx).
export default function AdminTicketsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { t: tt } = useTranslation('tickets')

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const [originFilter, setOriginFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clusterFilter, setClusterFilter] = useState('')

  useEffect(() => { document.title = 'Enclume — Tickets' }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (originFilter) params.origin = originFilter
    if (statusFilter) params.status = statusFilter
    if (clusterFilter) params.clusterLabel = clusterFilter
    api.get('/admin/tickets', { params })
      .then(res => setTickets(res.data.tickets))
      .catch(() => setError(tt('admin.errorLoad')))
      .finally(() => setLoading(false))
  }, [originFilter, statusFilter, clusterFilter, tt])

  useEffect(() => { load() }, [load])

  const patchTicket = async (id, patch) => {
    setSavingId(id)
    try {
      const res = await api.patch(`/admin/tickets/${id}`, patch)
      setTickets(prev => prev.map(ticket => ticket.id === id ? res.data.ticket : ticket))
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error?.message || tt('admin.errorSave'))
    } finally {
      setSavingId(null)
    }
  }

  const groups = ORIGINS
    .map(origin => ({ origin, items: tickets.filter(ticket => ticket.origin === origin) }))
    .filter(group => group.items.length > 0)

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/admin')} style={S.backBtn}>← {tt('admin.backToAdmin')}</span>
      </div>

      <div style={S.body}>
        <h1 style={S.pageTitle}>{tt('admin.title')}</h1>

        {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}

        <div style={S.filters}>
          <label style={S.filterField}>
            <span style={S.filterLabel}>{tt('admin.filters.origin')}</span>
            <select style={S.select} value={originFilter} onChange={e => setOriginFilter(e.target.value)}>
              <option value="">{tt('admin.filters.all')}</option>
              {ORIGINS.map(o => <option key={o} value={o}>{tt(`admin.originLabels.${o}`)}</option>)}
            </select>
          </label>
          <label style={S.filterField}>
            <span style={S.filterLabel}>{tt('admin.filters.status')}</span>
            <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{tt('admin.filters.all')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{tt(`admin.statusLabels.${s}`)}</option>)}
            </select>
          </label>
          <label style={S.filterField}>
            <span style={S.filterLabel}>{tt('admin.filters.clusterLabel')}</span>
            <input
              style={S.select}
              value={clusterFilter}
              onChange={e => setClusterFilter(e.target.value)}
              placeholder={tt('admin.filters.clusterLabelPlaceholder')}
            />
          </label>
        </div>

        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : tickets.length === 0 ? (
          <p style={S.muted}>{tt('admin.noTickets')}</p>
        ) : (
          groups.map(group => (
            <div key={group.origin} style={S.originGroup}>
              <h2 style={S.originTitle}>{tt(`admin.originLabels.${group.origin}`)}</h2>
              <div style={S.list}>
                {group.items.map(ticket => (
                  <TicketRow
                    key={`${ticket.id}-${ticket.cluster_label || ''}`}
                    ticket={ticket}
                    tt={tt}
                    saving={savingId === ticket.id}
                    onPatch={patch => patchTicket(ticket.id, patch)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

// Keyée par `${id}-${cluster_label}` dans le parent : un remount (plutôt qu'un effet de
// resynchronisation) réinitialise clusterDraft quand la valeur vient du serveur (rechargement de
// liste), sans jamais écraser une saisie locale en cours — patron recommandé par React pour l'état
// dérivé d'une prop (https://react.dev/learn/you-might-not-need-an-effect).
function TicketRow({ ticket, tt, saving, onPatch }) {
  const [clusterDraft, setClusterDraft] = useState(ticket.cluster_label || '')

  return (
    <div style={S.row}>
      <div style={S.rowMain}>
        <div style={S.rowTop}>
          <span style={S.rowTitle}>{ticket.title}</span>
          <span className="badge">{tt(`form.categoryOptions.${ticket.category}`)}</span>
          {ticket.domain && <span className="badge">{tt(`form.domainOptions.${ticket.domain}`)}</span>}
        </div>
        <p style={S.rowDescription}>{ticket.description}</p>
        <div style={S.rowMeta}>
          {ticket.reporter_username && (
            <span style={S.muted}>{tt('admin.reportedBy')} : {ticket.reporter_username}</span>
          )}
          <span style={S.muted}>{new Date(ticket.created_at).toLocaleString('fr-FR')}</span>
        </div>
      </div>

      <div style={S.rowActions}>
        <select
          style={S.select}
          value={ticket.status}
          disabled={saving}
          onChange={e => onPatch({ status: e.target.value })}
        >
          {STATUSES.map(s => <option key={s} value={s}>{tt(`admin.statusLabels.${s}`)}</option>)}
        </select>

        <select
          style={S.select}
          value={ticket.priority || ''}
          disabled={saving}
          onChange={e => onPatch({ priority: e.target.value || null })}
        >
          <option value="">{tt('admin.priorityPlaceholder')}</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{tt(`admin.priorityLabels.${p}`)}</option>)}
        </select>

        <input
          style={S.select}
          value={clusterDraft}
          disabled={saving}
          placeholder={tt('admin.clusterLabelEditPlaceholder')}
          onChange={e => setClusterDraft(e.target.value)}
          onBlur={() => { if (clusterDraft !== (ticket.cluster_label || '')) onPatch({ cluster_label: clusterDraft }) }}
        />
      </div>
    </div>
  )
}

// ─── Styles (même patron que AdminUsersPage.jsx) ──────────────────────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 22px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '12px' },

  filters: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' },
  filterField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel: { fontSize: '12px', color: 'var(--text-secondary)' },
  select: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 8px', color: 'var(--text-primary)', fontSize: '12px' },

  originGroup: { marginBottom: '24px' },
  originTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', gap: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 14px', flexWrap: 'wrap' },
  rowMain: { flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '4px' },
  rowTop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  rowTitle: { fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' },
  rowDescription: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' },
  rowMeta: { display: 'flex', gap: '12px', marginTop: '4px' },

  rowActions: { display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, width: '200px' },
}
