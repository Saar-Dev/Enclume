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

  const typeLabel = (type) => {
    if (type === 'drone') return t('vault.typeDrone')
    if (type === 'pnj') return t('vault.typePnj')
    return t('vault.typePj')
  }

  return (
    <div style={S.container}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>{t('vault.back')}</button>
        <h1 style={S.pageTitle}>{t('vault.pageTitle')}</h1>
        <div style={S.headerRight} />
      </div>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error} ✕</div>}

      <div style={S.body}>
        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : characters.length === 0 ? (
          <p style={S.muted}>{t('vault.empty')}</p>
        ) : (
          <div style={S.list}>
            {characters.map(character => (
              <div key={character.id} style={S.rowWrapper}>
                <div style={S.row}>
                  <div style={S.rowMain}>
                    {editingId === character.id ? (
                      <input
                        style={S.input}
                        value={editingName}
                        autoFocus
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
                    <span style={S.typeBadge}>{typeLabel(character.type)}</span>
                  </div>
                  <div style={S.rowActions}>
                    {character.hasPendingRequest ? (
                      <span style={S.pendingBadge}>{t('vault.pendingBadge')}</span>
                    ) : requestingId !== character.id && (
                      <button
                        style={S.btnSecondary}
                        onClick={() => { setRequestingId(character.id); setSelectedCampaignId('') }}
                      >{t('vault.requestTransfer')}</button>
                    )}
                    <button
                      style={S.btnSecondary}
                      onClick={() => { setEditingId(character.id); setEditingName(character.name) }}
                    >{t('vault.rename')}</button>
                    <button
                      style={S.btnDanger}
                      onClick={() => setDeleteConfirmId(character.id)}
                    >{t('vault.delete')}</button>
                  </div>
                </div>

                {requestingId === character.id && (
                  <div style={S.requestForm}>
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
                      style={S.btnSecondary}
                      onClick={() => handleRequestTransfer(character.id)}
                      disabled={!selectedCampaignId || sendingRequest}
                    >{sendingRequest ? t('common.loading') : t('vault.confirmRequest')}</button>
                    <button style={S.btnGhost} onClick={() => setRequestingId(null)}>{t('common.cancel')}</button>
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
              <button style={S.btnGhost} onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</button>
              <button style={S.btnDanger} onClick={() => handleDelete(deleteConfirmId)} disabled={deleting}>
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
  container: { minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  pageTitle: { fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 },
  headerRight: { width: '52px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '640px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rowWrapper: { display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '8px' },
  rowMain: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  rowName: { fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typeBadge: { fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 },
  rowActions: { display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' },
  pendingBadge: { fontSize: '11px', color: '#e0b25c', border: '1px solid rgba(224,178,92,0.4)', borderRadius: '4px', padding: '5px 10px', backgroundColor: 'rgba(224,178,92,0.1)' },
  requestForm: { display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 14px 12px', backgroundColor: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', borderRadius: '0 0 8px 8px', marginTop: '-8px' },

  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', minWidth: '160px' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalText: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },

  btnSecondary: { background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { backgroundColor: 'rgba(224,92,92,0.15)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '6px 12px', color: 'var(--color-danger)', fontSize: '13px', cursor: 'pointer' },
  btnGhost: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '7px', cursor: 'pointer' },
}
