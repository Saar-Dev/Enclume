import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// ─── VaultPage ("Coffre") ───────────────────────────────────────────────────────
// PLAN_VAULT.md Étape 7 — Lot 1 (liste, renommage, suppression) + Lot 3 (demander un transfert).
// Le traitement MJ (Lot 4) vient ensuite, dans CampaignSettingsPage/SectionPlayers.
export default function VaultPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [campaigns, setCampaigns] = useState([])
  const [requestingId, setRequestingId] = useState(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [sendingRequest, setSendingRequest] = useState(false)

  // ─── Création directe (Lot câblage UI, docs/EN_COURS.md 2026-08-16) ────────────────────────
  // creatingType : null | 'pj' | 'drone' | 'exo' — panneau "nom + confirmer" affiché pour ce type.
  // showPjChoice : sous-choix Wizard/Outil direct spécifique au Personnage (les deux autres types
  // n'ont pas de Wizard).
  const [showPjChoice, setShowPjChoice] = useState(false)
  const [creatingType, setCreatingType] = useState(null)
  const [newCharName, setNewCharName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { document.title = 'Enclume — Coffre' }, [])

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/vault/characters')
      setCharacters(res.data.characters)
    } catch { setError(t('vault.errorLoad')) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { loadCharacters() }, [loadCharacters])

  // Campagnes dont l'utilisateur est membre — même source que le Dashboard (condition (a) de la
  // Décision 3, revalidée de toute façon côté serveur dans requestImport).
  useEffect(() => {
    api.get('/campaigns').then(res => setCampaigns(res.data.campaigns)).catch(() => {})
  }, [])

  const handleRenameSubmit = async (characterId) => {
    const trimmed = editingName.trim()
    if (!trimmed) { setEditingId(null); return }
    try {
      const res = await api.patch(`/vault/characters/${characterId}`, { name: trimmed })
      setCharacters(prev => prev.map(c => c.id === characterId ? res.data.character : c))
    } catch {
      setError(t('vault.errorRename'))
    } finally {
      setEditingId(null)
    }
  }

  const handleDelete = async (characterId) => {
    setDeleting(true)
    try {
      await api.delete(`/vault/characters/${characterId}`)
      setCharacters(prev => prev.filter(c => c.id !== characterId))
      setDeleteConfirmId(null)
    } catch {
      setError(t('vault.errorDelete'))
    } finally {
      setDeleting(false)
    }
  }

  const handleRequestTransfer = async (characterId) => {
    if (!selectedCampaignId) return
    setSendingRequest(true)
    try {
      await api.post(`/vault/characters/${characterId}/request-import`, { targetCampaignId: selectedCampaignId })
      setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, hasPendingRequest: true } : c))
      setRequestingId(null)
      setSelectedCampaignId('')
    } catch (err) {
      setError(err.response?.data?.error?.message || t('vault.errorRequest'))
    } finally {
      setSendingRequest(false)
    }
  }

  const cancelCreate = () => {
    setCreatingType(null)
    setShowPjChoice(false)
    setNewCharName('')
  }

  const handleCreateDirect = async () => {
    const trimmed = newCharName.trim()
    if (!trimmed || !creatingType) return
    setCreating(true)
    try {
      const res = await api.post('/vault/characters', { name: trimmed, type: creatingType })
      cancelCreate()
      navigate(`/vault/characters/${res.data.character.id}`)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('vault.errorCreate'))
      setCreating(false)
    }
  }

  const typeLabel = (type) => {
    if (type === 'drone') return t('vault.typeDrone')
    if (type === 'exo') return t('vault.typeExo')
    if (type === 'pnj') return t('vault.typePnj')
    return t('vault.typePj')
  }

  const typeBadgeClass = (type) => {
    if (type === 'drone') return 'badge badge-type-drone'
    if (type === 'exo') return 'badge badge-type-exo'
    return 'badge badge-type-pj'
  }

  return (
    <div className="app-shell" style={S.container}>

      {/* Header — illustration en fond (.vault-topbar, index.css), boutons de création intégrés */}
      <div className="vault-topbar" style={{ ...S.header, position: 'relative', zIndex: 1 }}>
        <div style={S.headerTop}>
          <button className="btn-icon" onClick={() => navigate('/dashboard')}>{t('vault.back')}</button>
          <h1 style={S.pageTitle}>{t('vault.pageTitle')}</h1>
          <div style={S.headerRight} />
        </div>

        <div style={S.toolbar}>
          <div style={S.createGroup}>
            {!showPjChoice ? (
              <button className="btn" onClick={() => setShowPjChoice(true)}>
                {t('vault.createCharacter')}
              </button>
            ) : (
              <div style={S.pjChoiceGroup}>
                <button className="btn btn-ghost" onClick={() => navigate('/vault/creation')}>
                  {t('vault.createCharacterViaWizard')}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setCreatingType('pj'); setShowPjChoice(false) }}
                >{t('vault.createCharacterDirect')}</button>
                <button className="btn btn-ghost" onClick={() => setShowPjChoice(false)}>{t('common.cancel')}</button>
              </div>
            )}
            <button className="btn" onClick={() => setCreatingType('drone')}>
              {t('vault.createDrone')}
            </button>
            <button className="btn" onClick={() => setCreatingType('exo')}>
              {t('vault.createExo')}
            </button>
            <button className="btn" disabled title={t('common.comingSoon')}>
              {t('vault.createVaisseau')}
            </button>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate('/equipment')}>
            {t('vault.equipmentCatalog')}
          </button>
        </div>
      </div>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error} ✕</div>}

      <div style={{ ...S.body, position: 'relative', zIndex: 1 }}>
        {creatingType && (
          <div style={S.createForm}>
            <input
              style={S.input}
              autoFocus
              placeholder={t('vault.namePlaceholder')}
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateDirect()
                if (e.key === 'Escape') cancelCreate()
              }}
            />
            <button
              className="btn"
              onClick={handleCreateDirect}
              disabled={!newCharName.trim() || creating}
            >{creating ? t('common.loading') : t('common.create')}</button>
            <button className="btn btn-ghost" onClick={cancelCreate}>{t('common.cancel')}</button>
          </div>
        )}

        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : characters.length === 0 ? (
          <p style={S.muted}>{t('vault.empty')}</p>
        ) : (
          <div style={S.list}>
            {characters.map(character => (
              <div key={character.id} style={S.rowWrapper}>
                <div
                  style={S.row}
                  onClick={() => { if (editingId !== character.id) navigate(`/vault/characters/${character.id}`) }}
                >
                  <div style={S.rowMain}>
                    {editingId === character.id ? (
                      <input
                        style={S.input}
                        value={editingName}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSubmit(character.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleRenameSubmit(character.id)}
                      />
                    ) : (
                      <span style={S.rowName}>{character.name}</span>
                    )}
                    <span className={typeBadgeClass(character.type)}>{typeLabel(character.type)}</span>
                  </div>
                  <div style={S.rowActions} onClick={e => e.stopPropagation()}>
                    {character.hasPendingRequest ? (
                      <span style={S.pendingBadge}>{t('vault.pendingBadge')}</span>
                    ) : requestingId !== character.id && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => { setRequestingId(character.id); setSelectedCampaignId('') }}
                      >{t('vault.requestTransfer')}</button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => { setEditingId(character.id); setEditingName(character.name) }}
                    >{t('vault.rename')}</button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setDeleteConfirmId(character.id)}
                    >{t('vault.delete')}</button>
                  </div>
                </div>

                {requestingId === character.id && (
                  <div style={S.requestForm}>
                    <span style={S.transferHint}>{t('vault.transferHint')}</span>
                    <div style={S.requestFormRow}>
                      <select
                        style={S.input}
                        value={selectedCampaignId}
                        onChange={e => setSelectedCampaignId(e.target.value)}
                      >
                        <option value="">{t('vault.selectCampaignPlaceholder')}</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn"
                        onClick={() => handleRequestTransfer(character.id)}
                        disabled={!selectedCampaignId || sendingRequest}
                      >{sendingRequest ? t('common.loading') : t('vault.confirmRequest')}</button>
                      <button className="btn btn-ghost" onClick={() => setRequestingId(null)}>{t('common.cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal suppression */}
      {deleteConfirmId && (
        <div style={S.overlay} onClick={() => setDeleteConfirmId(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.modalTitle}>{t('vault.deleteConfirmTitle')}</h2>
            <p style={S.modalText}>{t('vault.deleteConfirmText')}</p>
            <div style={S.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirmId)} disabled={deleting}>
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 24px 18px', flexShrink: 0 },
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.6)' },
  headerRight: { width: '52px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px' },

  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' },
  createGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  pjChoiceGroup: { display: 'flex', gap: '8px', alignItems: 'center' },
  createForm: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rowWrapper: { display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' },
  rowMain: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  rowName: { fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions: { display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' },
  pendingBadge: { fontSize: '11px', color: '#e0b25c', border: '1px solid rgba(224,178,92,0.4)', borderRadius: '4px', padding: '5px 10px', backgroundColor: 'rgba(224,178,92,0.1)' },
  requestForm: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 14px 12px', backgroundColor: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', borderRadius: '0 0 8px 8px', marginTop: '-8px' },
  requestFormRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  transferHint: { fontSize: '11px', color: 'var(--text-muted)' },

  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', minWidth: '160px' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
}
