import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { useSocket } from '../lib/SocketContext'
import { useCharacterStore } from '../stores/characterStore'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'

// docs/PLAN_BLESSURES_GUERISON.md §6.1 — écran de revue MJ groupé (Lot 2, premier consommateur
// interactif). Se peuple lui-même (GET pending-review au montage + CAMPAIGN_ADVANCE_PENDING) —
// aucun déclenchement depuis GameTimeWidget.jsx : le serveur diffuse cet événement à toute la room
// dès qu'une revue s'ouvre, ce composant, toujours monté, le reçoit comme n'importe quel autre
// client (pas de store dédié "ouvrir la modale" nécessaire, cf. analyse à charge du plan).
export default function BlessuresReviewPanel({ campaignId }) {
  const { t } = useTranslation()
  const { t: tChar } = useTranslation('charSheet')
  const { isGm, characters } = useCharacterStore()
  const socket = useSocket()
  const [echeances, setEcheances] = useState([])

  const load = useCallback(() => {
    if (!isGm) return
    api.get(`/campaigns/${campaignId}/game-echeances/pending-review`)
      .then(res => setEcheances(res.data.echeances || []))
      .catch(err => console.error('[BlessuresReviewPanel] load:', err.message))
  }, [campaignId, isGm])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!socket || !isGm) return
    const onPending  = () => load()
    const onResolved = ({ echeanceId }) => setEcheances(prev => prev.filter(e => e.id !== echeanceId))
    const onCancelled = () => setEcheances([])
    socket.on(WS.CAMPAIGN_ADVANCE_PENDING, onPending)
    socket.on(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    socket.on(WS.CAMPAIGN_ADVANCE_CANCELLED, onCancelled)
    return () => {
      socket.off(WS.CAMPAIGN_ADVANCE_PENDING, onPending)
      socket.off(WS.GAME_ECHEANCE_RESOLVED, onResolved)
      socket.off(WS.CAMPAIGN_ADVANCE_CANCELLED, onCancelled)
    }
  }, [socket, isGm, load])

  if (!isGm || echeances.length === 0) return null

  const healingChoice = (echeanceId, mjChoice, soinsContinues) => {
    api.post(`/campaigns/${campaignId}/game-echeances/${echeanceId}/healing-choice`, {
      mjChoice, ...(soinsContinues !== undefined ? { soinsContinues } : {}),
    }).catch(err => console.error('[BlessuresReviewPanel] healing-choice:', err.message))
  }

  const infectionMode = (echeanceId, mode) => {
    api.post(`/campaigns/${campaignId}/game-echeances/${echeanceId}/infection-mode`, { mode })
      .then(() => { if (mode === 'player') load() })
      .catch(err => console.error('[BlessuresReviewPanel] infection-mode:', err.message))
  }

  const confirmAdvance = () => {
    api.post(`/campaigns/${campaignId}/game-time/confirm-advance`)
      .catch(err => console.error('[BlessuresReviewPanel] confirm-advance:', err.message))
  }
  const cancelAdvance = () => {
    api.post(`/campaigns/${campaignId}/game-time/cancel-advance`)
      .catch(err => console.error('[BlessuresReviewPanel] cancel-advance:', err.message))
  }

  return (
    <div style={styles.panel}>
      <div style={styles.title}>{t('session.woundsReviewTitle')}</div>
      {echeances.map(e => (
        <div key={e.id} style={styles.row}>
          <div style={styles.rowHeader}>
            <span style={styles.characterName}>{e.characterName}</span>
            {e.wound && (
              <span style={styles.woundInfo}>
                {tChar(LOCATION_I18N_KEYS[e.wound.location])} — {tChar(`locationPanel.severityShort.${e.wound.severity}`)}
              </span>
            )}
          </div>
          {e.conditionType === 'wound_healing_check'
            ? <HealingRow echeance={e} onChoice={healingChoice} characters={characters} t={t} />
            : <InfectionRow echeance={e} onMode={infectionMode} t={t} />}
        </div>
      ))}
      <div style={styles.footer}>
        <button type="button" className="btn" onClick={confirmAdvance}>{t('common.confirm')}</button>
        <button type="button" className="btn btn-ghost" onClick={cancelAdvance}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}

// "Contexte RAW" (soin/médecin/matériel) — purement local, jamais envoyé au serveur ni stocké
// (décision Saar 2026-07-30, docs/PLAN_BLESSURES_GUERISON.md §6.1) : une aide à la décision du MJ,
// jamais un calcul. Remis à zéro à chaque nouvelle échéance (state par ligne, pas partagé).
function HealingRow({ echeance, onChoice, characters, t }) {
  const [soin, setSoin] = useState(false)
  const [medecin, setMedecin] = useState(false)
  const [medecinId, setMedecinId] = useState('')
  const [materiel, setMateriel] = useState(false)
  const [soinsContinues, setSoinsContinues] = useState(false)
  const isOneShot = echeance.occurrencesRemaining === null

  return (
    <div style={styles.choiceRow}>
      <div style={styles.contextRow}>
        <label style={styles.contextLabel}>
          <input type="checkbox" checked={soin} onChange={e => setSoin(e.target.checked)} /> {t('session.contextSoin')}
        </label>
        <label style={styles.contextLabel}>
          <input type="checkbox" checked={medecin} onChange={e => setMedecin(e.target.checked)} /> {t('session.contextMedecin')}
        </label>
        {medecin && (
          <select value={medecinId} onChange={e => setMedecinId(e.target.value)} style={styles.medecinSelect}>
            <option value="">{t('session.contextMedecinWho')}</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <label style={styles.contextLabel}>
          <input type="checkbox" checked={materiel} onChange={e => setMateriel(e.target.checked)} /> {t('session.contextMateriel')}
        </label>
      </div>
      <div style={styles.buttonsRow}>
        <button type="button" className="btn" onClick={() => onChoice(echeance.id, 'amelioration')}>
          {t('session.healingAmelioration')}
        </button>
        <button type="button" className="btn btn-ghost"
          onClick={() => onChoice(echeance.id, 'echec', isOneShot ? soinsContinues : undefined)}>
          {t('session.healingEchec')}
        </button>
        {isOneShot && (
          <label style={styles.contextLabel}>
            <input type="checkbox" checked={soinsContinues} onChange={e => setSoinsContinues(e.target.checked)} />
            {t('session.healingSoinsContinues')}
          </label>
        )}
        <button type="button" className="btn btn-danger" onClick={() => onChoice(echeance.id, 'catastrophe')}>
          {t('session.healingCatastrophe')}
        </button>
      </div>
    </div>
  )
}

function InfectionRow({ echeance, onMode, t }) {
  if (echeance.status === 'awaiting_player_roll') {
    return <div style={styles.choiceRow}><span>{t('session.infectionAwaitingPlayer')}</span></div>
  }
  return (
    <div style={styles.choiceRow}>
      <div style={styles.buttonsRow}>
        <button type="button" className="btn" onClick={() => onMode(echeance.id, 'auto')}>
          {t('session.infectionRollsAuto')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onMode(echeance.id, 'player')}>
          {t('session.infectionRollsAskPlayers')}
        </button>
      </div>
    </div>
  )
}

const styles = {
  panel: {
    position: 'fixed', top: '60px', right: '16px', width: '360px', maxHeight: '70vh', overflowY: 'auto',
    background: '#16162a', border: '1px solid #2a2a3e', borderRadius: '8px', padding: '12px', zIndex: 200,
  },
  title: { fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  row: { borderTop: '1px solid #2a2a3e', padding: '8px 0' },
  rowHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' },
  characterName: { fontWeight: '700' },
  woundInfo: { opacity: 0.8 },
  choiceRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  contextRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px' },
  contextLabel: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' },
  medecinSelect: { fontSize: '11px' },
  buttonsRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  footer: { display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #2a2a3e' },
}
