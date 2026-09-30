import { useTranslation } from 'react-i18next'
import SurfaceMaterialEditor from '../SurfaceMaterialEditor.jsx'
import { styles } from '../Sidebar.styles.js'
import { CHIP_BTN_STYLE, PAINT_WALL_SCOPE_LABEL_KEYS } from './panelSharedConstants.js'

// Réglages du mode Peindre un mur (portée + matériau) — extrait de SurfaceEditorPanel.jsx (§16,
// PLAN_WORLD_BUILDER_REWORK.md).
export default function PaintWallPanelSection({ surfaceToolState, updateSurfaceTool, surfaceMaterialState, updateSurfaceMaterial }) {
  const { t } = useTranslation()
  const wallPaintScope = surfaceToolState.wallPaintScope || 'case'

  return (
    <div className="sidebar-glass" style={styles.roomToolGrid}>
      <p className="sidebar-tool-hint" style={styles.roomToolHint}>
        {t('surfaceEditor.paintWallRoomHint', {
          name: surfaceToolState.roomName || '',
          scope: t(PAINT_WALL_SCOPE_LABEL_KEYS[wallPaintScope]),
        })}
      </p>
      <div style={styles.roomToolModes}>
        {[
          { key: 'case', label: t('surfaceEditor.paintWallScopeCase') },
          { key: 'run', label: t('surfaceEditor.paintWallScopeRun') },
          { key: 'room', label: t('surfaceEditor.paintWallScopeRoom') },
        ].map(scope => (
          <button
            key={scope.key}
            type="button"
            onClick={() => updateSurfaceTool({ wallPaintScope: scope.key })}
            className="sidebar-tool-mode-btn"
            data-active={wallPaintScope === scope.key}
            style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
          >
            <span>{scope.label}</span>
          </button>
        ))}
      </div>
      {wallPaintScope === 'room' && (
        <label style={styles.roomToolLabel}>
          <input
            type="checkbox"
            checked={!!surfaceToolState.wallPaintClearOverrides}
            onChange={e => updateSurfaceTool({ wallPaintClearOverrides: e.target.checked })}
          />
          <span>{t('surfaceEditor.paintWallClearOverrides')}</span>
        </label>
      )}
      <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.paintWallMaterialSection')}</div>
      <SurfaceMaterialEditor profile={surfaceMaterialState} onChange={updateSurfaceMaterial} />
    </div>
  )
}
