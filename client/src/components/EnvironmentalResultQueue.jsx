import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useTokenStore } from '../stores/tokenStore'
import { CombatResultGM, CombatResultPlayer } from './CombatResultPanels'

let nextQueueId = 0

// EnvironmentalResultQueue — file d'attente pour les résultats de dangers environnementaux
// (Froid/Feu/Acide/Décompression) hors du mode combat (bug trouvé par Saar, docs/
// PLAN_FATIGUE_DOMMAGES.md §11 Lot 5). `CombatOverlay.jsx` (gmAttackResult/pnjAttackResult) n'est
// monté que si mode==='combat' et ne garde qu'un seul résultat à la fois (état simple, jamais un
// tableau) — jamais un problème pour Acide/Décompression/Feu (ils ne tickent que pendant
// startResolutionPhase, donc le combat est déjà ouvert par construction), mais un vrai bug pour le
// Froid, qui tique depuis l'horloge de campagne sans aucune garantie de combat ouvert et peut toucher
// plusieurs personnages en un seul balayage.
//
// Composant séparé, monté en permanence (même patron que DicePanel — toujours présent dans
// SessionPage, jamais conditionné à un mode) : une vraie file (tableau), rien n'écrase rien, chaque
// entrée est retirée explicitement à la fermeture, la suivante s'affiche alors. Filtré sur
// `data.sourceCode` (jamais posé par une attaque de combat normale, voir useCombatSocket.js) pour ne
// jamais interférer avec l'affichage combat existant — useCombatSocket.js a été corrigé en retour pour
// ne plus traiter ces mêmes résultats en double.
// Réutilise CombatResultGM/CombatResultPlayer tels quels (mêmes composants que CombatOverlay.jsx),
// même logique de résolution de libellé source (`resolveAttaquantLabel`) — rien de nouveau inventé
// côté présentation.
export default function EnvironmentalResultQueue({ socket }) {
  const { t } = useTranslation('combat')
  const { t: tStatus } = useTranslation()
  const { user } = useAuthStore()
  const { characters, isGm } = useCharacterStore()
  const tokens = useTokenStore(s => s.tokens)

  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (!socket) return
    const onResult = (data) => {
      if (!data.sourceCode) return
      setQueue(q => [...q, { ...data, _queueId: nextQueueId++ }])
    }
    socket.on(WS.COMBAT_ATTACK_RESULT, onResult)
    return () => socket.off(WS.COMBAT_ATTACK_RESULT, onResult)
  }, [socket])

  const dismiss = useCallback((queueId) => {
    setQueue(q => q.filter(item => item._queueId !== queueId))
  }, [])

  const playerCharacter = !isGm ? characters.find(c => c.user_id === user?.id) : null
  const playerToken = playerCharacter ? tokens.find(tk => tk.character_id === playerCharacter.id) : null
  const current = queue[0] ?? null
  const isRelevant = current && (isGm || current.cibleId === playerToken?.id)

  // Un client ni GM ni ciblé par l'entrée courante n'a rien à afficher — la retirer de sa propre file
  // locale immédiatement (jamais un dismiss manuel, il n'y a pas de bouton) pour laisser passer la
  // suivante, plutôt que de rester bloqué dessus indéfiniment.
  useEffect(() => {
    if (current && !isRelevant) dismiss(current._queueId)
  }, [current, isRelevant, dismiss])

  if (!current || !isRelevant) return null

  const resolveSourceLabel = (result) => result.sourceCode === 'fall'
    ? t('fallPanel.title')
    : tStatus(`status.${result.sourceCode}`)

  const onClose = () => dismiss(current._queueId)

  return (
    <div style={styles.overlay}>
      {isGm ? (
        <CombatResultGM
          attaquant={resolveSourceLabel(current)}
          cible={tokens.find(tk => tk.id === current.cibleId)?.label ?? '?'}
          isSuccess={current.isSuccess}
          roll={current.roll}
          seuil={current.chancesDeReussite}
          localisation={current.localisation}
          degatsBruts={current.degautsBruts}
          degatsNets={current.degatsNets}
          severity={current.severity}
          is_lethal={current.is_lethal}
          shockResult={current.shockResult}
          onClose={onClose}
        />
      ) : (
        <CombatResultPlayer
          attaquant={resolveSourceLabel(current)}
          isSuccess={current.isSuccess}
          roll={current.roll}
          seuil={current.chancesDeReussite}
          localisation={current.localisation}
          degatsBruts={current.degautsBruts}
          degatsNets={current.degatsNets}
          severity={current.severity}
          is_lethal={current.is_lethal}
          shockResult={current.shockResult}
          onClose={onClose}
        />
      )}
      {queue.length > 1 && (
        <span className="badge" style={styles.queueBadge}>+{queue.length - 1}</span>
      )}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  },
  queueBadge: {
    position: 'fixed',
    top: 12,
    right: 12,
    pointerEvents: 'none',
  },
}
