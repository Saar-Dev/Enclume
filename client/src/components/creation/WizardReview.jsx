import { useTranslation } from 'react-i18next'

const GENO_NAMES = {
  HUMAIN: 'Humain',
  HYB_NAT: 'Hybride naturel',
  GEN_HYB: 'Géno-hybride',
  TEC_HYB: 'Techno-hybride',
}

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

export default function WizardReview({ step1Data, step2Data, step3Data, step4Data, step5Data, pcDispo }) {
  const { t } = useTranslation('creation')

  const displayAge = step4Data?.finalAge ?? step4Data?.age ?? '?'
  const mutations = step3Data?.method === 'random'
    ? (step3Data.kept ?? [])
    : (step3Data?.mutations ?? [])
  const advantagesMeta = step5Data?.advantagesMeta ?? []
  const advantages = advantagesMeta.filter(a => a.type === 'advantage')
  const disadvantages = advantagesMeta.filter(a => a.type === 'disadvantage')

  return (
    <div style={s.container}>
      <h2 style={s.title}>{t('wizard.review_title')}</h2>

      {/* ── Identité + Attributs ───────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{t('wizard.step_label_1')}</div>
        <div style={s.row}>
          <span style={s.label}>{t('step1.charName')}</span>
          <span style={s.value}>{step1Data?.charName ?? '—'}</span>
        </div>
        {step1Data?.playerName && (
          <div style={s.row}>
            <span style={s.label}>{t('step1.playerName')}</span>
            <span style={s.value}>{step1Data.playerName}</span>
          </div>
        )}
        <div style={s.attrGrid}>
          {ATTR_IDS.map(id => (
            <div key={id} style={s.attrItem}>
              <span style={s.attrLabel}>{id}</span>
              <span style={s.attrValue}>{step1Data?.attributes?.[id] ?? '?'}</span>
            </div>
          ))}
        </div>
        <div style={s.pcRow}>
          {t('step5.pc_remaining', { n: pcDispo })}
        </div>
      </div>

      {/* ── Génotype ────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{t('wizard.step_label_2')}</div>
        <div style={s.row}>
          <span style={s.value}>
            {GENO_NAMES[step2Data?.genotypeId] ?? step2Data?.genotypeId ?? '—'}
          </span>
          {step2Data?.isDeserter && (
            <span style={s.badge}>{t('step2.deserter_label')}</span>
          )}
        </div>
      </div>

      {/* ── Mutations ────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{t('wizard.step_label_3')}</div>
        {mutations.length === 0 ? (
          <span style={s.empty}>{t('step3.none')}</span>
        ) : (
          mutations.map((m, i) => (
            <div key={i} style={s.row}>
              <span style={s.value}>{t(`step3.mutations.${m.mutation_id}.name`)}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Expérience ───────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{t('wizard.step_label_4')}</div>
        <div style={s.row}>
          <span style={s.label}>{t('step4.sub_age')}</span>
          <span style={s.value}>{t('step4.age_slider', { age: displayAge })}</span>
        </div>
        {(step4Data?.careers ?? []).map((c, i) => (
          <div key={i} style={s.row}>
            <span style={s.label}>{c.career_name ?? c.career_id}</span>
            <span style={s.value}>{t('step4.age_slider', { age: c.years })}</span>
          </div>
        ))}
      </div>

      {/* ── Avantages & Désavantages ─────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{t('wizard.step_label_5')}</div>
        {advantages.length === 0 && disadvantages.length === 0 ? (
          <span style={s.empty}>—</span>
        ) : (
          <>
            {advantages.map((a, i) => (
              <div key={i} style={s.row}>
                <span style={s.value}>{a.name}</span>
                <span style={s.costBadge}>{t('step5.pc_cost', { n: a.cost_pc ?? '' })}</span>
              </div>
            ))}
            {disadvantages.map((a, i) => (
              <div key={i} style={s.row}>
                <span style={{ ...s.value, color: '#c06060' }}>{a.name}</span>
                <span style={s.gainBadge}>+{Math.abs(a.cost_pc ?? 0)} PC</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  container: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    maxWidth: '760px',
    margin: '0 auto',
    width: '100%',
  },
  title: {
    color: '#c8c8f0',
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
  },
  section: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '12px 16px',
    backgroundColor: 'rgba(6,6,14,0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    color: '#5b8dee',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid #1e1e2e',
    paddingBottom: '6px',
    marginBottom: '4px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    color: '#5a5a7a',
    fontSize: '12px',
    fontWeight: '600',
  },
  value: {
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: '500',
  },
  badge: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '3px',
    backgroundColor: 'rgba(224,92,92,0.12)',
    color: '#e05c5c',
    fontWeight: '600',
  },
  empty: {
    color: '#3a3a5e',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  attrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '4px',
    marginTop: '4px',
  },
  attrItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 4px',
    backgroundColor: 'rgba(14,14,26,0.8)',
    borderRadius: '4px',
    border: '1px solid #1e1e2e',
  },
  attrLabel: {
    color: '#5a5a7a',
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  attrValue: {
    color: '#c8c8f0',
    fontSize: '14px',
    fontWeight: '700',
  },
  pcRow: {
    color: '#e0a85c',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: '4px',
  },
  costBadge: {
    fontSize: '11px',
    color: '#5b8dee',
    fontWeight: '600',
  },
  gainBadge: {
    fontSize: '11px',
    color: '#60c060',
    fontWeight: '600',
  },
}
