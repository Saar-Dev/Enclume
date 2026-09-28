import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useWorldRuntimeStore } from '../stores/worldRuntimeStore.js'
import { groupEffectDefinitions } from '../lib/effectDefinitionGroups.js'
import FloatingPanelSection from './FloatingPanelSection.jsx'
import SurfaceEffectPanel from './SurfaceEffectPanel.jsx'
import { useDraggablePanelPosition } from '../lib/floatingPanel.js'

const PANEL_W = 300
const PANEL_H_EST = 420
const DEFAULT_HEIGHT = 2.5

// SessionDangerZonePanel — Z6 (docs/PLANS/PLAN_ZONES_DANGER.md §7.2), point d'entrée décidé par Saar :
// Sidebar > Outils > « Zone de danger » (fenêtre flottante, pas un onglet permanent — le MJ ne pose
// une zone qu'occasionnellement). Formulaire de pose (repris tel quel de SurfaceEditorPanel.jsx,
// mode:'effect') + liste « Effets actifs » (même patron, Modifier ouvre SurfaceEffectPanel.jsx déjà
// construit, réutilisé sans modification) + un bouton « Placer » qui arme le mode de pose sur
// Canvas3D.jsx (glisser un rectangle, aperçu translucide, POST au relâchement — voir Canvas3D.jsx et
// SessionPage.jsx:handleZonePlaceCommit).
//
// Portée assumée de ce lot (§11 historique) : seul le mode rectangle est câblé ici. « Remplir un
// compartiment » (targetKind:'compartment') est reporté à un lot suivant — la détection de pièce au
// clic (findRoomAtCell, client/src/lib/surfaceRooms.js) n'est câblée nulle part dans Canvas3D.jsx
// aujourd'hui, contrairement à l'éditeur de carte.
export default function SessionDangerZonePanel({ battlemapId, onClose, placingZone, onArmPlacement, onCancelPlacement }) {
  const { t } = useTranslation()
  const { position, beginDrag, panelRef } = useDraggablePanelPosition({
    x: 80, y: 80, width: PANEL_W, height: PANEL_H_EST, placement: 'free',
    storageKey: 'enclume.sessionDangerZonePanel.position',
  })
  const worldEffects = useWorldRuntimeStore(s => s.worldEffects)
  const fetchWorldEffects = useWorldRuntimeStore(s => s.fetchWorldEffects)
  const definitions = worldEffects.definitions || []

  const [definitionKey, setDefinitionKey] = useState(definitions[0]?.key || '')
  const [intensity, setIntensity] = useState(1)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [puissance, setPuissance] = useState(0)
  const [effectInspector, setEffectInspector] = useState(null)

  const groups = groupEffectDefinitions(definitions, t)
  const selectedDefinition = definitions.find(d => d.key === (definitionKey || definitions[0]?.key))

  const deleteRuntimeEffect = async instanceId => {
    if (!battlemapId) return
    try {
      await api.delete(`/battlemaps/${battlemapId}/world-effects/instances/${instanceId}`)
      await fetchWorldEffects(battlemapId)
      if (effectInspector?.instanceId === instanceId) setEffectInspector(null)
    } catch (error) {
      console.error('[SessionDangerZonePanel] Suppression effet refusée :', error)
    }
  }

  const updateRuntimeEffect = async (instanceId, patch) => {
    if (!battlemapId) return
    try {
      await api.patch(`/battlemaps/${battlemapId}/world-effects/instances/${instanceId}`, patch)
      await fetchWorldEffects(battlemapId)
    } catch (error) {
      console.error('[SessionDangerZonePanel] Mise à jour effet refusée :', error)
    }
  }

  const armPlacement = () => {
    if (!selectedDefinition) return
    onArmPlacement?.({
      definitionKey: selectedDefinition.key,
      definitionCategory: selectedDefinition.category,
      intensity: Math.max(0.01, Number(intensity) || 1),
      height: Math.max(0.1, Number(height) || DEFAULT_HEIGHT),
      puissance: Math.round(Number(puissance) || 0),
    })
  }

  return (
    <div
      ref={panelRef}
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="session-danger-zone-panel"
    >
      <div style={S.header} onPointerDown={beginDrag} data-testid="session-danger-zone-panel-handle">
        <p style={S.title}>{t('surfaceEditor.effectZone')}</p>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <FloatingPanelSection title={t('surfaceEditor.effectZone')} defaultOpen storageKey="enclume.sessionDangerZonePanel.section.create">
          <label style={S.field}>
            <span style={S.label}>{t('surfaceEditor.effectTypeLabel')}</span>
            <select
              value={definitionKey}
              onChange={event => setDefinitionKey(event.target.value)}
              onPointerDown={event => event.stopPropagation()}
              style={S.input}
            >
              {groups.map(group => (
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
          <div style={S.grid}>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.effectIntensityLabel')}</span>
              <input
                type="number" min="0.01" max="100" step="0.25"
                value={intensity}
                onChange={event => setIntensity(Math.max(0.01, Number(event.target.value) || 1))}
                onPointerDown={event => event.stopPropagation()}
                style={S.input}
              />
            </label>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.effectVolumeHeightLabel')}</span>
              <input
                type="number" min="0.1" max="100" step="0.25"
                value={height}
                onChange={event => setHeight(Math.max(0.1, Number(event.target.value) || DEFAULT_HEIGHT))}
                onPointerDown={event => event.stopPropagation()}
                style={S.input}
              />
            </label>
            <label style={S.field}>
              <span style={S.label}>{t('surfaceEditor.effectPuissanceLabel')}</span>
              <input
                type="number" min="-1000" max="1000" step="1"
                value={puissance}
                onChange={event => setPuissance(Math.round(Number(event.target.value) || 0))}
                onPointerDown={event => event.stopPropagation()}
                style={S.input}
              />
            </label>
          </div>
          {placingZone ? (
            <div style={S.placingHint}>
              <p style={S.hintText}>{t('surfaceEditor.placingZoneHint')}</p>
              <button type="button" onClick={onCancelPlacement} style={S.action}>
                {t('surfaceEditor.cancelPlacement')}
              </button>
            </div>
          ) : (
            <button type="button" onClick={armPlacement} disabled={!selectedDefinition} style={{ ...S.action, ...S.primary }}>
              {t('surfaceEditor.placeZoneButton')}
            </button>
          )}
        </FloatingPanelSection>

        {(worldEffects.instances || []).length > 0 && (
          <FloatingPanelSection title={t('surfaceEditor.activeEffectsTitle')} defaultOpen storageKey="enclume.sessionDangerZonePanel.section.list">
            {worldEffects.instances.map(instance => {
              const definition = definitions.find(item => item.key === instance.definitionKey)
              return (
                <div key={instance.id} style={S.listRow}>
                  <span style={S.listLabel}>
                    {definition?.label || instance.definitionKey} ×{instance.intensity}
                    {Number(instance.puissance) !== 0 && ` · ${t('surfaceEditor.effectPuissanceLabel')} ${instance.puissance > 0 ? '+' : ''}${instance.puissance}`}
                  </span>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={event => setEffectInspector({ instanceId: instance.id, x: event.clientX, y: event.clientY })}
                      style={S.action}
                    >
                      {t('common.edit')}
                    </button>
                    <button type="button" onClick={() => deleteRuntimeEffect(instance.id)} style={S.action}>
                      {t('common.delete')}
                    </button>
                  </span>
                </div>
              )
            })}
          </FloatingPanelSection>
        )}
      </div>

      {effectInspector && (() => {
        const instance = (worldEffects.instances || []).find(item => item.id === effectInspector.instanceId)
        if (!instance) return null
        const definition = definitions.find(item => item.key === instance.definitionKey)
        return (
          <SurfaceEffectPanel
            instance={instance}
            definition={definition}
            x={effectInspector.x}
            y={effectInspector.y}
            onPatch={patch => updateRuntimeEffect(instance.id, patch)}
            onDelete={() => deleteRuntimeEffect(instance.id)}
            onClose={() => setEffectInspector(null)}
          />
        )
      })()}
    </div>
  )
}

const S = {
  panel: {
    position: 'fixed',
    width: PANEL_W,
    maxHeight: 'calc(100vh - 16px)',
    zIndex: 10002,
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.72)',
    overflow: 'hidden',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: '#0a0a14',
    cursor: 'grab', touchAction: 'none',
  },
  title: { margin: 0, fontSize: '12px', color: '#dbeafe', fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  action: { minHeight: '30px', border: '1px solid #3f3f5e', borderRadius: '5px', background: '#17172a', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer', padding: '0 10px' },
  primary: { borderColor: 'rgba(91, 141, 238, 0.55)', background: 'rgba(30, 58, 138, 0.25)', color: '#93c5fd' },
  placingHint: { display: 'flex', flexDirection: 'column', gap: '6px' },
  hintText: { margin: 0, fontSize: '11px', color: '#fbbf24' },
  listRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid #1e1e2e', fontSize: '11px', color: '#cbd5e1' },
  listLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}
