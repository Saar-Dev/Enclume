import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Canvas, useFrame } from '@react-three/fiber'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import { loadVoxelTextures } from '../lib/voxelTextures'
import Voxel from '../components/Voxel'

const GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']
const GEOMETRY_LABELS = {
  cube: 'Cube',
  slab_bottom: 'Dalle basse',
  slab_top: 'Dalle haute',
  slope: 'Rampe',
  wedge: 'Coin',
}
const FACE_NAMES = ['all', 'top', 'bottom', 'north', 'south', 'east', 'west']
const FACE_LABELS = {
  all: 'Principal',
  top: 'Dessus',
  bottom: 'Dessous',
  north: 'Nord',
  south: 'Sud',
  east: 'Est',
  west: 'Ouest',
}

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

// ─── Composant principal ──────────────────────────────────────────────────────
export default function TexturePacksPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedPack, setSelectedPack] = useState(null)
  const [packDetail, setPackDetail] = useState(null)
  const [packFiles, setPackFiles] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('voxels')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', label: '', description: '', tile_size: '128' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(null)
  const [exporting, setExporting] = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [uploadingFile, setUploadingFile] = useState(false)

  // Constructeur voxel
  const [editingVoxel, setEditingVoxel] = useState(null) // null | 'new' | objet voxel
  const [voxelForm, setVoxelForm] = useState({ label: '', faces: {}, allowed_geometries: ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'] })
  const [savingVoxel, setSavingVoxel] = useState(false)
  const [voxelError, setVoxelError] = useState(null)
  const [pickerFace, setPickerFace] = useState(null)

  // ─── Chargement packs ───────────────────────────────────────────────────────
  const loadPacks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/texture-packs')
      setPacks(res.data.packs)
    } catch { setError(t('texturePacks.errorLoad')) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { loadPacks() }, [loadPacks])

  // ─── Chargement détail pack ─────────────────────────────────────────────────
  const loadPackDetail = useCallback(async (packId) => {
    setDetailLoading(true)
    setPackDetail(null)
    setPackFiles([])
    setEditingVoxel(null)
    try {
      const [detailRes, filesRes] = await Promise.all([
        api.get(`/texture-packs/${packId}`),
        api.get(`/texture-packs/${packId}/files`),
      ])
      setPackDetail(detailRes.data)
      setPackFiles(filesRes.data.files)
    } catch { setError(t('texturePacks.errorLoad')) }
    finally { setDetailLoading(false) }
  }, [t])

  const handleSelectPack = useCallback((pack) => {
    setSelectedPack(pack)
    setActiveTab('voxels')
    loadPackDetail(pack.id)
  }, [loadPackDetail])

  const isOwner = selectedPack?.created_by === user?.id

  // ─── Création pack ──────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!createForm.name || !createForm.label) { setCreateError(t('texturePacks.errorCreate')); return }
    setCreating(true); setCreateError(null)
    try {
      const res = await api.post('/texture-packs', {
        name: createForm.name.trim().toLowerCase().replace(/\s+/g, '-'),
        label: createForm.label.trim(),
        description: createForm.description.trim() || null,
        tile_size: Number(createForm.tile_size) || 128,
      })
      setPacks(prev => [...prev, res.data.pack])
      setShowCreate(false)
      setCreateForm({ name: '', label: '', description: '', tile_size: '128' })
    } catch (err) { setCreateError(err.response?.data?.error || t('texturePacks.errorCreate')) }
    finally { setCreating(false) }
  }, [createForm, t])

  // ─── Export / Import ────────────────────────────────────────────────────────
  const handleExport = useCallback(async (pack) => {
    setExporting(pack.id)
    try {
      const res = await api.get(`/texture-packs/${pack.id}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `${pack.name}.zip`; a.click()
      URL.revokeObjectURL(url)
    } catch { setError(t('texturePacks.exportError')) }
    finally { setExporting(null) }
  }, [t])

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportError(null); setImportSuccess(null)
    try {
      const formData = new FormData(); formData.append('zip', file)
      const res = await api.post('/texture-packs/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportSuccess(t('texturePacks.importSuccess') + ` (${res.data.textureCount} voxels)`)
      await loadPacks()
    } catch (err) { setImportError(err.response?.data?.error || t('texturePacks.importError')) }
    finally { setImporting(false); e.target.value = '' }
  }, [t, loadPacks])

  // ─── Suppression pack ───────────────────────────────────────────────────────
  const handleDeletePack = useCallback(async (packId) => {
    setDeleting(true)
    try {
      await api.delete(`/texture-packs/${packId}`)
      setPacks(prev => prev.filter(p => p.id !== packId))
      if (selectedPack?.id === packId) { setSelectedPack(null); setPackDetail(null); setPackFiles([]) }
      setDeleteConfirm(null)
    } catch (err) {
      setError(err.response?.status === 409 ? t('texturePacks.deletePackUsed') : (err.response?.data?.error || t('common.error')))
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }, [selectedPack, t])

  // ─── Gestion fichiers PNG ───────────────────────────────────────────────────
  const handleUploadFile = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file || !selectedPack) return
    setUploadingFile(true)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await api.post(`/texture-packs/${selectedPack.id}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPackFiles(prev => [...prev, res.data.file])
    } catch (err) { setError(err.response?.data?.error || t('common.error')) }
    finally { setUploadingFile(false); e.target.value = '' }
  }, [selectedPack, t])

  const handleDeleteFile = useCallback(async (filePath) => {
    if (!selectedPack) return
    try {
      await api.delete(`/texture-packs/${selectedPack.id}/files/${filePath}`)
      setPackFiles(prev => prev.filter(f => f.path !== filePath))
    } catch (err) {
      setError(err.response?.status === 409 ? t('texturePacks.fileInUse') : (err.response?.data?.error || t('common.error')))
    }
  }, [selectedPack, t])

  // ─── Constructeur voxel ─────────────────────────────────────────────────────
  const startNewVoxel = useCallback(() => {
    setVoxelForm({ label: '', faces: {}, allowed_geometries: ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'] })
    setVoxelError(null); setEditingVoxel('new')
  }, [])

  const startEditVoxel = useCallback((voxel) => {
    setVoxelForm({
      label: voxel.label,
      faces: { ...(voxel.faces || {}) },
      allowed_geometries: voxel.allowed_geometries || ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge'],
    })
    setVoxelError(null); setEditingVoxel(voxel)
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
    } catch { setError(t('common.error')) }
  }, [t])

  const handleSaveVoxel = useCallback(async () => {
    if (!voxelForm.label.trim()) { setVoxelError('Un nom est requis'); return }
    if (!voxelForm.faces.all) { setVoxelError('La face Principale est obligatoire'); return }
    if ((voxelForm.allowed_geometries || []).length === 0) { setVoxelError('Au moins une géométrie requise'); return }

    setSavingVoxel(true); setVoxelError(null)
    try {
      if (editingVoxel === 'new') {
        // Création : POST /voxel-textures/from-paths — route à créer côté serveur
        const res = await api.post('/voxel-textures/from-paths', {
          pack_id: selectedPack.id,
          label: voxelForm.label.trim(),
          faces: voxelForm.faces,
          allowed_geometries: voxelForm.allowed_geometries,
        })
        setPackDetail(prev => ({ ...prev, textures: [...(prev?.textures || []), res.data.texture] }))
        setPacks(prev => prev.map(p => p.id === selectedPack.id ? { ...p, texture_count: Number(p.texture_count) + 1 } : p))
      } else {
        // Modification label + allowed_geometries uniquement
        const res = await api.put(`/voxel-textures/${editingVoxel.id}`, {
          label: voxelForm.label.trim(),
          allowed_geometries: JSON.stringify(voxelForm.allowed_geometries),
        })
        setPackDetail(prev => ({ ...prev, textures: prev.textures.map(t => t.id === editingVoxel.id ? res.data.texture : t) }))
      }
      setEditingVoxel(null)
    } catch (err) { setVoxelError(err.response?.data?.error || t('common.error')) }
    finally { setSavingVoxel(false) }
  }, [voxelForm, editingVoxel, selectedPack, t])

  if (loading) return <div style={S.loadingScreen}><p style={S.muted}>{t('common.loading')}</p></div>

  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>{t('texturePacks.back')}</button>
        <h1 style={S.pageTitle}>{t('texturePacks.pageTitle')}</h1>
        <div style={S.headerRight}>
          <label style={S.btnSecondary}>
            {importing ? t('common.loading') : t('texturePacks.importZip')}
            <input type="file" accept=".zip" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
          </label>
          <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>{t('texturePacks.newPack')}</button>
        </div>
      </div>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error} ✕</div>}
      {importSuccess && <div style={S.successBanner} onClick={() => setImportSuccess(null)}>{importSuccess} ✕</div>}
      {importError && <div style={S.errorBanner} onClick={() => setImportError(null)}>{importError} ✕</div>}

      <div style={S.body}>

        {/* Colonne packs */}
        <div style={S.packList}>
          <div style={S.sectionHeader}><span style={S.sectionTitle}>Packs</span></div>
          {packs.length === 0 && <p style={S.muted}>{t('texturePacks.noPacks')}</p>}
          {packs.map(pack => (
            <div key={pack.id}
              style={{ ...S.packItem, ...(selectedPack?.id === pack.id ? S.packItemActive : {}) }}
              onClick={() => handleSelectPack(pack)}
            >
              <div style={S.packRow}><span style={S.packLabel}>{pack.label}</span><span style={S.packCount}>{pack.texture_count}v</span></div>
              <div style={S.packRow}><span style={S.packName}>{pack.name}</span><span style={S.packTile}>{pack.tile_size}px</span></div>
            </div>
          ))}
        </div>

        {/* Zone détail */}
        <div style={S.detail}>
          {!selectedPack && <div style={S.emptyDetail}><p style={S.muted}>{t('texturePacks.selectPack')}</p></div>}

          {selectedPack && (
            <>
              <div style={S.detailHeader}>
                <div>
                  <h2 style={S.detailTitle}>{selectedPack.label}</h2>
                  <p style={S.detailMeta}>{selectedPack.name} · {selectedPack.tile_size}px</p>
                </div>
                <div style={S.detailActions}>
                  {isOwner && <>
                    <button style={S.btnSecondary} onClick={() => handleExport(selectedPack)} disabled={!!exporting}>
                      {exporting === selectedPack.id ? t('common.loading') : t('texturePacks.exportZip')}
                    </button>
                    <button style={S.btnDanger} onClick={() => setDeleteConfirm(selectedPack.id)}>{t('texturePacks.deletePack')}</button>
                  </>}
                </div>
              </div>

              {/* Onglets */}
              <div style={S.tabs}>
                <button style={{ ...S.tab, ...(activeTab === 'voxels' ? S.tabActive : {}) }} onClick={() => setActiveTab('voxels')}>
                  Voxels {packDetail ? `(${packDetail.textures.length})` : ''}
                </button>
                <button style={{ ...S.tab, ...(activeTab === 'files' ? S.tabActive : {}) }} onClick={() => setActiveTab('files')}>
                  Textures PNG {packFiles.length > 0 ? `(${packFiles.length})` : ''}
                </button>
              </div>

              {detailLoading && <p style={{ ...S.muted, padding: '16px 24px' }}>{t('common.loading')}</p>}

              {/* ─── Onglet Voxels ─────────────────────────────────────────── */}
              {!detailLoading && activeTab === 'voxels' && packDetail && (
                <div style={S.voxelLayout}>

                  {/* Liste voxels */}
                  <div style={S.voxelList}>
                    {isOwner && <button style={{ ...S.btnPrimary, marginBottom: '8px', fontSize: '12px' }} onClick={startNewVoxel}>+ Nouveau voxel</button>}
                    {packDetail.textures.length === 0 && <p style={S.muted}>{t('texturePacks.noVoxels')}</p>}
                    {packDetail.textures.map(tex => {
                      const previewPath = tex.faces?.top || tex.faces?.all
                      const previewUrl = previewPath ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${previewPath}` : null
                      const isActive = editingVoxel && editingVoxel !== 'new' && editingVoxel.id === tex.id
                      return (
                        <div key={tex.id}
                          style={{ ...S.voxelItem, ...(isActive ? S.voxelItemActive : {}), ...(tex.deprecated ? { opacity: 0.45 } : {}) }}
                          onClick={() => startEditVoxel(tex)}
                        >
                          {previewUrl && <img src={previewUrl} alt={tex.label} style={S.voxelThumb} />}
                          <div style={S.voxelItemInfo}>
                            <span style={S.voxelItemLabel}>{tex.label}</span>
                            {tex.deprecated && <span style={S.deprecatedBadge}>Désactivé</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Constructeur */}
                  <div style={S.builder}>
                    {!editingVoxel && (
                      <div style={S.builderEmpty}>
                        <p style={S.muted}>{isOwner ? 'Cliquez sur un voxel pour le modifier' : 'Sélectionnez un voxel'}</p>
                      </div>
                    )}

                    {editingVoxel && (
                      <div style={S.builderContent}>
                        {/* Nom */}
                        <div style={S.fieldGroup}>
                          <label style={S.fieldLabel}>Nom du voxel</label>
                          <input style={S.input} value={voxelForm.label}
                            onChange={e => setVoxelForm(p => ({ ...p, label: e.target.value }))}
                            placeholder="ex: Plaque métal" disabled={!isOwner} />
                        </div>

                        <div style={S.builderRow}>
                          {/* Faces */}
                          <div>
                            <p style={{ ...S.fieldLabel, marginBottom: '8px' }}>Faces (cliquer pour assigner)</p>
                            <div style={S.facesGrid}>
                              {FACE_NAMES.map(faceName => {
                                const filePath = voxelForm.faces[faceName]
                                const url = filePath ? `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${filePath}` : null
                                return (
                                  <div key={faceName} style={S.faceSlot}>
                                    <span style={S.faceLabel}>{FACE_LABELS[faceName]}</span>
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
                              <VoxelPreview faces={voxelForm.faces} packId={selectedPack.id}
                                geometry={voxelForm.allowed_geometries?.[0] || 'cube'} />
                            </div>
                            <div>
                              <p style={{ ...S.fieldLabel, marginBottom: '6px' }}>Géométries autorisées</p>
                              {GEOMETRIES.map(geo => (
                                <label key={geo} style={S.geoRow}>
                                  <input type="checkbox"
                                    checked={(voxelForm.allowed_geometries || []).includes(geo)}
                                    onChange={() => isOwner && toggleGeometry(geo)}
                                    disabled={!isOwner} style={S.checkbox} />
                                  <span style={S.geoLabel}>{GEOMETRY_LABELS[geo]}</span>
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
                </div>
              )}

              {/* ─── Onglet Textures PNG ────────────────────────────────────── */}
              {!detailLoading && activeTab === 'files' && (
                <div style={S.filesTab}>
                  {isOwner && (
                    <div style={S.filesHeader}>
                      <label style={S.btnPrimary}>
                        {uploadingFile ? t('common.loading') : '+ Ajouter un PNG'}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                          onChange={handleUploadFile} disabled={uploadingFile} />
                      </label>
                      <span style={S.muted}>Dimensions multiples de {selectedPack.tile_size}px</span>
                    </div>
                  )}
                  {packFiles.length === 0 && <p style={S.muted}>{t('texturePacks.noFiles')}</p>}
                  <div style={S.filesGrid}>
                    {packFiles.map(file => {
                      const url = `${import.meta.env.VITE_API_URL}/api/textures/${selectedPack.id}/${file.path}`
                      return (
                        <div key={file.path} style={{ ...S.fileCard, ...(file.inUse ? S.fileCardUsed : {}) }}>
                          <img src={url} alt={file.path} style={S.fileImg} />
                          <div style={S.fileInfo}>
                            <span style={{ ...S.fileName, ...(file.inUse ? { color: 'var(--color-danger)' } : {}) }}>
                              {file.path.replace(/\.[^.]+$/, '')}
                            </span>
                            {file.inUse && <span style={S.usedBadge}>Utilisé</span>}
                          </div>
                          {isOwner && !file.inUse && (
                            <button style={S.fileDeleteBtn} onClick={() => handleDeleteFile(file.path)}>✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Popup sélecteur PNG */}
      {pickerFace && (
        <div style={S.overlay} onClick={() => setPickerFace(null)}>
          <div style={S.pickerModal} onClick={e => e.stopPropagation()}>
            <div style={S.pickerHeader}>
              <span style={S.pickerTitle}>Choisir — {FACE_LABELS[pickerFace]}</span>
              <button style={S.btnGhost} onClick={() => setPickerFace(null)}>✕</button>
            </div>
            {packFiles.length === 0
              ? <p style={S.muted}>Aucun PNG — ajoutez d'abord des fichiers dans l'onglet "Textures PNG"</p>
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

      {/* Modal création pack */}
      {showCreate && (
        <div style={S.overlay} onClick={() => setShowCreate(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('texturePacks.newPack')}</h2>
            {createError && <p style={S.fieldError}>{createError}</p>}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packName')}</label>
              <input style={S.input} value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: mon-pack" />
              <span style={S.fieldHint}>Identifiant technique — minuscules, tirets</span>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packLabel')}</label>
              <input style={S.input} value={createForm.label} onChange={e => setCreateForm(p => ({ ...p, label: e.target.value }))} placeholder="ex: Mon Pack" />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packDescription')}</label>
              <input style={S.input} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packTileSize')}</label>
              <select style={S.input} value={createForm.tile_size} onChange={e => setCreateForm(p => ({ ...p, tile_size: e.target.value }))}>
                <option value="64">64px</option>
                <option value="128">128px</option>
                <option value="256">256px</option>
              </select>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
              <button style={S.btnPrimary} onClick={handleCreate} disabled={creating}>
                {creating ? t('common.loading') : t('texturePacks.newPack')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression pack */}
      {deleteConfirm && (
        <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('texturePacks.deletePack')}</h2>
            <p style={S.modalText}>{t('texturePacks.deletePackConfirm')}</p>
            <div style={S.modalFooter}>
              <button style={S.btnGhost} onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button style={S.btnDanger} onClick={() => handleDeletePack(deleteConfirm)} disabled={deleting}>
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
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  loadingScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-app)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },
  successBanner: { backgroundColor: 'rgba(76,175,119,0.12)', border: '1px solid #4caf77', borderRadius: '6px', padding: '8px 16px', color: '#4caf77', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },
  body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },

  packList: { width: '200px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' },
  sectionHeader: { marginBottom: '8px' },
  sectionTitle: { fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  packItem: { padding: '7px 9px', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent' },
  packItemActive: { backgroundColor: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.3)' },
  packRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' },
  packLabel: { fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' },
  packCount: { fontSize: '10px', color: 'var(--text-muted)' },
  packName: { fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' },
  packTile: { fontSize: '10px', color: 'var(--text-muted)' },

  detail: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  emptyDetail: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  detailTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 2px 0' },
  detailMeta: { fontSize: '11px', color: 'var(--text-muted)', margin: 0 },
  detailActions: { display: 'flex', gap: '8px' },

  tabs: { display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  tab: { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '-1px' },
  tabActive: { color: '#5b8dee', borderBottomColor: '#5b8dee', fontWeight: '500' },

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

  filesTab: { padding: '14px 20px', overflowY: 'auto', flex: 1 },
  filesHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  filesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px' },
  fileCard: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden', position: 'relative' },
  fileCardUsed: { borderColor: 'rgba(255,107,107,0.4)' },
  fileImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', imageRendering: 'pixelated', display: 'block' },
  fileInfo: { padding: '3px 6px 4px' },
  fileName: { fontSize: '9px', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  usedBadge: { fontSize: '8px', color: 'var(--color-danger)', display: 'block' },
  fileDeleteBtn: { position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white', width: '16px', height: '16px', borderRadius: '50%', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
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
  fieldHint: { fontSize: '10px', color: 'var(--text-muted)' },
  fieldError: { fontSize: '12px', color: 'var(--color-danger)', margin: 0 },
  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' },

  btnPrimary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  btnSecondary: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { backgroundColor: 'rgba(224,92,92,0.15)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '6px 12px', color: 'var(--color-danger)', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
  muted: { color: 'var(--text-muted)', fontSize: '12px' },
}
