// client/src/components/creation/Step3Mutations.jsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import api from '../../lib/api'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import { mutationOptionKey } from '../../../../shared/wizardOptionKeys.js'
import { useWizardLock } from '../../lib/useWizardLock.js'
import WizardLockToggle from './WizardLockToggle.jsx'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'

const ASSETS_BASE = `${import.meta.env.VITE_API_URL}/api/assets/assets`
const MAX_REROLL_ATTEMPTS = 500

export default function Step3Mutations({ initialData, sheetId, pcDispo = 20, randomMutationsEnabled, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()
  const { isLocked, isLockedForPlayer, toggleLock, showLockToggle } = useWizardLock(3)

  const [mutations, setMutations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step3/ref`)
      .then(res => setMutations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sheetId])

  // 'none' est soumis via handleNone (sans méthode explicite) — on restaure en 'chosen'
  // pour que l'écran achat soit visible avec la carte "Aucune mutation"
  const [method, setMethod] = useState(
    initialData?.method === 'none' ? 'chosen' : (initialData?.method ?? null)
  )
  const [selected, setSelected] = useState(
    initialData?.method === 'chosen' ? (initialData.mutations ?? []) : []
  )

  // Aléatoire
  const [d20Result, setD20Result] = useState(initialData?.d20Result ?? null)
  const [rollResults, setRollResults] = useState([])
  const [awaitingRoll, setAwaitingRoll] = useState(false)
  const [rollPayload, setRollPayload] = useState(null)
  const [kept, setKept] = useState(
    initialData?.method === 'random' ? (initialData.kept ?? []) : []
  )
  const [removed, setRemoved] = useState(
    initialData?.method === 'random' ? (initialData.removed ?? []) : []
  )
  const [pcAfterRemovals, setPcAfterRemovals] = useState(
    initialData?.method === 'random' ? pcDispo - (initialData.pcSpent ?? 0) : pcDispo
  )

  // Sous-type
  const [pendingSubtype, setPendingSubtype] = useState(null)

  // Tooltip
  const [tooltip, setTooltip] = useState(null)

  // Halo de confirmation (carte cliquée avec succès)
  const [flashId, setFlashId] = useState(null)
  const flashCard = (mutationId) => {
    setFlashId(mutationId)
    window.setTimeout(() => setFlashId(prev => (prev === mutationId ? null : prev)), 600)
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  const findMutation = (mutationId) => mutations.find(m => m.mutation_id === mutationId)
  const variantLabel = (mut) => mut?.subtype ? t(`step3.subtype_labels.${mut.subtype}`) : null

  const totalCost = selected.reduce((sum, m) => sum + (findMutation(m.mutation_id)?.cost_pc || 0), 0)
  const pcLeft = pcDispo - totalCost

  const showTooltip = (desc, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ desc, top: rect.top, left: rect.left + rect.width / 2 })
  }

  const buildMutationsMeta = (items) => items.map(item => {
    const mut = findMutation(item.mutation_id)
    return {
      mutation_id: item.mutation_id,
      name: mut?.name ?? item.mutation_id,
      subtype_name: item.subtype_name ?? null,
      cost_pc: mut?.cost_pc ?? 0,
    }
  })

  // ─── Handlers ACHAT ─────────────────────────────────────────────────────
  const handleAdd = (mutationId) => {
    const mut = findMutation(mutationId)
    if (!mut) return
    if (mut.is_unique && selected.some(m => m.mutation_id === mutationId)) return

    if (mut.has_subtable) {
      setPendingSubtype({ mutation_id: mutationId })
      return
    }
    if (pcLeft < mut.cost_pc) return
    setSelected(prev => [...prev, { mutation_id: mutationId, subtype_id: null, subtype_name: variantLabel(mut) }])
    flashCard(mutationId)
  }

  const handleSelectSubtype = (subtype) => {
    if (!pendingSubtype) return
    setSelected(prev => [...prev, {
      mutation_id: pendingSubtype.mutation_id,
      subtype_id: subtype.subtype_id,
      subtype_name: subtype.name,
    }])
    flashCard(pendingSubtype.mutation_id)
    setPendingSubtype(null)
  }

  const handleRemove = (index) => {
    setSelected(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitChosen = () => {
    onNext?.({ method: 'chosen', mutations: selected, pcSpent: totalCost, mutationsMeta: buildMutationsMeta(selected) })
  }

  // ─── Handlers ALÉATOIRE ─────────────────────────────────────────────────
  const rollOneMutation = (usedUniqueIds) => {
    for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
      const d100 = Math.floor(Math.random() * 100) + 1
      const pool = mutations.filter(m => d100 >= m.d100_range_start && d100 <= m.d100_range_end)
      if (pool.length === 0) continue
      const mut = pool[Math.floor(Math.random() * pool.length)]
      if (mut.is_unique && usedUniqueIds.has(mut.mutation_id)) continue

      let subtype = null
      if (mut.has_subtable && mut.subtable.length > 0) {
        subtype = mut.subtable[Math.floor(Math.random() * mut.subtable.length)]
      }
      if (mut.is_unique) usedUniqueIds.add(mut.mutation_id)

      return {
        mutation_id: mut.mutation_id,
        subtype_id: subtype?.subtype_id ?? null,
        subtype_name: subtype?.name ?? variantLabel(mut),
        d100,
      }
    }
    return null
  }

  // D20 réel via socket (jamais Math.random — même mécanique que le Lot 6 CareersAllocator.jsx).
  // Les tirages D100 par mutation (rollOneMutation) restent en Math.random(), hors scope ici.
  const finalizeRoll = (d20) => {
    const count = d20 <= 15 ? 1 : d20 <= 19 ? 2 : 3

    const usedUniqueIds = new Set()
    const results = []
    for (let i = 0; i < count; i++) {
      const result = rollOneMutation(usedUniqueIds)
      if (result) results.push(result)
    }

    setD20Result(d20)
    setRollResults(results)
    setKept([])
    setRemoved([])
    setPcAfterRemovals(pcDispo)
  }

  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id) return
      // socketDice.js n'inclut jamais dieType dans le payload DICE_RESULT — dieType:'d20' est une
      // constante connue ici (ce bouton n'émet jamais que '1d20'), pas une supposition.
      setRollPayload({ ...payload, dieType: 'd20' })
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id])

  const handleStartRoll = () => {
    if (!socket || awaitingRoll) return
    setAwaitingRoll(true)
    socket.emit(WS.DICE_ROLL, { formula: '1d20' })
  }

  const handleDiceOverlayDone = () => {
    if (!rollPayload) return
    finalizeRoll(rollPayload.total)
    setAwaitingRoll(false)
    setRollPayload(null)
  }

  const handleKeep = (index) => {
    const result = rollResults[index]
    setKept(prev => [...prev, result])
    setRollResults(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveRandom = (index) => {
    const result = rollResults[index]
    const mut = findMutation(result.mutation_id)
    const cost = mut?.cost_pc > 0 ? 0 : 1
    if (pcAfterRemovals < cost) return
    setPcAfterRemovals(prev => prev - cost)
    setRemoved(prev => [...prev, result])
    setRollResults(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitRandom = () => {
    onNext?.({
      method: 'random', kept, removed, d20Result,
      pcSpent: pcDispo - pcAfterRemovals,
      mutationsMeta: buildMutationsMeta(kept),
    })
  }

  // ─── Handler AUCUNE MUTATION ────────────────────────────────────────────
  const handleNone = () => {
    onNext?.({ method: 'none', pcSpent: 0, mutations: [], mutationsMeta: [] })
  }

  // ─── Reset méthode ──────────────────────────────────────────────────────
  const handleBackToMethod = () => {
    setMethod(null)
    setSelected([])
    setD20Result(null)
    setRollResults([])
    setKept([])
    setRemoved([])
    setPcAfterRemovals(pcDispo)
    setAwaitingRoll(false)
    setRollPayload(null)
  }

  if (loading) {
    return (
      <div style={st.container}>
        <p style={st.loadingText}>{t('step3.loading')}</p>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDU — Choix méthode
  // ══════════════════════════════════════════════════════════════════════
  if (!method) {
    return (
      <div className="wiz2-container">
        <div className="wiz2-carousel">

          <div className="wiz2-card" onClick={() => setMethod('chosen')}>
            <img className="wiz2-card-img" src={`${ASSETS_BASE}/s2_libre.webp`} alt="" />
            <div className="wiz2-vignette" />
            <div className="wiz2-card-top">
              <span className="wiz2-card-name">{t('step3.method_choose')}</span>
            </div>
            <div className="wiz2-card-bottom">
              <p className="wiz2-card-summary">{t('step3.method_choose_desc')}</p>
            </div>
          </div>

          {randomMutationsEnabled !== false && (
            <div className="wiz2-card" onClick={() => setMethod('random')}>
              <img className="wiz2-card-img" src={`${ASSETS_BASE}/s2_aleatoire.webp`} alt="" />
              <div className="wiz2-vignette" />
              <div className="wiz2-card-top">
                <span className="wiz2-card-name">{t('step3.method_random')}</span>
              </div>
              <div className="wiz2-card-bottom">
                <p className="wiz2-card-summary">{t('step3.method_random_desc')}</p>
              </div>
            </div>
          )}

        </div>

        <div className="wiz2-nav">
          {onPrev && (
            <button className="btn btn-ghost" onClick={onPrev}>
              ← {t('step3.prev')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDU — Méthode ACHAT
  // ══════════════════════════════════════════════════════════════════════
  if (method === 'chosen') {
    const availableMutations = mutations.filter(m => m.cost_pc >= 0 && m.cost_pc <= pcLeft)

    return (
      <div style={st.container}>
        <div style={st.topRow}>
          <button style={st.backLink} onClick={handleBackToMethod}>
            ← {t('step3.back_to_method')}
          </button>
        </div>

        <div style={st.noneCard} onClick={handleNone}>
          <span style={st.noneTitle}>{t('step3.none')}</span>
          <p style={st.noneDesc}>{t('step3.noneDesc')}</p>
        </div>

        <div style={st.grid}>
          {availableMutations.map(mut => {
            const label = variantLabel(mut)
            const hasSkill = mut.skills.length > 0
            const optionKey = mutationOptionKey(mut.mutation_id)
            const lockedForPlayer = isLockedForPlayer(optionKey)
            const classNames = [
              mut.mutation_id === flashId ? 'wiz3-card-flash' : null,
              lockedForPlayer ? 'locked' : null,
            ].filter(Boolean).join(' ') || undefined
            return (
              <div
                key={mut.mutation_id}
                style={st.card}
                className={classNames}
                onClick={() => { if (!lockedForPlayer) handleAdd(mut.mutation_id) }}
              >
                <div style={st.cardHeader}>
                  <span style={st.cardName}>{mut.name}</span>
                  <span style={{
                    ...st.cardCost,
                    color: mut.cost_pc > 0 ? '#5b8dee' : '#888',
                  }}>
                    {mut.cost_pc > 0 ? `−${mut.cost_pc} PC` : t('step3.free')}
                  </span>
                  {showLockToggle && (
                    <WizardLockToggle locked={isLocked(optionKey)} onToggle={() => toggleLock(optionKey)} />
                  )}
                </div>
                {label && <div style={st.cardVariant}>{label}</div>}
                <p style={st.cardDesc}>{mut.description}</p>

                {hasSkill && mut.skills.map(sk => (
                  <div
                    key={sk.skill_name}
                    style={st.skillRow}
                    onMouseEnter={(e) => showTooltip(mut.special_effect, e)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span style={st.skillLabel}>{t('step3.skill_prefix')}</span>
                    <span style={st.skillName}>{sk.skill_name}</span>
                    <span style={st.skillAttrs}>
                      ({sk.skill_attrs}{sk.skill_base !== 0 ? `, ${sk.skill_base}` : ''})
                    </span>
                  </div>
                ))}

                <div style={st.cardTags}>
                  {mut.is_unique && <span style={st.tag}>{t('step3.unique')}</span>}
                  {mut.is_stackable && <span style={st.tag}>{t('step3.stackable', { effect: mut.stack_effect })}</span>}
                  {mut.has_subtable && <span style={st.tag}>{t('step3.has_subtypes')}</span>}
                </div>
              </div>
            )
          })}
        </div>

        {selected.length > 0 && (
          <div style={st.selection}>
            <h3 style={st.selectionTitle}>
              {t('step3.selection_title', { count: selected.length })}
            </h3>
            {selected.map((m, i) => {
              const mut = findMutation(m.mutation_id)
              return (
                <div key={i} style={st.selectionItem}>
                  <span style={st.selectionName}>
                    {mut?.name}
                    {m.subtype_name ? ` — ${m.subtype_name}` : ''}
                  </span>
                  <span style={{ color: mut?.cost_pc > 0 ? '#5b8dee' : '#888', fontSize: '11px' }}>
                    {mut?.cost_pc > 0 ? `−${mut.cost_pc} PC` : t('step3.free')}
                  </span>
                  <button style={st.removeBtn} onClick={() => handleRemove(i)}>×</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal sous-type */}
        {pendingSubtype && (
          <div style={st.overlay} onClick={() => setPendingSubtype(null)}>
            <div style={st.modal} onClick={e => e.stopPropagation()}>
              <h3 style={st.modalTitle}>
                {findMutation(pendingSubtype.mutation_id)?.name} — {t('step3.choose_subtype')}
              </h3>
              {(findMutation(pendingSubtype.mutation_id)?.subtable ?? []).map(sub => (
                <div key={sub.subtype_id}>
                  <button
                    style={st.subtypeBtn}
                    onClick={() => handleSelectSubtype(sub)}
                  >
                    {sub.name}
                  </button>
                  <p style={st.subtypeDesc}>{sub.description}</p>
                </div>
              ))}
              <button style={st.cancelBtn} onClick={() => setPendingSubtype(null)}>
                {t('step3.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            ...st.tooltip,
            top: tooltip.top,
            left: tooltip.left,
          }}>
            {tooltip.desc}
          </div>
        )}

        <div style={st.nav}>
          {onPrev && (
            <button style={st.prevBtn} onClick={onPrev}>
              ← {t('step3.prev')}
            </button>
          )}
          <button
            style={st.nextBtn}
            disabled={selected.length === 0}
            onClick={handleSubmitChosen}
          >
            {t('step3.next')} →
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDU — Méthode ALÉATOIRE
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={st.container}>
      <div style={st.topRow}>
        <button style={st.backLink} onClick={handleBackToMethod}>
          ← {t('step3.back_to_method')}
        </button>
      </div>

      {rollPayload && (
        <div className="wiz4-diceoverlay">
          <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
            <DiceLights />
            <DiceRoller payload={rollPayload} onDone={handleDiceOverlayDone} />
          </Canvas>
        </div>
      )}

      {!d20Result && (
        <div style={st.rollSection}>
          <p style={st.rollDesc}>{t('step3.roll_desc')}</p>
          <button style={st.rollBtn} onClick={handleStartRoll} disabled={awaitingRoll}>
            🎲 {awaitingRoll ? t('step3.roll_d20_rolling') : t('step3.roll_d20')}
          </button>
        </div>
      )}

      {d20Result && (
        <div style={st.rollResults}>
          <div style={st.rollInfo}>
            <span style={st.rollD20}>D20 = {d20Result}</span>
            <span style={st.rollCount}>
              {t('step3.roll_count', { count: rollResults.length + kept.length + removed.length })}
            </span>
          </div>

          {rollResults.length > 0 && (
            <div style={st.rollPending}>
              <h3 style={st.rollPendingTitle}>{t('step3.roll_pending')}</h3>
              {rollResults.map((result, i) => {
                const mut = findMutation(result.mutation_id)
                const hasSkill = mut?.skills.length > 0
                return (
                  <div key={i} style={st.rollCard}>
                    <div style={st.rollCardHeader}>
                      <span style={st.cardName}>{mut?.name}</span>
                      <span style={{ color: '#888', fontSize: '11px' }}>D100 = {result.d100}</span>
                    </div>
                    {result.subtype_name && (
                      <div style={st.rollSubtype}>→ {result.subtype_name}</div>
                    )}
                    <p style={st.cardDesc}>{mut?.description?.substring(0, 120)}…</p>

                    {hasSkill && mut.skills.map(sk => (
                      <div
                        key={sk.skill_name}
                        style={st.skillRow}
                        onMouseEnter={(e) => showTooltip(mut.special_effect, e)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span style={st.skillLabel}>{t('step3.skill_prefix')}</span>
                        <span style={st.skillName}>{sk.skill_name}</span>
                        <span style={st.skillAttrs}>
                          ({sk.skill_attrs}{sk.skill_base !== 0 ? `, ${sk.skill_base}` : ''})
                        </span>
                      </div>
                    ))}

                    <div style={st.rollActions}>
                      <button style={st.keepBtn} onClick={() => handleKeep(i)}>
                        {t('step3.keep')}
                      </button>
                      <button style={st.removeRandomBtn} onClick={() => handleRemoveRandom(i)}>
                        {mut?.cost_pc > 0
                          ? t('step3.remove_free')
                          : t('step3.remove_cost')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {(kept.length > 0 || removed.length > 0) && (
            <div style={st.rollSummary}>
              <div style={st.summaryItem}>
                <span style={st.summaryLabel}>{t('step3.kept_count', { count: kept.length })}</span>
                {kept.map((m, i) => (
                  <span key={i} style={st.summaryName}>
                    {findMutation(m.mutation_id)?.name}
                    {m.subtype_name ? ` (${m.subtype_name})` : ''}
                  </span>
                ))}
              </div>
              <div style={st.summaryItem}>
                <span style={st.summaryLabel}>{t('step3.removed_count', { count: removed.length })}</span>
                {removed.map((m, i) => (
                  <span key={i} style={st.summaryName}>{findMutation(m.mutation_id)?.name}</span>
                ))}
              </div>
              {pcAfterRemovals < pcDispo && (
                <div style={st.summaryPc}>
                  {t('step3.pc_spent_on_removals', { spent: pcDispo - pcAfterRemovals })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tooltip && (
        <div style={{
          ...st.tooltip,
          top: tooltip.top,
          left: tooltip.left,
        }}>
          {tooltip.desc}
        </div>
      )}

      <div style={st.nav}>
        {onPrev && (
          <button style={st.prevBtn} onClick={onPrev}>
            ← {t('step3.prev')}
          </button>
        )}
        {d20Result && rollResults.length === 0 && (
          <button style={st.nextBtn} onClick={handleSubmitRandom}>
            {t('step3.next')} →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────
const st = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 20px 40px',
    maxWidth: '960px',
    margin: '0 auto',
    flex: 1,
    width: '100%',
  },
  loadingText: { color: '#5a5a7a', fontSize: '14px', textAlign: 'center', padding: '40px 0' },
  topRow: {
    marginBottom: '12px',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#6a6a8a',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
  },

  // Aucune mutation
  noneCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    marginBottom: '12px',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    backgroundColor: 'rgba(6,6,14,0.6)',
    cursor: 'pointer',
  },
  noneTitle: { color: '#5a5a7a', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  noneDesc: { color: '#3a3a5e', fontSize: '11px', lineHeight: '1.5', margin: 0 },

  // Grille achat
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '8px',
    flex: 1,
    alignContent: 'start',
  },
  card: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '12px',
    backgroundColor: 'rgba(6,6,14,0.85)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: '600',
    flex: 1,
    marginRight: '8px',
  },
  cardVariant: { color: '#9090c8', fontSize: '10px', marginBottom: '2px' },
  cardCost: { fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  cardDesc: { color: '#6a6a8a', fontSize: '11px', lineHeight: '1.6', margin: 0 },
  cardTags: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  tag: {
    fontSize: '9px', padding: '2px 6px', borderRadius: '3px',
    backgroundColor: 'rgba(91,141,238,0.10)', color: '#5b8dee',
  },

  // Compétence
  skillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 8px',
    backgroundColor: 'rgba(74,158,92,0.06)',
    borderRadius: '3px',
    cursor: 'help',
    flexWrap: 'wrap',
  },
  skillLabel: { color: '#4a9e5c', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' },
  skillName: { color: '#4a9e5c', fontSize: '11px', fontWeight: '600' },
  skillAttrs: { color: '#6a6a8a', fontSize: '10px' },

  // Sélection
  selection: {
    marginTop: '16px',
    padding: '12px',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    backgroundColor: 'rgba(91,141,238,0.04)',
  },
  selectionTitle: {
    color: '#5a5a7a', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
  },
  selectionItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '4px 0', borderBottom: '1px solid #1a1a2e', fontSize: '12px',
  },
  selectionName: { color: '#c0c0d0', flex: 1 },
  removeBtn: { background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: '16px', padding: '0 4px' },

  // Modal sous-type
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    backgroundColor: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '8px',
    padding: '24px', minWidth: '320px', maxWidth: '400px',
    display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '80vh', overflowY: 'auto',
  },
  modalTitle: { color: '#c0c0d0', fontSize: '14px', fontWeight: '600', marginBottom: '4px' },
  subtypeBtn: {
    padding: '10px 16px', background: '#1e1e3e', border: '1px solid #3a3a5e',
    borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', cursor: 'pointer', textAlign: 'left',
  },
  subtypeDesc: { color: '#6a6a8a', fontSize: '10px', lineHeight: '1.5', margin: '2px 0 0 0' },
  cancelBtn: {
    padding: '8px 12px', background: 'transparent', border: 'none',
    color: '#e05c5c', cursor: 'pointer', fontSize: '11px', marginTop: '4px', alignSelf: 'center',
  },

  // Aléatoire
  rollSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '40px 0' },
  rollDesc: { color: '#6a6a8a', fontSize: '12px', textAlign: 'center', maxWidth: '400px', lineHeight: '1.7', margin: 0 },
  rollBtn: {
    padding: '16px 40px', border: '2px solid #5b8dee', borderRadius: '8px',
    backgroundColor: 'rgba(91,141,238,0.10)', color: '#5b8dee',
    fontSize: '18px', fontWeight: '700', cursor: 'pointer',
  },
  rollResults: { display: 'flex', flexDirection: 'column', gap: '16px' },
  rollInfo: { display: 'flex', justifyContent: 'center', gap: '16px', padding: '8px' },
  rollD20: { color: '#5b8dee', fontSize: '16px', fontWeight: '700' },
  rollCount: { color: '#9090c8', fontSize: '14px' },
  rollPending: {},
  rollPendingTitle: {
    color: '#e0a85c', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
  },
  rollCard: {
    border: '1px solid #2a2a3e', borderRadius: '6px', padding: '12px',
    marginBottom: '8px', backgroundColor: 'rgba(6,6,14,0.85)',
  },
  rollCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  rollSubtype: { color: '#9090c8', fontSize: '10px', marginBottom: '6px' },
  rollActions: { display: 'flex', gap: '8px', marginTop: '10px' },
  keepBtn: {
    padding: '6px 16px', border: '1px solid #4a9e5c', borderRadius: '4px',
    backgroundColor: 'rgba(74,158,92,0.10)', color: '#4a9e5c', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  },
  removeRandomBtn: {
    padding: '6px 16px', border: '1px solid #e05c5c', borderRadius: '4px',
    backgroundColor: 'rgba(224,92,92,0.10)', color: '#e05c5c', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  },
  rollSummary: {
    padding: '12px', border: '1px solid #1e1e2e', borderRadius: '6px',
    backgroundColor: 'rgba(6,6,14,0.85)', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  summaryItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  summaryLabel: { color: '#5a5a7a', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
  summaryName: { color: '#9090c8', fontSize: '11px' },
  summaryPc: { color: '#e0a85c', fontSize: '11px', fontWeight: '600', marginTop: '4px' },

  // Navigation
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 0 0', borderTop: '1px solid #1e1e2e', marginTop: 'auto',
  },
  prevBtn: {
    padding: '8px 16px', border: '1px solid #2a2a3e', borderRadius: '4px',
    backgroundColor: '#0e0e1a', color: '#6a6a8a', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  },
  nextBtn: {
    padding: '8px 20px', border: 'none', borderRadius: '4px',
    backgroundColor: '#5b8dee', color: '#fff', fontSize: '12px',
    fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginLeft: 'auto',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#0a0a14',
    border: '1px solid #2a2a4e',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#b0b0c8',
    whiteSpace: 'pre-line',
    width: '240px',
    zIndex: 1000,
    lineHeight: '1.6',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transform: 'translate(-50%, calc(-100% - 8px))',
  },
}
