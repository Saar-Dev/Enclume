// client/src/components/campaignSettings/SectionPlayers.jsx
// PLAN_VAULT.md Étape 7, Lot 4 — le MJ traite ici les demandes de transfert depuis le Coffre
// d'un joueur vers cette campagne (Décision 3, "depuis le Vault : restreint").
// Emplacement vérifié libre le 2026-07-10 (historique Git remonté, "Phase 3" = texte de
// remplissage générique du commit qui a créé les 5 onglets d'un coup, sans projet en collision).
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { sharedStyles as styles } from './sharedStyles'

export default function SectionPlayers({ campaignId }) {
  const { t } = useTranslation()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processingId, setProcessingId] = useState(null)

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get(`/vault/campaigns/${campaignId}/transfer-requests`)
      setRequests(res.data.requests)
    } catch { setError(t('settings.transferRequestsErrorLoad')) }
    finally { setLoading(false) }
  }, [campaignId, t])

  useEffect(() => { loadRequests() }, [loadRequests])

  const typeLabel = (type) => {
    if (type === 'drone') return t('vault.typeDrone')
    if (type === 'pnj') return t('vault.typePnj')
    return t('vault.typePj')
  }

  const handleApprove = async (requestId) => {
    setProcessingId(requestId)
    try {
      await api.post(`/vault/transfer-requests/${requestId}/approve`)
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch {
      setError(t('settings.transferRequestErrorApprove'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId) => {
    setProcessingId(requestId)
    try {
      await api.post(`/vault/transfer-requests/${requestId}/reject`)
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch {
      setError(t('settings.transferRequestErrorReject'))
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <section className="card">
      <h2 style={styles.sectionTitle}>{t('settings.transferRequestsTitle')}</h2>

      {error && <p style={{ ...styles.placeholderText, color: 'var(--color-danger)' }}>{error}</p>}

      {loading ? (
        <p style={styles.placeholderText}>{t('common.loading')}</p>
      ) : requests.length === 0 ? (
        <p style={styles.placeholderText}>{t('settings.transferRequestsEmpty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {requests.map(request => (
            <div key={request.id} style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{request.character_name}</span>
                <span style={badgeStyle}>{typeLabel(request.character_type)}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('settings.transferRequestBy', { username: request.requested_by_username || '?' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                >{t('settings.transferRequestApprove')}</button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleReject(request.id)}
                  disabled={processingId === request.id}
                >{t('settings.transferRequestReject')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
  borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '8px',
}
const badgeStyle = {
  fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
  borderRadius: '4px', padding: '2px 6px', flexShrink: 0,
}
