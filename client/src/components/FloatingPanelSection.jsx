export default function FloatingPanelSection({ title, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} style={S.section}>
      <summary style={S.summary}>{title}</summary>
      <div style={S.content}>{children}</div>
    </details>
  )
}

const S = {
  section: {
    border: '1px solid #27273a',
    borderRadius: '7px',
    background: 'rgba(15, 23, 42, 0.45)',
    overflow: 'hidden',
  },
  summary: {
    padding: '9px 10px',
    color: '#aebbd0',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    padding: '2px 10px 10px',
  },
}
