// Bouton (i) + panel flottant décrivant une compétence — extrait de SkillsPanel.jsx (comportement
// visuel inchangé), réutilisé par CareersAllocator.jsx (Step4 Profession, docs/EN_COURS.md).
// Habillage fin sur InfoPopover.jsx (MARCHAND-UX-REVIEW, 2026-10-08) : API externe et rendu
// inchangés pour ces deux appelants, seule la coquille (position, boîte, en-tête) est désormais
// partagée avec EquipmentInfoPopover.jsx plutôt que recopiée une 3ᵉ fois.

import InfoPopover, { InfoButton } from './InfoPopover.jsx'
import { openInfoPanel } from '../lib/infoPopover.js'

const PANEL_WIDTH = 280
const PANEL_HEIGHT = 436

export function SkillInfoButton({ skill, setDetailPanel }) {
  if (!skill?.description) return null
  return (
    <InfoButton onOpen={(e) => openInfoPanel(skill, e, setDetailPanel, { width: PANEL_WIDTH, height: PANEL_HEIGHT })} />
  )
}

// popover: { data: skill, x, y, width } | null — popoverRef: attaché par l'appelant à son effet clic-dehors.
// onClose: optionnel, affiche un bouton × en plus de la fermeture par clic-dehors déjà gérée par l'appelant.
export default function SkillInfoPopover({ popover, popoverRef, onClose }) {
  if (!popover) return null
  const skill = popover.data
  return (
    <InfoPopover panel={popover} popoverRef={popoverRef} onClose={onClose} title={skill.label}>
      <div style={s.detailAttrs}>
        {skill.attr_1}{skill.attr_2 ? `/${skill.attr_2}` : `/${skill.attr_1}`}
        {skill.marker && skill.marker !== 'S' && (
          <span style={{ marginLeft: '6px', color: '#4a4a7a' }}>{skill.marker}</span>
        )}
      </div>
      <p style={s.detailText}>{skill.description}</p>
    </InfoPopover>
  )
}

const s = {
  detailAttrs: {
    padding: '4px 12px',
    fontSize: '10px',
    color: '#4a4a7a',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  detailText: {
    padding: '6px 12px 12px',
    fontSize: '11px',
    color: '#7a7a9a',
    lineHeight: '1.6',
    margin: 0,
    overflowY: 'auto',
    flex: 1,
  },
}
