import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import api from '../lib/api'
import ReliefBoxGeometry from './ReliefBoxGeometry.jsx'
import {
  DEFAULT_PROCEDURAL_MATERIAL,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
  generateProceduralMaterialTexture,
} from '../lib/proceduralMaterials'

const CATEGORY_OPTIONS = ['Sol', 'Mur', 'Divers']
const ALLOWED_GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']

function dataUrlToFile(dataUrl, name) {
  const [header, body] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/png'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], name, { type: mime })
}

function PreviewBlock({ preview }) {
  const meshRef = useRef()
  const material = useMemo(() => {
    if (!preview) return null
    const loader = new THREE.TextureLoader()
    const map = loader.load(preview.albedoDataUrl)
    const normalMap = loader.load(preview.normalDataUrl)
    map.colorSpace = THREE.SRGBColorSpace
    normalMap.colorSpace = THREE.NoColorSpace || ''
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    normalMap.magFilter = THREE.NearestFilter
    normalMap.minFilter = THREE.NearestFilter
    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      metalness: preview.material.id === 'steel' ? 0.45 : 0.05,
      roughness: preview.material.id === 'plastic' ? 0.38 : 0.74,
    })
  }, [preview])

  useEffect(() => () => {
    material?.map?.dispose()
    material?.normalMap?.dispose()
    material?.dispose()
  }, [material])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.35
  })

  if (!material) return null

  return (
    <mesh ref={meshRef} rotation={[-0.35, 0.4, 0]} material={material} castShadow receiveShadow>
      <ReliefBoxGeometry
        args={[1.35, 0.18, 1.35]}
        profile={preview.procedural}
        faceMask={[false, false, true, false, false, false]}
      />
    </mesh>
  )
}

function Preview3D({ preview }) {
  return (
    <Canvas
      camera={{ position: [1.6, 1.25, 1.9], fov: 44 }}
      style={{ width: '100%', height: '100%', background: '#0f1115' }}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.5} castShadow />
      <PreviewBlock preview={preview} />
    </Canvas>
  )
}

function SliderField({ label, value, onChange, min = 0, max = 100, suffix = '%' }) {
  return (
    <label style={S.sliderField}>
      <span style={S.fieldLabel}>{label}</span>
      <div style={S.sliderRow}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={S.range}
        />
        <span style={S.sliderValue}>{value}{suffix}</span>
      </div>
    </label>
  )
}

export default function MaterialGeneratorTab({
  selectedPack,
  setPackDetail,
  setPacks,
  setPackFiles,
  isOwner,
}) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_PROCEDURAL_MATERIAL }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      label: prev.label || DEFAULT_PROCEDURAL_MATERIAL.label,
    }))
    setError(null)
    setSuccess(null)
  }, [selectedPack?.id])

  const selectedPackId = selectedPack?.id
  const tileSize = Number(selectedPack?.tile_size) || 128
  const preview = useMemo(() => {
    try {
      return generateProceduralMaterialTexture({ ...form, size: tileSize })
    } catch (err) {
      console.error('[MaterialGenerator] preview failed', err)
      return null
    }
  }, [form, tileSize])

  const updateForm = useCallback((patch) => {
    setForm(prev => ({ ...prev, ...patch }))
    setSuccess(null)
    setError(null)
  }, [])

  const uploadGeneratedFile = useCallback(async (dataUrl, name) => {
    const file = dataUrlToFile(dataUrl, name)
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post(`/texture-packs/${selectedPackId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.file
  }, [selectedPackId])

  const handleCreate = useCallback(async () => {
    if (!isOwner || !selectedPackId || !preview) return
    if (!form.label.trim()) {
      setError('Nom requis')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const safeName = form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'materiau'
      const albedoFile = await uploadGeneratedFile(preview.albedoDataUrl, `${safeName}.png`)
      const normalFile = await uploadGeneratedFile(preview.normalDataUrl, `${safeName}-normal.png`)
      const res = await api.post('/voxel-textures/from-paths', {
        pack_id: selectedPackId,
        label: form.label.trim(),
        faces: {
          all: albedoFile.path,
          all_normal: normalFile.path,
          __procedural: preview.procedural,
        },
        allowed_geometries: ALLOWED_GEOMETRIES,
        category_label: form.categoryLabel === 'Divers' ? null : form.categoryLabel,
        usage_hint: 'voxel',
      })

      setPackFiles(prev => [
        ...prev,
        { ...albedoFile, inUse: true },
        { ...normalFile, inUse: true },
      ])
      setPackDetail(prev => ({
        ...prev,
        textures: [...(prev?.textures || []), res.data.texture],
      }))
      setPacks(prev => prev.map(pack => (
        pack.id === selectedPackId
          ? { ...pack, texture_count: Number(pack.texture_count) + 1 }
          : pack
      )))
      setSuccess(`Materiau cree : ${form.label.trim()}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Creation impossible')
    } finally {
      setSaving(false)
    }
  }, [
    form,
    isOwner,
    preview,
    selectedPackId,
    setPackDetail,
    setPackFiles,
    setPacks,
    uploadGeneratedFile,
  ])

  if (!isOwner) {
    return (
      <div style={S.empty}>
        <p style={S.muted}>Ce pack ne vous appartient pas. Le generateur est disponible sur vos packs.</p>
      </div>
    )
  }

  return (
    <div style={S.layout}>
      <div style={S.controls}>
        <div style={S.header}>
          <h3 style={S.title}>Generateur de materiau</h3>
          <p style={S.hint}>Choisis une matiere, une peinture, un motif et les filtres. Le bouton cree un materiau utilisable dans la palette.</p>
        </div>

        <div style={S.grid}>
          <label style={S.field}>
            <span style={S.fieldLabel}>Nom</span>
            <input
              value={form.label}
              onChange={e => updateForm({ label: e.target.value })}
              style={S.input}
              placeholder="ex: Acier jaune sale"
            />
          </label>
          <label style={S.field}>
            <span style={S.fieldLabel}>Classement</span>
            <select
              value={form.categoryLabel}
              onChange={e => updateForm({ categoryLabel: e.target.value })}
              style={S.input}
            >
              {CATEGORY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label style={S.field}>
            <span style={S.fieldLabel}>Matiere</span>
            <select
              value={form.material}
              onChange={e => updateForm({ material: e.target.value })}
              style={S.input}
            >
              {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label style={S.field}>
            <span style={S.fieldLabel}>Motif</span>
            <select
              value={form.pattern}
              onChange={e => updateForm({ pattern: e.target.value })}
              style={S.input}
            >
              {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
                <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
              ))}
            </select>
          </label>
          <label style={S.field}>
            <span style={S.fieldLabel}>Peinture</span>
            <div style={S.paintRow}>
              <input
                type="color"
                value={form.paint}
                onChange={e => updateForm({ paint: e.target.value })}
                style={S.colorInput}
              />
              <input
                value={form.paint}
                onChange={e => updateForm({ paint: e.target.value })}
                style={{ ...S.input, flex: 1 }}
              />
            </div>
          </label>
          <label style={S.field}>
            <span style={S.fieldLabel}>Seed</span>
            <input
              value={form.seed}
              onChange={e => updateForm({ seed: e.target.value })}
              style={S.input}
              placeholder="variation"
            />
          </label>
        </div>

        <div style={S.sliders}>
          <SliderField label="Usure" value={form.wear} onChange={wear => updateForm({ wear })} />
          <SliderField label="Salete" value={form.dirt} onChange={dirt => updateForm({ dirt })} />
          <SliderField label="Relief" value={form.relief} onChange={relief => updateForm({ relief })} />
          <label style={S.checkRow}>
            <input
              type="checkbox"
              checked={form.realRelief !== false}
              onChange={e => updateForm({ realRelief: e.target.checked })}
            />
            <span>Relief reel sur la geometrie</span>
          </label>
        </div>

        {error && <p style={S.error}>{error}</p>}
        {success && <p style={S.success}>{success}</p>}

        <div style={S.footer}>
          <button style={S.btnGhost} type="button" onClick={() => updateForm({ seed: `${form.seed || 'enclume'}-v` })}>
            Nouvelle variation
          </button>
          <button style={S.btnPrimary} type="button" disabled={saving || !preview} onClick={handleCreate}>
            {saving ? 'Creation...' : 'Creer le materiau'}
          </button>
        </div>
      </div>

      <div style={S.previewPanel}>
        <div style={S.preview3d}>
          {preview ? <Preview3D preview={preview} /> : <span style={S.muted}>Apercu indisponible</span>}
        </div>
        <div style={S.previewGrid}>
          <div style={S.previewTile}>
            {preview && <img src={preview.albedoDataUrl} alt="Texture generee" style={S.previewImg} />}
            <span style={S.previewLabel}>Peinture finale</span>
          </div>
          <div style={S.previewTile}>
            {preview && <img src={preview.normalDataUrl} alt="Normal map generee" style={S.previewImg} />}
            <span style={S.previewLabel}>Relief</span>
          </div>
        </div>
        <p style={S.muted}>Taille generee : {tileSize}px. Le relief combine normal map et deformation reelle quand l'option est active.</p>
      </div>
    </div>
  )
}

const S = {
  layout: { display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) 280px', gap: '18px', flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px' },
  controls: { display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 },
  header: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { margin: 0, color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px', margin: 0 },
  fieldLabel: { color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600 },
  input: { width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' },
  paintRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  colorInput: { width: '42px', height: '32px', padding: '2px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' },
  sliders: { display: 'grid', gridTemplateColumns: '1fr', gap: '8px' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' },
  sliderField: { display: 'flex', flexDirection: 'column', gap: '5px', margin: 0 },
  sliderRow: { display: 'grid', gridTemplateColumns: '1fr 44px', gap: '8px', alignItems: 'center' },
  range: { width: '100%', accentColor: '#5b8dee' },
  sliderValue: { color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right', fontFamily: 'monospace' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' },
  previewPanel: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  preview3d: { height: '210px', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0f1115', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  previewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  previewTile: { display: 'flex', flexDirection: 'column', gap: '5px' },
  previewImg: { width: '100%', aspectRatio: '1', borderRadius: '6px', border: '1px solid var(--border-subtle)', objectFit: 'cover', imageRendering: 'pixelated', backgroundColor: 'var(--bg-surface)' },
  previewLabel: { color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center' },
  btnPrimary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  btnGhost: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' },
  muted: { color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.4 },
  error: { color: 'var(--color-danger)', fontSize: '12px', margin: 0 },
  success: { color: '#4caf77', fontSize: '12px', margin: 0 },
}
