import { useTranslation } from 'react-i18next'
import { STATE_DEFS, nextKey } from './combatSections.js'
import { stateTransitionCost } from '../../../shared/combatIniCost.js'

// Puce compacte click-to-cycle : choisir un etat de combat (posture, arme, mode de tir) en cyclant
// au clic, avec le cout de transition d'Initiative affiche. Variante compacte de
// CombatDeclareStateSelector (segmented control) — meme API (stateKey/current/initial/onChange/
// availableKeys), presentation differente : le MJ declare vite pour plusieurs PNJ. Ex-`InlineChip`
// local a CombatGmDeclareWindow (PLAN_RW_DECLARE_WINDOWS module 7).
// `glyph` (module 3) : nom d'un SVG `assets/status/*.svg` rendu en mask-image recoloree a l'accent,
// en tete du label. Optionnel — sans `glyph`, la puce rend le label texte comme avant (degradation).
// `disabled` (module 3) : la puce ne cycle plus (ex. arme verrouillee pendant une attaque cote PJ).
export default function CombatDeclareStateChip({ stateKey, current, initial, onChange, availableKeys, glyph, disabled = false }) {
  const { t } = useTranslation('combat')
  const def = STATE_DEFS[stateKey]
  const cur = def.states.find(s => s.k === current)
  const cost = stateTransitionCost(stateKey, initial, current)

  return (
    <div
      onClick={() => { if (!disabled) onChange(nextKey(stateKey, current, availableKeys)) }}
      aria-disabled={disabled || undefined}
      style={{ ...S.chip, ...(disabled ? S.chipDisabled : {}) }}
    >
      {glyph && (
        <span
          className="combat-chip-glyph"
          style={{ '--chip-glyph': `url(/assets/status/${glyph}.svg)` }}
        />
      )}
      <span style={S.chipLabel}>{t(def.label)}</span>
      <span style={S.chipValue}>{cur?.l ? t(cur.l) : current}</span>
      {cost !== 0 && (
        <span style={{ ...S.chipCost, color: cost > 0 ? '#3aaa6a' : '#c86030' }}>
          {cost > 0 ? `+${cost}` : cost}
        </span>
      )}
    </div>
  )
}

const S = {
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#0a1018', border: '1px solid #1a2a38', borderRadius: 2, cursor: 'pointer', userSelect: 'none' },
  chipDisabled: { cursor: 'not-allowed', opacity: 0.4 },
  chipLabel: { fontSize: 7, color: '#456575', letterSpacing: '0.1em', fontFamily: 'monospace' },
  chipValue: { fontSize: 10, color: '#dde7ee', fontWeight: 600 },
  chipCost: { fontSize: 8, fontFamily: 'monospace', fontWeight: 700 },
}
