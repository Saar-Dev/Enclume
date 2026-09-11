import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useChanceCountdown } from '../lib/useChanceCountdown.js'

let nextQueueId = 0

// ChancePlayerChoiceCard — prompt joueur pour le choix RAW « gagner 1 Chance / relancer le Test »
// sur SON PROPRE personnage (docs/PLANS/PLAN_CHANCE.md L3e-1). Patron identique à
// CatastropheReviewQueue.jsx (file, pas un slot qui écrase — un joueur multi-personnages pourrait
// recevoir deux entrées quasi simultanées), filtrage par propriété côté client (même diffusion
// room que CHANCE_CHOICE_PENDING, pas de ciblage serveur par socket, patron `repair_request`).
// Les entrées PNJ sont ignorées ici — affichées au MJ par CatastropheChoiceQueue.jsx.
export default function ChancePlayerChoiceCard({ socket }) {
  const { t } = useTranslation('combat')
  const { characters } = useCharacterStore()
  const userId = useAuthStore(s => s.user?.id)

  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (!socket) return
    const onPending = (data) => {
      const character = characters.find(c => c.id === data.characterId)
      if (!character || character.type !== 'pj' || character.user_id !== userId) return
      setQueue(q => [...q, { ...data, _queueId: nextQueueId++ }])
    }
    const onResolved = (data) => {
      setQueue(q => q.filter(item => item.id !== data.id))
    }
    socket.on(WS.CHANCE_CHOICE_PENDING, onPending)
    socket.on(WS.CHANCE_CHOICE_RESOLVED, onResolved)
    return () => {
      socket.off(WS.CHANCE_CHOICE_PENDING, onPending)
      socket.off(WS.CHANCE_CHOICE_RESOLVED, onResolved)
    }
  }, [socket, characters, userId])

  const current = queue[0] ?? null
  const remainingSeconds = useChanceCountdown(current?.rolledAt, current?.timeoutMs)

  const resolve = useCallback((choice) => {
    if (!socket || !current) return
    socket.emit(WS.CHANCE_CHOICE_RESOLVE, { pendingId: current.id, choice })
    setQueue(q => q.filter(item => item._queueId !== current._queueId))
  }, [socket, current])

  if (!current) return null

  return (
    <div className="chance-choice-overlay">
      <div className="chance-choice-card">
        <div className="chance-choice-title">{t('chance.choiceCard.title')}</div>
        <div className="chance-choice-test-label">{current.testLabel}</div>

        <div className="chance-choice-actions">
          <button className="btn-ghost" onClick={() => resolve('reroll')}>
            {t('chance.choiceCard.rerollButton')}
          </button>
          <button className="btn btn-gold" onClick={() => resolve('gain_point')}>
            {t('chance.choiceCard.gainPointButton')}
          </button>
        </div>
        {remainingSeconds != null && (
          <div className="chance-choice-countdown">{t('chance.choiceCard.autoResolveIn', { seconds: remainingSeconds })}</div>
        )}
      </div>
      {queue.length > 1 && (
        <span className="badge chance-choice-queue-badge">+{queue.length - 1}</span>
      )}
    </div>
  )
}
