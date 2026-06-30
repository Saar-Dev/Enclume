// client/src/components/creation/Step3Mutations.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MOCK_MUTATION_IDS = [1, 7, 11, 14, 17, 20]

const MOCK_SUBTYPES = {
  20: [
    { subtype_id: 1, d4_roll: 1 },
    { subtype_id: 2, d4_roll: 2 },
    { subtype_id: 3, d4_roll: 3 },
    { subtype_id: 4, d4_roll: 4 },
  ],
}

const MUTATION_META = {
  1: { cost_pc: 3, is_unique: true, is_stackable: false, has_subtable: false, has_skill: true },
  7: { cost_pc: 2, is_unique: true, is_stackable: false, has_subtable: false, has_skill: true },
  11: { cost_pc: 0, is_unique: true, is_stackable: false, has_subtable: false, has_skill: false },
  14: { cost_pc: 0, is_unique: true, is_stackable: false, has_subtable: false, has_skill: false },
  17: { cost_pc: 0, is_unique: true, is_stackable: false, has_subtable: false, has_skill: false },
  20: { cost_pc: 2, is_unique: true, is_stackable: false, has_subtable: true, has_skill: false },
}

export default function Step3Mutations({ pcDispo = 20, onNext, onPrev }) {
  const { t } = useTranslation('creation')

  const [method, setMethod] = useState(null)
  const [selected, setSelected] = useState([])

  // Aléatoire
  const [d20Result, setD20Result] = useState(null)
  const [rollResults, setRollResults] = useState([])
  const [kept, setKept] = useState([])
  const [removed, setRemoved] = useState([])
  const [pcAfterRemovals, setPcAfterRemovals] = useState(pcDispo)

  // Sous-type
  const [pendingSubtype, setPendingSubtype] = useState(null)

  // Tooltip
  const [tooltip, setTooltip] = useState(null)

  // ─── Helpers ────────────────────────────────────────────────────────────
  const totalCost = selected.reduce((sum, m) => sum + (MUTATION_META[m.mutation_id]?.cost_pc || 0), 0)
  const pcLeft = pcDispo - totalCost

  const showTooltip = (desc, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ desc, top: rect.top, left: rect.left + rect.width / 2 })
  }

  // ─── Handlers ACHAT ─────────────────────────────────────────────────────
  const handleAdd = (mutationId) => {
    const meta = MUTATION_META[mutationId]
    if (!meta) return
    if (meta.is_unique && selected.some(m => m.mutation_id === mutationId)) return

    if (meta.has_subtable) {
      setPendingSubtype({ mutation_id: mutationId })
      return
    }
    if (pcLeft < meta.cost_pc) return
    setSelected(prev => [...prev, { mutation_id: mutationId, subtype_id: null, subtype_name: null }])
  }

  const handleSelectSubtype = (subtype) => {
    if (!pendingSubtype) return
    const meta = MUTATION_META[pendingSubtype.mutation_id]
    setSelected(prev => [...prev, {
      mutation_id: pendingSubtype.mutation_id,
      subtype_id: subtype.subtype_id,
      subtype_name: t(`step3.mutations.${pendingSubtype.mutation_id}.subtypes.${subtype.subtype_id}.name`),
    }])
    setPendingSubtype(null)
  }

  const handleRemove = (index) => {
    setSelected(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitChosen = () => {
    onNext?.({ method: 'chosen', mutations: selected, pcSpent: totalCost })
  }

  // ─── Handlers ALÉATOIRE ─────────────────────────────────────────────────
  const handleRoll = () => {
    const d20 = Math.floor(Math.random() * 20) + 1
    const count = d20 <= 15 ? 1 : d20 <= 19 ? 2 : 3

    const pool = [...MOCK_MUTATION_IDS]
    const results = []
    const used = new Set()

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      const mutationId = pool[idx]
      if (used.has(mutationId) && used.size < pool.length) {
        let alt = pool.find(id => !used.has(id))
        if (alt) {
          used.add(alt)
          results.push({ mutation_id: alt, subtype_id: null, subtype_name: null, d100: Math.floor(Math.random() * 100) + 1 })
          continue
        }
      }
      used.add(mutationId)

      const meta = MUTATION_META[mutationId]
      let subtype = null
      if (meta?.has_subtable) {
        const subtypes = MOCK_SUBTYPES[mutationId] || []
        subtype = subtypes[Math.floor(Math.random() * subtypes.length)]
      }

      results.push({
        mutation_id: mutationId,
        subtype_id: subtype?.subtype_id || null,
        subtype_name: subtype ? t(`step3.mutations.${mutationId}.subtypes.${subtype.subtype_id}.name`) : null,
        d100: Math.floor(Math.random() * 100) + 1,
      })
    }

    setD20Result(d20)
    setRollResults(results)
    setKept([])
    setRemoved([])
    setPcAfterRemovals(pcDispo)
  }

  const handleKeep = (index) => {
    const result = rollResults[index]
    setKept(prev => [...prev, result])
    setRollResults(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveRandom = (index) => {
    const result = rollResults[index]
    const meta = MUTATION_META[result.mutation_id]
    const cost = meta?.cost_pc > 0 ? 0 : 1
    if (pcAfterRemovals < cost) return
    setPcAfterRemovals(prev => prev - cost)
    setRemoved(prev => [...prev, result])
    setRollResults(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitRandom = () => {
    onNext?.({ method: 'random', kept, removed, pcSpent: pcDispo - pcAfterRemovals })
  }

  // ─── Handler AUCUNE MUTATION ────────────────────────────────────────────
  const handleNone = () => {
    onNext?.({ method: 'none', pcSpent: 0, mutations: [] })
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
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDU — Choix méthode
  // ══════════════════════════════════════════════════════════════════════
  if (!method) {
    return (
      <div style={st.container}>
        <div style={st.methodCards}>
          <div style={st.methodCard} onClick={() => setMethod('chosen')}>
            <div style={st.methodIcon}>🧬</div>
            <h2 style={st.methodName}>{t('step3.method_choose')}</h2>
            <p style={st.methodDesc}>{t('step3.method_choose_desc')}</p>
          </div>

          <div style={st.methodCard} onClick={() => setMethod('random')}>
            <div style={st.methodIcon}>🎲</div>
            <h2 style={st.methodName}>{t('step3.method_random')}</h2>
            <p style={st.methodDesc}>{t('step3.method_random_desc')}</p>
          </div>

          <div style={st.methodCard} onClick={handleNone}>
            <div style={st.methodIcon}>🚫</div>
            <h2 style={st.methodName}>{t('step3.none')}</h2>
            <p style={st.methodDesc}>{t('step3.noneDesc')}</p>
          </div>
        </div>

        <div style={st.nav}>
          {onPrev && (
            <button style={st.prevBtn} onClick={onPrev}>
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
    const availableIds = MOCK_MUTATION_IDS.filter(id => {
      const meta = MUTATION_META[id]
      return meta && meta.cost_pc >= 0 && meta.cost_pc <= pcLeft
    })

    return (
      <div style={st.container}>
        <div style={st.topRow}>
          <button style={st.backLink} onClick={handleBackToMethod}>
            ← {t('step3.back_to_method')}
          </button>
        </div>

        <div style={st.grid}>
          {availableIds.map(id => {
            const meta = MUTATION_META[id]
            const hasSkill = meta?.has_skill
            return (
              <div key={id} style={st.card} onClick={() => handleAdd(id)}>
                <div style={st.cardHeader}>
                  <span style={st.cardName}>{t(`step3.mutations.${id}.name`)}</span>
                  <span style={{
                    ...st.cardCost,
                    color: meta.cost_pc > 0 ? '#5b8dee' : '#888',
                  }}>
                    {meta.cost_pc > 0 ? `−${meta.cost_pc} PC` : t('step3.free')}
                  </span>
                </div>
                <p style={st.cardDesc}>{t(`step3.mutations.${id}.desc`)}</p>

                {hasSkill && (
                  <div
                    style={st.skillRow}
                    onMouseEnter={(e) => showTooltip(t(`step3.mutations.${id}.skill_desc`), e)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span style={st.skillLabel}>{t('step3.skill_prefix')}</span>
                    <span style={st.skillName}>
                      {t(`step3.mutations.${id}.skill_name`)}
                    </span>
                    <span style={st.skillAttrs}>
                      ({t(`step3.mutations.${id}.skill_attrs`)}
                      {t(`step3.mutations.${id}.skill_base`) !== '0' ? `, ${t(`step3.mutations.${id}.skill_base`)}` : ''})
                    </span>
                  </div>
                )}

                <div style={st.cardTags}>
                  {meta.is_unique && <span style={st.tag}>{t('step3.unique')}</span>}
                  {meta.is_stackable && <span style={st.tag}>{t('step3.stackable', { limit: meta.stack_limit })}</span>}
                  {meta.has_subtable && <span style={st.tag}>{t('step3.has_subtypes')}</span>}
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
            {selected.map((m, i) => (
              <div key={i} style={st.selectionItem}>
                <span style={st.selectionName}>
                  {t(`step3.mutations.${m.mutation_id}.name`)}
                  {m.subtype_name ? ` — ${m.subtype_name}` : ''}
                </span>
                <span style={{ color: MUTATION_META[m.mutation_id]?.cost_pc > 0 ? '#5b8dee' : '#888', fontSize: '11px' }}>
                  {MUTATION_META[m.mutation_id]?.cost_pc > 0 ? `−${MUTATION_META[m.mutation_id].cost_pc} PC` : t('step3.free')}
                </span>
                <button style={st.removeBtn} onClick={() => handleRemove(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Modal sous-type */}
        {pendingSubtype && (
          <div style={st.overlay} onClick={() => setPendingSubtype(null)}>
            <div style={st.modal} onClick={e => e.stopPropagation()}>
              <h3 style={st.modalTitle}>
                {t(`step3.mutations.${pendingSubtype.mutation_id}.name`)} — {t('step3.choose_subtype')}
              </h3>
              {(MOCK_SUBTYPES[pendingSubtype.mutation_id] || []).map(sub => (
                <div key={sub.subtype_id}>
                  <button
                    style={st.subtypeBtn}
                    onClick={() => handleSelectSubtype(sub)}
                  >
                    {t(`step3.mutations.${pendingSubtype.mutation_id}.subtypes.${sub.subtype_id}.name`)}
                  </button>
                  <p style={st.subtypeDesc}>
                    {t(`step3.mutations.${pendingSubtype.mutation_id}.subtypes.${sub.subtype_id}.desc`)}
                  </p>
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

      {!d20Result && (
        <div style={st.rollSection}>
          <p style={st.rollDesc}>{t('step3.roll_desc')}</p>
          <button style={st.rollBtn} onClick={handleRoll}>
            🎲 {t('step3.roll_d20')}
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
                const meta = MUTATION_META[result.mutation_id]
                const hasSkill = meta?.has_skill
                return (
                  <div key={i} style={st.rollCard}>
                    <div style={st.rollCardHeader}>
                      <span style={st.cardName}>{t(`step3.mutations.${result.mutation_id}.name`)}</span>
                      <span style={{ color: '#888', fontSize: '11px' }}>D100 = {result.d100}</span>
                    </div>
                    {result.subtype_name && (
                      <div style={st.rollSubtype}>→ {result.subtype_name}</div>
                    )}
                    <p style={st.cardDesc}>{t(`step3.mutations.${result.mutation_id}.desc`)?.substring(0, 120)}…</p>

                    {hasSkill && (
                      <div
                        style={st.skillRow}
                        onMouseEnter={(e) => showTooltip(t(`step3.mutations.${result.mutation_id}.skill_desc`), e)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span style={st.skillLabel}>{t('step3.skill_prefix')}</span>
                        <span style={st.skillName}>
                          {t(`step3.mutations.${result.mutation_id}.skill_name`)}
                        </span>
                        <span style={st.skillAttrs}>
                          ({t(`step3.mutations.${result.mutation_id}.skill_attrs`)}
                          {t(`step3.mutations.${result.mutation_id}.skill_base`) !== '0' ? `, ${t(`step3.mutations.${result.mutation_id}.skill_base`)}` : ''})
                        </span>
                      </div>
                    )}

                    <div style={st.rollActions}>
                      <button style={st.keepBtn} onClick={() => handleKeep(i)}>
                        {t('step3.keep')}
                      </button>
                      <button style={st.removeRandomBtn} onClick={() => handleRemoveRandom(i)}>
                        {meta?.cost_pc > 0
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
                    {t(`step3.mutations.${m.mutation_id}.name`)}
                    {m.subtype_name ? ` (${m.subtype_name})` : ''}
                  </span>
                ))}
              </div>
              <div style={st.summaryItem}>
                <span style={st.summaryLabel}>{t('step3.removed_count', { count: removed.length })}</span>
                {removed.map((m, i) => (
                  <span key={i} style={st.summaryName}>{t(`step3.mutations.${m.mutation_id}.name`)}</span>
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

  // Choix méthode
  methodCards: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    flex: 1,
    alignItems: 'center',
  },
  methodCard: {
    flex: 1,
    maxWidth: '320px',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: 'rgba(6,6,14,0.85)',
    transition: 'border-color 0.2s',
  },
  methodIcon: { fontSize: '40px', marginBottom: '16px' },
  methodName: { color: '#c0c0d0', fontSize: '15px', fontWeight: '700', marginBottom: '12px' },
  methodDesc: { color: '#6a6a8a', fontSize: '11px', lineHeight: '1.7' },

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
    alignItems: 'center',
  },
  cardName: {
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    marginRight: '8px',
  },
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