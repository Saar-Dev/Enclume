import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const ACCENT = '#3aaa6a'
const MONO = { fontFamily: "'Share Tech Mono', monospace" }

const TAGS = {
  add:     { label: 'AJOUT',      color: '#3aaa6a' },
  fix:     { label: 'CORRECTIF',  color: '#5b8dee' },
  chg:     { label: 'CHANGEMENT', color: '#f5c542' },
  refactor: { label: 'REFACTO',   color: '#a78bfa' },
}

function parseChangelog(text) {
  const blocks = text.split(/^## /m).filter(Boolean)
  return blocks.map(block => {
    const lines = block.trim().split('\n')
    const parts = lines[0].split(' — ')
    const version = parts[0].replace(/^v/, '')
    const date    = parts[1] ?? ''
    const title   = parts.slice(2).join(' — ')
    const entries = lines.slice(1)
      .map(l => {
        const m = l.match(/^- \[(\w+)\] (.+)$/)
        return m ? { tag: m[1], text: m[2] } : null
      })
      .filter(Boolean)
    return { version, date, title, entries }
  })
}

export default function ChangelogPanel() {
  const { t } = useTranslation()
  const [open, setOpen]       = useState(false)
  const [releases, setReleases] = useState([])

  useEffect(() => {
    fetch('/CHANGELOG.md')
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        if (!text) return
        const parsed  = parseChangelog(text)
        const latest  = parsed[0]?.version
        setReleases(parsed)
        if (latest && localStorage.getItem('changelog_last_seen') !== latest) {
          localStorage.setItem('changelog_last_seen', latest)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{
      width:       open ? 340 : 38,
      flexShrink:  0,
      position:    'relative',
      background:  '#070d0a',
      borderLeft:  `1px solid ${open ? ACCENT + '33' : '#15251a'}`,
      display:     'flex',
      flexDirection: 'column',
      overflow:    'hidden',
      transition:  'width 0.18s ease',
    }}>

      {/* ── Rail fermé ─────────────────────────────────────── */}
      {!open && (
        <div
          onClick={() => setOpen(true)}
          title={t('changelog.openTitle')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', paddingTop: 16, gap: 10, cursor: 'pointer',
          }}
        >
          <span style={{ ...MONO, fontSize: 12, color: ACCENT }}>◇</span>
          <span style={{
            ...MONO, fontSize: 9, color: '#3a6050', letterSpacing: '0.2em',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          }}>SYSTEM_LOG</span>
        </div>
      )}

      {/* ── Panneau ouvert ─────────────────────────────────── */}
      {open && (
        <>
          {/* Fond PCB décoratif */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none' }}
            viewBox="0 0 340 700"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="cl-pads" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="13" cy="13" r="0.7" fill={ACCENT} />
              </pattern>
            </defs>
            <rect width="340" height="700" fill="url(#cl-pads)" />
            <g stroke={ACCENT} strokeWidth="0.8" fill="none">
              <path d="M0 80 L110 80 L110 140 L220 140 L220 60 L340 60" />
              <path d="M30 0 L30 200 L90 200 L90 320 L20 320 L20 480" />
              <path d="M0 380 L150 380 L150 300 L280 300 L280 420 L340 420" />
              <path d="M60 700 L60 560 L190 560 L190 620 L320 620" />
            </g>
            <g fill={ACCENT}>
              {[[110,80],[220,140],[90,200],[150,380],[280,300],[190,560],[20,320]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r="1.6" />
              ))}
            </g>
            <g stroke={ACCENT} strokeWidth="0.8" fill="none">
              <rect x="190" y="200" width="32" height="16" />
              <rect x="50"  y="420" width="18" height="26" />
            </g>
          </svg>

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${ACCENT}33`,
            position: 'relative', zIndex: 1, background: 'rgba(7,13,10,0.7)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ ...MONO, fontSize: 11, color: ACCENT, letterSpacing: '0.16em', fontWeight: 600 }}>
              ◇ SYSTEM_LOG
            </span>
            <div style={{ flex: 1 }} />
            <span
              onClick={() => setOpen(false)}
              title={t('changelog.reduceTitle')}
              style={{ ...MONO, fontSize: 13, color: '#3a6050', cursor: 'pointer', padding: '0 2px' }}
            >→</span>
          </div>

          {/* Body — entries */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16, position: 'relative', zIndex: 1 }}>
            {releases.map((rel, i) => (
              <div key={rel.version} style={{ marginBottom: i < releases.length - 1 ? 16 : 0 }}>

                {/* Version header */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...MONO, fontSize: 14, color: i === 0 ? ACCENT : '#aaccdd', fontWeight: 600 }}>
                    v{rel.version}
                  </span>
                  {i === 0 && (
                    <span style={{
                      ...MONO, fontSize: 7, color: ACCENT, letterSpacing: '0.1em',
                      border: `1px solid ${ACCENT}66`, padding: '1px 4px', background: `${ACCENT}1a`,
                    }}>DERNIER</span>
                  )}
                  <div style={{ flex: 1, height: 1, background: '#15251a' }} />
                  <span style={{ ...MONO, fontSize: 8, color: '#3a6050' }}>{rel.date}</span>
                </div>

                {/* Title */}
                <div style={{ fontSize: 11, color: '#7a8a99', marginBottom: 7, fontStyle: 'italic' }}>
                  {rel.title}
                </div>

                {/* Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {rel.entries.map((e, j) => {
                    const tag = TAGS[e.tag] ?? TAGS.add
                    return (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{
                          ...MONO, fontSize: 6.5, color: tag.color, fontWeight: 600,
                          width: 58, flexShrink: 0,
                          border: `1px solid ${tag.color}44`, padding: '2px 2px',
                          textAlign: 'center', marginTop: 1, background: `${tag.color}11`,
                        }}>{t(`changelog.tags.${e.tag || 'add'}`)}</span>
                        <span style={{ fontSize: 11, color: '#c0c0d0', lineHeight: 1.4 }}>{e.text}</span>
                      </div>
                    )
                  })}
                </div>

              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', borderTop: `1px solid ${ACCENT}33`,
            position: 'relative', zIndex: 1, background: 'rgba(7,13,10,0.7)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
            <span style={{ ...MONO, fontSize: 8, color: '#3a6050', letterSpacing: '0.1em' }}>
              BUILD {releases[0]?.version ?? '—'} · OK
            </span>
          </div>
        </>
      )}

    </div>
  )
}
