// client/src/components/campaignSettings/sharedStyles.js
// Styles partagés pour toutes les sections de CampaignSettings

export const sharedStyles = {
  // ─── Layout ──────────────────────────────────────────────────────────
  section: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '10px',
    padding: '24px',
  },
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
    accentColor: '#5b8dee',
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
  numInput: {
    width: '52px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-normal)',
    borderRadius: '4px',
    padding: '4px 6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    textAlign: 'center',
  },

  // ─── Boutons ─────────────────────────────────────────────────────────
  optionBtn: {
    padding: '8px 18px',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  optionBtnActive: {
    borderColor: '#5b8dee',
    color: '#5b8dee',
    background: 'rgba(91,141,238,0.10)',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    padding: '7px 14px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnDanger: {
    backgroundColor: 'transparent',
    border: '1px solid var(--color-danger)',
    borderRadius: '6px',
    color: 'var(--color-danger)',
    padding: '7px 14px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },

  // ─── Statuts ─────────────────────────────────────────────────────────
  saveSuccess: { fontSize: '13px', color: '#4caf77' },
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
    backgroundColor: 'rgba(91,141,238,0.06)',
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
    color: '#4caf77',
    fontWeight: '500',
  },
}