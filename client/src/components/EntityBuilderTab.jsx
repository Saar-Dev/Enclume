import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame } from '@react-three/fiber'
import api from '../lib/api'
import { loadVoxelTextures } from '../lib/voxelTextures'

// ─── Constantes ───────────────────────────────────────────────────────────────
// Faces entité — labels via fr.json builder.faces.*
const FACE_NAMES = ['top', 'bottom', 'north', 'south', 'east', 'west']

const EMPTY_FORM = {
  label: '',
  appearance: 'voxel',
  glb_url: '',
  width: 1,
  height: 1,
  depth: 1,
  placementMode: 'free',
  wallDefaultBottomHeight: 1,
  wallAllowInterior: true,
  wallAllowExterior: true,
  geometryExtras: {},
  faces: {},
  states: [],
  interactions: [],
}

// ─── Aperçu 3D ────────────────────────────────────────────────────────────────
function RotatingEntity({ textureMaterials, width, height, depth }) {
  const groupRef = useRef()
  const w = width || 1
  const h = height || 1
  const d = depth || 1

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.8
  })
  if (!textureMaterials) return null
  return (
    <group ref={groupRef} position={[-w/2, -h/2, -d/2]}>
      <mesh material={textureMaterials.faceMaterials}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  )
}

function EntityPreview({ faces, packId, width, height, depth }) {
  const { t } = useTranslation()
  const [materials, setMaterials] = useState(null)
  const hasAnyFace = Object.values(faces).some(v => v !== null && v !== undefined && v !== '')

  useEffect(() => {
    if (!packId || !hasAnyFace) return undefined
    let cancelled = false
    const fakeTex = [{ id: 0, pack_id: packId, pack_name: '', label: 'preview', faces }]
    loadVoxelTextures(fakeTex).then(result => {
      if (!cancelled) setMaterials(result[0] || null)
    })
    return () => { cancelled = true }
  }, [faces, hasAnyFace, packId])

  if (!packId || !hasAnyFace || !materials) {
    return (
      <div style={S.previewPlaceholder}>
        <span style={S.muted}>{t('builder.preview')}</span>
      </div>
    )
  }

  const maxDim = Math.max(width || 1, height || 1, depth || 1)
  const camDist = maxDim * 2.5

  return (
    <Canvas
      camera={{ position: [camDist, camDist * 0.75, camDist], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#0f1115' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />
      <RotatingEntity textureMaterials={materials} width={width} height={height} depth={depth} />
    </Canvas>
  )
}

// ─── EntityBuilderTab ─────────────────────────────────────────────────────────
export default function EntityBuilderTab({
  selectedPack,
  packFiles,
  isOwner,
  onCountChange,
}) {
  const { t } = useTranslation()

  const [blueprints, setBlueprints] = useState([])
  const [loadingBp, setLoadingBp] = useState(false)
  const [editingBp, setEditingBp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [bpError, setBpError] = useState(null)

  const [skills, setSkills] = useState([])
  useEffect(() => {
    api.get('/char-ref/skills')
      .then(res => setSkills(res.data.skills || []))
      .catch(() => {})
  }, [])

  const [pickerFace, setPickerFace] = useState(null)
  const [stateWarn, setStateWarn] = useState(null)

  useEffect(() => { setEditingBp(null); setForm(EMPTY_FORM) }, [selectedPack?.id])

  // ─── Chargement blueprints ────────────────────────────────────────────────
  const loadBlueprints = useCallback(async () => {
    if (!selectedPack) return
    setLoadingBp(true)
    try {
      const res = await api.get(`/entity-blueprints/all?pack_id=${selectedPack.id}`)
      setBlueprints(res.data.blueprints)
      onCountChange?.(res.data.blueprints.length)
    } catch { setBpError(t('builder.errorLoad')) }
    finally { setLoadingBp(false) }
  }, [selectedPack, onCountChange, t])

  useEffect(() => { loadBlueprints() }, [loadBlueprints])

  // ─── Init formulaire ──────────────────────────────────────────────────────
  const startNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setBpError(null)
    setEditingBp('new')
  }, [])

  const startEdit = useCallback((bp) => {
    setForm({
      label:      bp.label || '',
      appearance: bp.glb_url ? 'glb' : 'voxel',
      glb_url:    bp.glb_url || '',
      width:      bp.geometry?.width  ?? 1,
      height:     bp.geometry?.height ?? 1,
      depth:      bp.geometry?.depth  ?? 1,
      placementMode: bp.geometry?.placementMode || bp.geometry?.placement_mode || 'free',
      wallDefaultBottomHeight: bp.geometry?.wallMount?.defaultBottomHeight ?? 1,
      wallAllowInterior: bp.geometry?.wallMount?.allowInterior !== false,
      wallAllowExterior: bp.geometry?.wallMount?.allowExterior !== false,
      geometryExtras: { ...(bp.geometry || {}) },
      faces:      { ...(bp.geometry?.faces || {}) },
      states: (bp.states || []).map(s => ({
        id:           s.id,
        name:         s.name || '',
        opacity:      s.visual_override?.opacity ?? 1.0,
        face_overrides: { ...(s.visual_override?.face_overrides || {}) },
      })),
      interactions: (bp.interactions || []).map(i => {
        const isDisplacement = i.type === 'displacement' || i.move_type === 'displacement'
        if (isDisplacement) {
          return {
            id:               i.id            || `inter_${Date.now()}`,
            type:             'displacement',
            attribute_id:     i.attribute_id  || 'FOR',
            difficulty_dc:    i.difficulty_dc ?? 0,
            dmax_override:    i.dmax_override ?? null,
            range:            i.range         ?? 1,
            required_state_ids: i.required_state_ids || [],
          }
        }
        return {
          id:                 i.id            || `inter_${Date.now()}`,
          type:               'skillcheck',
          action_label:       i.action_label  || '',
          skill_id:           i.skill_id      || '',
          attribute_id:       i.attribute_id  || '',
          difficulty_dc:      i.difficulty_dc ?? 0,
          target_state_id:    i.target_state_id ?? 0,
          range:              i.range         ?? 1.5,
          required_state_ids: i.required_state_ids || [],
        }
      }),
    })
    setBpError(null)
    setEditingBp(bp)
  }, [])

  // ─── Faces base ───────────────────────────────────────────────────────────
  const handlePickFace = useCallback((faceName, filePath) => {
    setForm(prev => ({ ...prev, faces: { ...prev.faces, [faceName]: filePath } }))
    setPickerFace(null)
  }, [])

  const handleClearFace = useCallback((faceName) => {
    setForm(prev => { const f = { ...prev.faces }; delete f[faceName]; return { ...prev, faces: f } })
  }, [])

  // ─── États ────────────────────────────────────────────────────────────────
  const addState = useCallback(() => {
    setForm(prev => ({
      ...prev,
      states: [...prev.states, { id: prev.states.length, name: '', opacity: 1.0, face_overrides: {} }],
    }))
  }, [])

  const updateState = useCallback((idx, field, value) => {
    setForm(prev => ({
      ...prev,
      states: prev.states.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }))
  }, [])

  const removeState = useCallback((idx) => {
    setForm(prev => {
      const stateId = prev.states[idx].id
      const referenced = prev.interactions.some(inter =>
        (inter.required_state_ids || []).includes(stateId) || inter.target_state_id === stateId
      )
      if (referenced) {
        setStateWarn(t('builder.stateReferenced', { name: prev.states[idx].name || stateId }))
        return prev
      }
      return { ...prev, states: prev.states.filter((_, i) => i !== idx) }
    })
  }, [t])

  // ─── Face overrides états ─────────────────────────────────────────────────
  const handlePickFaceOverride = useCallback((stateIdx, faceName, filePath) => {
    setForm(prev => ({
      ...prev,
      states: prev.states.map((s, i) =>
        i === stateIdx ? { ...s, face_overrides: { ...s.face_overrides, [faceName]: filePath } } : s
      ),
    }))
    setPickerFace(null)
  }, [])

  const handleClearFaceOverride = useCallback((stateIdx, faceName) => {
    setForm(prev => ({
      ...prev,
      states: prev.states.map((s, i) =>
        i === stateIdx ? { ...s, face_overrides: { ...s.face_overrides, [faceName]: null } } : s
      ),
    }))
    setPickerFace(null)
  }, [])

  // ─── Interactions ─────────────────────────────────────────────────────────
  const addInteraction = useCallback(() => {
    setForm(prev => ({
      ...prev,
      interactions: [...prev.interactions, {
        id:                 `inter_${Date.now()}`,
        type:               'skillcheck',
        action_label:       '',
        skill_id:           '',
        attribute_id:       '',
        difficulty_dc:      0,
        target_state_id:    0,
        range:              1.5,
        required_state_ids: [],
        dmax_override:      null,
      }],
    }))
  }, [])

  const updateInteraction = useCallback((idx, field, value) => {
    setForm(prev => ({
      ...prev,
      interactions: prev.interactions.map((inter, i) => i === idx ? { ...inter, [field]: value } : inter),
    }))
  }, [])

  const removeInteraction = useCallback((idx) => {
    setForm(prev => ({ ...prev, interactions: prev.interactions.filter((_, i) => i !== idx) }))
  }, [])

  const toggleRequiredState = useCallback((interIdx, stateId) => {
    setForm(prev => ({
      ...prev,
      interactions: prev.interactions.map((inter, i) => {
        if (i !== interIdx) return inter
        const cur = inter.required_state_ids || []
        return {
          ...inter,
          required_state_ids: cur.includes(stateId) ? cur.filter(id => id !== stateId) : [...cur, stateId],
        }
      }),
    }))
  }, [])

  // ─── Sauvegarde ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.label.trim()) { setBpError(t('builder.errorNameRequired')); return }
    setSaving(true); setBpError(null)
    try {
      const geometry = {
        ...form.geometryExtras,
        width:  Number(form.width)  || 1,
        height: Number(form.height) || 1,
        depth:  Number(form.depth)  || 1,
        faces:  form.appearance === 'voxel' ? form.faces : {},
        placementMode: form.placementMode === 'wall' ? 'wall' : 'free',
        origin: form.placementMode === 'wall' ? 'wall-back-center' : 'floor-center',
      }
      if (geometry.placementMode === 'wall') {
        geometry.wallMount = {
          defaultBottomHeight: Number.isFinite(Number(form.wallDefaultBottomHeight))
            ? Number(form.wallDefaultBottomHeight)
            : 1,
          allowInterior: form.wallAllowInterior !== false,
          allowExterior: form.wallAllowExterior !== false,
        }
      } else {
        delete geometry.wallMount
      }
      const states = form.states.map(s => ({
        id: s.id, name: s.name,
        is_blocking: false, is_transparent: false,
        visual_override: { opacity: Number(s.opacity), face_overrides: s.face_overrides },
      }))
      const interactions = form.interactions.map(inter => {
        if (inter.type === 'displacement') {
          return {
            id:                 inter.id,
            type:               'displacement',
            action_label:       'Déplacer',           // fixe — jamais configurable
            move_type:          'displacement',
            attribute_id:       inter.attribute_id || 'FOR',
            skill_id:           null,
            difficulty_dc:      Number(inter.difficulty_dc),
            target_state_id:    null,
            range:              Number(inter.range),
            required_state_ids: inter.required_state_ids,
            dmax_override:      (inter.dmax_override !== null && inter.dmax_override !== '')
              ? Number(inter.dmax_override) : null,
          }
        }
        return {
          id:                 inter.id,
          type:               'skillcheck',
          action_label:       inter.action_label,
          skill_id:           inter.skill_id   || null,
          attribute_id:       inter.attribute_id || null,
          difficulty_dc:      Number(inter.difficulty_dc),
          target_state_id:    inter.target_state_id,
          range:              Number(inter.range),
          required_state_ids: inter.required_state_ids,
          move_type:          null,
          dmax_override:      null,
        }
      })
      const body = {
        label:   form.label.trim(),
        glb_url: form.appearance === 'glb' ? (form.glb_url || null) : null,
        geometry, states, interactions,
        pack_id: selectedPack.id,
      }
      if (editingBp === 'new') {
        const res = await api.post('/entity-blueprints', body)
        const updated = [...blueprints, res.data.blueprint]
        setBlueprints(updated)
        onCountChange?.(updated.length)
        setEditingBp(res.data.blueprint)
      } else {
        const res = await api.put(`/entity-blueprints/${editingBp.id}`, body)
        const updated = blueprints.map(b => b.id === editingBp.id ? res.data.blueprint : b)
        setBlueprints(updated)
        setEditingBp(res.data.blueprint)
      }
    } catch (err) {
      setBpError(err.response?.data?.error || t('common.error'))
    } finally { setSaving(false) }
  }, [form, editingBp, selectedPack, blueprints, onCountChange, t])

  // ─── Dépréciation ─────────────────────────────────────────────────────────
  const handleDeprecate = useCallback(async (bp) => {
    try {
      const res = await api.put(`/entity-blueprints/${bp.id}`, { deprecated: !bp.deprecated })
      setBlueprints(prev => prev.map(b => b.id === bp.id ? res.data.blueprint : b))
      if (editingBp && editingBp !== 'new' && editingBp.id === bp.id) setEditingBp(res.data.blueprint)
    } catch { setBpError(t('common.error')) }
  }, [editingBp, t])

  // ─── Upload GLB ───────────────────────────────────────────────────────────
  const [uploadingGlb, setUploadingGlb] = useState(false)
  const handleUploadGlb = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editingBp || editingBp === 'new') return
    setUploadingGlb(true)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(
        `/entity-blueprints/${editingBp.id}/upload-glb`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setBlueprints(prev => prev.map(b => b.id === editingBp.id ? res.data.blueprint : b))
      setEditingBp(res.data.blueprint)
      setForm(prev => ({ ...prev, glb_url: res.data.blueprint.glb_url || '' }))
    } catch (err) {
      setBpError(err.response?.data?.error || t('common.error'))
    } finally { setUploadingGlb(false); e.target.value = '' }
  }, [editingBp, t])

  // ─── Suppression ──────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async (bpId) => {
    setDeleting(true)
    try {
      await api.delete(`/entity-blueprints/${bpId}`)
      const updated = blueprints.filter(b => b.id !== bpId)
      setBlueprints(updated)
      onCountChange?.(updated.length)
      if (editingBp && editingBp !== 'new' && editingBp.id === bpId) setEditingBp(null)
      setDeleteConfirm(null)
    } catch (err) {
      setBpError(err.response?.status === 409
        ? t('builder.errorBpInUse')
        : (err.response?.data?.error || t('common.error'))
      )
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }, [blueprints, editingBp, onCountChange, t])

  // ─── Picker dispatch ──────────────────────────────────────────────────────
  const currentPickerPath = pickerFace
    ? pickerFace.section === 'base'
      ? form.faces[pickerFace.faceName]
      : form.states[pickerFace.stateIdx]?.face_overrides[pickerFace.faceName]
    : null

  const handlePickerPick = useCallback((filePath) => {
    if (!pickerFace) return
    if (pickerFace.section === 'base') handlePickFace(pickerFace.faceName, filePath)
    else handlePickFaceOverride(pickerFace.stateIdx, pickerFace.faceName, filePath)
  }, [pickerFace, handlePickFace, handlePickFaceOverride])

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loadingBp) return <p style={{ ...S.muted, padding: '16px 24px' }}>{t('common.loading')}</p>

  return (
    <div style={S.voxelLayout}>

      {/* ── Liste blueprints ─────────────────────────────────────────────── */}
      <div style={S.voxelList}>
        {isOwner && (
          <button style={{ ...S.btnPrimary, marginBottom: '8px', fontSize: '12px' }} onClick={startNew}>
            {t('builder.newEntity')}
          </button>
        )}
        {blueprints.length === 0 && <p style={S.muted}>{t('builder.noEntities')}</p>}
        {blueprints.map(bp => {
          const isActive = editingBp && editingBp !== 'new' && editingBp.id === bp.id
          return (
            <div key={bp.id}
              style={{ ...S.voxelItem, ...(isActive ? S.voxelItemActive : {}), ...(bp.deprecated ? { opacity: 0.45 } : {}) }}
              onClick={() => startEdit(bp)}
            >
              <div style={S.voxelItemInfo}>
                <span style={S.voxelItemLabel}>{bp.label}</span>
                {bp.deprecated && <span style={S.deprecatedBadge}>{t('builder.deprecated')}</span>}
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {bp.glb_url ? 'GLB' : 'Voxel'} · {(bp.states || []).length} {t('builder.statesCount')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      <div style={S.builder}>
        {!editingBp && (
          <div style={S.builderEmpty}>
            <p style={S.muted}>{isOwner ? t('builder.clickToEditEntity') : t('builder.selectEntity')}</p>
          </div>
        )}

        {editingBp && (
          <div style={S.builderContent}>

            {bpError && <p style={S.fieldError}>{bpError}</p>}
            {stateWarn && <div style={S.warnBanner} onClick={() => setStateWarn(null)}>⚠ {stateWarn} ✕</div>}

            {/* ── Nom ────────────────────────────────────────────────────── */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('builder.fieldName')}</label>
              <input style={S.input} value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder={t('builder.placeholderEntityName')} disabled={!isOwner} />
            </div>

            {/* ── Dimensions ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {[{ field: 'width', labelKey: 'builder.width' }, { field: 'height', labelKey: 'builder.height' }, { field: 'depth', labelKey: 'builder.depth' }].map(({ field, labelKey }) => (
                <div key={field} style={{ ...S.fieldGroup, flex: 1 }}>
                  <label style={S.fieldLabel}>{t(labelKey)}</label>
                  <input type="number" min="0.05" max="20" step="0.05" style={S.input}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) || 1 }))}
                    disabled={!isOwner} />
                </div>
              ))}
            </div>

            {/* ── Mode de pose ──────────────────────────────────────────── */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Mode de pose</label>
              <select
                style={S.input}
                value={form.placementMode}
                onChange={e => setForm(p => ({ ...p, placementMode: e.target.value }))}
                disabled={!isOwner}
              >
                <option value="free">Libre — posé sur le sol</option>
                <option value="wall">Mural — accroché obligatoirement à un mur</option>
              </select>
              {form.placementMode === 'wall' && (
                <>
                  <label style={{ ...S.fieldLabel, marginTop: '6px' }}>Hauteur basse conseillée</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.25"
                    style={S.input}
                    value={form.wallDefaultBottomHeight}
                    onChange={e => setForm(p => ({ ...p, wallDefaultBottomHeight: e.target.value }))}
                    disabled={!isOwner}
                  />
                  <p style={S.fieldHint}>Le pivot du GLB doit être au centre du dos, au niveau de son bord inférieur.</p>
                </>
              )}
            </div>

            {/* ── Apparence ──────────────────────────────────────────────── */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('builder.fieldAppearance')}</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {[{ value: 'voxel', labelKey: 'builder.appearanceVoxel' }, { value: 'glb', labelKey: 'builder.appearanceGlb' }].map(opt => (
                  <label key={opt.value} style={{ ...S.geoRow, cursor: isOwner ? 'pointer' : 'default' }}>
                    <input type="radio" name="appearance"
                      checked={form.appearance === opt.value}
                      onChange={() => isOwner && setForm(p => ({ ...p, appearance: opt.value }))}
                      disabled={!isOwner} style={S.checkbox} />
                    <span style={S.geoLabel}>{t(opt.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.appearance === 'glb' && (
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>{t('builder.appearanceGlb')}</label>
                {form.glb_url
                  ? <p style={S.fieldHint}>{t('builder.glbCurrent')} {form.glb_url.split('?')[0].split('/').pop()}</p>
                  : <p style={S.fieldHint}>{t('builder.glbNone')}</p>
                }
                {isOwner && editingBp !== 'new' && (
                  <label style={{ ...S.btnSecondary, display: 'inline-block', cursor: 'pointer' }}>
                    {uploadingGlb ? t('common.loading') : form.glb_url ? t('builder.glbReplace') : t('builder.glbUpload')}
                    <input type="file" accept=".glb,model/gltf-binary,application/octet-stream"
                      style={{ display: 'none' }} onChange={handleUploadGlb} disabled={uploadingGlb} />
                  </label>
                )}
                {isOwner && editingBp === 'new' && (
                  <p style={S.fieldHint}>{t('builder.glbSaveFirst')}</p>
                )}
              </div>
            )}

            {form.appearance === 'voxel' && (
              <div style={S.builderRow}>
                <div>
                  <p style={{ ...S.fieldLabel, marginBottom: '8px' }}>{t('builder.facesLabel')}</p>
                  <div style={S.facesGrid}>
                    {FACE_NAMES.map(faceName => {
                      const filePath = form.faces[faceName]
                      const url = filePath
                        ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${filePath}`
                        : null
                      return (
                        <div key={faceName} style={S.faceSlot}>
                          <span style={S.faceLabel}>{t(`builder.faces.${faceName}`)}</span>
                          <div style={{ ...S.faceBox, ...(isOwner ? S.faceBoxClickable : {}) }}
                            onClick={() => isOwner && setPickerFace({ section: 'base', faceName })}>
                            {url
                              ? <img src={url} alt={faceName} style={S.faceImg} />
                              : <span style={S.facePlus}>{isOwner ? '+' : '—'}</span>}
                          </div>
                          {isOwner && filePath && (
                            <button style={S.faceClear} onClick={() => handleClearFace(faceName)}>✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={S.rightCol}>
                  <div style={S.previewBox}>
                    <EntityPreview faces={form.faces} packId={selectedPack.id}
                      width={form.width} height={form.height} depth={form.depth} />
                  </div>
                </div>
              </div>
            )}

            {/* ── États ──────────────────────────────────────────────────── */}
            <div style={S.sectionBlock}>
              <div style={S.sectionBlockHeader}>
                <span style={S.fieldLabel}>{t('builder.sectionStates')}</span>
                {isOwner && (
                  <button style={{ ...S.btnSecondary, fontSize: '11px', padding: '3px 10px' }} onClick={addState}>
                    {t('builder.addState')}
                  </button>
                )}
              </div>
              {form.states.length === 0 && <p style={S.muted}>{t('builder.noStates')}</p>}
              {form.states.map((state, idx) => (
                <div key={idx} style={S.stateBlock}>
                  <div style={S.stateHeader}>
                    <input style={{ ...S.input, flex: 1, fontSize: '12px', padding: '4px 8px' }}
                      value={state.name}
                      onChange={e => updateState(idx, 'name', e.target.value)}
                      placeholder={t('builder.statePlaceholder', { idx })} disabled={!isOwner} />
                    <label style={{ ...S.geoRow, marginLeft: '8px', marginBottom: 0 }}>
                      <span style={{ ...S.geoLabel, fontSize: '11px' }}>{t('builder.opacity')}</span>
                      <input type="number" min="0" max="1" step="0.1"
                        style={{ ...S.input, width: '56px', fontSize: '11px', padding: '3px 6px' }}
                        value={state.opacity}
                        onChange={e => updateState(idx, 'opacity', e.target.value)}
                        disabled={!isOwner} />
                    </label>
                    {isOwner && (
                      <button style={{ ...S.btnGhost, color: 'var(--color-danger)', fontSize: '11px' }}
                        onClick={() => removeState(idx)}>{t('common.delete')}</button>
                    )}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ ...S.fieldHint, marginBottom: '6px' }}>{t('builder.stateTexturesHint')}</p>
                    <div style={{ ...S.facesGrid, gridTemplateColumns: 'repeat(6, 52px)' }}>
                      {FACE_NAMES.map(faceName => {
                        const overridePath = state.face_overrides[faceName]
                        const hasOverride = overridePath !== undefined
                        const isNull = overridePath === null
                        const url = overridePath && !isNull
                          ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${overridePath}`
                          : null
                        return (
                          <div key={faceName} style={S.faceSlot}>
                            <span style={S.faceLabel}>{t(`builder.faces.${faceName}`)}</span>
                            <div style={{
                              ...S.faceBox, width: '44px', height: '44px',
                              ...(isOwner ? S.faceBoxClickable : {}),
                              ...(isNull ? { opacity: 0.3 } : {}),
                            }}
                              onClick={() => isOwner && setPickerFace({ section: 'state', stateIdx: idx, faceName })}>
                              {url
                                ? <img src={url} alt={faceName} style={S.faceImg} />
                                : isNull
                                  ? <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('builder.faceInvisible')}</span>
                                  : <span style={S.facePlus}>{isOwner ? '+' : '—'}</span>}
                            </div>
                            {isOwner && hasOverride && (
                              <button style={S.faceClear}
                                onClick={() => handleClearFaceOverride(idx, faceName)}>✕</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Interactions ───────────────────────────────────────────── */}
            <div style={S.sectionBlock}>
              <div style={S.sectionBlockHeader}>
                <span style={S.fieldLabel}>{t('builder.sectionInteractions')}</span>
                {isOwner && (
                  <button style={{ ...S.btnSecondary, fontSize: '11px', padding: '3px 10px' }} onClick={addInteraction}>
                    {t('builder.addInteraction')}
                  </button>
                )}
              </div>
              {form.interactions.length === 0 && <p style={S.muted}>{t('builder.noInteractions')}</p>}
              {form.states.length === 0 && form.interactions.length > 0 && (
                <p style={{ ...S.fieldHint, color: 'var(--color-danger)' }}>
                  {t('builder.interactionsNeedStates')}
                </p>
              )}
              {form.interactions.map((inter, idx) => (
                <div key={idx} style={S.stateBlock}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ ...S.fieldLabel, fontSize: '11px' }}>{t('builder.interactionLabel', { n: idx + 1 })}</span>
                      <select
                        style={{ ...S.input, fontSize: '11px', width: 'auto' }}
                        value={inter.type || 'skillcheck'}
                        onChange={e => {
                          const newType = e.target.value
                          setForm(prev => ({
                            ...prev,
                            interactions: prev.interactions.map((it, i) => {
                              if (i !== idx) return it
                              if (newType === 'displacement') {
                                return {
                                  id:                 it.id,
                                  type:               'displacement',
                                  attribute_id:       it.attribute_id || 'FOR',
                                  difficulty_dc:      it.difficulty_dc ?? 0,
                                  dmax_override:      null,
                                  range:              1,
                                  required_state_ids: it.required_state_ids || [],
                                }
                              }
                              return {
                                id:                 it.id,
                                type:               'skillcheck',
                                action_label:       it.action_label || '',
                                skill_id:           '',
                                attribute_id:       '',
                                difficulty_dc:      it.difficulty_dc ?? 0,
                                target_state_id:    0,
                                range:              1.5,
                                required_state_ids: it.required_state_ids || [],
                                dmax_override:      null,
                              }
                            }),
                          }))
                        }}
                        disabled={!isOwner}>
                        <option value="skillcheck">{t('builder.typeSkillcheck')}</option>
                        <option value="displacement">{t('builder.typeDisplacement')}</option>
                      </select>
                    </div>
                    {isOwner && (
                      <button style={{ ...S.btnGhost, color: 'var(--color-danger)', fontSize: '11px' }}
                        onClick={() => removeInteraction(idx)}>{t('common.delete')}</button>
                    )}
                  </div>

                  {(inter.type === 'skillcheck' || !inter.type) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}>
                        <label style={S.fieldHint}>{t('builder.skillcheckActionLabel')}</label>
                        <input style={{ ...S.input, fontSize: '11px' }}
                          value={inter.action_label || ''}
                          onChange={e => updateInteraction(idx, 'action_label', e.target.value)}
                          placeholder={t('builder.placeholderActionLabel')}
                          disabled={!isOwner} />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldSkill')}</label>
                        <select style={{ ...S.input, fontSize: '11px' }}
                          value={inter.skill_id || ''}
                          onChange={e => updateInteraction(idx, 'skill_id', e.target.value)}
                          disabled={!isOwner}>
                          <option value="">{t('builder.skillNone')}</option>
                          {skills.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldAttribute')}</label>
                        <p style={{ ...S.fieldHint, color: 'var(--text-muted)', marginBottom: '2px' }}>{t('builder.attributeHint')}</p>
                        <select style={{ ...S.input, fontSize: '11px' }}
                          value={inter.attribute_id || ''}
                          onChange={e => updateInteraction(idx, 'attribute_id', e.target.value)}
                          disabled={!isOwner}>
                          <option value="">{t('builder.attributeNone')}</option>
                          <option value="FOR">{t('charSheet.attr.FOR')} (FOR)</option>
                          <option value="CON">{t('charSheet.attr.CON')} (CON)</option>
                          <option value="COO">{t('charSheet.attr.COO')} (COO)</option>
                          <option value="ADA">{t('charSheet.attr.ADA')} (ADA)</option>
                          <option value="PER">{t('charSheet.attr.PER')} (PER)</option>
                          <option value="INT">{t('charSheet.attr.INT')} (INT)</option>
                          <option value="VOL">{t('charSheet.attr.VOL')} (VOL)</option>
                          <option value="PRE">{t('charSheet.attr.PRE')} (PRE)</option>
                        </select>
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldDifficulty')}</label>
                        <input type="number" style={{ ...S.input, fontSize: '11px' }}
                          value={inter.difficulty_dc ?? 0}
                          onChange={e => updateInteraction(idx, 'difficulty_dc', Number(e.target.value))}
                          disabled={!isOwner} />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldRange')}</label>
                        <input type="number" step="0.5" style={{ ...S.input, fontSize: '11px' }}
                          value={inter.range ?? 1.5}
                          onChange={e => updateInteraction(idx, 'range', Number(e.target.value))}
                          disabled={!isOwner} />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldTargetState')}</label>
                        <select style={{ ...S.input, fontSize: '11px' }}
                          value={inter.target_state_id ?? 0}
                          onChange={e => updateInteraction(idx, 'target_state_id', Number(e.target.value))}
                          disabled={!isOwner}>
                          {form.states.map(s => (
                            <option key={s.id} value={s.id}>{s.name || t('builder.stateFallbackName', { id: s.id })}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {inter.type === 'displacement' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldAttributeLinked')}</label>
                        <select style={{ ...S.input, fontSize: '11px' }}
                          value={inter.attribute_id || 'FOR'}
                          onChange={e => updateInteraction(idx, 'attribute_id', e.target.value)}
                          disabled={!isOwner}>
                          <option value="FOR">{t('charSheet.attr.FOR')} (FOR)</option>
                          <option value="CON">{t('charSheet.attr.CON')} (CON)</option>
                          <option value="COO">{t('charSheet.attr.COO')} (COO)</option>
                          <option value="ADA">{t('charSheet.attr.ADA')} (ADA)</option>
                          <option value="PER">{t('charSheet.attr.PER')} (PER)</option>
                          <option value="INT">{t('charSheet.attr.INT')} (INT)</option>
                          <option value="VOL">{t('charSheet.attr.VOL')} (VOL)</option>
                          <option value="PRE">{t('charSheet.attr.PRE')} (PRE)</option>
                        </select>
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldDifficulty')}</label>
                        <input type="number" style={{ ...S.input, fontSize: '11px' }}
                          value={inter.difficulty_dc ?? 0}
                          onChange={e => updateInteraction(idx, 'difficulty_dc', Number(e.target.value))}
                          disabled={!isOwner} />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldDmaxOverride')}</label>
                        <input type="number" min="1" max="5" step="1"
                          style={{ ...S.input, fontSize: '11px' }}
                          value={inter.dmax_override ?? ''}
                          onChange={e => updateInteraction(idx, 'dmax_override',
                            e.target.value === '' ? null : Number(e.target.value))}
                          placeholder={t('builder.placeholderUnlimited')}
                          disabled={!isOwner} />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.fieldHint}>{t('builder.fieldRange')}</label>
                        <input type="number" step="0.5" style={{ ...S.input, fontSize: '11px' }}
                          value={inter.range ?? 1}
                          onChange={e => updateInteraction(idx, 'range', Number(e.target.value))}
                          disabled={!isOwner} />
                      </div>
                    </div>
                  )}

                  {form.states.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={S.fieldHint}>{t('builder.statesRequired')}</p>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {form.states.map(s => (
                          <label key={s.id} style={{ ...S.geoRow, marginBottom: 0 }}>
                            <input type="checkbox"
                              checked={(inter.required_state_ids || []).includes(s.id)}
                              onChange={() => isOwner && toggleRequiredState(idx, s.id)}
                              disabled={!isOwner} style={S.checkbox} />
                            <span style={{ ...S.geoLabel, fontSize: '11px' }}>{s.name || t('builder.stateFallbackName', { id: s.id })}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ ...S.fieldHint, color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'monospace', fontSize: '10px' }}>
                    id : {inter.id}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            {isOwner && (
              <div style={S.builderFooter}>
                <button style={S.btnGhost} onClick={() => setEditingBp(null)}>{t('common.cancel')}</button>
                {editingBp !== 'new' && (
                  <>
                    <button style={S.btnSecondary} onClick={() => handleDeprecate(editingBp)}>
                      {editingBp.deprecated ? t('texturePacks.textureRestore') : t('texturePacks.textureDeprecate')}
                    </button>
                    <button style={S.btnDanger} onClick={() => setDeleteConfirm(editingBp.id)}>
                      {t('common.delete')}
                    </button>
                  </>
                )}
                <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Picker PNG ────────────────────────────────────────────────────── */}
      {pickerFace && (
        <div style={S.overlay} onClick={() => setPickerFace(null)}>
          <div style={S.pickerModal} onClick={e => e.stopPropagation()}>
            <div style={S.pickerHeader}>
              <span style={S.pickerTitle}>{t('builder.pickerTitle', { face: t(`builder.faces.${pickerFace.faceName}`) })}</span>
              <button style={S.btnGhost} onClick={() => setPickerFace(null)}>✕</button>
            </div>
            {packFiles.length === 0
              ? <p style={S.muted}>{t('builder.noPngEntities')}</p>
              : (
                <div style={S.pickerGrid}>
                  {packFiles.map(file => {
                    const url = `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${file.path}`
                    const isSelected = currentPickerPath === file.path
                    return (
                      <div key={file.path}
                        style={{ ...S.pickerItem, ...(isSelected ? S.pickerItemSelected : {}) }}
                        onClick={() => handlePickerPick(file.path)}>
                        <img src={url} alt={file.path} style={S.pickerImg} />
                        <span style={S.pickerName}>{file.path.replace(/\.[^.]+$/, '').split('/').pop()}</span>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ── Modale confirmation suppression ─────────────────────────────── */}
      {deleteConfirm && (
        <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('builder.deleteTitle')}</h2>
            <p style={S.modalText}>{t('builder.deleteText')}</p>
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button style={S.btnDanger} onClick={() => handleDelete(deleteConfirm)} disabled={deleting}>
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  voxelLayout: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  voxelList: { width: '170px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' },
  voxelItem: { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', border: '1px solid transparent' },
  voxelItemActive: { backgroundColor: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.3)' },
  voxelItemInfo: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  voxelItemLabel: { fontSize: '11px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deprecatedBadge: { fontSize: '9px', color: 'var(--color-danger)' },

  builder: { flex: 1, overflowY: 'auto', padding: '14px 18px' },
  builderEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  builderContent: { display: 'flex', flexDirection: 'column', gap: '14px' },
  builderRow: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
  builderFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' },

  facesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 60px)', gap: '8px' },
  faceSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  faceLabel: { fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' },
  faceBox: { width: '52px', height: '52px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceBoxClickable: { cursor: 'pointer', borderStyle: 'dashed' },
  faceImg: { width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' },
  facePlus: { fontSize: '18px', color: 'var(--text-muted)' },
  faceClear: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '9px', cursor: 'pointer', padding: 0 },

  rightCol: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '150px' },
  previewBox: { width: '150px', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0 },
  previewPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1115' },

  sectionBlock: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' },
  sectionBlockHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  stateBlock: { padding: '8px 10px', backgroundColor: 'var(--bg-elevated)', borderRadius: '5px', border: '1px solid var(--border-subtle)' },
  stateHeader: { display: 'flex', alignItems: 'center', gap: '8px' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  pickerModal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px', width: '500px', maxWidth: '92vw', maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: '10px' },
  pickerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  pickerTitle: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  pickerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px', overflowY: 'auto' },
  pickerItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '5px', borderRadius: '6px', cursor: 'pointer', border: '2px solid transparent' },
  pickerItemSelected: { border: '2px solid #5b8dee', backgroundColor: 'rgba(91,141,238,0.1)' },
  pickerImg: { width: '60px', height: '60px', objectFit: 'cover', imageRendering: 'pixelated', borderRadius: '4px' },
  pickerName: { fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' },

  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', margin: 0 },
  fieldHint: { fontSize: '10px', color: 'var(--text-muted)', margin: 0 },
  fieldError: { fontSize: '12px', color: 'var(--color-danger)', margin: 0 },
  warnBanner: { backgroundColor: 'rgba(255,170,0,0.12)', border: '1px solid #ffaa00', borderRadius: '6px', padding: '7px 12px', color: '#ffaa00', fontSize: '12px', cursor: 'pointer' },
  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' },

  geoRow: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '4px' },
  checkbox: { width: '13px', height: '13px', accentColor: '#5b8dee', cursor: 'pointer' },
  geoLabel: { fontSize: '12px', color: 'var(--text-primary)' },

  btnPrimary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  btnSecondary: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { backgroundColor: 'rgba(224,92,92,0.15)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '6px 12px', color: 'var(--color-danger)', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  muted: { color: 'var(--text-muted)', fontSize: '12px' },
}
