import { useTranslation } from 'react-i18next'
import CombatDeclareStateChip from './CombatDeclareStateChip.jsx'

// Satellite d'état (PLAN_RW_DECLARE_DESIGN module 3, D8) — sort les axes tactiques (posture /
// vitesse / arme) du corps des fenêtres de déclaration vers un panneau frère accroché au bord
// gauche de la fenêtre principale, qui suit sa position (lit le `pos` du useDraggable de la
// fenêtre). Identique PJ / MJ / Exo. Aucun satellite pour un drone (`state` fixe).
//
// Look : teinte Wizard, tokens `--decl-*` (index.css), portés par `data-decl` + `data-family` sur
// le panneau lui-même (il est frère, pas enfant de la fenêtre). Réf. : maquette + prototype
// afcd5e28. En ordre B (le châssis partagé, module 2, n'existe pas encore) c'est le panneau qui se
// positionne ; au module 2 il redeviendra un slot que le frame place.
//
// `fire_mode` NE passe PAS ici — il reste dans le corps jusqu'au module 4 (interim assumé, §14.7).

const GLYPHS = {
  position: { standing: 'stand', crouching: 'crounch', kneeling: 'kneel', prone: 'crawl' },
  vitesse:  { delayed: 'actionDelayed', normal: 'actionNormal', rushed: 'actionRush' },
  weapon:   { holstered: 'WeaponA', ready: 'WeaponB', drawn: 'WeaponC' },
}
const SAT_W = 92
const GAP = 2

export default function CombatDeclareStatePanel({
  pos,
  family = 'pj',                 // pj | gm-pnj | exo → data-family → --decl-acc
  positionMode = 'fixed',        // 'fixed' pour .combat-float-win (PJ, exo) ; 'absolute' pour .combat-win (MJ)
  isNew = false,                 // badge « NOUVEAU » (exo — gagne le satellite dans cette refonte)
  axes = ['position', 'vitesse', 'weapon'],
  decl,
  initial,
  onChange,                      // (axis, value) => void
  onPositionClick = null,        // exo à terre : tout clic sur Posture => tentative de se relever
  weaponDisabled = false,
  hidden = false,
}) {
  const { t } = useTranslation('combat')

  // Suit la fenêtre : toujours collé à son bord gauche (D8).
  const left = pos.left - SAT_W - GAP

  return (
    <div
      className="combat-declare-state-panel"
      data-decl=""
      data-family={family}
      style={{
        position: positionMode,
        left,
        top: pos.top,
        width: SAT_W,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div className="combat-declare-state-panel__title">
        {t('statePanel.title')}
        {isNew && <span className="combat-declare-state-panel__badge">{t('statePanel.newBadge')}</span>}
      </div>
      {axes.map(axis => (
        <CombatDeclareStateChip
          key={axis}
          stateKey={axis}
          current={decl[axis]}
          initial={initial[axis]}
          glyph={GLYPHS[axis]?.[decl[axis]]}
          disabled={axis === 'weapon' && weaponDisabled}
          onChange={
            axis === 'position' && onPositionClick
              ? onPositionClick
              : v => onChange(axis, v)
          }
        />
      ))}
    </div>
  )
}
