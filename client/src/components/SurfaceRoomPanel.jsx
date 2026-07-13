import { useMemo, useState } from 'react'
import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
} from '../lib/proceduralMaterials.js'

const PANEL_W = 330
const PANEL_H_EST = 720
const MATERIAL_FACES = [
  ['top', 'Dessus'],
  ['bottom', 'Dessous'],
  ['wallInterior', 'Mur intérieur'],
  ['wallExterior', 'Mur extérieur'],
]

function clampPanelPosition(x, y) {
  const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, Number(x) || 8))
  const top = Math.max(8, Math.min(window.innerHeight - PANEL_H_EST - 8, Number(y) || 8))
  return { left, top }
}

function normalizedProfile(tool, face) {
  return {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(tool?.materialProfiles?.[face] || {}),
  }
}

export default function SurfaceRoomPanel({ room, tool, x, y, onPatch, onClose }) {
  const position = useMemo(() => clampPanelPosition(x, y), [x, y])
  const [materialFace, setMaterialFace] = useState(tool?.materialFace || 'top')
  if (!room) return null

  const canonicalSlices = Array.isArray(room.verticalProfile?.slices)
    ? room.verticalProfile.slices
    : []
  const hasCanonicalProfile = canonicalSlices.length > 0
  const heightLevels = Math.max(1, Number(room.heightLevels) || Number(tool?.roomHeightLevels) || 1)
  const material = normalizedProfile(tool, materialFace)
  const patchMaterial = patch => onPatch?.({
    materialFace,
    materialProfiles: {
      ...(tool?.materialProfiles || {}),
      [materialFace]: { ...material, ...patch },
    },
  })
  const startConnector = type => onPatch?.({
    mode: 'connector',
    connectorType: type,
    ...(type === 'door' ? {} : { connectorToLevel: (Number(tool?.level) || 0) + 1 }),
    connectorBlueprintId: null,
    connectorModelLabel: null,
    connectorModelCategory: null,
    connectorModelGlbUrl: null,
    connectorModelBuiltinKey: null,
    connectorModelGeometry: null,
    connectorMaterialOverrides: {},
  })

  return (
    <div
      style={{ ...S.panel, left: position.left, top: position.top }}
      onPointerDown={event => event.stopPropagation()}
    >
      <div style={S.header}>
        <div>
          <p style={S.kicker}>Salle</p>
          <p style={S.title}>{room.label || room.name || room.id}</p>
        </div>
        <button type="button" onClick={onClose} style={S.closeBtn}>×</button>
      </div>

      <div style={S.body}>
        <div style={S.infoGrid}>
          <span>Étage de base</span>
          <strong>{Number(tool?.level) || 0}</strong>
          <span>Volume</span>
          <strong>{hasCanonicalProfile ? `profil vertical · ${heightLevels} niveaux` : `${heightLevels} niveau${heightLevels > 1 ? 'x' : ''}`}</strong>
        </div>

        <div style={S.grid}>
          {!hasCanonicalProfile ? (
            <label style={S.field}>
              <span style={S.label}>Hauteur</span>
              <select
                value={Number(tool?.roomHeightLevels) || heightLevels}
                onChange={event => onPatch?.({
                  roomHeightLevels: Number(event.target.value),
                  wallHeightLevels: Number(event.target.value),
                })}
                style={S.input}
              >
                {[1, 2, 3, 4, 5, 6].map(levels => (
                  <option key={levels} value={levels}>{levels} niveau{levels > 1 ? 'x' : ''}</option>
                ))}
              </select>
            </label>
          ) : (
            <div style={S.profileNote}>
              La hauteur locale est portée par le profil vertical du monde. Les zones basses et hautes restent indépendantes.
            </div>
          )}
          <label style={S.field}>
            <span style={S.label}>Dalle</span>
            <input
              type="number"
              min="0.05"
              max="4"
              step="0.05"
              value={Number(tool?.floorThickness) || 0.25}
              onChange={event => onPatch?.({ floorThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>Plafond</span>
            <input
              type="number"
              min="0.05"
              max="4"
              step="0.05"
              value={Number(tool?.ceilingThickness) || 0.25}
              onChange={event => onPatch?.({ ceilingThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>Épaisseur des murs</span>
            <input
              type="number"
              min="1"
              max="8"
              step="1"
              value={Number(tool?.wallThickness) || 1}
              onChange={event => onPatch?.({ wallThickness: Number(event.target.value) })}
              style={S.input}
            />
          </label>
        </div>

        <div style={S.grid}>
          <label style={S.field}>
            <span style={S.label}>Coût de déplacement</span>
            <input
              type="number"
              min="0.05"
              max="100"
              step="0.25"
              value={Math.max(0.05, Number(tool?.movementMultiplier) || 1)}
              onChange={event => onPatch?.({
                movementMultiplier: Math.max(0.05, Math.min(100, Number(event.target.value) || 1)),
              })}
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>Collision</span>
            <select
              value={tool?.surfaceBlocking || 'solid'}
              onChange={event => onPatch?.({ surfaceBlocking: event.target.value })}
              style={S.input}
            >
              <option value="solid">Plein</option>
              <option value="glass">Verre</option>
              <option value="grate">Grille</option>
            </select>
          </label>
        </div>

        <div style={S.section}>
          <span style={S.label}>Matériaux</span>
          <div style={S.faceTabs}>
            {MATERIAL_FACES.map(([face, label]) => (
              <button
                key={face}
                type="button"
                onClick={() => {
                  setMaterialFace(face)
                  onPatch?.({ materialFace: face })
                }}
                style={{ ...S.tab, ...(materialFace === face ? S.tabActive : {}) }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={S.grid}>
            <label style={S.field}>
              <span style={S.label}>Matière</span>
              <select value={material.material} onChange={event => patchMaterial({ material: event.target.value })} style={S.input}>
                {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label style={S.field}>
              <span style={S.label}>Motif</span>
              <select value={material.pattern} onChange={event => patchMaterial({ pattern: event.target.value })} style={S.input}>
                {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
                  <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label style={S.colorField}>
            <span style={S.label}>Peinture</span>
            <input type="color" value={material.paint} onChange={event => patchMaterial({ paint: event.target.value })} style={S.colorInput} />
            <input type="text" value={material.paint} onChange={event => patchMaterial({ paint: event.target.value })} style={S.input} />
          </label>
        </div>

        <div style={S.section}>
          <span style={S.label}>Ajouter un connecteur</span>
          <div style={S.actionRow}>
            <button type="button" onClick={() => startConnector('door')} style={S.action}>Porte</button>
            <button type="button" onClick={() => startConnector('elevator')} style={S.action}>Ascenseur</button>
            <button type="button" onClick={() => startConnector('ladder')} style={S.action}>Échelle</button>
          </div>
        </div>
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: '#0a0a14',
  },
  kicker: { margin: 0, fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: '2px 0 0', fontSize: '12px', color: '#dbeafe', fontWeight: 600, maxWidth: '255px', overflow: 'hidden', textOverflow: 'ellipsis' },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' },
  body: { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' },
  infoGrid: { display: 'grid', gridTemplateColumns: '86px minmax(0, 1fr)', gap: '5px 8px', color: '#64748b', fontSize: '11px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  colorField: { display: 'grid', gridTemplateColumns: '1fr 36px 105px', alignItems: 'center', gap: '7px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  colorInput: { width: '34px', height: '30px', padding: '2px', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '4px' },
  profileNote: { gridColumn: '1 / -1', padding: '8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.28)', background: 'rgba(120, 53, 15, 0.16)', color: '#d6b56f', fontSize: '11px', lineHeight: 1.4 },
  section: { display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '2px' },
  faceTabs: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px' },
  tab: { minHeight: '27px', border: '1px solid #27273a', borderRadius: '5px', background: '#11111f', color: '#7f8eaa', fontSize: '10px', cursor: 'pointer' },
  tabActive: { borderColor: '#d97706', background: 'rgba(217, 119, 6, 0.18)', color: '#fde68a' },
  actionRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '5px' },
  action: { minHeight: '30px', border: '1px solid #3f3f5e', borderRadius: '5px', background: '#17172a', color: '#cbd5e1', fontSize: '10px', cursor: 'pointer' },
}
