import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clearMaterialSlotOverride,
  materialSlotDisplayValue,
  normalizeModelMaterialSlots,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'
import { useDraggablePanelPosition } from '../lib/floatingPanel.js'

const PANEL_W = 310
const PANEL_H_EST = 620

// Clés i18n namespace builder (docs/SYSTEME/LOCALISATION.md §3.1) — le code slot lui-même reste
// la clé JS locale, seul l'affichage passe par t().
const MODEL_SLOT_LABEL_KEYS = {
  SLOT_01: 'surfaceConnectorPanel.modelSlotLabels.SLOT_01',
  SLOT_02: 'surfaceConnectorPanel.modelSlotLabels.SLOT_02',
  SLOT_03: 'surfaceConnectorPanel.modelSlotLabels.SLOT_03',
  SLOT_04: 'surfaceConnectorPanel.modelSlotLabels.SLOT_04',
  SLOT_05: 'surfaceConnectorPanel.modelSlotLabels.SLOT_05',
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

// Fonction pure : `t` injecté en paramètre par l'appelant (règle des hooks, docs/SYSTEME/LOCALISATION.md §3.1).
function connectorTypeLabel(type, t) {
  if (type === 'door') return t('surfaceConnectorPanel.typeDoor')
  if (type === 'elevator') return t('surfaceConnectorPanel.typeElevator')
  if (type === 'ladder') return t('surfaceConnectorPanel.typeLadder')
  return type
}

const ELEVATOR_PHASE_LABEL_KEYS = {
  idle: 'elevatorRuntimeControls.phaseLabels.idle',
  open: 'elevatorRuntimeControls.phaseLabels.open',
  closing: 'elevatorRuntimeControls.phaseLabels.closing',
  moving: 'elevatorRuntimeControls.phaseLabels.moving',
  opening: 'elevatorRuntimeControls.phaseLabels.opening',
  blocked: 'elevatorRuntimeControls.phaseLabels.blocked',
}

function ElevatorRuntimeControls({ connector, runtimeState, onCommand, canAdmin }) {
  const { t } = useTranslation('builder')
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
        <span>{t('elevatorRuntimeControls.cabinLabel')}</span>
        <strong>{runtimeState?.phase && ELEVATOR_PHASE_LABEL_KEYS[runtimeState.phase] ? t(ELEVATOR_PHASE_LABEL_KEYS[runtimeState.phase]) : t('elevatorRuntimeControls.initialState')}</strong>
        <span>{t('elevatorRuntimeControls.stopLabel')}</span>
        <strong>{runtimeState?.currentStopId || stops[0]?.label || '—'}</strong>
        <span>{t('elevatorRuntimeControls.queueLabel')}</span>
        <strong>{t('elevatorRuntimeControls.callsCount', { count: runtimeState?.queue?.length || 0 })}</strong>
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
            {stop.label || t('elevatorRuntimeControls.floorFallback', { level: stop.level })}
          </button>
        ))}
      </div>
      {canAdmin && (
        <div style={S.runtimeActions}>
          {runtimeState?.phase === 'blocked' ? (
            <button type="button" disabled={pending} onClick={() => run({ type: 'unblock' })} style={S.adminBtn}>{t('elevatorRuntimeControls.unblockButton')}</button>
          ) : (
            <button type="button" disabled={pending} onClick={() => run({ type: 'block', reason: 'gm-door-obstruction' })} style={S.adminBtn}>{t('elevatorRuntimeControls.blockDoorButton')}</button>
          )}
          <button type="button" disabled={pending} onClick={() => run({ type: 'open' })} style={S.adminBtn}>{t('elevatorRuntimeControls.openButton')}</button>
          <button type="button" disabled={pending} onClick={() => run({ type: 'close' })} style={S.adminBtn}>{t('elevatorRuntimeControls.closeButton')}</button>
        </div>
      )}
      {runtimeState?.blockedReason && <p style={S.hint}>{t('elevatorRuntimeControls.blockedReasonPrefix', { reason: runtimeState.blockedReason })}</p>}
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
  canEdit = true,
  canAdminElevator = canEdit,
}) {
  const { t } = useTranslation('builder')
  const { position, beginDrag, panelRef } = useDraggablePanelPosition({
    x,
    y,
    width: PANEL_W,
    height: PANEL_H_EST,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const materialSlots = normalizeModelMaterialSlots(connector?.modelGeometry)
  const materialOverrides = connector?.modelMaterialOverrides || {}
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
          <p style={S.kicker}>{t('surfaceConnectorPanel.kicker')}</p>
          <p style={S.title}>{connector.modelLabel || connector.type || t('surfaceConnectorPanel.defaultObjectLabel')}</p>
        </div>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <div style={S.infoGrid}>
          <span>{t('surfaceConnectorPanel.typeLabel')}</span>
          <strong>{connectorTypeLabel(connector.type, t)}</strong>
          <span>{t('surfaceConnectorPanel.levelLabel')}</span>
          <strong>{connector.fromLevel !== undefined && connector.toLevel !== undefined ? `${connector.fromLevel} → ${connector.toLevel}` : connector.level ?? 0}</strong>
          <span>{t('surfaceConnectorPanel.dimensionsLabel')}</span>
          <strong>{connector.width ?? connector.modelGeometry?.width ?? 1} × {connector.depth ?? connector.modelGeometry?.depth ?? 1} × {connector.height ?? connector.modelGeometry?.height ?? 1} m</strong>
        </div>

        {canEdit && connector.type === 'door' && (
          <label style={S.field}>
            <span style={S.label}>{t('surfaceConnectorPanel.stateLabel')}</span>
            <select value={connector.state || 'closed'} onChange={e => patchState(e.target.value)} style={S.input}>
              <option value="closed">{t('surfaceConnectorPanel.stateClosed')}</option>
              <option value="open">{t('surfaceConnectorPanel.stateOpen')}</option>
              <option value="locked">{t('surfaceConnectorPanel.stateLocked')}</option>
            </select>
          </label>
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
          <span style={S.label}>{t('surfaceRoomPanel.movementCostLabel')}</span>
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
          <span style={S.hint}>{t('surfaceConnectorPanel.movementCostHint')}</span>
        </label>}

        {canEdit && (materialSlots.length > 0 ? (
          <div style={S.field}>
            <span style={S.label}>{t('surfaceConnectorPanel.colorsLabel')}</span>
            <div style={S.slotList}>
              {materialSlots.map(slot => {
                const slotValue = materialSlotDisplayValue(materialOverrides, slot)
                const slotLabelKey = MODEL_SLOT_LABEL_KEYS[slot.code]
                return (
                  <label key={slot.code} style={S.slotRow}>
                    <span style={S.slotLabel}>
                      {slotLabelKey ? t(slotLabelKey) : slot.label}
                      <small>{slot.code}</small>
                    </span>
                    <input
                      type="color"
                      value={slotValue.color}
                      onChange={e => patchMaterialSlot(slot, { color: e.target.value })}
                      style={S.colorInput}
                    />
                    <button type="button" onClick={() => clearMaterialSlot(slot)} style={S.resetBtn}>
                      {t('common.resetButton')}
                    </button>
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <p style={S.hint}>{t('surfaceConnectorPanel.noColorSlots')}</p>
        ))}

        {canEdit && onDelete && (!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...S.button, ...S.danger }}>
            {t('surfaceConnectorPanel.deleteObjectButton')}
          </button>
        ) : (
          <div style={S.deleteActions}>
            <button type="button" onClick={() => onDelete(connector.id)} style={{ ...S.button, ...S.danger }}>
              {t('surfaceRoomPanel.confirmDeleteButton')}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={S.button}>
              {t('common.cancelButton')}
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
