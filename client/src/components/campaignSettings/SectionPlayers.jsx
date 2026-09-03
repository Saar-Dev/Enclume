// client/src/components/campaignSettings/SectionPlayers.jsx
// Onglet « Joueurs » de la Configuration — vue MJ du roster : chaque joueur inscrit, les personnages
// qu'il possède dans la campagne (par type, prêt ou création en cours), et ses demandes de transfert
// depuis le Coffre. Remplace l'ancienne page /campaigns/:id/pool (CharacterPoolPage, supprimée) et
// l'ancien contenu « demandes de transfert seules » de cet onglet.
//
// Source unique : GET /campaigns/:id/roster (campaignRosterService). La carte MJ ne liste pas de
// personnages (emplacement `stats` réservé, Lot présence en pause) et apparaît en dernier — tri fait
// côté serveur. Décisions Saar 2026-09-03.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { sharedStyles as styles } from './sharedStyles'

const TYPE_LABEL_KEY = { pj: 'vault.typePj', pnj: 'vault.typePnj', drone: 'vault.typeDrone', exo: 'vault.typeExo' }

export default function SectionPlayers({ campaignId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // `busyId` : id d'une demande de transfert en cours de traitement, ou `start:<userId>` pour un
  // démarrage de création — verrouille les boutons concernés sans bloquer le reste de la vue.
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get(`/campaigns/${campaignId}/roster`)
      setRoster(res.data.roster)
    } catch { setError(t('settings.rosterErrorLoad')) }
    finally { setLoading(false) }
  }, [campaignId, t])

  useEffect(() => { load() }, [load])

  const processTransfer = async (requestId, action, errKey) => {
    setBusyId(requestId)
    setError(null)
    try {
      await api.post(`/vault/transfer-requests/${requestId}/${action}`)
      await load()
    } catch {
      setError(t(errKey))
    } finally {
      setBusyId(null)
    }
  }

  const handleStartCreation = async (userId) => {
    setBusyId(`start:${userId}`)
    setError(null)
    try {
      const res = await api.post('/creation/start', { campaignId, targetUserId: userId })
      navigate(`/campaigns/${campaignId}/creation/${res.data.sheetId}`)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('settings.rosterStartError'))
      setBusyId(null)
    }
  }

  const openSheet = (characterId) => navigate(`/campaigns/${campaignId}/characters/${characterId}/sheet`)
  const resumeDraft = (sheetId) => navigate(`/campaigns/${campaignId}/creation/${sheetId}`)

  return (
    <section className="card">
      <h2 style={styles.sectionTitle}>{t('settings.sectionPlayers')}</h2>

      {error && <p style={{ ...styles.placeholderText, color: 'var(--color-danger)' }}>{error}</p>}

      {loading ? (
        <p style={styles.placeholderText}>{t('common.loading')}</p>
      ) : roster.length === 0 ? (
        <p style={styles.placeholderText}>{t('settings.rosterEmpty')}</p>
      ) : (
        <div style={s.list}>
          {roster.map(player => (
            <PlayerCard
              key={player.userId}
              player={player}
              t={t}
              busyId={busyId}
              onApprove={(id) => processTransfer(id, 'approve', 'settings.transferRequestErrorApprove')}
              onReject={(id) => processTransfer(id, 'reject', 'settings.transferRequestErrorReject')}
              onOpenSheet={openSheet}
              onResumeDraft={resumeDraft}
              onStartCreation={handleStartCreation}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PlayerCard({ player, t, busyId, onApprove, onReject, onOpenSheet, onResumeDraft, onStartCreation }) {
  const isGm = player.role === 'gm'
  const hasDraft = player.characters.some(c => c.status === 'draft')

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.playerName}>{player.username}</span>
        <span className={isGm ? 'badge badge-gm' : 'badge badge-player'}>
          {isGm ? t('dashboard.roleGM') : t('dashboard.rolePlayer')}
        </span>
      </div>

      {isGm ? (
        <p style={styles.placeholderText}>{t('settings.rosterGmStatsSoon')}</p>
      ) : (
        <>
          <div style={s.subBlock}>
            <div style={s.subLabel}>{t('settings.rosterCharacters')}</div>
            {player.characters.length === 0 ? (
              <p style={styles.placeholderText}>{t('settings.rosterNoCharacter')}</p>
            ) : (
              player.characters.map(c => (
                <div key={c.id} style={s.row}>
                  <span style={s.rowName}>{c.name || t('settings.rosterUnnamed')}</span>
                  <span style={s.typeTag}>{t(TYPE_LABEL_KEY[c.type] ?? 'vault.typePnj')}</span>
                  {!c.visible && <span style={s.hiddenTag}>{t('settings.rosterHidden')}</span>}
                  {c.status === 'draft' ? (
                    <button className="btn btn-ghost" style={s.rowBtn} onClick={() => onResumeDraft(c.sheetId)}>
                      {t('settings.rosterResume')}
                    </button>
                  ) : (
                    <button className="btn btn-ghost" style={s.rowBtn} onClick={() => onOpenSheet(c.id)}>
                      {t('settings.rosterOpenSheet')}
                    </button>
                  )}
                </div>
              ))
            )}
            {!hasDraft && (
              <button
                className="btn btn-ghost"
                style={s.startBtn}
                disabled={busyId === `start:${player.userId}`}
                onClick={() => onStartCreation(player.userId)}
              >
                {t('settings.rosterStartCreation')}
              </button>
            )}
          </div>

          {player.transferRequests.length > 0 && (
            <div style={s.subBlock}>
              <div style={s.subLabel}>{t('settings.transferRequestsTitle')}</div>
              {player.transferRequests.map(r => (
                <div key={r.id} style={s.row}>
                  <span style={s.rowName}>{r.characterName}</span>
                  <span style={s.typeTag}>{t(TYPE_LABEL_KEY[r.characterType] ?? 'vault.typePnj')}</span>
                  <div style={s.rowActions}>
                    <button className="btn btn-ghost" disabled={busyId === r.id} onClick={() => onApprove(r.id)}>
                      {t('settings.transferRequestApprove')}
                    </button>
                    <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => onReject(r.id)}>
                      {t('settings.transferRequestReject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: '8px', padding: '12px 14px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  playerName: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  subBlock: { display: 'flex', flexDirection: 'column', gap: '6px' },
  subLabel: {
    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  row: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  rowName: { fontSize: '13px', color: 'var(--text-primary)' },
  rowActions: { display: 'flex', gap: '8px', marginLeft: 'auto' },
  rowBtn: { marginLeft: 'auto' },
  startBtn: { alignSelf: 'flex-start', marginTop: '2px' },
  typeTag: {
    fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
    borderRadius: '4px', padding: '2px 6px',
  },
  hiddenTag: { fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' },
}
