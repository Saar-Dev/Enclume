import { useTranslation } from 'react-i18next'
import { styles } from '../Sidebar.styles.js'

// Réglages du mode Mur droit (épaisseur + hauteur) — extrait de SurfaceEditorPanel.jsx (§16,
// PLAN_WORLD_BUILDER_REWORK.md).
export default function WallPanelSection({ surfaceToolState, updateSurfaceTool }) {
  const { t } = useTranslation()

  return (
    <div style={styles.roomToolGrid}>
      <label style={styles.roomToolLabel}>
        <span>Epaisseur</span>
        <input
          type="number"
          min="1"
          max="8"
          value={surfaceToolState.wallThickness}
          onChange={e => updateSurfaceTool({ wallThickness: Number(e.target.value) })}
          className="sidebar-tool-field"
        />
      </label>
      <label style={styles.roomToolLabel}>
        <span>{t('surfaceEditor.wallHeight')}</span>
        <select
          value={surfaceToolState.wallHeightLevels}
          onChange={e => updateSurfaceTool({ wallHeightLevels: Number(e.target.value) })}
          className="sidebar-tool-field"
        >
          {[1, 2, 3, 4, 5, 6].map(levels => (
            <option key={levels} value={levels}>{t('surfaceEditor.levelCount', { count: levels })}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
