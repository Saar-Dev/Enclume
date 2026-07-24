import { useTranslation } from 'react-i18next'
import DroneWeaponPanel from './DroneWeaponPanel.jsx'

export default function DroneDeclareSection({
  pendingMove,
  onMoveToggle,
  hasPassed,
  onPassToggle,
  droneWeapons,
  selectedWeaponId,
  onWeaponSelect,
  assaultTargetId,
  onChooseTarget,
  getLabel,
  style,
}) {
  const { t } = useTranslation('combat')
  return (
    <div style={style}>
      <div className="combat-win-section">
        <span className="combat-win-section-title" style={{ color: '#aa8a30' }}>{t('sectionTitles.action')}</span>
        <div style={S.actionGrid}>
          <div
            style={{ ...S.actionBtn, ...(pendingMove ? S.actionBtnActive : {}), gridColumn: 'span 2' }}
            onClick={onMoveToggle}
          >
            <span style={{ ...S.actionLabel, color: pendingMove ? '#e8c870' : '#aaccdd' }}>{t('actionLabels.move')}</span>
            <span style={{ ...S.actionIni, color: pendingMove ? '#e8c870' : '#5a6070' }}>{t('droneDeclare.iniPlaceholder')}</span>
          </div>
          <div
            style={{ ...S.actionBtn, ...(hasPassed ? S.actionBtnActive : {}), gridColumn: 'span 2' }}
            onClick={onPassToggle}
          >
            <span style={{ ...S.actionLabel, color: hasPassed ? '#e8c870' : '#aaccdd' }}>{t('droneDeclare.passTurn')}</span>
          </div>
        </div>
        {pendingMove && (
          <div style={S.attackTargetRow}>
            <span style={S.attackTargetLabel}>⇒</span>
            <span style={{ ...S.attackTargetName, color: '#5b8dee' }}>
              [{pendingMove.targetPosX}, {pendingMove.targetPosY}]
            </span>
          </div>
        )}
      </div>
      <DroneWeaponPanel
        droneWeapons={droneWeapons}
        selectedWeaponId={selectedWeaponId}
        assaultTargetId={assaultTargetId}
        showReadyBadge={false}
        onWeaponSelect={onWeaponSelect}
        onChooseTarget={onChooseTarget}
        getLabel={getLabel}
      />
    </div>
  )
}

const S = {
  actionGrid:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  actionBtn:        { padding: '5px 8px', background: '#0a1018', border: '1px solid #15212e', borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  actionBtnActive:  { background: '#2a1e10', border: '1px solid #aa8a30' },
  actionLabel:      { fontSize: 10, flex: 1 },
  actionIni:        { fontSize: 8, fontFamily: 'monospace', flexShrink: 0 },
  attackTargetRow:  { marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 },
  attackTargetLabel:{ fontSize: 9, color: '#c86030', fontFamily: 'monospace' },
  attackTargetName: { fontSize: 10, fontWeight: 600 },
}
