import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { getSetbackBlockCount, resolveSetback } from '../../../../shared/careerSetbacks.js'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'

// OPT-06 (revers) — sous-step dédiée de Step4Experience, autonome (pas de dépendance à
// CareersAllocator.jsx — les deux composants ne sont jamais montés en même temps, un seul
// sous-step actif à la fois, donc aucune coordination nécessaire sur l'écouteur DICE_RESULT).
// Jet 1D100 obligatoire (pas de case à cocher, pas d'alternative) sur le total d'années
// d'expérience CUMULÉES — voir shared/careerSetbacks.js.
export default function SetbacksAllocator({ totalYears, setbackRows, initialRolls, onRollsChange, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()

  const [rolls, setRolls] = useState(initialRolls ?? [])
  const [awaitingBlock, setAwaitingBlock] = useState(null)
  const [awaitingPayload, setAwaitingPayload] = useState(null)

  const blockCount = getSetbackBlockCount(totalYears)

  useEffect(() => {
    onRollsChange?.(rolls)
  }, [rolls, onRollsChange])

  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id) return
      if (awaitingBlock === null) return
      // socketDice.js n'inclut jamais dieType dans le payload DICE_RESULT — ce composant ne lance
      // jamais que '1d100' (formule fixe), dieType 'd100' en dur (P56, pattern CareersAllocator.jsx).
      setAwaitingPayload({ ...payload, dieType: 'd100' })
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id, awaitingBlock])

  const handleStartRoll = (blockIndex) => {
    if (!socket || awaitingBlock !== null) return
    setAwaitingBlock(blockIndex)
    socket.emit(WS.DICE_ROLL, { formula: '1d100' })
  }

  const handleOverlayDone = () => {
    if (!awaitingPayload || awaitingBlock === null) return
    setRolls(prev => [...prev, { blockIndex: awaitingBlock, roll: awaitingPayload.total }])
    setAwaitingBlock(null)
    setAwaitingPayload(null)
  }

  const allRolled = rolls.length >= blockCount
  const blocks = Array.from({ length: blockCount }, (_, i) => i)

  return (
    <div className="wiz4-cols">
      {awaitingPayload && (
        <div className="wiz4-diceoverlay">
          <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
            <DiceLights />
            <DiceRoller payload={awaitingPayload} onDone={handleOverlayDone} />
          </Canvas>
        </div>
      )}

      <div className="wiz4-main">
        <div className="wiz4-block">
          <span className="wiz4-h">{t('step4.setback_title')}</span>
          <p className="wiz4-note">{t('step4.setback_intro')}</p>

          {blocks.map(blockIndex => {
            const pick = rolls.find(r => r.blockIndex === blockIndex)
            const resolved = pick ? resolveSetback(pick.roll, setbackRows) : null
            const yearReached = 13 + blockIndex * 3
            const isAwaitingThis = awaitingBlock === blockIndex

            return (
              <div key={blockIndex} className="wiz4-randomrow">
                <div className="wiz4-randomhead">
                  <span className="wiz4-randomlbl">{t('step4.setback_block', { year: yearReached })}</span>
                  {!pick && (
                    <button
                      className={`wiz4-rollbtn${awaitingBlock !== null ? ' dis' : ''}`}
                      onClick={() => handleStartRoll(blockIndex)}
                      disabled={awaitingBlock !== null}
                    >
                      {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.setback_roll_btn')}
                    </button>
                  )}
                </div>
                {pick && resolved && (
                  <div className="wiz4-randomresult">
                    <p className="wiz4-note"><strong>{resolved.name}</strong> ({pick.roll})</p>
                    <p className="wiz4-note">{resolved.description}</p>
                    <p className="wiz4-note">{t('step4.career_random_narrative_note')}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="wiz4-foot">
          <button className="wiz4-prev" onClick={onPrev}>{t('step4.prev')}</button>
          <span className={`wiz4-status${allRolled ? ' ok' : ''}`}>
            {allRolled ? t('step4.career_status_ok') : t('step4.setback_status_left')}
          </span>
          <button className={`wiz4-next${allRolled ? '' : ' dis'}`} onClick={onNext} disabled={!allRolled}>
            {t('step4.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
