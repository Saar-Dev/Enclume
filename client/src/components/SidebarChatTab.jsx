import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import { useCombatStore } from '../stores/combatStore'
import { WS } from '../../../shared/events.js'
import { CombatDeclareLogChatPanel } from './CombatDeclareLog.jsx'
import { renderMessage } from './MessageRendererRegistry.jsx'
import { styles } from './Sidebar.styles.js'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 4d) — comportement inchangé.
// breakdownPopover/onOpenBreakdown/setPendingActionCount viennent des hooks useDiceBreakdownPopover
// et useSidebarPendingActionsBadge, qui restent appelés dans Sidebar.jsx (popover et badge sont
// rendus hors du contenu d'onglet).
export default function SidebarChatTab({
  socket,
  breakdownPopover,
  onOpenBreakdown,
  setPendingActionCount,
  onEntityActionResolve,
  onOpenTrade,
  onOpenExchange,
}) {
  const { t } = useTranslation()
  const { t: tCombat } = useTranslation('combat')
  const { isGm } = useCharacterStore()
  const { messagesByCampaign, activeCampaignId } = useSessionStore()
  const { phase } = useCombatStore()
  const messages = useMemo(
    () => messagesByCampaign[activeCampaignId] || [],
    [activeCampaignId, messagesByCampaign],
  )

  const [chatInput, setChatInput] = useState('')
  const [cdlOpen, setCdlOpen] = useState(true)

  // Animation dé — id du dernier message dé reçu, nettoyé après 800ms.
  // Déclenchement pendant le render (pattern React "adjusting state" — évite un setState
  // synchrone en corps d'effet, react-hooks/set-state-in-effect) ; extinction dans un effet
  // dédié keyé sur animatingDiceId, indépendant des messages non-dé qui arrivent entre temps
  // (corrige un bug latent : l'ancien effet, keyé sur `[messages]`, annulait le timer sur tout
  // nouveau message sans le relancer si ce n'était pas un dé — l'icône restait alors animée
  // indéfiniment si un message texte arrivait avant les 800ms).
  const [animatingDiceId, setAnimatingDiceId] = useState(null)
  const [lastDiceId, setLastDiceId] = useState(null)
  const [prevMessages, setPrevMessages] = useState(messages)
  if (messages !== prevMessages) {
    setPrevMessages(messages)
    const lastDice = [...messages].reverse().find(m => m.type === 'dice')
    if (lastDice && lastDice.id !== lastDiceId) {
      setLastDiceId(lastDice.id)
      setAnimatingDiceId(lastDice.id)
    }
  }
  useEffect(() => {
    if (animatingDiceId == null) return undefined
    const timer = setTimeout(() => setAnimatingDiceId(null), 800)
    return () => clearTimeout(timer)
  }, [animatingDiceId])

  // Réf pour l'auto-scroll — pointe sur un div vide en fin de liste de messages
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (e) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return

    // Commandes dés : /r <formule> ou /roll <formule>
    // Le client émet DICE_ROLL — le serveur calcule et broadcaste DICE_RESULT.
    // Le message ne part PAS dans le chat.
    const diceMatch = text.match(/^\/r(?:oll)?\s+(.+)$/i)
    if (diceMatch) {
      const formula = diceMatch[1].trim()
      if (formula) socket?.emit(WS.DICE_ROLL, { formula })
      setChatInput('')
      return
    }

    // /help, /w, /gm sont interceptés côté serveur (socketChat.js, chatCommandRegistry) — le
    // client envoie le texte brut, pas de parsing dupliqué ici.
    socket?.emit(WS.CHAT_SEND, { channelId: 'general', type: 'TEXT', payload: { text } })
    setChatInput('')
  }

  return (
    <>
      {(phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && (
        <CombatDeclareLogChatPanel isOpen={cdlOpen} onToggle={() => setCdlOpen(v => !v)} />
      )}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <p style={styles.emptyMsg}>{t('chat.placeholder')}</p>
        )}
        {messages.map(msg => renderMessage(msg, {
          t, tCombat, isGm,
          animatingDiceId,
          breakdownPopoverMsgId: breakdownPopover?.msgId,
          onOpenBreakdown,
          setPendingActionCount,
          onEntityActionResolve,
          onOpenTrade,
          onOpenExchange,
        }))}
        {/* Ancre auto-scroll — div vide en fin de liste */}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={styles.chatForm}>
        <input
          className="sidebar-tool-field" style={styles.chatInput}
          placeholder={t('chat.placeholder')}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
        />
        <button className="btn-icon" type="submit" style={{ color: 'var(--color-primary)', fontSize: '14px' }}>➤</button>
      </form>
    </>
  )
}
