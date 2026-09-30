import { useTranslation } from 'react-i18next'
import Object3DPreview from '../Object3DPreview.jsx'
import { materialSlotDisplayValue } from '../../lib/modelMaterialSlots.js'
import { styles } from '../Sidebar.styles.js'

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

// Réglages du mode Connecteur, deuxième bloc — champs Ascenseur + choix du modèle 3D + couleurs
// (le bloc Échelle reste dans SurfaceEditorPanel.jsx, positionné ailleurs dans le panneau, avant le
// champ transverse « coût de déplacement » — extrait de SurfaceEditorPanel.jsx, §16,
// PLAN_WORLD_BUILDER_REWORK.md).
export default function ConnectorPanelSection({
  surfaceToolState,
  updateSurfaceTool,
  connectorChoices,
  selectedConnectorChoice,
  connectorMaterialSlots,
  connectorMaterialOverrides,
  updateConnectorMaterialSlot,
  clearConnectorMaterialSlot,
  selectConnectorModel,
}) {
  const { t } = useTranslation()

  return (
    <>
      {surfaceToolState.connectorType === 'elevator' && (
        <div className="sidebar-glass" style={styles.connectorPicker}>
          <label style={styles.roomToolLabel}>
            <span>{t('surfaceEditor.elevatorToLevel')}</span>
            <select
              value={surfaceToolState.connectorToLevel}
              onChange={e => updateSurfaceTool({ connectorToLevel: Number(e.target.value) })}
              className="sidebar-tool-field"
            >
              {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label style={styles.roomToolLabel}>
            <span>Axe de la porte</span>
            <select
              value={surfaceToolState.elevatorDoorAxis || 'z'}
              onChange={e => updateSurfaceTool({ elevatorDoorAxis: e.target.value })}
              className="sidebar-tool-field"
            >
              <option value="z">Nord / sud</option>
              <option value="x">Est / ouest</option>
            </select>
          </label>
          <label style={styles.roomToolLabel}>
            <span>Côté de la porte</span>
            <select
              value={Number(surfaceToolState.elevatorDoorSide) < 0 ? -1 : 1}
              onChange={e => updateSurfaceTool({ elevatorDoorSide: Number(e.target.value) })}
              className="sidebar-tool-field"
            >
              <option value={1}>Positif</option>
              <option value={-1}>Négatif</option>
            </select>
          </label>
          <label style={styles.roomToolLabel}>
            <span>Trajet par étage (s)</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={surfaceToolState.elevatorTravelSecondsPerLevel || 2}
              onChange={e => updateSurfaceTool({ elevatorTravelSecondsPerLevel: Math.max(0.1, Number(e.target.value) || 2) })}
              className="sidebar-tool-field"
            />
          </label>
        </div>
      )}
      <div className="sidebar-glass" style={styles.connectorPicker}>
        <div style={styles.connectorPickerTitle}>
          {surfaceToolState.connectorType === 'door'
            ? t('surfaceEditor.doorModel')
            : surfaceToolState.connectorType === 'ladder'
              ? 'Modèle d’échelle'
              : t('surfaceEditor.elevatorModel')}
        </div>
        {connectorChoices.length === 0 ? (
          <div style={styles.connectorPickerEmpty}>{t('surfaceEditor.noConnectorModels')}</div>
        ) : (
          <>
            {connectorChoices.map(choice => {
              const isSelected = String(surfaceToolState.connectorBlueprintId) === String(choice.id)
                || (!surfaceToolState.connectorBlueprintId && selectedConnectorChoice?.id === choice.id)
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => selectConnectorModel(choice)}
                  className="sidebar-connector-model-btn"
                  data-active={isSelected}
                  style={styles.connectorModelBtn}
                >
                  <span>{isSelected ? '✓ ' : ''}{choice.label}</span>
                  <small>{choice.category || t('surfaceEditor.connectorModel')}</small>
                </button>
              )
            })}
            {selectedConnectorChoice && (
              <div className="sidebar-connector-selected" style={styles.connectorSelectedModel}>
                <span>✓ {t('surfaceEditor.selectedConnectorModel')}</span>
                <strong>{selectedConnectorChoice.label}</strong>
              </div>
            )}
            {selectedConnectorChoice?.glb_url && (
              <Object3DPreview
                blueprint={selectedConnectorChoice}
                materialOverrides={connectorMaterialOverrides}
              />
            )}
            {connectorMaterialSlots.length > 0 && (
              <div className="sidebar-glass" style={styles.connectorColorPanel}>
                <div style={styles.connectorPickerTitle}>Couleurs du modèle</div>
                {connectorMaterialSlots.map(slot => {
                  const slotValue = materialSlotDisplayValue(connectorMaterialOverrides, slot)
                  return (
                    <label key={slot.code} style={styles.connectorColorRow}>
                      <span style={styles.connectorColorLabel}>
                        {MODEL_SLOT_LABELS[slot.code] || slot.label}
                        <small>{slot.code}</small>
                      </span>
                      <input
                        type="color"
                        value={slotValue.color}
                        onChange={e => updateConnectorMaterialSlot(slot, { color: e.target.value })}
                        className="sidebar-tool-color-input" style={styles.roomToolColorInput}
                      />
                      <button
                        type="button"
                        onClick={() => clearConnectorMaterialSlot(slot)}
                        className="btn btn-ghost"
                        style={styles.connectorColorReset}
                      >
                        Reset
                      </button>
                    </label>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
