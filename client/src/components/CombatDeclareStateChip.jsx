import { useTranslation } from 'react-i18next'
import { STATE_DEFS, nextKey } from './combatSections.js'
import { stateTransitionCost } from '../../../shared/combatIniCost.js'

// Puce click-to-cycle : choisir un etat de combat (posture, arme, vitesse, mode de tir) en cyclant
// au clic, cout de transition d'Initiative affiche. Meme API que CombatDeclareStateSelector
// (stateKey / current / initial / onChange / availableKeys). Ex-`InlineChip` local a
// CombatGmDeclareWindow (PLAN_RW_DECLARE_WINDOWS module 7).
//
// Presentation portee par CSS (`.combat-state-chip`, index.css) — la mise en forme change selon le
// contexte : compacte en ligne dans le corps (fire_mode MJ), empilee glyphe+valeur dans le satellite
// d'etat (`.combat-declare-state-panel .combat-state-chip`, module 3, maquette teinte Wizard).
//   `glyph`    : nom d'un SVG `assets/status/*.svg` rendu en mask-image recoloree a l'accent famille.
//                Optionnel — sans glyphe, seul le texte s'affiche (degradation).
//   `disabled` : la puce ne cycle plus (ex. arme verrouillee pendant une attaque, cote PJ).
export default function CombatDeclareStateChip({ stateKey, current, initial, onChange, availableKeys, glyph, disabled = false }) {
  const { t } = useTranslation('combat')
  const def = STATE_DEFS[stateKey]
  const cur = def.states.find(s => s.k === current)
  const cost = stateTransitionCost(stateKey, initial, current)

  return (
    <button
      type="button"
      className="combat-state-chip"
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(nextKey(stateKey, current, availableKeys)) }}
    >
      {glyph && (
        <span
          className="combat-state-chip__glyph"
          style={{ '--chip-glyph': `url(/assets/status/${glyph}.svg)` }}
          aria-hidden="true"
        />
      )}
      <span className="combat-state-chip__label">{t(def.label)}</span>
      <span className="combat-state-chip__value">{cur?.l ? t(cur.l) : current}</span>
      {cost !== 0 && (
        <span className="combat-state-chip__cost" data-sign={cost > 0 ? 'pos' : 'neg'}>
          {cost > 0 ? `+${cost}` : cost}
        </span>
      )}
    </button>
  )
}
