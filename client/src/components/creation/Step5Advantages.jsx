import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { advantageOptionKey } from '../../../../shared/wizardOptionKeys.js'
import { useWizardLock } from '../../lib/useWizardLock.js'
import WizardLockToggle from './WizardLockToggle.jsx'
import { useCreationStore } from '../../stores/creationStore'

export default function Step5Advantages({ initialData, sheetId, pcDispo, onNext, onPrev, onLiveChange }) {
  const { t } = useTranslation('creation')
  const { isLocked, isLockedForPlayer, toggleLock, showLockToggle } = useWizardLock(5)
  const setStep5Data = useCreationStore(s => s.setStep5Data)
  const [refData, setRefData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(initialData?.advantages ?? [])
  const [pendingFamily, setPendingFamily] = useState(null)

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step5/ref`)
      .then(res => setRefData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sheetId])

  const advantages = refData.filter(a => a.type === 'advantage')
  const disadvantages = refData.filter(a => a.type === 'disadvantage')

  // `family` ne couvre que les variantes mutuellement exclusives (ex. Phobie, Déséquilibre
  // mental) contraintes par family_limit côté serveur (advantageConstraints.js) — pas une
  // taxonomie complète. La majorité des items restent hors famille et gardent la grille plate.
  const groupByFamily = (items) => {
    const seen = new Set()
    const families = []
    const ungrouped = []
    items.forEach(item => {
      if (item.family == null) { ungrouped.push(item); return }
      if (seen.has(item.family)) return
      seen.add(item.family)
      families.push({
        family: item.family,
        limit: item.family_limit ?? 1,
        items: items.filter(i => i.family === item.family),
      })
    })
    return { ungrouped, families }
  }

  const { ungrouped: ungroupedAdv, families: advFamilies } = groupByFamily(advantages)
  const { ungrouped: ungroupedDis, families: disFamilies } = groupByFamily(disadvantages)

  const pcGained = selected
    .map(id => refData.find(a => a.advantage_id === id))
    .filter(a => a?.type === 'disadvantage')
    .reduce((s, a) => s + Math.abs(a.cost_pc ?? 0), 0)

  const pcSpent = selected
    .map(id => refData.find(a => a.advantage_id === id))
    .filter(a => a?.type === 'advantage')
    .reduce((s, a) => s + (a.cost_pc ?? 0), 0)

  const pcRemaining = pcDispo + pcGained - pcSpent
  const pcNet = pcGained - pcSpent

  // Mémoïsé (pas un .map() nu) — référencé par l'effet de commit continu ci-dessous : un nouveau
  // tableau à chaque rendu redéclencherait cet effet en boucle (même incident "Maximum update depth
  // exceeded" déjà rencontré et documenté sur Step4Experience.jsx#validSetbackRolls).
  const advantagesMeta = useMemo(() => selected.map(id => {
    const adv = refData.find(a => a.advantage_id === id)
    return { advantage_id: id, name: adv?.name ?? id, type: adv?.type ?? 'unknown', cost_pc: adv?.cost_pc ?? 0 }
  }), [selected, refData])

  // Diffusion live (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§6.4bis) au MJ, ET commit continu dans le
  // store (WIZ45, docs/EN_COURS.md). pcNet/advantagesMeta étaient auparavant omis ici ("ne servent
  // qu'à la soumission finale") — mais ce payload devient aussi la valeur committée localement :
  // sans eux, step5Data resterait incomplet (pcNet manquant casserait le budget PC du header) tant
  // que "Suivant" n'a pas été cliqué.
  useEffect(() => {
    const payload = { advantages: selected, pcNet, advantagesMeta }
    onLiveChange?.(payload)
    setStep5Data(payload)
  }, [selected, pcNet, advantagesMeta, onLiveChange, setStep5Data])

  const handleToggle = (advantageId, type, costPc) => {
    if (isLockedForPlayer(advantageOptionKey(advantageId))) return
    setSelected(prev => {
      const isOn = prev.includes(advantageId)
      if (isOn) return prev.filter(id => id !== advantageId)
      if (type === 'advantage' && (costPc ?? 0) > pcRemaining) return prev
      return [...prev, advantageId]
    })
  }

  // Sélection d'une variante de famille (modal) : remplace toute variante de la même famille déjà
  // choisie (family_limit vaut 1 pour toutes les familles réelles à ce jour) ; re-cliquer la
  // variante déjà choisie la retire, sans rien sélectionner à la place.
  const handleSelectFamilyVariant = (item) => {
    if (isLockedForPlayer(advantageOptionKey(item.advantage_id))) return
    setSelected(prev => {
      const withoutFamily = prev.filter(id => refData.find(a => a.advantage_id === id)?.family !== item.family)
      if (prev.includes(item.advantage_id)) return withoutFamily
      return [...withoutFamily, item.advantage_id]
    })
    setPendingFamily(null)
  }

  const handleNext = () => {
    onNext?.({ advantages: selected, pcNet, advantagesMeta })
  }

  if (loading) {
    return (
      <div style={s.center}>
        <p style={s.loadingText}>{t('step5.loading')}</p>
      </div>
    )
  }

  const renderAdvCard = (adv) => {
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
  }

  const renderDisCard = (dis) => {
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
  }

  // Familles à 2 membres ou moins : lisibles côte à côte telles quelles, pas besoin de repliage.
  const renderFamilyBlock = (fam, renderCard) => {
    const count = fam.items.filter(item => selected.includes(item.advantage_id)).length
    return (
      <div key={fam.family} style={s.familyBlock}>
        <div style={s.familyHeader}>
          <span style={s.familyName}>{fam.family}</span>
          <span style={s.familyCounter}>{t('step5.family_limit_counter', { n: count, max: fam.limit })}</span>
        </div>
        <div style={s.grid}>
          {fam.items.map(renderCard)}
        </div>
      </div>
    )
  }

  const familyCostLabel = (fam) => {
    const type = fam.items[0]?.type
    const costs = fam.items.map(item => Math.abs(item.cost_pc ?? 0))
    const min = Math.min(...costs)
    const max = Math.max(...costs)
    const rangeText = min === max ? String(min) : `${min}-${max}`
    return type === 'disadvantage' ? `+${rangeText} PC` : t('step5.pc_cost', { n: rangeText })
  }

  // Familles à 3 membres ou plus (paliers d'un même avantage/désavantage — Carte au trésor, Phobie,
  // Sens développé...) : une seule carte-résumé, la modal liste les paliers au clic. Reprend le
  // patron de sélection de sous-type déjà en place pour les mutations (Step3Mutations.jsx,
  // has_subtable/subtable) plutôt qu'un nouveau mécanisme.
  const renderFamilySummaryCard = (fam) => {
    const type = fam.items[0]?.type
    const selectedItem = fam.items.find(item => selected.includes(item.advantage_id))
    const isOn = !!selectedItem
    return (
      <div
        key={fam.family}
        style={{ ...s.card, ...(isOn ? (type === 'disadvantage' ? s.cardDisadvOn : s.cardOn) : {}) }}
        onClick={() => setPendingFamily(fam.family)}
      >
        <span style={s.cardName}>{fam.family}</span>
        <span style={type === 'disadvantage' ? s.cardGain : s.cardCost}>{familyCostLabel(fam)}</span>
        <p style={s.cardDesc}>
          {selectedItem
            ? t('step5.family_selected', { name: selectedItem.name })
            : t('step5.family_choose_hint', { count: fam.items.length })}
        </p>
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
          {ungroupedAdv.map(renderAdvCard)}
          {advFamilies.filter(fam => fam.items.length > 2).map(renderFamilySummaryCard)}
        </div>
        {advFamilies.filter(fam => fam.items.length <= 2).map(fam => renderFamilyBlock(fam, renderAdvCard))}
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>{t('step5.disadvantages_section')}</h3>
        <div style={s.grid}>
          {ungroupedDis.map(renderDisCard)}
          {disFamilies.filter(fam => fam.items.length > 2).map(renderFamilySummaryCard)}
        </div>
        {disFamilies.filter(fam => fam.items.length <= 2).map(fam => renderFamilyBlock(fam, renderDisCard))}
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

      {pendingFamily && (() => {
        const fam = [...advFamilies, ...disFamilies].find(f => f.family === pendingFamily)
        if (!fam) return null
        const type = fam.items[0]?.type
        const selectedItem = fam.items.find(item => selected.includes(item.advantage_id))
        const familyRemaining = pcRemaining + (type === 'advantage' ? (selectedItem?.cost_pc ?? 0) : 0)
        return (
          <div style={s.overlay} onClick={() => setPendingFamily(null)}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
              <h3 style={s.modalTitle}>{fam.family} — {t('step5.choose_variant')}</h3>
              {fam.items.map(item => {
                const isOn = selected.includes(item.advantage_id)
                const optionKey = advantageOptionKey(item.advantage_id)
                const lockedForPlayer = isLockedForPlayer(optionKey)
                const affordable = type !== 'advantage' || isOn || (item.cost_pc ?? 0) <= familyRemaining
                return (
                  <div key={item.advantage_id} className={lockedForPlayer ? 'locked' : undefined} style={s.subtypeRow}>
                    <button
                      style={{ ...s.subtypeBtn, ...(isOn ? s.subtypeBtnOn : {}), ...(!affordable ? s.subtypeBtnDisabled : {}) }}
                      onClick={() => handleSelectFamilyVariant(item)}
                      disabled={!affordable}
                    >
                      {item.name} — {type === 'disadvantage' ? `+${Math.abs(item.cost_pc ?? 0)} PC` : t('step5.pc_cost', { n: item.cost_pc ?? 0 })}
                    </button>
                    {showLockToggle && (
                      <WizardLockToggle locked={isLocked(optionKey)} onToggle={() => toggleLock(optionKey)} />
                    )}
                    {item.description && <p style={s.subtypeDesc}>{item.description}</p>}
                  </div>
                )
              })}
              <button style={s.cancelBtn} onClick={() => setPendingFamily(null)}>{t('step5.cancel')}</button>
            </div>
          </div>
        )
      })()}
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
  familyBlock: { marginTop: '10px', paddingLeft: '12px', borderLeft: '2px solid #2a2a3e', display: 'flex', flexDirection: 'column', gap: '8px' },
  familyHeader: { display: 'flex', alignItems: 'baseline', gap: '8px' },
  familyName: { color: '#8888a8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
  familyCounter: { color: '#5a5a7a', fontSize: '10px' },
  card: { padding: '12px 16px', backgroundColor: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '6px', cursor: 'pointer', maxWidth: '260px', display: 'flex', flexDirection: 'column', gap: '4px', transition: 'border-color 0.15s ease' },
  cardOn: { borderColor: '#5b8dee', backgroundColor: '#14142e' },
  cardDisadvOn: { borderColor: '#c06060', backgroundColor: '#1e0e0e' },
  cardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  cardName: { color: '#c8c8f0', fontSize: '13px', fontWeight: '600' },
  cardCost: { color: '#e0a85c', fontSize: '11px', fontWeight: '600' },
  cardGain: { color: '#60c060', fontSize: '11px', fontWeight: '600' },
  cardDesc: { color: '#7070a0', fontSize: '11px', lineHeight: '1.5', margin: 0 },
  nav: { display: 'flex', gap: '12px', justifyContent: 'center', paddingTop: '8px', paddingBottom: '20px' },

  // Modal de choix de palier (familles à 3 membres ou plus) — même patron que le modal sous-type
  // de Step3Mutations.jsx (overlay/modal/subtypeBtn), adapté avec l'état sélectionné/désactivé.
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
  subtypeRow: { display: 'flex', flexDirection: 'column', gap: '2px' },
  subtypeBtn: {
    padding: '10px 16px', background: '#1e1e3e', border: '1px solid #3a3a5e',
    borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', cursor: 'pointer', textAlign: 'left',
    width: '100%',
  },
  subtypeBtnOn: { borderColor: '#5b8dee', backgroundColor: '#14142e', color: '#c8c8f0' },
  subtypeBtnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  subtypeDesc: { color: '#6a6a8a', fontSize: '10px', lineHeight: '1.5', margin: '2px 0 0 0' },
  cancelBtn: {
    padding: '8px 12px', background: 'transparent', border: 'none',
    color: '#e05c5c', cursor: 'pointer', fontSize: '11px', marginTop: '4px', alignSelf: 'center',
  },
}
