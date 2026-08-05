// Icônes SVG inline utilisées par Sidebar.jsx — extraites de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md,
// lot 1). Composants purs, sans state ni prop.
export const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
export const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
export const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
export const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
export const IconRuler = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.3 8.7L8.7 21.3a2.121 2.121 0 0 1-3 0L2.7 18.3a2.121 2.121 0 0 1 0-3L15.3 2.7a2.121 2.121 0 0 1 3 0l3 3a2.121 2.121 0 0 1 0 3z"/>
    <line x1="7.5" y1="10.5" x2="10" y2="13"/>
    <line x1="10.5" y1="7.5" x2="13" y2="10"/>
    <line x1="13.5" y1="4.5" x2="16" y2="7"/>
  </svg>
)
export const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
export const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
export const IconDice = () => {
  const s = 14, cx = 7, cy = 7, r = s * 0.46
  const r85 = r * 0.85
  const pts = `${cx},${(cy - r).toFixed(2)} ${(cx + r85).toFixed(2)},${(cy - r * 0.5).toFixed(2)} ${(cx + r85).toFixed(2)},${(cy + r * 0.5).toFixed(2)} ${cx},${(cy + r).toFixed(2)} ${(cx - r85).toFixed(2)},${(cy + r * 0.5).toFixed(2)} ${(cx - r85).toFixed(2)},${(cy - r * 0.5).toFixed(2)}`
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <polygon points={pts} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1={(cx - r85).toFixed(2)} y1={(cy - r * 0.5).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1={(cx + r85).toFixed(2)} y1={(cy - r * 0.5).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1={cx} y1={(cy - r).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <text x={cx} y={(cy + s * 0.07).toFixed(2)} textAnchor="middle" fontFamily="'Share Tech Mono', monospace" fontSize={(s * 0.26).toFixed(2)} fill="currentColor">20</text>
    </svg>
  )
}
export const IconPen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
  </svg>
)
