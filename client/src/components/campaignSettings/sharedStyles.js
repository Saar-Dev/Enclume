// client/src/components/campaignSettings/sharedStyles.js
// Styles partagés pour toutes les sections de CampaignSettings

export const sharedStyles = {
  // ─── Layout ──────────────────────────────────────────────────────────
  // NOTE : le conteneur de section utilise className="card" (index.css) — pas de style dédié ici.
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    margin: '0 0 20px 0',
  },

  // ─── Toggle / Checkbox ──────────────────────────────────────────────
  toggleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '15px',
    height: '15px',
    cursor: 'pointer',
    accentColor: 'var(--color-primary)',
    flexShrink: 0,
  },
  toggleLabel: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  toggleHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },

  // ─── Inputs génériques ──────────────────────────────────────────────
  // NOTE : boutons remplacés par className="btn"/"btn-ghost"/"btn-danger"/"btn-toggle" (index.css) —
  // plus de duplication d'un 2e système de boutons ici (optionBtn/btnSecondary/btnDanger retirés).
  numInput: {
    width: '52px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    padding: '4px 6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    textAlign: 'center',
  },

  // ─── Statuts ─────────────────────────────────────────────────────────
  saveSuccess: { fontSize: '13px', color: 'var(--color-success-soft)' },
  saveError: { fontSize: '13px', color: 'var(--color-danger)' },

  // ─── Tableau miniature ───────────────────────────────────────────────
  miniTh: {
    padding: '6px 14px',
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'left',
  },
  miniTd: {
    padding: '6px 14px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  miniTrActive: {
    backgroundColor: 'rgba(47,215,255,0.06)',
  },

  // ─── Placeholder ─────────────────────────────────────────────────────
  placeholderText: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    margin: 0,
  },

  // ─── Token status ────────────────────────────────────────────────────
  tokenStatusNone: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  tokenStatusSet: {
    fontSize: '13px',
    color: 'var(--color-success-soft)',
    fontWeight: '500',
  },
}