import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import { CATASTROPHE_EFFECT_TABLE, findCatastropheEntry } from '../../../shared/catastropheEffectTable.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useTokenStore } from '../stores/tokenStore'
import { useAuthStore } from '../stores/authStore.js'
import { useChanceCountdown } from '../lib/useChanceCountdown.js'

let nextQueueId = 0

// CatastropheChoiceQueue — remplace CatastropheReviewQueue.jsx + ChanceGmChoiceQueue.jsx +
// ChancePlayerChoiceCard.jsx (docs/PLANS/PLAN_CHANCE.md L3e-4, retour Saar 2026-09-11 puis
// 2026-09-12) : UNE seule fenêtre, à UNE seule position, pour tout ce qui relève d'une Catastrophe
// combat et/ou du choix Chance qui lui est lié — quel que soit le type du personnage concerné.
// Router le choix Chance d'un PJ vers un second composant à un autre endroit de l'écran recréait
// exactement le problème que la fusion MJ/PNJ avait déjà réglé : le mécanisme redevenait visible à
// deux endroits différents selon un critère (PJ vs PNJ) que le joueur n'a aucune raison de percevoir.
//
// Toujours monté pour tout le monde (MJ et joueurs) — le filtrage est par audience, jamais par
// position : le MJ voit les Catastrophes (conséquence table, jamais montrée à un joueur) + les choix
// Chance des PNJ ; un joueur voit uniquement le choix Chance de SON PROPRE personnage. Un même viewer
// peut cumuler les deux rôles (MJ qui teste aussi un PJ) — les deux flux se mélangent alors
// naturellement dans la même file, à la même position.
//
// Corrélation : CHANCE_CHOICE_PENDING porte `linkedCatastropheId` (id de la ligne pending_
// catastrophes ouverte par le même jet, quand les deux mécanismes sont câblés sur le même site —
// PLAN_CHANCE.md L3e). Une entrée Catastrophe et une entrée Chance partageant cet id fusionnent en
// une seule carte ; sinon chacune s'affiche seule (site Catastrophe pas encore câblé sur Chance, ou
// Chance hors combat sans Catastrophe associée — `maybeTriggerCatastrophe` est gardé `isCombatActive`,
// pas `openChanceChoice`). Un joueur n'a jamais de moitié Catastrophe visible : `catastropheEntries`
// n'est peuplée que côté MJ (onCatastrophePending ci-dessous), donc `entry` reste toujours null pour
// lui — la garde est structurelle, pas un `if` séparé au rendu.
export default function CatastropheChoiceQueue({ socket }) {
  const { t } = useTranslation('combat')
  const { isGm, characters } = useCharacterStore()
  const tokens = useTokenStore(s => s.tokens)
  const userId = useAuthStore(s => s.user?.id)

  const [catastropheEntries, setCatastropheEntries] = useState([])
  const [chanceEntries, setChanceEntries] = useState([])
  const [overrideEntry, setOverrideEntry] = useState('')

  useEffect(() => {
    if (!socket) return
    const onCatastrophePending = (data) => {
      if (!isGm) return // conséquence narrative — jamais montrée à un joueur, MJ uniquement
      setCatastropheEntries(q => [...q, { ...data, _queueId: nextQueueId++ }])
    }
    const onCatastropheApplied = (data) => {
      setCatastropheEntries(q => q.filter(item => item.id !== data.id))
    }
    const onChancePending = (data) => {
      const character = characters.find(c => c.id === data.characterId)
      if (!character) return
      // Audience RAW : le choix appartient au joueur du personnage pour un PJ (jamais montré à un
      // autre joueur ni au MJ) ; au MJ pour un PNJ (qui n'a pas de joueur propre).
      const forMe = character.type === 'pj' ? character.user_id === userId : isGm
      if (!forMe) return
      setChanceEntries(q => [...q, { ...data, _queueId: nextQueueId++ }])
    }
    const onChanceResolved = (data) => {
      setChanceEntries(q => q.filter(item => item.id !== data.id))
    }
    socket.on(WS.CATASTROPHE_PENDING, onCatastrophePending)
    socket.on(WS.CATASTROPHE_APPLIED, onCatastropheApplied)
    socket.on(WS.CHANCE_CHOICE_PENDING, onChancePending)
    socket.on(WS.CHANCE_CHOICE_RESOLVED, onChanceResolved)
    return () => {
      socket.off(WS.CATASTROPHE_PENDING, onCatastrophePending)
      socket.off(WS.CATASTROPHE_APPLIED, onCatastropheApplied)
      socket.off(WS.CHANCE_CHOICE_PENDING, onChancePending)
      socket.off(WS.CHANCE_CHOICE_RESOLVED, onChanceResolved)
    }
  }, [socket, characters, isGm, userId])

  // Fusion dérivée à chaque rendu — pas d'état séparé à synchroniser : une fois l'une des deux
  // moitiés résolue, elle disparaît de sa propre liste source et la carte continue de montrer
  // uniquement ce qui reste (naturellement, sans logique de "résolution partielle" à maintenir).
  const merged = catastropheEntries.map(cat => ({
    _key: `cat-${cat.id}`,
    catastrophe: cat,
    chance: chanceEntries.find(ch => ch.linkedCatastropheId === cat.id) ?? null,
  }))
  const standaloneChance = chanceEntries
    .filter(ch => !catastropheEntries.some(cat => cat.id === ch.linkedCatastropheId))
    .map(ch => ({ _key: `chc-${ch.id}`, catastrophe: null, chance: ch }))
  const queue = [...merged, ...standaloneChance]

  const current = queue[0] ?? null
  const remainingSeconds = useChanceCountdown(current?.chance?.rolledAt, current?.chance?.timeoutMs)

  useEffect(() => { setOverrideEntry('') }, [current?._key])

  const resolveCatastrophe = useCallback((override) => {
    if (!socket || !current?.catastrophe) return
    socket.emit(WS.CATASTROPHE_RESOLVE, { pendingId: current.catastrophe.id, override })
    setCatastropheEntries(q => q.filter(item => item._queueId !== current.catastrophe._queueId))
  }, [socket, current])

  const resolveChance = useCallback((choice) => {
    if (!socket || !current?.chance) return
    socket.emit(WS.CHANCE_CHOICE_RESOLVE, { pendingId: current.chance.id, choice })
    setChanceEntries(q => q.filter(item => item._queueId !== current.chance._queueId))
  }, [socket, current])

  if (!current) return null

  const { catastrophe, chance } = current
  const entry = catastrophe ? findCatastropheEntry(catastrophe.tableEntry) : null
  const tokenLabel = catastrophe ? (tokens.find(tk => tk.id === catastrophe.tokenId)?.label ?? '?') : null
  const characterLabel = chance ? (characters.find(c => c.id === chance.characterId)?.name ?? '?') : null

  return (
    <div className="catastrophe-review-overlay">
      <div className="catastrophe-review-card">
        <div className="catastrophe-review-title">
          {t('catastrophePopup')} — {tokenLabel ?? characterLabel}
        </div>

        {entry && (
          <>
            <div className="catastrophe-review-entry-name">{t(`catastrophe.${entry.key}.name`)}</div>
            <div className="catastrophe-review-entry-effect">{t(`catastrophe.${entry.key}.effect`)}</div>
            <div className="catastrophe-review-actions">
              <button className="btn btn-gold" onClick={() => resolveCatastrophe(null)}>
                {t('overlay.validateButton')}
              </button>
            </div>
            <div className="catastrophe-review-override-row">
              <select value={overrideEntry} onChange={(e) => setOverrideEntry(e.target.value)}>
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
                onClick={() => resolveCatastrophe(Number(overrideEntry))}
              >
                {t('catastrophe.applyOverride')}
              </button>
            </div>
          </>
        )}

        {chance && (
          <>
            <div className="chance-choice-test-label">{chance.testLabel}</div>
            <div className="chance-choice-actions">
              {chance.site === 'aoe_avoidance' ? (
                // Forçage AOE longue/extrême portée (PLAN_CHANCE.md L4) — vocabulaire RAW distinct de
                // la régénération sur Catastrophe (reroll/gain_point ci-dessous) : deux mécaniques
                // différentes partageant seulement la ressource Chance (décision §12, 2026-09-12),
                // jamais le même couple de boutons.
                <>
                  <button className="btn-ghost" onClick={() => resolveChance('attempt')}>
                    {t('chance.choiceCard.attemptButton')}
                  </button>
                  <button className="btn btn-gold" onClick={() => resolveChance('force')}>
                    {t('chance.choiceCard.forceButton')}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-ghost" onClick={() => resolveChance('reroll')}>
                    {t('chance.choiceCard.rerollButton')}
                  </button>
                  <button className="btn btn-gold" onClick={() => resolveChance('gain_point')}>
                    {t('chance.choiceCard.gainPointButton')}
                  </button>
                </>
              )}
            </div>
            {remainingSeconds != null && (
              <div className="chance-choice-countdown">{t('chance.choiceCard.autoResolveIn', { seconds: remainingSeconds })}</div>
            )}
          </>
        )}
      </div>
      {queue.length > 1 && (
        <span className="badge catastrophe-review-queue-badge">+{queue.length - 1}</span>
      )}
    </div>
  )
}
