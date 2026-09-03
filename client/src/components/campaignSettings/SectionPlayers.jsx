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

// Durée en secondes → « 2 h 15 min » / « 45 min » / « — ». Unités via i18n (jamais codées en dur).
function formatDuration(seconds, t) {
  const s = Math.round(seconds || 0)
  if (s < 60) return t('settings.rosterDurNone')
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h && m) return t('settings.rosterDurHM', { h, m })
  if (h) return t('settings.rosterDurH', { h })
  return t('settings.rosterDurM', { m })
}

function formatStatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function SectionPlayers({ campaignId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [roster, setRoster] = useState([])
  const [campaignStats, setCampaignStats] = useState(null)
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
      setCampaignStats(res.data.campaignStats ?? null)
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

      {!loading && campaignStats && (
        <p style={s.campaignStats}>
          {t('settings.rosterCampaignStats', {
            combats: campaignStats.combatCount,
            duration: formatDuration(campaignStats.combatSeconds, t),
          })}
        </p>
      )}

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
        {player.stats?.online && <span style={s.onlineTag}>● {t('settings.rosterOnline')}</span>}
        <span className={isGm ? 'badge badge-gm' : 'badge badge-player'} style={s.roleBadge}>
          {isGm ? t('dashboard.roleGM') : t('dashboard.rolePlayer')}
        </span>
      </div>

      <ActivityBlock stats={player.stats} t={t} />

      {!isGm && (
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

// Bloc « Activité » — présence par joueur (Lot C). Affiché pour le MJ (seul contenu de sa carte) et
// pour chaque joueur. « Jeu » = temps en session (jeu + édition + combat confondus, un seul socket).
function ActivityBlock({ stats, t }) {
  const lastDate = formatStatDate(stats?.lastConnectedAt)
  return (
    <div style={s.subBlock}>
      <div style={s.subLabel}>{t('settings.rosterActivity')}</div>
      <div style={s.activityRow}>
        <span>{t('settings.rosterStatPlay')} : {formatDuration(stats?.sessionSeconds, t)}</span>
        <span>{t('settings.rosterStatWizard')} : {formatDuration(stats?.wizardSeconds, t)}</span>
        <span>{t('settings.rosterStatVisits', { count: stats?.visitCount ?? 0 })}</span>
        <span>{lastDate ? t('settings.rosterStatLast', { date: lastDate }) : t('settings.rosterStatLastNever')}</span>
      </div>
    </div>
  )
}

const s = {
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  campaignStats: { fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' },
  card: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: '8px', padding: '12px 14px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  playerName: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  onlineTag: { fontSize: '11px', color: 'var(--color-success-soft)' },
  roleBadge: { marginLeft: 'auto' },
  activityRow: {
    display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
    fontSize: '12px', color: 'var(--text-secondary)',
  },
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
