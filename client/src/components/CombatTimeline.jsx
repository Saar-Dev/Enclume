import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import TimelineCard from './TimelineCard'

const MAX_CARDS = 12

export default function CombatTimeline({ characters, topOffset = 0, onPortraitClick, actionTimerSec = 0 }) {
  const { roster, actions, phase, activeTokenId, activeSlotIdx, currentTurn } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // ── Timer de tour (ANNOUNCEMENT uniquement) ──────────────────────────────────
  // Se remet à zéro à chaque changement de slot actif.
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    if (!actionTimerSec || phase !== 'ANNOUNCEMENT') {
      setSecondsLeft(null)
      return
    }
    setSecondsLeft(actionTimerSec)
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === null || prev <= 1) { clearInterval(id); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [activeTokenId, phase, actionTimerSec])

  if (!phase || phase === 'ROSTER' || roster.length === 0) return null

  // ── Dériver les cartes selon la phase ────────────────────────────────────────
  let cards
  if (phase === 'ANNOUNCEMENT') {
    cards = [...roster]
      .sort((a, b) => a.initiative - b.initiative)
      .map(entry => {
        const token = tokens.find(t => t.id === entry.token_id)
        const char  = token ? characters.find(c => c.id === token.character_id) : null
        return {
          key:           `r-${entry.token_id}`,
          portraitUrl:   char?.portrait_url ?? null,
          label:         token?.label ?? '?',
          initiative:    entry.initiative,
          worstSeverity: char?.worst_wound_severity ?? null,
          isPnj:         char?.type === 'pnj',
          hasAnnounced:  entry.has_announced ?? false,
          isSurprised:   entry.is_surprised ?? false,
          isActive:      entry.token_id === activeTokenId,
        }
      })
  } else {
    cards = [...actions]
      .sort((a, b) => a.sequence - b.sequence)
      .map((action, idx) => {
        const token       = tokens.find(t => t.id === action.token_id)
        const char        = token ? characters.find(c => c.id === token.character_id) : null
        const rosterEntry = roster.find(r => r.token_id === action.token_id)
        return {
          key:           `a-${action.id}`,
          portraitUrl:   char?.portrait_url ?? null,
          label:         token?.label ?? '?',
          initiative:    rosterEntry?.initiative ?? 0,
          worstSeverity: char?.worst_wound_severity ?? null,
          isPnj:         char?.type === 'pnj',
          hasAnnounced:  false,
          isSurprised:   false,
          isActive:      idx === activeSlotIdx,
        }
      })
  }

  const visible  = cards.slice(0, MAX_CARDS)
  const overflow = Math.max(0, cards.length - MAX_CARDS)
  const isAnnouncement = phase === 'ANNOUNCEMENT'

  // Couleur timer : vert → orange → rouge
  const timerColor = secondsLeft === null ? '#50c878'
    : secondsLeft > actionTimerSec * 0.5 ? '#50c878'
    : secondsLeft > actionTimerSec * 0.25 ? '#e0a050'
    : '#e05050'

  return (
    <div style={styles.bar(topOffset)}>

      {/* Timer + Tour N — ancrage gauche */}
      <div style={styles.leftPanel}>
        {secondsLeft !== null && (
          <div style={styles.timer(timerColor)}>
            {secondsLeft}
          </div>
        )}
        <div style={styles.turnLabel}>
          Tour {currentTurn}
        </div>
      </div>

      {/* Cartes */}
      <div style={styles.cardList}>
        <LayoutGroup>
          <AnimatePresence initial={false}>
            {visible.map(card => (
              <motion.div
                key={card.key}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ flexShrink: 0 }}
              >
                <TimelineCard
                  portraitUrl={card.portraitUrl}
                  label={card.label}
                  initiative={card.initiative}
                  isActive={card.isActive}
                  hasAnnounced={card.hasAnnounced}
                  isSurprised={card.isSurprised}
                  worstSeverity={card.worstSeverity}
                  isPnj={card.isPnj}
                  onClick={onPortraitClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </LayoutGroup>

        {overflow > 0 && (
          <div style={styles.overflow}>+{overflow}</div>
        )}
      </div>

      {/* Indicateur phase + flèche — ancrage droite */}
      <div style={styles.phaseIndicator}>
        <span style={styles.phaseLabel}>
          {isAnnouncement ? 'Annonce' : 'Résolution'}
        </span>
        <span style={styles.phaseArrow(isAnnouncement)}>
          {isAnnouncement ? '←' : '→'}
        </span>
      </div>

    </div>
  )
}

const styles = {
  bar: (topOffset) => ({
    position: 'absolute',
    top: topOffset,
    left: 0,
    right: 'var(--sidebar-w, 0px)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: '10px 14px',
    background: 'rgba(10,10,20,0.88)',
    borderBottom: '1px solid #2a2a3e',
    pointerEvents: 'auto',
    zIndex: 10,
  }),
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingBottom: 4,
    flexShrink: 0,
    gap: 2,
  },
  timer: (color) => ({
    fontSize: 22,
    fontWeight: 700,
    color,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    transition: 'color 0.5s ease',
  }),
  turnLabel: {
    fontSize: 10,
    color: '#55558a',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    flex: 1,
  },
  overflow: {
    fontSize: 11,
    color: '#55558a',
    fontWeight: 600,
    paddingBottom: 6,
    paddingLeft: 4,
    flexShrink: 0,
  },
  phaseIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    paddingBottom: 6,
    flexShrink: 0,
  },
  phaseLabel: {
    fontSize: 10,
    color: '#55558a',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  phaseArrow: (isAnnouncement) => ({
    fontSize: 18,
    color: isAnnouncement ? '#e0a050' : '#50c878',
    lineHeight: 1,
    fontWeight: 700,
  }),
}
