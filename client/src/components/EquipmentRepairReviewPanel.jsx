import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { useSocket } from '../lib/SocketContext'
import { useCharacterStore } from '../stores/characterStore'

// docs/PLANS/PLAN_USURE&INTEGRITE.md §8 (L6) — boîte de réception MJ des demandes de réparation.
// Panneau AUTONOME (pas de généralisation de BlessuresReviewPanel — N=2, ce dernier est fragile et
// couplé au flux d'avance d'horloge ; on extraira une coquille commune au 3ᵉ panneau, L9). Une
// demande de réparation est ad-hoc, sans rapport avec l'horloge : aucun pied « confirmer l'avance ».
// Se peuple lui-même (GET au montage + EQUIPMENT_REPAIR_UPDATED), comme les autres panneaux Sidebar.
export default function EquipmentRepairReviewPanel({ campaignId }) {
  const { t } = useTranslation()
  const { isGm } = useCharacterStore()
  const socket = useSocket()
  const [echeances, setEcheances] = useState([])
  const [skillOptions, setSkillOptions] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    if (!isGm) return
    api.get(`/campaigns/${campaignId}/game-echeances/repair-requests`)
      .then(res => {
        setEcheances(res.data.echeances || [])
        setSkillOptions(res.data.repairSkillOptions || [])
      })
      .catch(err => console.error('[EquipmentRepairReviewPanel] load:', err.message))
  }, [campaignId, isGm])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!socket || !isGm) return
    const onUpdated = () => load()
    const onResolved = ({ echeanceId }) => setEcheances(prev => prev.filter(e => e.id !== echeanceId))
    socket.on(WS.EQUIPMENT_REPAIR_UPDATED, onUpdated)
    socket.on(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    return () => {
      socket.off(WS.EQUIPMENT_REPAIR_UPDATED, onUpdated)
      socket.off(WS.GAME_ECHEANCE_RESOLVED, onResolved)
    }
  }, [socket, isGm, load])

  if (!isGm || echeances.length === 0) return null

  const decide = async (echeanceId, decision, skillId) => {
    setBusyId(echeanceId)
    try {
      await api.post(`/campaigns/${campaignId}/game-echeances/${echeanceId}/repair-decision`, {
        decision, ...(skillId ? { skillId } : null),
      })
    } catch (err) {
      console.error('[EquipmentRepairReviewPanel] decide:', err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="gm-review-panel">
      <div className="gm-review-title">{t('session.repairReviewTitle')}</div>
      {echeances.map(e => (
        <RepairRow
          key={e.id}
          echeance={e}
          skillOptions={skillOptions}
          busy={busyId === e.id}
          onDecide={decide}
          t={t}
        />
      ))}
    </div>
  )
}

function RepairRow({ echeance: e, skillOptions, busy, onDecide, t }) {
  const [skillId, setSkillId] = useState(e.suggestedSkillId ?? '')

  const itgLabel = e.item?.integrityCurrent != null
    ? `${e.item.integrityCurrent}/${e.item.integrityMax}${e.item.malfunctionSeverity ? ` · ${t(`session.repairPanne.${e.item.malfunctionSeverity}`)}` : ''}`
    : '—'

  return (
    <div className="gm-review-row">
      <div className="gm-review-row-head">
        <span className="gm-review-name">{e.characterName}</span>
        <span className="gm-review-meta">{e.item?.name} · {itgLabel}</span>
      </div>

      {e.status === 'awaiting_player_roll' ? (
        <div className="gm-review-await">{t('session.repairAwaitingPlayer', { character: e.characterName })}</div>
      ) : (
        <div className="gm-review-actions">
          <label className="gm-review-field">
            {t('session.repairSkill')}
            <select value={skillId} onChange={ev => setSkillId(ev.target.value)} disabled={busy}>
              {skillOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          {e.ntMalus < 0 && <span className="gm-review-meta">{t('session.repairNtMalus', { mod: e.ntMalus })}</span>}
          <button type="button" className="btn" disabled={busy}
            onClick={() => onDecide(e.id, 'approve', skillId)}>
            {t('session.repairApprove')}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy}
            onClick={() => onDecide(e.id, 'reject')}>
            {t('session.repairReject')}
          </button>
        </div>
      )}
    </div>
  )
}
