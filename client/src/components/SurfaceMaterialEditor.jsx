import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
} from '../lib/proceduralMaterials.js'
import { normalizedSurfaceMaterial } from '../lib/surfaceMaterial.js'

export default function SurfaceMaterialEditor({ profile, onChange }) {
  const material = normalizedSurfaceMaterial(profile)
  const patch = value => onChange?.({ ...material, ...value })
  const paint = /^#[0-9a-f]{6}$/i.test(String(material.paint || ''))
    ? material.paint
    : DEFAULT_SURFACE_MATERIAL_PRESET.paint

  return (
    <div style={S.root} data-testid="surface-material-editor">
      <div style={S.grid}>
        <label style={S.field}>
          <span style={S.label}>Matière</span>
          <select value={material.material} onChange={event => patch({ material: event.target.value })} style={S.input}>
            {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
        <label style={S.field}>
          <span style={S.label}>Motif</span>
          <select value={material.pattern} onChange={event => patch({ pattern: event.target.value })} style={S.input}>
            {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
              <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label style={S.colorField}>
        <span style={S.label}>Peinture</span>
        <input type="color" value={paint} onChange={event => patch({ paint: event.target.value })} style={S.colorInput} />
        <input type="text" value={material.paint || paint} onChange={event => patch({ paint: event.target.value })} style={S.input} />
      </label>
      {[
        ['wear', 'Usure'],
        ['dirt', 'Saleté'],
        ['relief', 'Relief'],
      ].map(([key, label]) => (
        <label key={key} style={S.field}>
          <span style={S.rangeLabel}><span>{label}</span><strong>{Number(material[key]) || 0}</strong></span>
          <input
            aria-label={label}
            type="range"
            min="0"
            max="100"
            step="1"
            value={Number(material[key]) || 0}
            onChange={event => patch({ [key]: Number(event.target.value) })}
            style={S.range}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => patch({ realRelief: material.realRelief === false })}
        style={{ ...S.toggle, ...(material.realRelief !== false ? S.toggleActive : {}) }}
      >
        Relief réel : {material.realRelief !== false ? 'actif' : 'normal map'}
      </button>
    </div>
  )
}

const S = {
  root: { display: 'flex', flexDirection: 'column', gap: '8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  colorField: { display: 'grid', gridTemplateColumns: '1fr 36px 105px', alignItems: 'center', gap: '7px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  rangeLabel: { display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  colorInput: { width: '34px', height: '30px', padding: '2px', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '4px' },
  range: { width: '100%' },
  toggle: { minHeight: '29px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#7f8eaa', fontSize: '10px', cursor: 'pointer' },
  toggleActive: { borderColor: '#0ea5e9', background: 'rgba(14, 165, 233, 0.15)', color: '#bae6fd' },
}
