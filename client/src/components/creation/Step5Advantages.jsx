import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { advantageOptionKey } from '../../../../shared/wizardOptionKeys.js'
import { useWizardLock } from '../../lib/useWizardLock.js'
import WizardLockToggle from './WizardLockToggle.jsx'

export default function Step5Advantages({ initialData, sheetId, pcDispo, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const { isLocked, isLockedForPlayer, toggleLock, showLockToggle } = useWizardLock(5)
  const [refData, setRefData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(initialData?.advantages ?? [])

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step5/ref`)
      .then(res => setRefData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sheetId])

  const advantages = refData.filter(a => a.type === 'advantage')
  const disadvantages = refData.filter(a => a.type === 'disadvantage')

  const pcGained = selected
    .map(id => refData.find(a => a.advantage_id === id))
    .filter(a => a?.type === 'disadvantage')
    .reduce((s, a) => s + Math.abs(a.cost_pc ?? 0), 0)

  const pcSpent = selected
    .map(id => refData.find(a => a.advantage_id === id))
    .filter(a => a?.type === 'advantage')
    .reduce((s, a) => s + (a.cost_pc ?? 0), 0)

  const pcRemaining = pcDispo + pcGained - pcSpent

  const handleToggle = (advantageId, type, costPc) => {
    if (isLockedForPlayer(advantageOptionKey(advantageId))) return
    setSelected(prev => {
      const isOn = prev.includes(advantageId)
      if (isOn) return prev.filter(id => id !== advantageId)
      if (type === 'advantage' && (costPc ?? 0) > pcRemaining) return prev
      return [...prev, advantageId]
    })
  }

  const handleNext = () => {
    const pcNet = pcGained - pcSpent
    const advantagesMeta = selected.map(id => {
      const adv = refData.find(a => a.advantage_id === id)
      return { advantage_id: id, name: adv?.name ?? id, type: adv?.type ?? 'unknown', cost_pc: adv?.cost_pc ?? 0 }
    })
    onNext?.({ advantages: selected, pcNet, advantagesMeta })
  }

  if (loading) {
    return (
      <div style={s.center}>
        <p style={s.loadingText}>{t('step5.loading')}</p>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.pcBanner}>
        {t('step5.pc_remaining', { n: pcRemaining })}
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>{t('step5.advantages_section')}</h3>
        <div style={s.grid}>
          {advantages.map(adv => {
            const isOn = selected.includes(adv.advantage_id)
            const canSelect = isOn || (adv.cost_pc ?? 0) <= pcRemaining
            const optionKey = advantageOptionKey(adv.advantage_id)
            const lockedForPlayer = isLockedForPlayer(optionKey)
            return (
              <div
                key={adv.advantage_id}
                className={lockedForPlayer ? 'locked' : undefined}
                style={{
                  ...s.card,
                  ...(isOn ? s.cardOn : {}),
                  ...(!canSelect && !isOn ? s.cardDisabled : {}),
                }}
                onClick={() => canSelect || isOn ? handleToggle(adv.advantage_id, 'advantage', adv.cost_pc) : undefined}
              >
                <span style={s.cardName}>{adv.name}</span>
                <span style={s.cardCost}>{t('step5.pc_cost', { n: adv.cost_pc ?? 0 })}</span>
                {showLockToggle && (
                  <WizardLockToggle locked={isLocked(optionKey)} onToggle={() => toggleLock(optionKey)} />
                )}
                {adv.description && <p style={s.cardDesc}>{adv.description}</p>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>{t('step5.disadvantages_section')}</h3>
        <div style={s.grid}>
          {disadvantages.map(dis => {
            const isOn = selected.includes(dis.advantage_id)
            const optionKey = advantageOptionKey(dis.advantage_id)
            const lockedForPlayer = isLockedForPlayer(optionKey)
            return (
              <div
                key={dis.advantage_id}
                className={lockedForPlayer ? 'locked' : undefined}
                style={{ ...s.card, ...(isOn ? s.cardDisadvOn : {}) }}
                onClick={() => handleToggle(dis.advantage_id, 'disadvantage', dis.cost_pc)}
              >
                <span style={s.cardName}>{dis.name}</span>
                <span style={s.cardGain}>+{Math.abs(dis.cost_pc ?? 0)} PC</span>
                {showLockToggle && (
                  <WizardLockToggle locked={isLocked(optionKey)} onToggle={() => toggleLock(optionKey)} />
                )}
                {dis.description && <p style={s.cardDesc}>{dis.description}</p>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={s.nav}>
        <button className="btn btn-ghost" onClick={onPrev}>
          {t('step5.prev')}
        </button>
        <button
          className={pcRemaining >= 0 ? 'btn btn-gold' : 'btn'}
          onClick={handleNext}
          disabled={pcRemaining < 0}
        >
          {t('step5.validate')}
        </button>
      </div>
    </div>
  )
}

const s = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', overflowY: 'auto' },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#5a5a7a', fontSize: '14px' },
  pcBanner: { textAlign: 'center', color: '#e0a85c', fontSize: '16px', fontWeight: '700', padding: '8px', borderBottom: '1px solid #1e1e2e' },
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: { color: '#9090c8', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  card: { padding: '12px 16px', backgroundColor: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '6px', cursor: 'pointer', maxWidth: '260px', display: 'flex', flexDirection: 'column', gap: '4px', transition: 'border-color 0.15s ease' },
  cardOn: { borderColor: '#5b8dee', backgroundColor: '#14142e' },
  cardDisadvOn: { borderColor: '#c06060', backgroundColor: '#1e0e0e' },
  cardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  cardName: { color: '#c8c8f0', fontSize: '13px', fontWeight: '600' },
  cardCost: { color: '#e0a85c', fontSize: '11px', fontWeight: '600' },
  cardGain: { color: '#60c060', fontSize: '11px', fontWeight: '600' },
  cardDesc: { color: '#7070a0', fontSize: '11px', lineHeight: '1.5', margin: 0 },
  nav: { display: 'flex', gap: '12px', justifyContent: 'center', paddingTop: '8px', paddingBottom: '20px' },
}
