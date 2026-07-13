import { useMemo } from 'react'
import {
  clearMaterialSlotOverride,
  materialSlotDisplayValue,
  normalizeModelMaterialSlots,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'

const PANEL_W = 310
const PANEL_H_EST = 380

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

function connectorBlockingForState(type, state) {
  if (type === 'elevator') {
    return {
      blocksSight: false,
      blocksMovement: false,
      blocksWater: true,
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

function clampPanelPosition(x, y) {
  const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, Number(x) || 8))
  const top = Math.max(8, Math.min(window.innerHeight - PANEL_H_EST - 8, Number(y) || 8))
  return { left, top }
}

export default function SurfaceConnectorPanel({ connector, x, y, onPatch, onClose }) {
  const position = useMemo(() => clampPanelPosition(x, y), [x, y])
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
    <div style={{ ...S.panel, left: position.left, top: position.top }}>
      <div style={S.header}>
        <div>
          <p style={S.kicker}>Connecteur 3D</p>
          <p style={S.title}>{connector.modelLabel || connector.type || 'Objet 3D'}</p>
        </div>
        <button type="button" onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <div style={S.infoGrid}>
          <span>Type</span>
          <strong>{connector.type === 'door' ? 'Porte' : connector.type === 'elevator' ? 'Ascenseur' : connector.type}</strong>
          <span>Étage</span>
          <strong>{connector.level ?? 0}</strong>
          <span>Dimensions</span>
          <strong>{connector.width ?? connector.modelGeometry?.width ?? 1} × {connector.depth ?? connector.modelGeometry?.depth ?? 1} × {connector.height ?? connector.modelGeometry?.height ?? 1} m</strong>
        </div>

        {connector.type === 'door' && (
          <label style={S.field}>
            <span style={S.label}>État</span>
            <select value={connector.state || 'closed'} onChange={e => patchState(e.target.value)} style={S.input}>
              <option value="closed">Fermée</option>
              <option value="open">Ouverte</option>
              <option value="locked">Verrouillée</option>
            </select>
          </label>
        )}

        {materialSlots.length > 0 ? (
          <div style={S.field}>
            <span style={S.label}>Couleurs</span>
            <div style={S.slotList}>
              {materialSlots.map(slot => {
                const slotValue = materialSlotDisplayValue(materialOverrides, slot)
                return (
                  <label key={slot.code} style={S.slotRow}>
                    <span style={S.slotLabel}>
                      {MODEL_SLOT_LABELS[slot.code] || slot.label}
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
        )}
      </div>
    </div>
  )
}

const S = {
  panel: {
    position: 'fixed',
    width: PANEL_W,
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
  hint: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    lineHeight: 1.35,
  },
}
