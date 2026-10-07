import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_GROUPS,
  getMaterialThumbnailUrl,
  getPatternThumbnailUrl,
  onImportedPatternReady,
} from '../lib/proceduralMaterials.js'
import { normalizedSurfaceMaterial } from '../lib/materialDecision.js'

// Miniature de catalogue (matière ou motif), générée à la demande seulement quand elle entre dans
// le viewport (IntersectionObserver, même patron que SidebarChatTab.jsx) — jamais les 45 presets
// d'un coup à l'ouverture du panneau, pour ne pas réintroduire le gel déjà corrigé une fois pour
// les height maps importées (§14.1, PLAN_WORLD_BUILDER_REWORK.md). Un motif pas encore décodé se
// régénère seul une fois prêt via `onImportedPatternReady` (déjà le mécanisme de
// SurfaceDungeonScene.jsx, aucun registre d'écouteurs neuf à inventer).
function ThumbnailSwatchButton({ label, selected, presetId, kind, onClick }) {
  const [visible, setVisible] = useState(false)
  // Pas une vraie donnée affichée, juste un déclencheur de nouveau rendu quand la height map
  // importée finit de décoder (§14.1) — l'URL elle-même reste dérivée du cache au rendu, jamais
  // stockée dans un state (évite un setState synchrone en tête d'effet, react-hooks/set-state-in-effect).
  const [, forceRefresh] = useState(0)
  const elementRef = useRef(null)

  useEffect(() => {
    const el = elementRef.current
    if (!el) return undefined
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || kind !== 'pattern') return undefined
    return onImportedPatternReady(presetId, () => forceRefresh(tick => tick + 1))
  }, [visible, presetId, kind])

  const url = visible
    ? (kind === 'pattern' ? getPatternThumbnailUrl(presetId) : getMaterialThumbnailUrl(presetId))
    : null

  return (
    <button
      type="button"
      ref={elementRef}
      onClick={onClick}
      title={label}
      aria-pressed={selected}
      style={{ ...S.swatchButton, ...(selected ? S.swatchButtonActive : {}) }}
    >
      {url ? <img src={url} alt={label} style={S.swatchImg} /> : <span style={S.swatchPlaceholder} />}
      <span style={S.swatchLabel}>{label}</span>
    </button>
  )
}

export default function SurfaceMaterialEditor({ profile, onChange }) {
  const { t } = useTranslation('builder')
  const material = normalizedSurfaceMaterial(profile)
  const patch = value => onChange?.({ ...material, ...value })
  const paint = /^#[0-9a-f]{6}$/i.test(String(material.paint || ''))
    ? material.paint
    : DEFAULT_SURFACE_MATERIAL_PRESET.paint

  return (
    <div style={S.root} data-testid="surface-material-editor">
      <div style={S.field}>
        <span style={S.label}>{t('surfaceMaterialEditor.materialLabel')}</span>
        <div style={S.swatchGrid}>
          {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
            <ThumbnailSwatchButton
              key={preset.id}
              presetId={preset.id}
              kind="material"
              label={preset.label}
              selected={material.material === preset.id}
              onClick={() => patch({ material: preset.id })}
            />
          ))}
        </div>
      </div>
      <div style={S.field}>
        <span style={S.label}>{t('surfaceMaterialEditor.patternLabel')}</span>
        {PROCEDURAL_PATTERN_GROUPS.map(({ group, patterns }) => (
          <div key={group}>
            <span style={S.groupHeading}>{group}</span>
            <div style={S.swatchGrid}>
              {patterns.map(preset => (
                <ThumbnailSwatchButton
                  key={preset.id}
                  presetId={preset.id}
                  kind="pattern"
                  label={preset.label}
                  selected={material.pattern === preset.id}
                  onClick={() => {
                    // Sélectionner un motif sans relief ne montre rien (Saar, 2026-09-30) — 50 % au
                    // choix d'un motif rend l'effet visible tout de suite, pas de réglage caché à deviner.
                    patch(preset.id === 'none' ? { pattern: preset.id } : { pattern: preset.id, relief: 50 })
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <label style={S.colorField}>
        <span style={S.label}>{t('surfaceMaterialEditor.paintLabel')}</span>
        <input type="color" value={paint} onChange={event => patch({ paint: event.target.value })} style={S.colorInput} />
        <input type="text" value={material.paint || paint} onChange={event => patch({ paint: event.target.value })} style={S.input} />
      </label>
      {[
        ['wear', t('surfaceMaterialEditor.wearLabel')],
        ['dirt', t('surfaceMaterialEditor.dirtLabel')],
        ['relief', t('surfaceMaterialEditor.reliefLabel')],
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
      <label style={S.field}>
        <span style={S.rangeLabel}>
          <span>{t('surfaceMaterialEditor.patternScaleLabel')}</span>
          <strong>×{Number(material.patternScale) || 1}</strong>
        </span>
        <input
          aria-label={t('surfaceMaterialEditor.patternScaleLabel')}
          type="range"
          min="0.25"
          max="8"
          step="0.25"
          value={Number(material.patternScale) || 1}
          onChange={event => patch({ patternScale: Number(event.target.value) })}
          style={S.range}
        />
      </label>
      <button
        type="button"
        onClick={() => patch({ realRelief: material.realRelief === false })}
        style={{ ...S.toggle, ...(material.realRelief !== false ? S.toggleActive : {}) }}
      >
        {t('surfaceMaterialEditor.realReliefToggle', {
          state: material.realRelief !== false ? t('surfaceMaterialEditor.realReliefActive') : t('surfaceMaterialEditor.realReliefNormalMap'),
        })}
      </button>
    </div>
  )
}

const S = {
  root: { display: 'flex', flexDirection: 'column', gap: '8px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  swatchGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: '6px' },
  swatchButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '4px', borderRadius: '5px', cursor: 'pointer', border: '1px solid #1e1e2e', background: '#0a0a14' },
  swatchButtonActive: { border: '1px solid #0ea5e9', background: 'rgba(14, 165, 233, 0.15)' },
  swatchImg: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' },
  swatchPlaceholder: { width: '48px', height: '48px', borderRadius: '4px', background: '#14141f' },
  swatchLabel: { fontSize: '8px', color: '#94a3b8', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' },
  groupHeading: { fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', margin: '8px 0 3px' },
  colorField: { display: 'grid', gridTemplateColumns: '1fr 36px 105px', alignItems: 'center', gap: '7px' },
  label: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  rangeLabel: { display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { minWidth: 0, background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '7px 8px', color: '#cbd5e1', fontSize: '11px', outline: 'none' },
  colorInput: { width: '34px', height: '30px', padding: '2px', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '4px' },
  range: { width: '100%' },
  toggle: { minHeight: '29px', border: '1px solid #35354e', borderRadius: '5px', background: '#151525', color: '#7f8eaa', fontSize: '10px', cursor: 'pointer' },
  toggleActive: { borderColor: '#0ea5e9', background: 'rgba(14, 165, 233, 0.15)', color: '#bae6fd' },
}
