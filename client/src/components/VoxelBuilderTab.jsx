import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame } from '@react-three/fiber'
import api from '../lib/api'
import { loadVoxelTextures } from '../lib/voxelTextures'
import Voxel from '../components/Voxel'

// ─── Constantes ───────────────────────────────────────────────────────────────
const GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']
// Labels géométries/faces — voir fr.json builder.geometries.* et builder.faces.* pour les traductions
const FACE_NAMES = ['all', 'top', 'bottom', 'north', 'south', 'east', 'west']

// ─── Aperçu 3D — voxel rotatif ───────────────────────────────────────────────
function RotatingVoxel({ textureMaterials, geometry }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.8
  })
  if (!textureMaterials) return null
  return (
    <group ref={groupRef}>
      <Voxel
        position={[-0.5, -0.5, -0.5]}
        textureMaterials={textureMaterials}
        geometry={geometry || 'cube'}
        rotation={0}
      />
    </group>
  )
}

function VoxelPreview({ faces, packId, geometry }) {
  const [materials, setMaterials] = useState(null)

  useEffect(() => {
    if (!packId || !faces || !faces.all) {
      setMaterials(null)
      return
    }
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

  return (
    <Canvas
      camera={{ position: [2, 1.5, 2], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#0f1115' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />
      <RotatingVoxel textureMaterials={materials} geometry={geometry} />
    </Canvas>
  )
}

// ─── VoxelBuilderTab ──────────────────────────────────────────────────────────
export default function VoxelBuilderTab({
  selectedPack,
  packDetail,
  setPackDetail,
  setPacks,
  packFiles,
  isOwner,
}) {
  const { t } = useTranslation()

  const [editingVoxel, setEditingVoxel] = useState(null)

  // Reset au changement de pack — évite d'afficher un voxel d'un ancien pack
  useEffect(() => { setEditingVoxel(null) }, [selectedPack?.id])

  const [voxelForm, setVoxelForm] = useState({
    label: '',
    faces: {},
    allowed_geometries: ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'],
  })
  const [savingVoxel, setSavingVoxel] = useState(false)
  const [voxelError, setVoxelError] = useState(null)
  const [pickerFace, setPickerFace] = useState(null)

  // Réinitialiser le formulaire au changement de pack
  useEffect(() => { setEditingVoxel(null) }, [selectedPack?.id])

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const startNewVoxel = useCallback(() => {
    setVoxelForm({ label: '', faces: {}, allowed_geometries: ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'] })
    setVoxelError(null)
    setEditingVoxel('new')
  }, [])

  const startEditVoxel = useCallback((voxel) => {
    setVoxelForm({
      label: voxel.label,
      faces: { ...(voxel.faces || {}) },
      allowed_geometries: voxel.allowed_geometries || ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'],
    })
    setVoxelError(null)
    setEditingVoxel(voxel)
  }, [])

  const toggleGeometry = useCallback((geo) => {
    setVoxelForm(prev => {
      const cur = prev.allowed_geometries || []
      return { ...prev, allowed_geometries: cur.includes(geo) ? cur.filter(g => g !== geo) : [...cur, geo] }
    })
  }, [])

  const handlePickFace = useCallback((faceName, filePath) => {
    setVoxelForm(prev => ({ ...prev, faces: { ...prev.faces, [faceName]: filePath } }))
    setPickerFace(null)
  }, [])

  const handleClearFace = useCallback((faceName) => {
    setVoxelForm(prev => { const f = { ...prev.faces }; delete f[faceName]; return { ...prev, faces: f } })
  }, [])

  const handleDeprecateVoxel = useCallback(async (voxel) => {
    try {
      const res = await api.put(`/voxel-textures/${voxel.id}`, { deprecated: !voxel.deprecated })
      setPackDetail(prev => ({ ...prev, textures: prev.textures.map(t => t.id === voxel.id ? res.data.texture : t) }))
      setEditingVoxel(prev => prev && prev !== 'new' && prev.id === voxel.id ? res.data.texture : prev)
    } catch { /* erreur remontée au shell si nécessaire */ }
  }, [setPackDetail])

  const handleSaveVoxel = useCallback(async () => {
    if (!voxelForm.label.trim()) { setVoxelError(t('builder.errorNameRequired')); return }
    if (!voxelForm.faces.all) { setVoxelError(t('builder.errorFacePrimaryRequired')); return }
    if ((voxelForm.allowed_geometries || []).length === 0) { setVoxelError(t('builder.errorGeometryRequired')); return }

    setSavingVoxel(true); setVoxelError(null)
    try {
      if (editingVoxel === 'new') {
        const res = await api.post('/voxel-textures/from-paths', {
          pack_id: selectedPack.id,
          label: voxelForm.label.trim(),
          faces: voxelForm.faces,
          allowed_geometries: voxelForm.allowed_geometries,
        })
        setPackDetail(prev => ({ ...prev, textures: [...(prev?.textures || []), res.data.texture] }))
        setPacks(prev => prev.map(p => p.id === selectedPack.id ? { ...p, texture_count: Number(p.texture_count) + 1 } : p))
      } else {
        const res = await api.put(`/voxel-textures/${editingVoxel.id}`, {
          label: voxelForm.label.trim(),
          allowed_geometries: JSON.stringify(voxelForm.allowed_geometries),
        })
        setPackDetail(prev => ({ ...prev, textures: prev.textures.map(t => t.id === editingVoxel.id ? res.data.texture : t) }))
      }
      setEditingVoxel(null)
    } catch (err) { setVoxelError(err.response?.data?.error || t('common.error')) }
    finally { setSavingVoxel(false) }
  }, [voxelForm, editingVoxel, selectedPack, setPackDetail, setPacks, t])

  // ─── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div style={S.voxelLayout}>

      {/* Liste voxels */}
      <div style={S.voxelList}>
        {isOwner && (
          <button style={{ ...S.btnPrimary, marginBottom: '8px', fontSize: '12px' }}
            onClick={startNewVoxel}>
            {t('builder.newVoxel')}
          </button>
        )}
        {packDetail.textures.length === 0 && <p style={S.muted}>{t('texturePacks.noVoxels')}</p>}
        {packDetail.textures.map(tex => {
          const previewPath = tex.faces?.top || tex.faces?.all
          const previewUrl = previewPath
            ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${previewPath}`
            : null
          const isActive = editingVoxel && editingVoxel !== 'new' && editingVoxel.id === tex.id
          return (
            <div key={tex.id}
              style={{ ...S.voxelItem, ...(isActive ? S.voxelItemActive : {}), ...(tex.deprecated ? { opacity: 0.45 } : {}) }}
              onClick={() => startEditVoxel(tex)}
            >
              {previewUrl && <img src={previewUrl} alt={tex.label} style={S.voxelThumb} />}
              <div style={S.voxelItemInfo}>
                <span style={S.voxelItemLabel}>{tex.label}</span>
                {tex.deprecated && <span style={S.deprecatedBadge}>{t('builder.deprecated')}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Constructeur */}
      <div style={S.builder}>
        {!editingVoxel && (
          <div style={S.builderEmpty}>
            <p style={S.muted}>{isOwner ? t('builder.clickToEditVoxel') : t('builder.selectVoxel')}</p>
          </div>
        )}

        {editingVoxel && (
          <div style={S.builderContent}>
            {/* Nom */}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('builder.voxelNameLabel')}</label>
              <input style={S.input} value={voxelForm.label}
                onChange={e => setVoxelForm(p => ({ ...p, label: e.target.value }))}
                placeholder={t('builder.placeholderVoxelName')} disabled={!isOwner} />
            </div>

            <div style={S.builderRow}>
              {/* Faces */}
              <div>
                <p style={{ ...S.fieldLabel, marginBottom: '8px' }}>{t('builder.facesLabel')}</p>
                <div style={S.facesGrid}>
                  {FACE_NAMES.map(faceName => {
                    const filePath = voxelForm.faces[faceName]
                    const url = filePath
                      ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${filePath}`
                      : null
                    return (
                      <div key={faceName} style={S.faceSlot}>
                        <span style={S.faceLabel}>{t(`builder.faces.${faceName}`)}</span>
                        <div style={{ ...S.faceBox, ...(isOwner ? S.faceBoxClickable : {}) }}
                          onClick={() => isOwner && setPickerFace(faceName)}>
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

              {/* Droite : aperçu + géométries */}
              <div style={S.rightCol}>
                <div style={S.previewBox}>
                  <VoxelPreview
                    faces={voxelForm.faces}
                    packId={selectedPack.id}
                    geometry={voxelForm.allowed_geometries?.[0] || 'cube'}
                  />
                </div>
                <div>
                  <p style={{ ...S.fieldLabel, marginBottom: '6px' }}>{t('builder.geometriesLabel')}</p>
                  {GEOMETRIES.map(geo => (
                    <label key={geo} style={S.geoRow}>
                      <input type="checkbox"
                        checked={(voxelForm.allowed_geometries || []).includes(geo)}
                        onChange={() => isOwner && toggleGeometry(geo)}
                        disabled={!isOwner} style={S.checkbox} />
                      <span style={S.geoLabel}>{t(`builder.geometries.${geo}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {voxelError && <p style={S.fieldError}>{voxelError}</p>}

            {isOwner && (
              <div style={S.builderFooter}>
                <button style={S.btnGhost} onClick={() => setEditingVoxel(null)}>{t('common.cancel')}</button>
                {editingVoxel !== 'new' && (
                  <button style={S.btnSecondary} onClick={() => handleDeprecateVoxel(editingVoxel)}>
                    {editingVoxel.deprecated ? t('texturePacks.textureRestore') : t('texturePacks.textureDeprecate')}
                  </button>
                )}
                <button style={S.btnPrimary} onClick={handleSaveVoxel} disabled={savingVoxel}>
                  {savingVoxel ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popup sélecteur PNG */}
      {pickerFace && (
        <div style={S.overlay} onClick={() => setPickerFace(null)}>
          <div style={S.pickerModal} onClick={e => e.stopPropagation()}>
            <div style={S.pickerHeader}>
              <span style={S.pickerTitle}>{t('builder.pickerTitle', { face: t(`builder.faces.${pickerFace}`) })}</span>
              <button style={S.btnGhost} onClick={() => setPickerFace(null)}>✕</button>
            </div>
            {packFiles.length === 0
              ? <p style={S.muted}>{t('builder.noPngVoxels')}</p>
              : (
                <div style={S.pickerGrid}>
                  {packFiles.map(file => {
                    const url = `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${file.path}`
                    const isSelected = voxelForm.faces[pickerFace] === file.path
                    return (
                      <div key={file.path}
                        style={{ ...S.pickerItem, ...(isSelected ? S.pickerItemSelected : {}) }}
                        onClick={() => handlePickFace(pickerFace, file.path)}>
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
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  voxelLayout: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  voxelList: { width: '170px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' },
  voxelItem: { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', border: '1px solid transparent' },
  voxelItemActive: { backgroundColor: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.3)' },
  voxelThumb: { width: '26px', height: '26px', objectFit: 'cover', borderRadius: '3px', imageRendering: 'pixelated', flexShrink: 0 },
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
  geoRow: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '4px' },
  checkbox: { width: '13px', height: '13px', accentColor: '#5b8dee', cursor: 'pointer' },
  geoLabel: { fontSize: '12px', color: 'var(--text-primary)' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  pickerModal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px', width: '500px', maxWidth: '92vw', maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: '10px' },
  pickerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  pickerTitle: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  pickerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px', overflowY: 'auto' },
  pickerItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '5px', borderRadius: '6px', cursor: 'pointer', border: '2px solid transparent' },
  pickerItemSelected: { border: '2px solid #5b8dee', backgroundColor: 'rgba(91,141,238,0.1)' },
  pickerImg: { width: '60px', height: '60px', objectFit: 'cover', imageRendering: 'pixelated', borderRadius: '4px' },
  pickerName: { fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' },

  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  fieldLabel: { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', margin: 0 },
  fieldError: { fontSize: '12px', color: 'var(--color-danger)', margin: 0 },
  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' },

  btnPrimary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  btnSecondary: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
  muted: { color: 'var(--text-muted)', fontSize: '12px' },
}
