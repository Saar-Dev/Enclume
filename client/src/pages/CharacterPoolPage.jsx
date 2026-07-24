// client/src/pages/CharacterPoolPage.jsx — Pool de personnages (Wizard collaboratif, Lot A3,
// docs/PLAN_WIZARDCOLLAB.md §4.1/§6.2). Jamais "Brouillon" côté texte visible (décision Saar,
// docs/VOCABULARY.md) — "brouillon"/"draft" reste un terme de code interne uniquement.
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

export default function CharacterPoolPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('creation')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pool, setPool] = useState([])
  const [members, setMembers] = useState([])
  const [targetUserId, setTargetUserId] = useState('')
  const [starting, setStarting] = useState(false)

  const formatError = (err) =>
    err.response?.data?.error?.message || err.response?.data?.message || `Erreur ${err.response?.status ?? 'réseau'}`

  // Aucune suppression automatique d'un brouillon abandonné (action destructive, jamais en silence)
  // — décision Saar : afficher la date pour que le MJ juge lui-même. Devient un signal fiable
  // maintenant que chaque étape persiste réellement (plus seulement peek/finalize).
  const formatUpdatedAt = (iso) => {
    if (!iso) return null
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [poolRes, membersRes] = await Promise.all([
        api.get(`/creation/campaign/${campaignId}/drafts`),
        api.get(`/campaigns/${campaignId}/members`).catch(() => ({ data: { members: [] } })),
      ])
      setPool(poolRes.data.drafts ?? [])
      setMembers(membersRes.data.members ?? [])
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  const handleStartFor = async () => {
    if (!targetUserId || starting) return
    setStarting(true)
    setError(null)
    try {
      const res = await api.post('/creation/start', { campaignId, targetUserId })
      navigate(`/campaigns/${campaignId}/creation/${res.data.sheetId}`)
    } catch (err) {
      setError(formatError(err))
      setStarting(false)
    }
  }

  // Membres joueurs n'ayant pas déjà un personnage dans le pool — évite de proposer targetUserId
  // pour quelqu'un qui en a déjà un (startCreation est idempotent côté serveur de toute façon, mais
  // un sélecteur qui ne propose que du pertinent évite la confusion).
  const eligibleMembers = members.filter(
    m => m.role !== 'gm' && !pool.some(d => d.ownerUserId === m.id)
  )

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>← {t('wizard.pool_back')}</button>
        <h1 style={s.title}>{t('wizard.pool_title')}</h1>
      </div>

      {error && <div className="wiz-error">{error}</div>}

      {loading ? (
        <p style={s.empty}>{t('wizard.loading')}</p>
      ) : (
        <>
          <div style={s.list}>
            {pool.length === 0 && <p style={s.empty}>{t('wizard.pool_empty')}</p>}
            {pool.map(d => (
              <div key={d.sheetId} style={s.row}>
                <div style={s.rowInfo}>
                  <span style={s.rowName}>{d.ownerName ?? t('wizard.pool_no_owner')}</span>
                  {d.updatedAt && (
                    <span style={s.rowUpdated}>{t('wizard.pool_updated', { date: formatUpdatedAt(d.updatedAt) })}</span>
                  )}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate(`/campaigns/${campaignId}/creation/${d.sheetId}`)}
                >
                  {t('wizard.pool_open')}
                </button>
              </div>
            ))}
          </div>

          {eligibleMembers.length > 0 && (
            <div style={s.startBlock}>
              <select
                className="wiz1-name-input"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                style={s.select}
              >
                <option value="">{t('wizard.pool_pick_player')}</option>
                {eligibleMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.character_name || m.username}</option>
                ))}
              </select>
              <button className="btn btn-gold" onClick={handleStartFor} disabled={!targetUserId || starting}>
                {starting ? '…' : t('wizard.pool_start_for')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  container: { maxWidth: '640px', margin: '0 auto', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px' },
  title: { color: '#c8c8f0', fontSize: '20px', fontWeight: '700', margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', backgroundColor: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '6px',
  },
  rowInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  rowName: { color: '#c8c8f0', fontSize: '14px', fontWeight: '600' },
  rowUpdated: { color: '#6a6a8a', fontSize: '11px' },
  empty: { color: '#8080a0', fontSize: '13px' },
  startBlock: { display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #1e1e2e' },
  select: { flex: 1 },
}
