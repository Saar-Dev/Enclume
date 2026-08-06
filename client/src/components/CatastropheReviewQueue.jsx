import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { CATASTROPHE_EFFECT_TABLE, findCatastropheEntry } from '../../../shared/catastropheEffectTable.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useTokenStore } from '../stores/tokenStore'

let nextQueueId = 0

// CatastropheReviewQueue — file de validation MJ pour la Catastrophe automatique en combat
// (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1). MJ uniquement, toujours monté (même patron que
// EnvironmentalResultQueue.jsx/DicePanel) : jamais gaté au mode combat côté client, la garde combat
// actif est déjà appliquée côté serveur (maybeTriggerCatastrophe). Vraie file (tableau), pas un slot
// qui écrase — un même échange (attaque + défense) peut produire deux entrées quasi simultanées (§8
// point 2 du plan). Source de vérité : CATASTROPHE_PENDING (création + resync SESSION_JOIN pour un
// MJ reconnectant, server/src/socket/index.js), jamais un état local seul.
export default function CatastropheReviewQueue({ socket }) {
  const { t } = useTranslation('combat')
  const { isGm } = useCharacterStore()
  const tokens = useTokenStore(s => s.tokens)

  const [queue, setQueue] = useState([])
  const [overrideEntry, setOverrideEntry] = useState('')

  useEffect(() => {
    if (!socket) return
    const onPending = (data) => {
      setQueue(q => [...q, { ...data, _queueId: nextQueueId++ }])
    }
    const onApplied = (data) => {
      setQueue(q => q.filter(item => item.id !== data.id))
    }
    socket.on(WS.CATASTROPHE_PENDING, onPending)
    socket.on(WS.CATASTROPHE_APPLIED, onApplied)
    return () => {
      socket.off(WS.CATASTROPHE_PENDING, onPending)
      socket.off(WS.CATASTROPHE_APPLIED, onApplied)
    }
  }, [socket])

  const current = queue[0] ?? null

  useEffect(() => { setOverrideEntry('') }, [current?.id])

  const resolve = useCallback((override) => {
    if (!socket || !current) return
    socket.emit(WS.CATASTROPHE_RESOLVE, { pendingId: current.id, override })
    setQueue(q => q.filter(item => item._queueId !== current._queueId))
  }, [socket, current])

  if (!isGm || !current) return null

  const entry = findCatastropheEntry(current.tableEntry)
  const tokenLabel = tokens.find(tk => tk.id === current.tokenId)?.label ?? '?'

  return (
    <div className="catastrophe-review-overlay">
      <div className="catastrophe-review-card">
        <div className="catastrophe-review-title">{t('catastrophePopup')} — {tokenLabel}</div>
        <div className="catastrophe-review-entry-name">{t(`catastrophe.${entry.key}.name`)}</div>
        <div className="catastrophe-review-entry-effect">{t(`catastrophe.${entry.key}.effect`)}</div>

        <div className="catastrophe-review-actions">
          <button className="btn btn-gold" onClick={() => resolve(null)}>
            {t('overlay.validateButton')}
          </button>
        </div>

        <div className="catastrophe-review-override-row">
          <select
            value={overrideEntry}
            onChange={(e) => setOverrideEntry(e.target.value)}
          >
            <option value="">{t('catastrophe.overridePlaceholder')}</option>
            {CATASTROPHE_EFFECT_TABLE.map(opt => (
              <option key={opt.index} value={opt.index}>
                {opt.index} — {t(`catastrophe.${opt.key}.name`)}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost"
            disabled={!overrideEntry}
            onClick={() => resolve(Number(overrideEntry))}
          >
            {t('catastrophe.applyOverride')}
          </button>
        </div>
      </div>
      {queue.length > 1 && (
        <span className="badge catastrophe-review-queue-badge">+{queue.length - 1}</span>
      )}
    </div>
  )
}
