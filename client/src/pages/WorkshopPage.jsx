import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import VoxelBuilderTab from '../components/VoxelBuilderTab'
import EntityBuilderTab from '../components/EntityBuilderTab'

// ─── WorkshopPage ─────────────────────────────────────────────────────────────
// Shell de l'Atelier du GM — gère les packs, le détail et les onglets.
// Les onglets Voxels et Entités sont délégués à des composants séparés (PW5).
// Remplace TexturePacksPage.jsx — route /workshop.
export default function WorkshopPage() {
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
  const [activeTab, setActiveTab] = useState('files')

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
  const [entityCount, setEntityCount] = useState(0)

  const isOwner = selectedPack?.created_by === user?.id

  // ─── Chargement packs ─────────────────────────────────────────────────────────
  const loadPacks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/texture-packs')
      setPacks(res.data.packs)
    } catch { setError(t('texturePacks.errorLoad')) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { loadPacks() }, [loadPacks])

  // ─── Chargement détail pack ───────────────────────────────────────────────────
  const loadPackDetail = useCallback(async (packId) => {
    setDetailLoading(true)
    setPackDetail(null)
    setPackFiles([])
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
    setActiveTab('files')
    loadPackDetail(pack.id)
  }, [loadPackDetail])

  // ─── Création pack ────────────────────────────────────────────────────────────
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

  // ─── Export / Import ──────────────────────────────────────────────────────────
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

  // ─── Suppression pack ─────────────────────────────────────────────────────────
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

  // ─── Fichiers PNG ─────────────────────────────────────────────────────────────
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

  // ─── Rendu ────────────────────────────────────────────────────────────────────
  if (loading) return <div style={S.loadingScreen}><p style={S.muted}>{t('common.loading')}</p></div>

  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>{t('texturePacks.back')}</button>
        <h1 style={S.pageTitle}>{t('workshop.pageTitle')}</h1>
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
          <div style={S.sectionHeader}><span style={S.sectionTitle}>{t('workshop.sectionPacks')}</span></div>
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
                <button style={{ ...S.tab, ...(activeTab === 'files' ? S.tabActive : {}) }} onClick={() => setActiveTab('files')}>
                  {t('workshop.tabTextures')}{packFiles.length > 0 ? ` (${packFiles.length})` : ''}
                </button>
                <button style={{ ...S.tab, ...(activeTab === 'voxels' ? S.tabActive : {}) }} onClick={() => setActiveTab('voxels')}>
                  {t('workshop.tabMaterials')}{packDetail ? ` (${packDetail.textures.length})` : ''}
                </button>
                <button style={{ ...S.tab, ...(activeTab === 'entities' ? S.tabActive : {}) }} onClick={() => setActiveTab('entities')}>
                  {t('workshop.tabEntities')}{entityCount > 0 ? ` (${entityCount})` : ''}
                </button>
              </div>

              {detailLoading && <p style={{ ...S.muted, padding: '16px 24px' }}>{t('common.loading')}</p>}

              {/* ─── Onglet Voxels ─────────────────────────────────────────── */}
              {!detailLoading && activeTab === 'voxels' && packDetail && (
                <VoxelBuilderTab
                  selectedPack={selectedPack}
                  packDetail={packDetail}
                  setPackDetail={setPackDetail}
                  setPacks={setPacks}
                  packFiles={packFiles}
                  isOwner={isOwner}
                />
              )}

              {/* ─── Onglet Éléments interactifs ───────────────────────────── */}
              {!detailLoading && activeTab === 'entities' && packDetail && (
                <EntityBuilderTab
                  selectedPack={selectedPack}
                  packDetail={packDetail}
                  setPacks={setPacks}
                  packFiles={packFiles}
                  isOwner={isOwner}
                  onCountChange={setEntityCount}
                />
              )}

              {/* ─── Onglet Textures PNG ────────────────────────────────────── */}
              {!detailLoading && activeTab === 'files' && (
                <div style={S.filesTab}>
                  {isOwner && (
                    <div style={S.filesHeader}>
                      <label style={S.btnPrimary}>
                        {uploadingFile ? t('common.loading') : t('workshop.addPng')}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                          onChange={handleUploadFile} disabled={uploadingFile} />
                      </label>
                      <span style={S.muted}>{t('workshop.dimensionsHint', { size: selectedPack.tile_size })}</span>
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
                            {file.inUse && <span style={S.usedBadge}>{t('workshop.usedBadge')}</span>}
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

      {/* Modal création pack */}
      {showCreate && (
        <div style={S.overlay} onClick={() => setShowCreate(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('texturePacks.newPack')}</h2>
            {createError && <p style={S.fieldError}>{createError}</p>}
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packName')}</label>
              <input style={S.input} value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder={t('workshop.packNamePlaceholder')} />
              <span style={S.fieldHint}>{t('workshop.packNameHint')}</span>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>{t('texturePacks.packLabel')}</label>
              <input style={S.input} value={createForm.label} onChange={e => setCreateForm(p => ({ ...p, label: e.target.value }))} placeholder={t('workshop.packLabelPlaceholder')} />
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
  tab: { background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'transparent', padding: '8px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '-1px' },
  tabActive: { color: '#5b8dee', borderBottomColor: '#5b8dee', fontWeight: '500' },

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
