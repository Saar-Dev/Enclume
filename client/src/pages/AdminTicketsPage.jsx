import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

const ORIGINS = ['player', 'gm', 'admin', 'log']
const STATUSES = ['new', 'triaged', 'in_progress', 'suspended', 'resolved', 'wont_fix', 'duplicate']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
// Miroir de ReportTicketPage.jsx (CATEGORY_KEYS/DOMAIN_KEYS) — même patron que ORIGINS/STATUSES/
// PRIORITIES ci-dessus, `domain` n'a pas de CHECK serveur (TICKETS.md §5) donc rien à valider ici.
const CATEGORY_KEYS = ['bug', 'balance', 'suggestion', 'other']
const DOMAIN_KEYS = ['monde', 'combat', 'personnage', 'wizard', 'marchands', 'editeur', 'infrastructure', 'autre']

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
  const [stats, setStats] = useState(null)

  const [originFilter, setOriginFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clusterFilter, setClusterFilter] = useState('')
  const [hideClosed, setHideClosed] = useState(true)

  const [selected, setSelected] = useState(() => new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const [creating, setCreating] = useState(false)

  useEffect(() => { document.title = 'Enclume — Tickets' }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (originFilter) params.origin = originFilter
    if (statusFilter) {
      params.status = statusFilter
    } else if (hideClosed) {
      params.activeOnly = 'true'
    }
    if (clusterFilter) params.clusterLabel = clusterFilter
    api.get('/admin/tickets', { params })
      .then(res => setTickets(res.data.tickets))
      .catch(() => setError(tt('admin.errorLoad')))
      .finally(() => setLoading(false))
  }, [originFilter, statusFilter, clusterFilter, hideClosed, tt])

  useEffect(() => { load() }, [load])

  // Compte global, jamais affecté par les filtres de la vue courante (récap topbar) — rafraîchi
  // après chaque écriture pour rester juste sans recharger toute la page.
  const loadStats = useCallback(() => {
    api.get('/admin/tickets/stats').then(res => setStats(res.data)).catch(() => {})
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const patchTicket = async (id, patch) => {
    setSavingId(id)
    try {
      const res = await api.patch(`/admin/tickets/${id}`, patch)
      setTickets(prev => prev.map(ticket => ticket.id === id ? res.data.ticket : ticket))
      setError(null)
      loadStats()
    } catch (err) {
      setError(err.response?.data?.error?.message || tt('admin.errorSave'))
    } finally {
      setSavingId(null)
    }
  }

  const toggleSelect = id => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === tickets.length ? new Set() : new Set(tickets.map(t => t.id)))
  }

  const applyBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return
    setBulkSaving(true)
    try {
      const results = await Promise.allSettled(
        [...selected].map(id => api.patch(`/admin/tickets/${id}`, { status: bulkStatus }))
      )
      const updatedById = new Map(
        results.filter(r => r.status === 'fulfilled').map(r => [r.value.data.ticket.id, r.value.data.ticket])
      )
      setTickets(prev => prev.map(ticket => updatedById.get(ticket.id) ?? ticket))
      if (results.some(r => r.status === 'rejected')) setError(tt('admin.errorSave'))
      else setError(null)
      setSelected(new Set())
      setBulkStatus('')
      loadStats()
    } finally {
      setBulkSaving(false)
    }
  }

  const handleTicketCreated = () => {
    setCreating(false)
    load()
    loadStats()
  }

  const groups = ORIGINS
    .map(origin => ({ origin, items: tickets.filter(ticket => ticket.origin === origin) }))
    .filter(group => group.items.length > 0)

  return (
    <div style={S.container}>

      <div style={S.header}>
        <span onClick={() => navigate('/admin')} style={S.backBtn}>← {tt('admin.backToAdmin')}</span>
        <div style={{ flex: 1 }} />
        {stats && (
          <div style={S.statsBar}>
            <span style={S.statItem}><b style={S.statOpen}>{stats.open}</b> {tt('admin.stats.open')}</span>
            <span style={S.statItem}><b style={S.statClosed}>{stats.closed}</b> {tt('admin.stats.closed')}</span>
            <span style={S.statItem}>{stats.total} {tt('admin.stats.total')}</span>
          </div>
        )}
      </div>

      <div style={S.body}>
        <div style={S.titleRow}>
          <h1 style={S.pageTitle}>{tt('admin.title')}</h1>
          {!creating && (
            <button className="btn btn-ghost" onClick={() => setCreating(true)}>
              {tt('admin.create.button')}
            </button>
          )}
        </div>

        {creating && (
          <CreateTicketPanel tt={tt} onCreated={handleTicketCreated} onCancel={() => setCreating(false)} />
        )}

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
          <label style={S.filterCheckbox}>
            <input
              type="checkbox"
              checked={hideClosed}
              disabled={!!statusFilter}
              onChange={e => setHideClosed(e.target.checked)}
            />
            <span style={S.filterLabel}>{tt('admin.filters.hideClosed')}</span>
          </label>
        </div>

        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : tickets.length === 0 ? (
          <p style={S.muted}>{tt('admin.noTickets')}</p>
        ) : (
          <>
            <div style={S.bulkBar}>
              <label style={S.filterCheckbox}>
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === tickets.length}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < tickets.length }}
                  onChange={toggleSelectAll}
                />
                <span style={S.filterLabel}>
                  {selected.size > 0 ? tt('admin.bulk.selected', { count: selected.size }) : tt('admin.bulk.selectAll')}
                </span>
              </label>
              {selected.size > 0 && (
                <>
                  <select style={S.select} value={bulkStatus} disabled={bulkSaving} onChange={e => setBulkStatus(e.target.value)}>
                    <option value="">{tt('admin.bulk.statusPlaceholder')}</option>
                    {STATUSES.map(s => <option key={s} value={s}>{tt(`admin.statusLabels.${s}`)}</option>)}
                  </select>
                  <button className="btn" disabled={!bulkStatus || bulkSaving} onClick={applyBulkStatus}>
                    {tt('admin.bulk.apply')}
                  </button>
                  <button className="btn btn-ghost" disabled={bulkSaving} onClick={() => setSelected(new Set())}>
                    {tt('admin.bulk.cancel')}
                  </button>
                </>
              )}
            </div>

            {groups.map(group => (
              <div key={group.origin} style={S.originGroup}>
                <h2 style={S.originTitle}>{tt(`admin.originLabels.${group.origin}`)}</h2>
                <div style={S.list}>
                  {group.items.map(ticket => (
                    <TicketRow
                      key={`${ticket.id}-${ticket.cluster_label || ''}-${ticket.linked_bug_code || ''}`}
                      ticket={ticket}
                      tt={tt}
                      saving={savingId === ticket.id}
                      selected={selected.has(ticket.id)}
                      onToggleSelect={() => toggleSelect(ticket.id)}
                      onPatch={patch => patchTicket(ticket.id, patch)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  )
}

// Keyée par `${id}-${cluster_label}-${linked_bug_code}` dans le parent : un remount (plutôt qu'un
// effet de resynchronisation) réinitialise les drafts quand la valeur vient du serveur (rechargement
// de liste), sans jamais écraser une saisie locale en cours — patron recommandé par React pour l'état
// dérivé d'une prop (https://react.dev/learn/you-might-not-need-an-effect).
function TicketRow({ ticket, tt, saving, selected, onToggleSelect, onPatch }) {
  const [clusterDraft, setClusterDraft] = useState(ticket.cluster_label || '')
  const [codeDraft, setCodeDraft] = useState(ticket.linked_bug_code || '')
  const [titleDraft, setTitleDraft] = useState(ticket.title)

  return (
    <div style={S.row}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} style={S.rowCheckbox} />
      <div className={`ticket-priority-chip${ticket.priority ? ` priority-${ticket.priority}` : ''}`} />
      <div style={S.rowMain}>
        <div style={S.rowTop}>
          <input
            style={S.codeInput}
            value={codeDraft}
            disabled={saving}
            placeholder={tt('admin.linkedBugCodePlaceholder')}
            title={tt('admin.linkedBugCode')}
            onChange={e => setCodeDraft(e.target.value)}
            onBlur={() => { if (codeDraft !== (ticket.linked_bug_code || '')) onPatch({ linked_bug_code: codeDraft }) }}
          />
          <input
            className="ticket-title-input"
            style={S.rowTitleInput}
            value={titleDraft}
            disabled={saving}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => { if (titleDraft.trim() && titleDraft !== ticket.title) onPatch({ title: titleDraft }) }}
          />
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

// Formulaire de création admin — mêmes 4 champs et mêmes clés i18n `form.*` que ReportTicketPage.jsx
// (formulaire joueur), posté sur le même endpoint générique POST /tickets (origin dérivé serveur
// depuis users.role — un admin y obtient déjà 'admin', aucune route dédiée nécessaire). Pas de champ
// `context` : contrairement au signalement joueur (déclenché depuis un écran précis), une création
// admin n'a pas de path/user_agent pertinent à capturer.
function CreateTicketPanel({ tt, onCreated, onCancel }) {
  const [category, setCategory] = useState('bug')
  const [domain, setDomain] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError(tt('form.errorRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/tickets', { category, domain: domain || null, title, description })
      onCreated()
    } catch {
      setError(tt('form.errorSubmit'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={S.createPanel}>
      <h2 style={S.createTitle}>{tt('admin.create.title')}</h2>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error}</div>}

      <div style={S.createRow}>
        <label style={S.filterField}>
          <span style={S.filterLabel}>{tt('form.category')}</span>
          <select style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORY_KEYS.map(key => (
              <option key={key} value={key}>{tt(`form.categoryOptions.${key}`)}</option>
            ))}
          </select>
        </label>
        <label style={S.filterField}>
          <span style={S.filterLabel}>{tt('form.domain')}</span>
          <select style={S.select} value={domain} onChange={e => setDomain(e.target.value)}>
            <option value="">{tt('form.domainPlaceholder')}</option>
            {DOMAIN_KEYS.map(key => (
              <option key={key} value={key}>{tt(`form.domainOptions.${key}`)}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={S.filterField}>
        <span style={S.filterLabel}>{tt('form.titleLabel')}</span>
        <input
          style={S.select}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={tt('form.titlePlaceholder')}
          maxLength={200}
          required
        />
      </label>

      <label style={S.filterField}>
        <span style={S.filterLabel}>{tt('form.description')}</span>
        <textarea
          style={S.createTextarea}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={tt('form.descriptionPlaceholder')}
          rows={4}
          required
        />
      </label>

      <div style={S.createFooter}>
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
          {tt('admin.bulk.cancel')}
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? tt('form.submitting') : tt('form.submit')}
        </button>
      </div>
    </form>
  )
}

// ─── Styles (même patron que AdminUsersPage.jsx) ──────────────────────────────
const S = {
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 22px' },
  pageTitle: { fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '0 0 16px', cursor: 'pointer' },

  createPanel: { display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' },
  createTitle: { fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  createRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  createTextarea: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' },
  createFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },

  statsBar: { display: 'flex', gap: '16px' },
  statItem: { fontSize: '12px', color: 'var(--text-secondary)' },
  statOpen: { color: 'var(--color-warning)' },
  statClosed: { color: 'var(--color-success)' },

  body: { flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '12px' },

  filters: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-end' },
  filterField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  filterCheckbox: { display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px', cursor: 'pointer' },
  filterLabel: { fontSize: '12px', color: 'var(--text-secondary)' },
  select: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 8px', color: 'var(--text-primary)', fontSize: '12px' },

  bulkBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', padding: '8px 10px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px' },

  originGroup: { marginBottom: '24px' },
  originTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', alignItems: 'flex-start', gap: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 14px', flexWrap: 'wrap' },
  rowCheckbox: { marginTop: '4px', flexShrink: 0 },
  rowMain: { flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '4px' },
  rowTop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  codeInput: { width: '84px', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)', background: 'var(--color-primary-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '3px 6px' },
  rowTitleInput: { flex: 1, minWidth: '160px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', padding: '2px 4px' },
  rowDescription: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' },
  rowMeta: { display: 'flex', gap: '12px', marginTop: '4px' },

  rowActions: { display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, width: '200px' },
}
