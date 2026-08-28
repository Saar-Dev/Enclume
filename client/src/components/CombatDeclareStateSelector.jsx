import { useTranslation } from 'react-i18next'
import { STATE_DEFS, stateTransitionCost } from './combatSections.js'

// Segmented control pour choisir un etat de combat (posture, arme, mode de tir, couverture,
// vitesse) avec le cout de transition d'Initiative affiche sur chaque option. Brique partagee des
// fenetres de declaration de combat (PLAN_RW_DECLARE_WINDOWS.md). Variante compacte : voir
// CombatDeclareStateChip (puce click-to-cycle) — meme API (stateKey/current/initial/onChange/
// availableKeys), presentation differente.
export default function CombatDeclareStateSelector({ stateKey, current, initial, onChange, disabled, availableKeys, highlightKey }) {
  const { t } = useTranslation('combat')
  const def = STATE_DEFS[stateKey]
  return (
    <div style={S.row}>
      <span style={S.label}>{t(def.label)}</span>
      <div style={S.seg}>
        {def.states.map(opt => {
          const isActive      = opt.k === current
          const isDisabled    = disabled || (availableKeys && !availableKeys.includes(opt.k))
          const isHighlighted = !isActive && !isDisabled && opt.k === highlightKey
          const cost          = stateTransitionCost(def, initial, opt.k)
          const costStr       = cost === 0 ? null : cost > 0 ? `+${cost}` : `${cost}`
          return (
            <div
              key={opt.k}
              onClick={() => !isDisabled && !isActive && onChange(opt.k)}
              style={{
                ...S.segOpt,
                ...(isActive      ? S.segOptActive   : {}),
                ...(isDisabled    ? S.segOptDisabled  : {}),
                ...(isHighlighted ? { borderColor: '#5b8dee', color: '#5b8dee' } : {}),
              }}
            >
              <span style={S.segOptLabel}>{t(opt.l)}</span>
              {costStr && !isActive && (
                <span style={{ ...S.segCost, color: cost > 0 ? '#3aaa6a' : '#c86030' }}>
                  {costStr}
                </span>
              )}
              {isActive && opt.k === initial && (
                <span style={S.segCostCurrent}>{t('stateSelector.currentBadge')}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 10px',
    gap: 6,
  },
  label: {
    fontSize: 8,
    color: '#456575',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    flexShrink: 0,
    width: 76,
  },
  seg: {
    display: 'flex',
    flex: 1,
    background: 'var(--combat-seg-bg)',
    border: '1px solid var(--combat-seg-border)',
  },
  segOpt: {
    flex: 1,
    padding: '4px 6px',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.1s',
  },
  segOptActive: {
    background: 'var(--combat-seg-active)',
    borderColor: '#3a8aaa66',
  },
  segOptDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  segOptLabel: {
    fontSize: 9,
    color: '#dde7ee',
    display: 'block',
    fontWeight: 500,
  },
  segCost: {
    fontSize: 7,
    display: 'block',
    marginTop: 1,
  },
  segCostCurrent: {
    fontSize: 7,
    color: 'var(--combat-title)',
    display: 'block',
    marginTop: 1,
  },
}
