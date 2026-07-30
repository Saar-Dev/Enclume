import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { useSocket } from '../lib/SocketContext'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'

// docs/PLAN_BLESSURES_GUERISON.md §6.1 — panneau joueur "Jets en attente" (Infection uniquement,
// Guérison ne jette jamais de dé). Toujours monté, se peuple lui-même (GET my-pending-rolls au
// montage + événements) — un joueur qui se (re)connecte après qu'un jet lui a été demandé le
// découvre ici, pas seulement via un événement raté entre-temps.
export default function PendingRollsPanel({ campaignId }) {
  const { t } = useTranslation()
  const { t: tChar } = useTranslation('charSheet')
  const socket = useSocket()
  const [echeances, setEcheances] = useState([])
  const [rolling, setRolling] = useState(null)

  const load = useCallback(() => {
    api.get(`/campaigns/${campaignId}/game-echeances/my-pending-rolls`)
      .then(res => setEcheances(res.data.echeances || []))
      .catch(err => console.error('[PendingRollsPanel] load:', err.message))
  }, [campaignId])

  useEffect(() => { load() }, [load])

  // Tous les hooks avant tout retour conditionnel (règle des Hooks) — un seul écouteur
  // GAME_ECHEANCE_RESOLVED couvre à la fois le retrait de la ligne et la remise à zéro de `rolling`.
  useEffect(() => {
    if (!socket) return
    const onPending  = () => load()
    const onResolved = ({ echeanceId }) => {
      setEcheances(prev => prev.filter(e => e.id !== echeanceId))
      setRolling(prev => (prev === echeanceId ? null : prev))
    }
    // Filet de sécurité : si le serveur refuse le jet (socket.emit('error', ...), échéance déjà
    // résolue par ailleurs, etc.), le bouton ne doit pas rester désactivé indéfiniment — pas de
    // moyen de savoir QUELLE échéance a échoué depuis un event générique, donc on débloque tout.
    const onError = () => setRolling(null)
    socket.on(WS.CAMPAIGN_ADVANCE_PENDING, onPending)
    socket.on(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    socket.on('error', onError)
    return () => {
      socket.off(WS.CAMPAIGN_ADVANCE_PENDING, onPending)
      socket.off(WS.GAME_ECHEANCE_RESOLVED, onResolved)
      socket.off('error', onError)
    }
  }, [socket, load])

  if (echeances.length === 0) return null

  // Un par un ou tous d'un coup (choix du joueur, décidé Saar §6) — le clic déclenche simplement
  // l'événement pour chaque échéance choisie, le serveur reste seul autoritaire sur le jet.
  const rollOne = (echeanceId) => {
    if (!socket) return
    setRolling(echeanceId)
    socket.emit(WS.WOUND_INFECTION_ROLL, { echeanceId })
  }
  const rollAll = () => echeances.forEach(e => rollOne(e.id))

  return (
    <div style={styles.panel}>
      <div style={styles.title}>{t('session.pendingRollsTitle')}</div>
      {echeances.map(e => (
        <div key={e.id} style={styles.row}>
          <span>
            {e.characterName} — {e.wound ? `${tChar(LOCATION_I18N_KEYS[e.wound.location])} (${tChar(`locationPanel.severityShort.${e.wound.severity}`)})` : ''}
          </span>
          <button type="button" className="btn btn-tool" disabled={rolling === e.id} onClick={() => rollOne(e.id)}>
            {t('dice.roll')}
          </button>
        </div>
      ))}
      {echeances.length > 1 && (
        <button type="button" className="btn btn-ghost" style={styles.rollAll} onClick={rollAll}>
          {t('dice.roll')} ({echeances.length})
        </button>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: 'fixed', bottom: '16px', right: '16px', width: '320px',
    background: '#16162a', border: '1px solid #2a2a3e', borderRadius: '8px', padding: '12px', zIndex: 190,
  },
  title: { fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0', gap: '8px' },
  rollAll: { marginTop: '8px', width: '100%' },
}
