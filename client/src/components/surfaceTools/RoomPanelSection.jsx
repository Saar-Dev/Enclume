import { useTranslation } from 'react-i18next'
import { PROCEDURAL_MATERIAL_PRESETS, PROCEDURAL_PATTERN_PRESETS } from '../../lib/proceduralMaterials.js'
import { styles } from '../Sidebar.styles.js'

// Réglages du mode Salle (dimensions + matériau appliqué) — extrait de SurfaceEditorPanel.jsx (§16,
// PLAN_WORLD_BUILDER_REWORK.md).
export default function RoomPanelSection({
  surfaceToolState,
  updateSurfaceTool,
  surfaceMaterialFace,
  surfaceMaterialState,
  surfacePaintValue,
  updateSurfaceMaterial,
}) {
  const { t } = useTranslation()

  return (
    <>
      <div style={styles.roomToolGrid}>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.roomHeight')}</span>
          <select
            value={surfaceToolState.roomHeightLevels}
            onChange={e => updateSurfaceTool({ roomHeightLevels: Number(e.target.value) })}
            className="sidebar-tool-field"
          >
            {[1, 2, 3, 4, 5, 6].map(levels => (
              <option key={levels} value={levels}>{t('surfaceEditor.levelCount', { count: levels })}</option>
            ))}
          </select>
        </label>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.slabThickness')}</span>
          <input
            type="number"
            min="0.05"
            max="4"
            step="0.05"
            value={surfaceToolState.floorThickness}
            onChange={e => updateSurfaceTool({ floorThickness: Number(e.target.value) })}
            className="sidebar-tool-field"
          />
        </label>
        <label style={styles.roomToolLabel}>
          <span>Epaisseur mur</span>
          <input
            type="number"
            min="1"
            max="8"
            value={surfaceToolState.wallThickness}
            onChange={e => updateSurfaceTool({ wallThickness: Number(e.target.value) })}
            className="sidebar-tool-field"
          />
        </label>
      </div>
      <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.appliedMaterial')}</div>
      <div style={styles.roomToolModes}>
        {[
          ['floor', 'Sol'],
          ['ceiling', 'Plafond'],
          ['wallInterior', 'Murs côté salle'],
        ].map(([face, label]) => (
          <button
            key={face}
            type="button"
            onClick={() => updateSurfaceTool({ materialFace: face })}
            className="sidebar-tool-mode-btn"
            data-active={surfaceMaterialFace === face}
            style={styles.roomToolModeBtn}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.roomToolGrid}>
        <label style={styles.roomToolLabel}>
          <span>Materiau</span>
          <select
            value={surfaceMaterialState.material}
            onChange={e => updateSurfaceMaterial({ material: e.target.value })}
            className="sidebar-tool-field"
          >
            {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
        <label style={styles.roomToolLabel}>
          <span>Motif</span>
          <select
            value={surfaceMaterialState.pattern}
            onChange={e => updateSurfaceMaterial({ pattern: e.target.value })}
            className="sidebar-tool-field"
          >
            {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
              <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label style={styles.roomToolLabel}>
        <span>Peinture</span>
        <div style={styles.roomToolColorRow}>
          <input
            type="color"
            value={surfacePaintValue}
            onChange={e => updateSurfaceMaterial({ paint: e.target.value })}
            className="sidebar-tool-color-input" style={styles.roomToolColorInput}
          />
          <input
            type="text"
            value={surfaceMaterialState.paint || surfacePaintValue}
            onChange={e => updateSurfaceMaterial({ paint: e.target.value })}
            className="sidebar-tool-field"
          />
        </div>
      </label>
      {[
        ['wear', 'Usure'],
        ['dirt', 'Salete'],
        ['relief', 'Relief'],
      ].map(([key, label]) => (
        <label key={key} style={styles.roomToolLabel}>
          <span>{label}</span>
          <div style={styles.roomToolRangeRow}>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Number(surfaceMaterialState[key]) || 0}
              onChange={e => updateSurfaceMaterial({ [key]: Number(e.target.value) })}
              style={styles.roomToolRange}
            />
            <span style={styles.roomToolRangeValue}>{Number(surfaceMaterialState[key]) || 0}</span>
          </div>
        </label>
      ))}
      <button
        type="button"
        onClick={() => updateSurfaceMaterial({ realRelief: surfaceMaterialState.realRelief === false })}
        className="sidebar-tool-toggle"
        data-active={surfaceMaterialState.realRelief !== false}
        style={styles.roomToolToggle}
      >
        <span>Relief reel</span>
        <span style={styles.roomToolToggleState}>
          {surfaceMaterialState.realRelief !== false ? 'Actif' : 'Normal map'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => updateSurfaceTool({ autoVariants: !surfaceToolState.autoVariants })}
        className="sidebar-tool-toggle"
        data-active={surfaceToolState.autoVariants}
        style={styles.roomToolToggle}
      >
        <span>Variations par surface</span>
        <span style={styles.roomToolToggleState}>
          {surfaceToolState.autoVariants ? 'Actif' : 'Fixe'}
        </span>
      </button>
      <div style={styles.roomToolGrid}>
        <label style={styles.roomToolLabel}>
          <span>Collision</span>
          <select
            value={surfaceToolState.surfaceBlocking || surfaceToolState.wallBlocking || 'solid'}
            onChange={e => updateSurfaceTool({ surfaceBlocking: e.target.value })}
            className="sidebar-tool-field"
          >
            <option value="solid">Plein</option>
            <option value="glass">Verre</option>
            <option value="grate">Grille</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => updateSurfaceMaterial({ seed: `mat-${Date.now().toString(36)}` })}
          className="btn btn-ghost" style={styles.roomToolSmallBtn}
        >
          Nouvelle variation
        </button>
      </div>
    </>
  )
}
