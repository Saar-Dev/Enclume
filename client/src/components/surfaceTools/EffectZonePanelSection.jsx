import { useTranslation } from 'react-i18next'
import { groupEffectDefinitions } from '../../lib/effectDefinitionGroups.js'
import { styles } from '../Sidebar.styles.js'

// Réglages du mode Zone d'effet (zones dangereuses) — extrait de SurfaceEditorPanel.jsx (§16,
// PLAN_WORLD_BUILDER_REWORK.md).
export default function EffectZonePanelSection({
  surfaceToolState,
  updateSurfaceTool,
  worldEffects,
  customEffectOpen,
  setCustomEffectOpen,
  customEffectDraft,
  setCustomEffectDraft,
  createCustomEffect,
  deleteRuntimeEffect,
  setEffectInspector,
}) {
  const { t } = useTranslation()

  return (
    <div className="sidebar-glass" style={styles.connectorPicker}>
      <div style={styles.connectorPickerTitle}>{t('surfaceEditor.effectZone')}</div>
      <div style={styles.roomToolGrid}>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.effectTypeLabel')}</span>
          <select
            value={surfaceToolState.effectDefinitionKey || 'fire'}
            onChange={e => updateSurfaceTool({ effectDefinitionKey: e.target.value })}
            className="sidebar-tool-field"
          >
            {groupEffectDefinitions(worldEffects.definitions || [], t).map(group => (
              <optgroup key={group.groupKey} label={group.label}>
                {group.definitions.map(definition => (
                  <option key={definition.key} value={definition.key}>
                    {definition.label}{definition.builtin ? '' : ` (${t('surfaceEditor.customEffectSuffix')})`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.effectIntensityLabel')}</span>
          <input
            type="number"
            min="0.01"
            max="100"
            step="0.25"
            value={surfaceToolState.effectIntensity}
            onChange={e => updateSurfaceTool({ effectIntensity: Math.max(0.01, Number(e.target.value) || 1) })}
            className="sidebar-tool-field"
          />
        </label>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.effectVolumeHeightLabel')}</span>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.25"
            value={surfaceToolState.effectHeight}
            onChange={e => updateSurfaceTool({ effectHeight: Math.max(0.1, Number(e.target.value) || 2.5) })}
            className="sidebar-tool-field"
          />
        </label>
        <label style={styles.roomToolLabel}>
          <span>{t('surfaceEditor.effectPuissanceLabel')}</span>
          <input
            type="number"
            min="-1000"
            max="1000"
            step="1"
            value={surfaceToolState.effectPuissance ?? 0}
            onChange={e => updateSurfaceTool({ effectPuissance: Math.round(Number(e.target.value) || 0) })}
            className="sidebar-tool-field"
          />
        </label>
      </div>
      <button type="button" onClick={() => setCustomEffectOpen(open => !open)} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
        {customEffectOpen ? t('common.close') : t('surfaceEditor.newCustomEffect')}
      </button>
      {customEffectOpen && (
        <div className="sidebar-glass" style={styles.connectorColorList}>
          <label style={styles.roomToolLabel}>
            <span>{t('surfaceEditor.customEffectKeyLabel')}</span>
            <input
              value={customEffectDraft.key}
              onChange={e => setCustomEffectDraft(draft => ({ ...draft, key: e.target.value }))}
              placeholder={t('surfaceEditor.customEffectKeyPlaceholder')}
              className="sidebar-tool-field"
            />
          </label>
          <label style={styles.roomToolLabel}>
            <span>{t('surfaceEditor.customEffectLabelField')}</span>
            <input
              value={customEffectDraft.label}
              onChange={e => setCustomEffectDraft(draft => ({ ...draft, label: e.target.value }))}
              placeholder={t('surfaceEditor.customEffectLabelPlaceholder')}
              className="sidebar-tool-field"
            />
          </label>
          <label style={styles.roomToolLabel}>
            <span>{t('surfaceEditor.customEffectMovementMultiplier')}</span>
            <input
              type="number"
              min="0.05"
              max="100"
              step="0.25"
              value={customEffectDraft.movementMultiplier}
              onChange={e => setCustomEffectDraft(draft => ({ ...draft, movementMultiplier: Number(e.target.value) || 1 }))}
              className="sidebar-tool-field"
            />
          </label>
          <label style={styles.roomToolLabel}>
            <span>{t('surfaceEditor.customEffectNoteLabel')}</span>
            <textarea
              value={customEffectDraft.note}
              onChange={e => setCustomEffectDraft(draft => ({ ...draft, note: e.target.value }))}
              rows={3}
              className="sidebar-tool-field"
            />
          </label>
          <button type="button" onClick={createCustomEffect} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
            {t('surfaceEditor.createCustomEffect')}
          </button>
        </div>
      )}
      {(worldEffects.instances || []).length > 0 && (
        <div className="sidebar-glass" style={styles.connectorColorList}>
          <div style={styles.connectorPickerTitle}>{t('surfaceEditor.activeEffectsTitle')}</div>
          {worldEffects.instances.map(instance => {
            const definition = worldEffects.definitions.find(item => item.key === instance.definitionKey)
            return (
              <div key={instance.id} className="sidebar-tool-selection" style={styles.roomToolSelection}>
                <span>
                  {definition?.label || instance.definitionKey} ×{instance.intensity}
                  {Number(instance.puissance) !== 0 && ` · ${t('surfaceEditor.effectPuissanceLabel')} ${instance.puissance > 0 ? '+' : ''}${instance.puissance}`}
                </span>
                <span style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={event => setEffectInspector({ instanceId: instance.id, x: event.clientX, y: event.clientY })}
                    className="btn btn-ghost"
                    style={styles.roomToolSmallBtn}
                  >
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => deleteRuntimeEffect(instance.id)} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
                    {t('common.delete')}
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
