import { useMemo, useState } from 'react'
import {
  clearMaterialSlotOverride,
  connectorModelMaterialSlots,
  materialSlotDisplayValue,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'
import { useDraggablePanelPosition } from '../lib/floatingPanel.js'
import Object3DPreview from './Object3DPreview.jsx'

const PANEL_W = 310
const PANEL_H_EST = 620

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

function connectorBlockingForState(type, state) {
  if (type === 'elevator' || type === 'ladder') {
    return {
      blocksSight: false,
      blocksMovement: false,
      blocksWater: type === 'elevator',
      barrierType: 'connector',
    }
  }
  const open = state === 'open'
  return {
    blocksSight: !open,
    blocksMovement: !open,
    blocksWater: !open,
    barrierType: open ? 'open-door' : 'door',
  }
}

function connectorTypeLabel(type) {
  if (type === 'door') return 'Porte'
  if (type === 'window') return 'Fenêtre'
  if (type === 'screen-window') return 'Fenêtre écran'
  if (type === 'skylight') return 'Dalle en verre'
  if (type === 'elevator') return 'Ascenseur'
  if (type === 'ladder') return 'Échelle'
  return type
}

const ELEVATOR_PHASE_LABELS = {
  idle: 'À l’arrêt',
  open: 'Portes ouvertes',
  closing: 'Fermeture',
  moving: 'En déplacement',
  opening: 'Ouverture',
  blocked: 'Porte bloquée',
}

function ElevatorRuntimeControls({ connector, runtimeState, onCommand, canAdmin }) {
  const [pending, setPending] = useState(false)
  const stops = Array.isArray(connector.stops) ? connector.stops : []
  const run = async command => {
    if (!onCommand || pending) return
    setPending(true)
    try { await onCommand(connector.worldId || connector.id, command) } finally { setPending(false) }
  }
  return (
    <div style={S.elevatorRuntime}>
      <div style={S.infoGrid}>
        <span>Cabine</span>
        <strong>{ELEVATOR_PHASE_LABELS[runtimeState?.phase] || 'État initial'}</strong>
        <span>Palier</span>
        <strong>{runtimeState?.currentStopId || stops[0]?.label || '—'}</strong>
        <span>File</span>
        <strong>{runtimeState?.queue?.length || 0} appel(s)</strong>
      </div>
      <div style={S.stopGrid}>
        {stops.map(stop => (
          <button
            key={stop.id}
            type="button"
            disabled={pending || !onCommand}
            onClick={() => run({ type: 'request', stopId: stop.id })}
            style={{
              ...S.runtimeBtn,
              ...(runtimeState?.currentStopId === stop.id ? S.runtimeBtnCurrent : {}),
            }}
          >
            {stop.label || `Étage ${stop.level}`}
          </button>
        ))}
      </div>
      {canAdmin && (
        <div style={S.runtimeActions}>
          {runtimeState?.phase === 'blocked' ? (
            <button type="button" disabled={pending} onClick={() => run({ type: 'unblock' })} style={S.adminBtn}>Débloquer</button>
          ) : (
            <button type="button" disabled={pending} onClick={() => run({ type: 'block', reason: 'gm-door-obstruction' })} style={S.adminBtn}>Bloquer la porte</button>
          )}
          <button type="button" disabled={pending} onClick={() => run({ type: 'open' })} style={S.adminBtn}>Ouvrir</button>
          <button type="button" disabled={pending} onClick={() => run({ type: 'close' })} style={S.adminBtn}>Fermer</button>
        </div>
      )}
      {runtimeState?.blockedReason && <p style={S.hint}>Blocage : {runtimeState.blockedReason}</p>}
    </div>
  )
}

export default function SurfaceConnectorPanel({
  connector,
  x,
  y,
  onPatch,
  onDelete,
  onClose,
  runtimeState = null,
  onElevatorCommand = null,
  onWindowStateChange = null,
  canEdit = true,
  canAdminElevator = canEdit,
}) {
  const { position, beginDrag, panelRef } = useDraggablePanelPosition({
    x,
    y,
    width: PANEL_W,
    height: PANEL_H_EST,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const materialSlots = connectorModelMaterialSlots(connector)
  const materialOverrides = connector?.modelMaterialOverrides || {}
  const previewBlueprint = useMemo(() => ({
    glb_url: connector?.modelGlbUrl || null,
    geometry: connector?.modelGeometry || {},
    label: connector?.modelLabel || connectorTypeLabel(connector?.type),
  }), [connector?.modelGlbUrl, connector?.modelGeometry, connector?.modelLabel, connector?.type])
  if (!connector) return null

  const patchMaterialSlot = (slot, patch) => {
    onPatch?.(connector.id, {
      modelMaterialOverrides: setMaterialSlotOverride(materialOverrides, slot, patch),
    })
  }

  const clearMaterialSlot = (slot) => {
    onPatch?.(connector.id, {
      modelMaterialOverrides: clearMaterialSlotOverride(materialOverrides, slot),
    })
  }

  const isWindow = ['window', 'screen-window'].includes(connector.type)
  const allowedWindowStates = Array.isArray(connector.allowedStates)
    ? connector.allowedStates
    : ['transparent', ...(connector.type === 'screen-window' ? ['opaque', 'mirror'] : [])]
  const currentWindowState = runtimeState?.state || connector.state || 'transparent'
  const toggleAllowedState = state => {
    if (state === 'transparent') return
    const next = allowedWindowStates.includes(state)
      ? allowedWindowStates.filter(item => item !== state)
      : [...allowedWindowStates, state]
    onPatch?.(connector.id, { allowedStates: ['transparent', ...next.filter(item => item !== 'transparent')] })
  }

  const patchState = (state) => {
    onPatch?.(connector.id, {
      state,
      ...connectorBlockingForState(connector.type, state),
    })
  }

  return (
    <div
      ref={panelRef}
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
      data-testid="surface-connector-panel"
    >
      <div style={S.header} onPointerDown={beginDrag} data-testid="surface-connector-panel-handle">
        <div>
          <p style={S.kicker}>Connecteur 3D</p>
          <p style={S.title}>{connector.modelLabel || connector.type || 'Objet 3D'}</p>
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <div style={S.infoGrid}>
          <span>Type</span>
          <strong>{connectorTypeLabel(connector.type)}</strong>
          <span>Étage</span>
          <strong>{connector.fromLevel !== undefined && connector.toLevel !== undefined ? `${connector.fromLevel} → ${connector.toLevel}` : connector.level ?? 0}</strong>
          <span>Dimensions</span>
          <strong>{connector.width ?? connector.modelGeometry?.width ?? 1} × {connector.depth ?? connector.modelGeometry?.depth ?? 1} × {connector.height ?? connector.modelGeometry?.height ?? 1} m</strong>
        </div>

        {canEdit && connector.type === 'door' && (
          <label style={S.field}>
            <span style={S.label}>État</span>
            <select value={connector.state || 'closed'} onChange={e => patchState(e.target.value)} style={S.input}>
              <option value="closed">Fermée</option>
              <option value="open">Ouverte</option>
              <option value="locked">Verrouillée</option>
            </select>
          </label>
        )}

        {isWindow && (
          <div style={S.field}>
            <span style={S.label}>États disponibles</span>
            {[
              ['transparent', 'Transparent'],
              ['opaque', 'Opaque'],
              ['mirror', 'Miroir'],
            ].map(([state, label]) => {
              const locked = state === 'transparent' || connector.type === 'window'
              const enabled = state === 'transparent' || (connector.type === 'screen-window' && allowedWindowStates.includes(state))
              if (connector.type === 'window' && state !== 'transparent') return null
              return (
                <label key={state} style={{ ...S.stateRow, ...(locked ? S.stateRowLocked : {}) }}>
                  <input type="checkbox" checked={enabled} disabled={!canEdit || locked} onChange={() => toggleAllowedState(state)} />
                  <span>{label}</span>
                </label>
              )
            })}
            {!canEdit && connector.type === 'screen-window' && (
              <div style={S.runtimeActions}>
                {allowedWindowStates.map(state => (
                  <button
                    key={state}
                    type="button"
                    disabled={!onWindowStateChange || currentWindowState === state}
                    onClick={() => onWindowStateChange(connector.worldId || connector.id, state)}
                    style={{ ...S.runtimeBtn, ...(currentWindowState === state ? S.runtimeBtnCurrent : {}) }}
                  >
                    {state === 'transparent' ? 'Transparent' : state === 'opaque' ? 'Opaque' : 'Miroir'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canEdit && connector.type === 'screen-window' && (
          <div style={S.field}>
            <span style={S.label}>Côté du boîtier</span>
            <button
              type="button"
              onClick={() => onPatch?.(connector.id, {
                modelFacing: connector.modelFacing === 'back' ? 'front' : 'back',
              })}
              style={S.button}
            >
              ↻ Retourner la fenêtre
            </button>
            <span style={S.hint}>
              Le boîtier est actuellement sur la face {connector.modelFacing === 'back' ? 'B' : 'A'}.
            </span>
          </div>
        )}

        {connector.type === 'elevator' && (
          <ElevatorRuntimeControls
            connector={connector}
            runtimeState={runtimeState}
            onCommand={onElevatorCommand}
            canAdmin={canAdminElevator}
          />
        )}

        {canEdit && <label style={S.field}>
          <span style={S.label}>Coût de déplacement</span>
          <input
            type="number"
            min="0.05"
            max="100"
            step="0.25"
            value={Math.max(0.05, Number(connector.movementMultiplier) || 1)}
            onChange={e => onPatch?.(connector.id, {
              movementMultiplier: Math.max(0.05, Math.min(100, Number(e.target.value) || 1)),
            })}
            style={S.input}
          />
          <span style={S.hint}>×1 normal, ×2 deux fois plus coûteux, jusqu’à ×100.</span>
        </label>}

        {canEdit && (materialSlots.length > 0 ? (
          <div style={S.field}>
            <span style={S.label}>Apparence</span>
            {previewBlueprint.glb_url && (
              <Object3DPreview blueprint={previewBlueprint} materialOverrides={materialOverrides} compact />
            )}
            <div style={S.slotList}>
              {materialSlots.map(slot => {
                const slotValue = materialSlotDisplayValue(materialOverrides, slot)
                return (
                  <label key={slot.code} style={S.slotRow}>
                    <span style={S.slotLabel}>
                      {slot.label || MODEL_SLOT_LABELS[slot.code]}
                      <small>{slot.code}</small>
                    </span>
                    <input
                      type="color"
                      value={slotValue.color}
                      onChange={e => patchMaterialSlot(slot, { color: e.target.value })}
                      style={S.colorInput}
                    />
                    <button type="button" onClick={() => clearMaterialSlot(slot)} style={S.resetBtn}>
                      Reset
                    </button>
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <p style={S.hint}>Ce modèle n’expose pas de slots couleur.</p>
        ))}

        {canEdit && onDelete && (!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...S.button, ...S.danger }}>
            Supprimer l’objet 3D
          </button>
        ) : (
          <div style={S.deleteActions}>
            <button type="button" onClick={() => onDelete(connector.id)} style={{ ...S.button, ...S.danger }}>
              Confirmer la suppression
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={S.button}>
              Annuler
            </button>
          </div>
        ))}
      </div>
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
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 14px',
    borderBottom: '1px solid #1e1e2e',
    background: '#0a0a14',
    cursor: 'grab',
    touchAction: 'none',
  },
  kicker: {
    margin: 0,
    fontSize: '11px',
    color: '#f97316',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#dbeafe',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '4px',
  },
  body: {
    padding: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 65px)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: '5px 8px',
    color: '#64748b',
    fontSize: '11px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  stateRow: { display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '12px' },
  stateRowLocked: { opacity: 0.55 },
  label: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: '#0a0a14',
    border: '1px solid #1e1e2e',
    borderRadius: '5px',
    padding: '7px 10px',
    color: '#cbd5e1',
    fontSize: '12px',
    outline: 'none',
  },
  slotList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '7px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(91, 141, 238, 0.25)',
    background: 'rgba(15, 23, 42, 0.55)',
  },
  slotRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px 44px',
    gap: '6px',
    alignItems: 'center',
  },
  slotLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    color: '#cbd5e1',
    fontSize: '11px',
    minWidth: 0,
  },
  colorInput: {
    width: '34px',
    height: '29px',
    padding: '2px',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resetBtn: {
    height: '28px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    background: '#0f0f1a',
    color: '#7f8eaa',
    fontSize: '10px',
    cursor: 'pointer',
  },
  button: {
    minHeight: '32px',
    border: '1px solid #35354e',
    borderRadius: '5px',
    background: '#151525',
    color: '#cbd5e1',
    fontSize: '10px',
    cursor: 'pointer',
  },
  deleteActions: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 72px',
    gap: '6px',
  },
  danger: {
    borderColor: 'rgba(251, 113, 133, 0.55)',
    background: 'rgba(127, 29, 29, 0.18)',
    color: '#fda4af',
  },
  hint: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    lineHeight: 1.35,
  },
  elevatorRuntime: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '9px',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    borderRadius: '7px',
    background: 'rgba(76, 29, 149, 0.12)',
  },
  stopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  runtimeBtn: {
    minHeight: '30px',
    border: '1px solid #3f3f5e',
    borderRadius: '5px',
    background: '#17172a',
    color: '#c4b5fd',
    fontSize: '11px',
    cursor: 'pointer',
  },
  runtimeBtnCurrent: {
    borderColor: '#a78bfa',
    background: 'rgba(124, 58, 237, 0.28)',
    color: '#f5f3ff',
  },
  runtimeActions: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
  },
  adminBtn: {
    minHeight: '27px',
    padding: '0 8px',
    border: '1px solid #4c1d95',
    borderRadius: '4px',
    background: '#211238',
    color: '#ddd6fe',
    fontSize: '10px',
    cursor: 'pointer',
  },
}
