import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { WS } from '../../../shared/events.js'
import { useCombatStore } from '../stores/combatStore'
import { useTokenStore } from '../stores/tokenStore'
import TimelineCard from './TimelineCard'

const MAX_CARDS = 12

export default function CombatTimeline({ characters, topOffset = 0, onPortraitClick, actionTimerSec = 0, socket, isGm = false, myTokenIds = null }) {
  const { t } = useTranslation('combat')
  const { roster, phase, subPhase, activeTokenId, currentTurn, timelineEntries, currentStep } = useCombatStore()
  const tokens = useTokenStore(s => s.tokens)

  // ── Timer ANNOUNCEMENT uniquement — Retarder son Action n'a plus de minuteur dédié (Session 159,
  // retour Saar : RAW REGLESYSCOMBAT.md:554-567 ne prévoit aucun compte à rebours). ─────────────────
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (actionTimerSec && phase === 'ANNOUNCEMENT') {
      setSecondsLeft(actionTimerSec)
      const id = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev === null || prev <= 1) { clearInterval(id); return 0 }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(id)
    }
    setSecondsLeft(null)
  }, [activeTokenId, phase, actionTimerSec])

  if (!phase || phase === 'ROSTER' || roster.length === 0) return null

  // ── Dériver les cartes selon la phase ────────────────────────────────────────
  let cards = []
  let waitingCards = []
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
          isDimmed:      (entry.has_announced ?? false) && entry.token_id !== activeTokenId,
        }
      })
  } else if (phase === 'RESOLUTION') {
    // Une carte par entrée de l'échelle (pas par personnage, §6quater) — un token en série d'attaques
    // multiples apparaît autant de fois que d'entrées. Résolues/perdues/passées restent visibles
    // (dimmées) comme historique du Tour, cohérent avec le comportement déjà existant en ANNOUNCEMENT/
    // ancienne RÉSOLUTION (idx < activeSlotIdx) — « pas d'icône dédiée » (§6quater) : même traitement
    // visuel `isDimmed` que resolved, aucune distinction lost/skipped à l'affichage.
    const scaleEntries = timelineEntries
      .filter(e => e.status !== 'delayed_waiting')
      .sort((a, b) => (b.phase_position ?? 0) - (a.phase_position ?? 0))
      .map(entry => {
        const token = tokens.find(t => t.id === entry.token_id)
        const char  = token ? characters.find(c => c.id === token.character_id) : null
        return {
          key:           `e-${entry.id}`,
          portraitUrl:   char?.portrait_url ?? null,
          label:         token?.label ?? '?',
          initiative:    entry.phase_position != null ? Math.round(entry.phase_position / 100) : null,
          worstSeverity: char?.worst_wound_severity ?? null,
          isPnj:         char?.type === 'pnj',
          hasAnnounced:  false,
          isSurprised:   false,
          isActive:      currentStep?.kind === 'entry' && currentStep.entry?.id === entry.id,
          isDimmed:      entry.status !== 'scheduled',
        }
      })
    // Token sans aucune entrée ce Tour (actions simples seulement, §5 « portée des entrées ») dont
    // c'est le pas courant — pas de ligne combat_timeline_entries à représenter, carte éphémère
    // dérivée uniquement de currentStep pour ne pas régresser la visibilité déjà offerte avant ce Lot.
    if (currentStep?.kind === 'simple') {
      const token = tokens.find(t => t.id === currentStep.tokenId)
      const char  = token ? characters.find(c => c.id === token.character_id) : null
      const rosterEntry = roster.find(r => r.token_id === currentStep.tokenId)
      scaleEntries.unshift({
        key:           `s-${currentStep.tokenId}`,
        portraitUrl:   char?.portrait_url ?? null,
        label:         token?.label ?? '?',
        initiative:    rosterEntry?.initiative ?? null,
        worstSeverity: char?.worst_wound_severity ?? null,
        isPnj:         char?.type === 'pnj',
        hasAnnounced:  false,
        isSurprised:   false,
        isActive:      true,
        isDimmed:      false,
      })
    }
    cards = scaleEntries

    // Zone « en attente » — une carte par personnage en délai (pas par entrée, §6 point 7 : « le
    // portrait est le déclencheur »). Cliquable dès que le pas normal à résoudre atteint (ou dépasse)
    // sa propre phase d'Initiative d'origine — jamais avant (RAW REGLESYSCOMBAT.md:554-567 : Retarder
    // décale l'Action vers plus tard, jamais plus tôt — retour Saar, Session 159, corrige une régression
    // introduite en retirant le minuteur : la borne qui comptait n'était pas le temps, c'était la
    // position) — ou au tour obligatoire de CE token précis (§6quater). Seulement si ce viewer le
    // contrôle (joueur → son propre token ; MJ → n'importe lequel, myTokenIds === null).
    const delayedTokenIds = [...new Set(
      timelineEntries.filter(e => e.status === 'delayed_waiting').map(e => e.token_id)
    )]
    waitingCards = delayedTokenIds.map(tokenId => {
      const token = tokens.find(t => t.id === tokenId)
      const char  = token ? characters.find(c => c.id === token.character_id) : null
      const rosterEntry = roster.find(r => r.token_id === tokenId)
      const ownPosition = (rosterEntry?.initiative ?? 0) * 100
      const isReactive   = subPhase === 'SLOT_ACTIVE' && currentStep?.kind !== 'delayed_turn'
        && currentStep?.position != null && currentStep.position <= ownPosition
      const isObligatory = currentStep?.kind === 'delayed_turn' && currentStep.tokenId === tokenId
      const controllable = isGm || (myTokenIds?.includes(tokenId) ?? false)
      return {
        key:         `w-${tokenId}`,
        tokenId,
        portraitUrl: char?.portrait_url ?? null,
        label:       token?.label ?? '?',
        isPnj:       char?.type === 'pnj',
        worstSeverity: char?.worst_wound_severity ?? null,
        clickable:   controllable && (isReactive || isObligatory),
        isActive:    isObligatory,
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
    <div className="combat-timeline-bar" style={{ top: topOffset }}>

      {/* Tour N + Phase + Collapse — ancrage gauche */}
      <div style={styles.leftPanel}>
        {secondsLeft !== null && (
          <div style={styles.timer(timerColor)}>
            {secondsLeft}
          </div>
        )}
        <div style={styles.turnLabel}>{t('timeline.turn', { turn: currentTurn })}</div>
        <span style={styles.phaseLabel}>{isAnnouncement ? t('timeline.announcement') : t('timeline.resolution')}</span>
        <span style={styles.phaseArrow(isAnnouncement)}>{isAnnouncement ? '←' : '→'}</span>
        <button style={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Cartes */}
      {!collapsed && (
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
                    isDimmed={card.isDimmed ?? false}
                    onClick={onPortraitClick}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </LayoutGroup>

          {overflow > 0 && (
            <div style={styles.overflow}>+{overflow}</div>
          )}

          {/* Zone « en attente » — personnages ayant retardé leur Action (docs/PLAN_COMBAT_TIMELINE.md
              §6 point 7 : le portrait est le déclencheur, pas de composant séparé). Visible de tous,
              seule l'interaction est limitée par les permissions (§6quater). */}
          {waitingCards.length > 0 && (
            <div style={styles.waitingZone}>
              <span style={styles.waitingLabel}>{t('timeline.waiting')}</span>
              <LayoutGroup>
                <AnimatePresence initial={false}>
                  {waitingCards.map(card => (
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
                        initiative={null}
                        isActive={card.isActive}
                        hasAnnounced={false}
                        isSurprised={false}
                        worstSeverity={card.worstSeverity}
                        isPnj={card.isPnj}
                        isDimmed={!card.clickable}
                        onClick={card.clickable ? () => socket?.emit(WS.COMBAT_ACT_NOW, { tokenId: card.tokenId }) : undefined}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

const styles = {
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
    justifyContent: 'center',
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
  waitingZone: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeft: '1px dashed rgba(255,255,255,0.15)',
  },
  waitingLabel: {
    fontSize: 8,
    color: '#8888b0',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    alignSelf: 'center',
    marginRight: 2,
    whiteSpace: 'nowrap',
  },
  phaseLabel: {
    fontSize: 9,
    color: '#55558a',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  phaseArrow: (isAnnouncement) => ({
    fontSize: 14,
    color: isAnnouncement ? '#e0a050' : '#50c878',
    lineHeight: 1,
    fontWeight: 700,
  }),
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: '#44446a',
    fontSize: 7,
    cursor: 'pointer',
    padding: '1px 2px',
    lineHeight: 1,
    marginTop: 2,
  },
}
