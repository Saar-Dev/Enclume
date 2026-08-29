import { useTranslation } from 'react-i18next'
import CombatDeclareStateChip from './CombatDeclareStateChip.jsx'

// Satellite d'etat (PLAN_RW_DECLARE_DESIGN module 3, D8) — sort les axes tactiques (posture /
// vitesse / arme) du corps des fenetres de declaration vers un panneau frere accroche au bord
// gauche de la fenetre principale, qui suit sa position (lit `pos` du useDraggable de la fenetre).
// Identique PJ / MJ / Exo. Aucun satellite pour un drone (`state` fixe). Brique = CombatDeclareStateChip
// tel quel + un glyphe. En ordre B (le chassis partage, module 2, n'existe pas encore) c'est le
// panneau lui-meme qui se positionne ; au module 2 il redeviendra un slot que le frame place.
//
// `fire_mode` NE passe PAS ici — il reste dans la section ARMEMENT du corps jusqu'au module 4
// (interim assume, §14.7).

const GLYPHS = {
  position: { standing: 'stand', crouching: 'crounch', kneeling: 'kneel', prone: 'crawl' },
  vitesse:  { delayed: 'actionDelayed', normal: 'actionNormal', rushed: 'actionRush' },
  weapon:   { holstered: 'WeaponA', ready: 'WeaponB', drawn: 'WeaponC' },
}
const SAT_W = 132
const GAP = 8

export default function CombatDeclareStatePanel({
  pos,
  windowWidth,
  positionMode = 'fixed',        // 'fixed' pour .combat-float-win (PJ, exo) ; 'absolute' pour .combat-win (MJ)
  axes = ['position', 'vitesse', 'weapon'],
  decl,
  initial,
  onChange,                      // (axis, value) => void
  onPositionClick = null,        // exo a terre : tout clic sur Posture => tentative de se relever
  weaponDisabled = false,
  hidden = false,
}) {
  const { t } = useTranslation('combat')

  // Suit la fenetre : colle a son bord gauche, bascule a droite s'il n'y a pas la place (PO-M3-d).
  const flipRight = pos.left - SAT_W - GAP < 8
  const left = flipRight ? pos.left + windowWidth + GAP : pos.left - SAT_W - GAP

  return (
    <div
      className="combat-declare-state-panel"
      style={{
        position: positionMode,
        left,
        top: pos.top,
        width: SAT_W,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div className="combat-declare-state-title">{t('statePanel.title')}</div>
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
