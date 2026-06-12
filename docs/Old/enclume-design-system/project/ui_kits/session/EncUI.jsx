// EncUI.jsx — shared primitives for the Enclume session UI kit
// Inline stroke SVG icons (Feather/Lucide-style, 24-grid, 2px) — the real app pattern.

const ENC = {
  // surfaces
  bgApp: '#0f1115', bgSession: '#0f0f1a', bgRaised: '#16162a',
  border: '#1e1e2e', border2: '#2a2a3e',
  // combat-window (tactical HUD) surfaces
  winBody: '#0d0f18', winHeader: '#080a12', winBorder: '#1e2435',
  // accents
  blue: '#5b8dee', cyan: '#3a8aaa', green: '#50c878', greenSoft: '#4caf77',
  red: '#e05b5b', amber: '#e0a050', gold: '#f5c542', goldMuted: '#aa8a30',
  // text
  txtHi: '#c0c0d0', txtMid: '#9090a8', txtLo: '#4a4a60',
  // wounds
  wound: { legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000' },
};

const Svg = ({ size = 16, children, stroke = 'currentColor', sw = 2, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);

// The imposed DicePanel model: a d20 (20-sided) as a faceted hexagon with "20".
const IconDice = ({ size = 16, color = 'currentColor' }) => {
  const s = size, cx = s/2, cy = s/2, r = s*0.46;
  const pts = `${cx},${cy-r} ${cx+r*0.85},${cy-r*0.5} ${cx+r*0.85},${cy+r*0.5} ${cx},${cy+r} ${cx-r*0.85},${cy+r*0.5} ${cx-r*0.85},${cy-r*0.5}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display:'block' }}>
      <polygon points={pts} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1={cx-r*0.85} y1={cy-r*0.5} x2={cx} y2={cy+r*0.34} stroke={color} strokeWidth="1" opacity="0.5"/>
      <line x1={cx+r*0.85} y1={cy-r*0.5} x2={cx} y2={cy+r*0.34} stroke={color} strokeWidth="1" opacity="0.5"/>
      <line x1={cx} y1={cy-r} x2={cx} y2={cy+r*0.34} stroke={color} strokeWidth="1" opacity="0.5"/>
      <text x={cx} y={cy+s*0.07} textAnchor="middle" fontFamily="'Share Tech Mono', monospace" fontSize={s*0.26} fill={color}>20</text>
    </svg>
  );
};
const IconRuler = ({ size = 16 }) => (
  <Svg size={size}><path d="M21.3 8.7L8.7 21.3a2.12 2.12 0 0 1-3 0L2.7 18.3a2.12 2.12 0 0 1 0-3L15.3 2.7a2.12 2.12 0 0 1 3 0l3 3a2.12 2.12 0 0 1 0 3z"/><line x1="7.5" y1="10.5" x2="10" y2="13"/><line x1="10.5" y1="7.5" x2="13" y2="10"/><line x1="13.5" y1="4.5" x2="16" y2="7"/></Svg>
);
const IconPen = ({ size = 13 }) => (
  <Svg size={size}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></Svg>
);
const IconPlus = ({ size = 14 }) => (<Svg size={size}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>);
const IconX = ({ size = 16 }) => (<Svg size={size}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>);
const IconSend = ({ size = 16 }) => (<Svg size={size}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></Svg>);
const IconSword = ({ size = 15 }) => (<Svg size={size}><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></Svg>);

// The anvil logo — gem = currentColor (color), body = --icon-secondary.
const AnvilLogo = ({ h = 28, color = '#e8eef7', body = '#5b8dee' }) => (
  <span style={{ display:'inline-block', width: h*0.71, height: h, color, ['--icon-secondary']: body }}
    dangerouslySetInnerHTML={{ __html: window.__ENCLUME_LOGO__ || '' }} />
);

// micro all-caps eyebrow label
const Eyebrow = ({ children, color = ENC.txtLo, style }) => (
  <span style={{ font: "600 10px/1.2 'Inter'", textTransform:'uppercase', letterSpacing:'.05em', color, ...style }}>{children}</span>
);

Object.assign(window, { ENC, Svg, IconDice, IconRuler, IconPen, IconPlus, IconX, IconSend, IconSword, AnvilLogo, Eyebrow });
