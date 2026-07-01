import { useTranslation } from 'react-i18next'

export default function Step4Summary({
  age, originGeo, originSoc, training, higherEd,
  careers, geoName, geoNation, socNation, onPrev, onSubmit,
  selectedGeoItem, selectedSocItem, selectedTrainingItem, selectedHigherEdItem,
}) {
  const { t } = useTranslation('creation')

  const geoItem = selectedGeoItem
  const socItem = selectedSocItem
  const trainingItem = selectedTrainingItem
  const higherEdItem = selectedHigherEdItem

  const totalPC = (higherEd ? 1 : 0) + careers.reduce((sum, c) => sum + c.years, 0)

  return (
    <div style={ss.container}>
      <h2 style={ss.title}>{t('step4.summary_title')}</h2>

      <div style={ss.section}>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.age_label')}</span>
          <span style={ss.value}>{t('step4.age_slider', { age })}</span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.geo_origin_title')}</span>
          <span style={ss.value}>
            {geoItem?.name ?? originGeo}
            {geoName ? ` — ${geoName}` : ''}
            {geoNation ? ` (${geoNation})` : ''}
          </span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.social_origin_title')}</span>
          <span style={ss.value}>
            {socItem?.name ?? originSoc}
            {socNation ? ` (${socNation})` : ''}
          </span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.training_title')}</span>
          <span style={ss.value}>{trainingItem?.name ?? training}</span>
        </div>
        {higherEdItem && (
          <div style={ss.row}>
            <span style={ss.label}>{t('step4.higher_ed_title')}</span>
            <span style={ss.value}>{higherEdItem.name}</span>
          </div>
        )}
      </div>

      <div style={ss.section}>
        <div style={ss.sectionTitle}>{t('step4.careers_title')}</div>
        {careers.length === 0 ? (
          <p style={ss.empty}>{t('step4.career_none')}</p>
        ) : (
          careers.map((c, i) => {
            const titleEntry = c.titles?.slice().reverse().find(ti => c.years >= ti.min_years)
            return (
              <div key={i} style={ss.careerRow}>
                <span style={ss.careerName}>{c.career_name ?? c.career_id}</span>
                <span style={ss.careerYears}>{c.years} an{c.years > 1 ? 's' : ''}</span>
                {titleEntry && <span style={ss.careerTitle}>{titleEntry.title}</span>}
              </div>
            )
          })
        )}
      </div>

      <div style={ss.pcRow}>
        {t('step4.summary_pc', { spent: totalPC, total: 20 })}
      </div>

      <div style={ss.nav}>
        <button style={ss.prevBtn} onClick={onPrev}>← {t('step4.prev')}</button>
        <button style={ss.submitBtn} onClick={onSubmit}>{t('step4.validate')}</button>
      </div>
    </div>
  )
}

const ss = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', flex: 1, maxWidth: '720px', margin: '0 auto', width: '100%' },
  title: { color: '#c0c0d0', fontSize: '16px', fontWeight: '700', margin: 0 },
  section: { border: '1px solid #1e1e2e', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(6,6,14,0.85)' },
  sectionTitle: { fontSize: '11px', fontWeight: '700', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px', backgroundColor: 'rgba(14,14,26,0.9)', borderBottom: '1px solid #1e1e2e' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 12px', borderBottom: '1px solid #1a1a2e', gap: '12px' },
  label: { color: '#5a5a7a', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  value: { color: '#c0c0d0', fontSize: '12px', textAlign: 'right' },
  empty: { color: '#3a3a5e', fontSize: '12px', padding: '12px', margin: 0 },
  careerRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #1a1a2e' },
  careerName: { color: '#c0c0d0', fontSize: '12px', fontWeight: '600', flex: 1 },
  careerYears: { color: '#9090c8', fontSize: '11px' },
  careerTitle: { color: '#5b8dee', fontSize: '11px', padding: '2px 6px', border: '1px solid #5b8dee', borderRadius: '3px' },
  pcRow: { color: '#e0a85c', fontSize: '12px', fontWeight: '600', textAlign: 'center', padding: '8px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #1e1e2e', marginTop: 'auto' },
  prevBtn: { padding: '8px 16px', border: '1px solid #2a2a3e', borderRadius: '4px', backgroundColor: '#0e0e1a', color: '#6a6a8a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  submitBtn: { padding: '8px 20px', border: 'none', borderRadius: '4px', backgroundColor: '#5b8dee', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' },
}
