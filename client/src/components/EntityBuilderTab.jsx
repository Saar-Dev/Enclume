import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame } from '@react-three/fiber'
import api from '../lib/api'
import { loadVoxelTextures } from '../lib/voxelTextures'

// ─── Constantes ───────────────────────────────────────────────────────────────
// Faces entité — 6 faces nommées (pas de face 'all' — les entités n'ont pas de fallback principal)
const FACE_NAMES = ['top', 'bottom', 'north', 'south', 'east', 'west']
const FACE_LABELS = {
  top: 'Dessus', bottom: 'Dessous',
  north: 'Nord', south: 'Sud',
  east: 'Est', west: 'Ouest',
}

const EMPTY_FORM = {
  label: '',
  appearance: 'voxel',   // 'voxel' | 'glb'
  glb_url: '',
  width: 1,
  height: 1,
  depth: 1,
  faces: {},             // { faceName: "uuid.png" } — chemins PNG relatifs au pack
  states: [],            // [{ id, name, opacity, face_overrides: { faceName: "uuid.png"|null } }]
  interactions: [],      // [{ id, action_label, skill_id, difficulty_dc, required_state_ids[], target_state_id, range }]
}

// ─── Aperçu 3D ────────────────────────────────────────────────────────────────
function RotatingEntity({ textureMaterials, width, height, depth }) {
  const groupRef = useRef()
  const w = width || 1
  const h = height || 1
  const d = depth || 1
  // Ordre faces BoxGeometry P32 : east(0), west(1), top(2), bottom(3), south(4), north(5)
  const FACE_ORDER_3D = ['east', 'west', 'top', 'bottom', 'south', 'north']
  const FACE_NAMES_3D = ['east', 'west', 'top', 'bottom', 'south', 'north']

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.8
  })
  if (!textureMaterials) return null
  return (
    <group ref={groupRef} position={[-w/2, -h/2, -d/2]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        {FACE_ORDER_3D.map((faceName, i) => {
          const mat = textureMaterials?.faceMaterials?.[i]
          if (!mat) return <meshBasicMaterial key={i} attach={`material-${i}`} color={0x334155} />
          return <meshLambertMaterial key={i} attach={`material-${i}`} {...mat} />
        })}
      </mesh>
    </group>
  )
}

function EntityPreview({ faces, packId, width, height, depth }) {
  const [materials, setMaterials] = useState(null)

  useEffect(() => {
    const hasAnyFace = Object.values(faces).some(v => v !== null && v !== undefined && v !== '')
    if (!packId || !hasAnyFace) { setMaterials(null); return }
    const fakeTex = [{ id: 0, pack_id: packId, pack_name: '', label: 'preview', faces }]
    loadVoxelTextures(fakeTex).then(result => setMaterials(result[0] || null))
  }, [faces, packId])

  if (!materials) {
    return (
      <div style={S.previewPlaceholder}>
        <span style={S.muted}>Aperçu</span>
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
// Props :
//   selectedPack   : { id, name, label, tile_size, created_by }
//   packDetail     : { pack, categories, textures }
//   setPacks       : setter shell
//   packFiles      : fichiers PNG bruts du pack — source des faces
//   isOwner        : boolean
//   onCountChange  : callback(n) — notifie WorkshopPage du nombre de blueprints
export default function EntityBuilderTab({
  selectedPack,
  packDetail,
  setPacks,
  packFiles,
  isOwner,
  onCountChange,
}) {
  const { t } = useTranslation()

  const [blueprints, setBlueprints] = useState([])
  const [loadingBp, setLoadingBp] = useState(false)
  const [editingBp, setEditingBp] = useState(null) // null | 'new' | objet blueprint
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [bpError, setBpError] = useState(null)

  // Menu déroulant skill_id — chargé une seule fois
  const [skills, setSkills] = useState([])
  useEffect(() => {
    api.get('/char-ref/skills')
      .then(res => setSkills(res.data.skills || []))
      .catch(() => {}) // non bloquant
  }, [])

  // pickerFace : { section: 'base'|'state', faceName, stateIdx? } | null
  const [pickerFace, setPickerFace] = useState(null)
  const [stateWarn, setStateWarn] = useState(null)

  // Reset au changement de pack
  useEffect(() => { setEditingBp(null); setForm(EMPTY_FORM) }, [selectedPack?.id])

  // ─── Chargement blueprints ────────────────────────────────────────────────
  const loadBlueprints = useCallback(async () => {
    if (!selectedPack) return
    setLoadingBp(true)
    try {
      const res = await api.get(`/entity-blueprints/all?pack_id=${selectedPack.id}`)
      setBlueprints(res.data.blueprints)
      onCountChange?.(res.data.blueprints.length)
    } catch { setBpError('Erreur lors du chargement') }
    finally { setLoadingBp(false) }
  }, [selectedPack, onCountChange])

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
      faces:      { ...(bp.geometry?.faces || {}) },
      states: (bp.states || []).map(s => ({
        id:           s.id,
        name:         s.name || '',
        opacity:      s.visual_override?.opacity ?? 1.0,
        face_overrides: { ...(s.visual_override?.face_overrides || {}) },
      })),
      interactions: (bp.interactions || []).map(i => ({ ...i })),
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
        setStateWarn(`L'état "${prev.states[idx].name || stateId}" est référencé dans une interaction.`)
        return prev
      }
      return { ...prev, states: prev.states.filter((_, i) => i !== idx) }
    })
  }, [])

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
        id: `inter_${Date.now()}`,
        action_label: '', skill_id: '',
        difficulty_dc: 0, required_state_ids: [],
        target_state_id: 0, range: 1.5,
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
    if (!form.label.trim()) { setBpError('Un nom est requis'); return }
    setSaving(true); setBpError(null)
    try {
      const geometry = {
        width:  Number(form.width)  || 1,
        height: Number(form.height) || 1,
        depth:  Number(form.depth)  || 1,
        faces:  form.appearance === 'voxel' ? form.faces : {},
      }
      const states = form.states.map(s => ({
        id: s.id, name: s.name,
        is_blocking: false, is_transparent: false,
        visual_override: { opacity: Number(s.opacity), face_overrides: s.face_overrides },
      }))
      const interactions = form.interactions.map(inter => ({
        id: inter.id, action_label: inter.action_label, skill_id: inter.skill_id,
        difficulty_dc: Number(inter.difficulty_dc),
        required_state_ids: inter.required_state_ids,
        target_state_id: inter.target_state_id,
        range: Number(inter.range),
      }))
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
  }, [form, editingBp, selectedPack, t])

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
        ? 'Ce blueprint est utilisé sur des cartes — utilisez Désactiver.'
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
            + Nouvel élément
          </button>
        )}
        {blueprints.length === 0 && <p style={S.muted}>Aucun élément interactif</p>}
        {blueprints.map(bp => {
          const isActive = editingBp && editingBp !== 'new' && editingBp.id === bp.id
          return (
            <div key={bp.id}
              style={{ ...S.voxelItem, ...(isActive ? S.voxelItemActive : {}), ...(bp.deprecated ? { opacity: 0.45 } : {}) }}
              onClick={() => startEdit(bp)}
            >
              <div style={S.voxelItemInfo}>
                <span style={S.voxelItemLabel}>{bp.label}</span>
                {bp.deprecated && <span style={S.deprecatedBadge}>Désactivé</span>}
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {bp.glb_url ? 'GLB' : 'Voxel'} · {(bp.states || []).length} états
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
            <p style={S.muted}>{isOwner ? 'Cliquez sur un élément pour le modifier' : 'Sélectionnez un élément'}</p>
          </div>
        )}

        {editingBp && (
          <div style={S.builderContent}>

            {bpError && <p style={S.fieldError}>{bpError}</p>}
            {stateWarn && <div style={S.warnBanner} onClick={() => setStateWarn(null)}>⚠ {stateWarn} ✕</div>}

            {/* ── Nom ────────────────────────────────────────────────────── */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Nom</label>
              <input style={S.input} value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="ex: Porte de sas" disabled={!isOwner} />
            </div>

            {/* ── Dimensions ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {[{ field: 'width', label: 'Largeur' }, { field: 'height', label: 'Hauteur' }, { field: 'depth', label: 'Profondeur' }].map(({ field, label }) => (
                <div key={field} style={{ ...S.fieldGroup, flex: 1 }}>
                  <label style={S.fieldLabel}>{label}</label>
                  <input type="number" min="1" max="10" step="1" style={S.input}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) || 1 }))}
                    disabled={!isOwner} />
                </div>
              ))}
            </div>

            {/* ── Apparence ──────────────────────────────────────────────── */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Apparence</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {[{ value: 'voxel', label: 'Voxel (textures)' }, { value: 'glb', label: 'Modèle GLB' }].map(opt => (
                  <label key={opt.value} style={{ ...S.geoRow, cursor: isOwner ? 'pointer' : 'default' }}>
                    <input type="radio" name="appearance"
                      checked={form.appearance === opt.value}
                      onChange={() => isOwner && setForm(p => ({ ...p, appearance: opt.value }))}
                      disabled={!isOwner} style={S.checkbox} />
                    <span style={S.geoLabel}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.appearance === 'glb' && (
              <div style={S.fieldGroup}>
                <label style={S.fieldLabel}>Modèle GLB</label>
                {form.glb_url
                  ? <p style={S.fieldHint}>Fichier actuel : {form.glb_url.split('?')[0].split('/').pop()}</p>
                  : <p style={S.fieldHint}>Aucun modèle GLB chargé</p>
                }
                {isOwner && editingBp !== 'new' && (
                  <label style={{ ...S.btnSecondary, display: 'inline-block', cursor: 'pointer' }}>
                    {uploadingGlb ? t('common.loading') : form.glb_url ? 'Remplacer le GLB' : 'Uploader un GLB'}
                    <input type="file" accept=".glb,model/gltf-binary,application/octet-stream"
                      style={{ display: 'none' }} onChange={handleUploadGlb} disabled={uploadingGlb} />
                  </label>
                )}
                {isOwner && editingBp === 'new' && (
                  <p style={S.fieldHint}>Sauvegardez d'abord le blueprint, puis uploadez le GLB.</p>
                )}
              </div>
            )}

            {form.appearance === 'voxel' && (
              <div style={S.builderRow}>
                {/* Grille de faces — même pattern que VoxelBuilderTab */}
                <div>
                  <p style={{ ...S.fieldLabel, marginBottom: '8px' }}>Faces (cliquer pour assigner)</p>
                  <div style={S.facesGrid}>
                    {FACE_NAMES.map(faceName => {
                      const filePath = form.faces[faceName]
                      const url = filePath
                        ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${filePath}`
                        : null
                      return (
                        <div key={faceName} style={S.faceSlot}>
                          <span style={S.faceLabel}>{FACE_LABELS[faceName]}</span>
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

                {/* Aperçu 3D */}
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
                <span style={S.fieldLabel}>États</span>
                {isOwner && (
                  <button style={{ ...S.btnSecondary, fontSize: '11px', padding: '3px 10px' }} onClick={addState}>
                    + Ajouter un état
                  </button>
                )}
              </div>
              {form.states.length === 0 && <p style={S.muted}>Aucun état — l'élément sera statique.</p>}
              {form.states.map((state, idx) => (
                <div key={idx} style={S.stateBlock}>
                  <div style={S.stateHeader}>
                    <input style={{ ...S.input, flex: 1, fontSize: '12px', padding: '4px 8px' }}
                      value={state.name}
                      onChange={e => updateState(idx, 'name', e.target.value)}
                      placeholder={`État ${idx} — ex: Fermé`} disabled={!isOwner} />
                    <label style={{ ...S.geoRow, marginLeft: '8px', marginBottom: 0 }}>
                      <span style={{ ...S.geoLabel, fontSize: '11px' }}>Opacité</span>
                      <input type="number" min="0" max="1" step="0.1"
                        style={{ ...S.input, width: '56px', fontSize: '11px', padding: '3px 6px' }}
                        value={state.opacity}
                        onChange={e => updateState(idx, 'opacity', e.target.value)}
                        disabled={!isOwner} />
                    </label>
                    {isOwner && (
                      <button style={{ ...S.btnGhost, color: 'var(--color-danger)', fontSize: '11px' }}
                        onClick={() => removeState(idx)}>Supprimer</button>
                    )}
                  </div>
                  {/* Face overrides — même picker que faces de base */}
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ ...S.fieldHint, marginBottom: '6px' }}>Textures de remplacement pour cet état (optionnel)</p>
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
                            <span style={S.faceLabel}>{FACE_LABELS[faceName]}</span>
                            <div style={{
                              ...S.faceBox, width: '44px', height: '44px',
                              ...(isOwner ? S.faceBoxClickable : {}),
                              ...(isNull ? { opacity: 0.3 } : {}),
                            }}
                              onClick={() => isOwner && setPickerFace({ section: 'state', stateIdx: idx, faceName })}>
                              {url
                                ? <img src={url} alt={faceName} style={S.faceImg} />
                                : isNull
                                  ? <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>invisible</span>
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
                <span style={S.fieldLabel}>Interactions</span>
                {isOwner && (
                  <button style={{ ...S.btnSecondary, fontSize: '11px', padding: '3px 10px' }} onClick={addInteraction}>
                    + Ajouter une interaction
                  </button>
                )}
              </div>
              {form.interactions.length === 0 && <p style={S.muted}>Aucune interaction — l'élément sera décoratif.</p>}
              {form.states.length === 0 && form.interactions.length > 0 && (
                <p style={{ ...S.fieldHint, color: 'var(--color-danger)' }}>
                  ⚠ Définissez d'abord des états avant de configurer les interactions.
                </p>
              )}
              {form.interactions.map((inter, idx) => (
                <div key={idx} style={S.stateBlock}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ ...S.fieldLabel, fontSize: '11px' }}>Interaction {idx + 1}</span>
                    {isOwner && (
                      <button style={{ ...S.btnGhost, color: 'var(--color-danger)', fontSize: '11px' }}
                        onClick={() => removeInteraction(idx)}>Supprimer</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>Identifiant (unique)</label>
                      <input style={{ ...S.input, fontSize: '11px' }} value={inter.id}
                        onChange={e => updateInteraction(idx, 'id', e.target.value)}
                        placeholder="ex: forcer" disabled={!isOwner} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>Label affiché au joueur</label>
                      <input style={{ ...S.input, fontSize: '11px' }} value={inter.action_label}
                        onChange={e => updateInteraction(idx, 'action_label', e.target.value)}
                        placeholder="ex: Forcer la porte" disabled={!isOwner} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>Compétence requise</label>
                      <select style={{ ...S.input, fontSize: '11px' }} value={inter.skill_id}
                        onChange={e => updateInteraction(idx, 'skill_id', e.target.value)}
                        disabled={!isOwner}>
                        <option value="">— Aucune —</option>
                        {skills.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>Modificateur de difficulté</label>
                      <p style={{ ...S.fieldHint, color: 'var(--text-muted)', marginBottom: '2px' }}>+5 Facile · 0 Moyen · -5 Difficile</p>
                      <input type="number" style={{ ...S.input, fontSize: '11px' }} value={inter.difficulty_dc}
                        onChange={e => updateInteraction(idx, 'difficulty_dc', Number(e.target.value))}
                        disabled={!isOwner} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>État cible (succès)</label>
                      <select style={{ ...S.input, fontSize: '11px' }} value={inter.target_state_id}
                        onChange={e => updateInteraction(idx, 'target_state_id', Number(e.target.value))}
                        disabled={!isOwner}>
                        {form.states.map(s => (
                          <option key={s.id} value={s.id}>{s.name || `État ${s.id}`}</option>
                        ))}
                      </select>
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.fieldHint}>Portée (unités voxel)</label>
                      <input type="number" step="0.5" style={{ ...S.input, fontSize: '11px' }} value={inter.range}
                        onChange={e => updateInteraction(idx, 'range', Number(e.target.value))}
                        disabled={!isOwner} />
                    </div>
                  </div>
                  {form.states.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={S.fieldHint}>États depuis lesquels cette interaction est disponible</p>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {form.states.map(s => (
                          <label key={s.id} style={{ ...S.geoRow, marginBottom: 0 }}>
                            <input type="checkbox"
                              checked={(inter.required_state_ids || []).includes(s.id)}
                              onChange={() => isOwner && toggleRequiredState(idx, s.id)}
                              disabled={!isOwner} style={S.checkbox} />
                            <span style={{ ...S.geoLabel, fontSize: '11px' }}>{s.name || `État ${s.id}`}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
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
                      {editingBp.deprecated ? 'Réactiver' : 'Désactiver'}
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

      {/* ── Picker PNG — identique VoxelBuilderTab ────────────────────────── */}
      {pickerFace && (
        <div style={S.overlay} onClick={() => setPickerFace(null)}>
          <div style={S.pickerModal} onClick={e => e.stopPropagation()}>
            <div style={S.pickerHeader}>
              <span style={S.pickerTitle}>Choisir — {FACE_LABELS[pickerFace.faceName]}</span>
              <button style={S.btnGhost} onClick={() => setPickerFace(null)}>✕</button>
            </div>
            {packFiles.length === 0
              ? <p style={S.muted}>Aucun PNG — ajoutez d'abord des fichiers dans l'onglet "Textures"</p>
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
            <h2 style={S.modalTitle}>Supprimer ce blueprint ?</h2>
            <p style={S.modalText}>Cette action est irréversible. Si des instances existent sur des cartes, la suppression sera bloquée.</p>
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
