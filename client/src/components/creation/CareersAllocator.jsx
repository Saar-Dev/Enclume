import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { careersList } from './mockStep4Data'

export default function CareersAllocator({
  pcDispo,
  selectedCareers,
  onAdd,
  onRemove,
  onNext,
  onPrev,
  selectedGeoItem,
  selectedSocItem,
  selectedTrainingItem,
  selectedHigherEdItem,
}) {
  const { t } = useTranslation('creation')
  const [selectedCareerCode, setSelectedCareerCode] = useState(null)
  const [years, setYears] = useState(1)
  const [filter, setFilter] = useState('all')

  const career = careersList.find(c => c.code === selectedCareerCode) || null

  // Filtrage
  const filteredCareers = careersList.filter(c => {
    if (filter === 'all') return true
    return !c.restricted_geo
  })

  // Titre correspondant aux années
  const getTitleForYears = (titles, yrs) => {
    if (!titles || titles.length === 0) return null
    return titles.find(t => yrs >= t.min_years && (t.max_years === null || yrs <= t.max_years)) || titles[titles.length - 1]
  }

  const currentTitle = career ? getTitleForYears(career.titles, years) : null

  // Salaire formaté
  const formatSalary = (title) => {
    if (!title) return '—'
    if (title.salary_per_year) return `${title.salary_per_year}¤/an`
    if (title.salary_formula) return `${title.salary_formula} (aléatoire)`
    return '—'
  }

  // Compétences groupées
  const groupedSkills = career ? career.skills.reduce((acc, sk) => {
    if (!acc[sk.skill_group]) acc[sk.skill_group] = []
    acc[sk.skill_group].push(sk)
    return acc
  }, {}) : {}

  // PC total dépensé
  const totalPC = selectedCareers.reduce((sum, c) => sum + c.years, 0)
  const remainingPC = pcDispo - totalPC

  // Fusion de toutes les compétences (backgrounds + carrières)
  const allSkills = useMemo(() => {
    const map = new Map()

    const addSkills = (skills) => {
      skills?.forEach(sk => {
        const b = sk.bonus ?? 0
        const existing = map.get(sk.skill_id)
        if (existing) {
          existing.mastery += b
        } else {
          map.set(sk.skill_id, { skill_id: sk.skill_id, mastery: b })
        }
      })
    }

    addSkills(selectedGeoItem?.skills)
    addSkills(selectedSocItem?.skills)
    addSkills(selectedTrainingItem?.skills)
    addSkills(selectedHigherEdItem?.skills)

    selectedCareers.forEach(c => {
      const cData = careersList.find(cl => cl.code === c.career_id)
      addSkills(cData?.skills)
    })

    return Array.from(map.values())
  }, [selectedGeoItem, selectedSocItem, selectedTrainingItem, selectedHigherEdItem, selectedCareers])

  const handleAdd = () => {
    if (!career) return
    if (years > remainingPC) return
    onAdd(career.code, years)
    setSelectedCareerCode(null)
    setYears(1)
  }

  const handleSelectCareer = (code) => {
    if (selectedCareerCode === code) {
      setSelectedCareerCode(null)
    } else {
      setSelectedCareerCode(code)
      setYears(1)
    }
  }

  return (
    <div style={s.container}>
      {/* En-tête */}
      <div style={s.header}>
        <span style={s.pcRemaining}>
          PC : {remainingPC} / {pcDispo}
        </span>
      </div>

      {/* Filtres */}
      <div style={s.filters}>
        <button
          style={filter === 'all' ? s.filterActive : s.filterBtn}
          onClick={() => setFilter('all')}
        >
          Tous
        </button>
        <button
          style={filter === 'eligible' ? s.filterActive : s.filterBtn}
          onClick={() => setFilter('eligible')}
        >
          Accessibles
        </button>
      </div>

      {/* Grille professions */}
      <div style={s.careersGrid}>
        {filteredCareers.map(c => (
          <div
            key={c.code}
            style={{
              ...s.careerCard,
              ...(selectedCareerCode === c.code ? s.careerCardSelected : {}),
            }}
            onClick={() => handleSelectCareer(c.code)}
          >
            <span style={s.careerName}>{c.name}</span>
            <span style={s.careerPoints}>{c.points_per_year} pts/an</span>
            {c.restricted_geo && (
              <span style={s.careerRestricted}>⚠️ restreint</span>
            )}
          </div>
        ))}
      </div>

      {/* Détail profession */}
      {career && (
        <div style={s.detail}>
          <h3 style={s.detailTitle}>{career.name}</h3>
          <p style={s.detailDesc}>{career.description}</p>

          {career.restricted_geo && (
            <p style={s.detailRestricted}>{career.restricted_geo}</p>
          )}

          {/* Compétences */}
          <div style={s.skillsSection}>
            <h4 style={s.skillsTitle}>
              {t('step4.career_skills_title', { points: career.points_per_year })} — {career.points_per_year * years} pts à répartir
            </h4>
            {Object.entries(groupedSkills).map(([group, skills]) => (
              <div key={group} style={s.skillGroup}>
                <span style={s.skillGroupName}>{group}</span>
                <ul style={s.skillList}>
                  {skills.map(sk => (
                    <li key={sk.skill_id} style={s.skillItem}>
                      {sk.skill_id}
                      {sk.conditional && <span style={s.skillCond}> (au choix)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Salaire */}
          <div style={s.salaryRow}>
            <span style={s.salaryLabel}>{t('step4.career_salary', { amount: '' })}</span>
            <span style={s.salaryValue}>{formatSalary(currentTitle)}</span>
            {currentTitle && (
              <span style={s.salaryTitle}> — {currentTitle.title}</span>
            )}
          </div>

          {/* Slider années */}
          <div style={s.yearsRow}>
            <span style={s.yearsLabel}>
              {t('step4.career_years')} : {years}
            </span>
            <input
              type="range"
              min={1}
              max={Math.max(1, Math.min(20, remainingPC))}
              value={years}
              onChange={(e) => setYears(parseInt(e.target.value, 10))}
              disabled={remainingPC <= 0}
              style={s.yearsSlider}
            />
          </div>

          {/* Récapitulatif année */}
          <div style={s.recapBox}>
            <div style={s.recapRow}>
              <span style={s.recapLabel}>Compétences</span>
              <span style={s.recapValue}>{career.points_per_year * years} pts</span>
            </div>
            <div style={s.recapRow}>
              <span style={s.recapLabel}>Avantages pro</span>
              <span style={s.recapValue}>{5 * years} pts</span>
            </div>
            <div style={s.recapRow}>
              <span style={s.recapLabel}>Salaire</span>
              <span style={s.recapValue}>
                {currentTitle ? formatSalary(currentTitle) : '—'}
                {currentTitle ? ` × ${years} an(s)` : ''}
              </span>
            </div>
            <div style={s.recapRow}>
              <span style={s.recapLabel}>Âge</span>
              <span style={s.recapValue}>+{years} an(s)</span>
            </div>
            <div style={s.recapRowTotal}>
              <span style={s.recapLabel}>Coût total</span>
              <span style={s.recapValueTotal}>{years} PC</span>
            </div>
          </div>

          {/* Bouton Ajouter */}
          <button
            style={years <= remainingPC ? s.addBtn : s.addBtnDisabled}
            onClick={handleAdd}
            disabled={years > remainingPC}
          >
            {t('step4.career_add')}
          </button>
        </div>
      )}

      {/* Professions sélectionnées */}
      {selectedCareers.length > 0 && (
        <div style={s.selectedSection}>
          <h4 style={s.selectedTitle}>
            Professions sélectionnées ({selectedCareers.length})
          </h4>
          {selectedCareers.map((c, i) => {
            const cData = careersList.find(cl => cl.code === c.career_id)
            return (
              <div key={i} style={s.selectedRow}>
                <span style={s.selectedName}>{cData?.name || c.career_id}</span>
                <span style={s.selectedYears}>{c.years} an(s)</span>
                <span style={s.selectedPC}>= {c.years} PC</span>
                <button
                  style={s.removeBtn}
                  onClick={() => onRemove(i)}
                >
                  {t('step4.career_remove')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedCareers.length === 0 && (
        <p style={s.noneSelected}>{t('step4.career_none')}</p>
      )}

      {/* Séparateur + Tableau récapitulatif des compétences */}
      {selectedCareers.length > 0 && allSkills.length > 0 && (
        <>
          <div style={s.separator}>
            <span style={s.separatorText}>Récapitulatif des compétences</span>
          </div>

          <table style={s.skillsTable}>
            <thead>
              <tr>
                <th style={s.th}>Compétence</th>
                <th style={s.th}>Base</th>
                <th style={s.th}>Maîtrise</th>
                <th style={s.th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {allSkills.map(sk => (
                <tr key={sk.skill_id}>
                  <td style={s.td}>{sk.skill_id}</td>
                  <td style={s.tdBase}>attr_1/attr_2</td>
                  <td style={s.tdMasteryCell}>
                    <button style={s.minusBtn}>-</button>
                    <span style={s.masteryValue}>{sk.mastery || 0}</span>
                    <button style={s.plusBtn}>+</button>
                  </td>
                  <td style={s.td}>+{sk.mastery || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Navigation */}
      <div style={s.nav}>
        <button style={s.backBtn} onClick={onPrev}>
          {t('step4.prev')}
        </button>
        <button
          style={selectedCareers.length > 0 ? s.nextBtn : s.nextBtnDisabled}
          onClick={onNext}
          disabled={selectedCareers.length === 0}
        >
          {t('step4.next')}
        </button>
      </div>
    </div>
  )
}

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '16px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  pcRemaining: {
    color: '#e0a85c',
    fontSize: '16px',
    fontWeight: '700',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  filterBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8080a0',
    cursor: 'pointer',
    fontSize: '12px',
  },
  filterActive: {
    padding: '6px 16px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #5b8dee',
    borderRadius: '4px',
    color: '#c8c8f0',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  careersGrid: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  careerCard: {
    flex: '0 0 160px',
    padding: '12px 14px',
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  careerCardSelected: {
    borderColor: '#5b8dee',
    backgroundColor: '#14142e',
  },
  careerName: {
    color: '#c8c8f0',
    fontSize: '13px',
    fontWeight: '600',
  },
  careerPoints: {
    color: '#5a5a7a',
    fontSize: '11px',
  },
  careerRestricted: {
    color: '#c0a060',
    fontSize: '10px',
  },
  detail: {
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailTitle: {
    color: '#c8c8f0',
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
  },
  detailDesc: {
    color: '#9090c8',
    fontSize: '12px',
    lineHeight: '1.6',
    margin: 0,
  },
  detailRestricted: {
    color: '#c0a060',
    fontSize: '11px',
    fontStyle: 'italic',
    margin: 0,
  },
  skillsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  skillsTitle: {
    color: '#9090c8',
    fontSize: '12px',
    fontWeight: '600',
    margin: 0,
  },
  skillGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  skillGroupName: {
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  skillList: {
    listStyle: 'none',
    padding: '0 0 0 8px',
    margin: 0,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 12px',
  },
  skillItem: {
    color: '#a0a0c0',
    fontSize: '11px',
  },
  skillCond: {
    color: '#6a6a4a',
    fontSize: '10px',
  },
  salaryRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  salaryLabel: {
    color: '#8080a0',
    fontSize: '12px',
  },
  salaryValue: {
    color: '#e0a85c',
    fontSize: '14px',
    fontWeight: '600',
  },
  salaryTitle: {
    color: '#6a6a8a',
    fontSize: '11px',
  },
  yearsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  yearsLabel: {
    color: '#8080a0',
    fontSize: '13px',
  },
  yearsSlider: {
    flex: 1,
    maxWidth: '200px',
    height: '4px',
    cursor: 'pointer',
    accentColor: '#5b8dee',
  },
  recapBox: {
    backgroundColor: '#0a0a18',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  recapRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  recapLabel: {
    color: '#8080a0',
  },
  recapValue: {
    color: '#c8c8f0',
    fontWeight: '600',
  },
  recapRowTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    borderTop: '1px solid #1e1e2e',
    paddingTop: '4px',
    marginTop: '2px',
  },
  recapValueTotal: {
    color: '#e0a85c',
    fontWeight: '700',
  },
  addBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  addBtnDisabled: {
    padding: '8px 20px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    color: '#4a4a6a',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'not-allowed',
    alignSelf: 'flex-start',
  },
  selectedSection: {
    backgroundColor: '#0a0a18',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectedTitle: {
    color: '#9090c8',
    fontSize: '12px',
    fontWeight: '600',
    margin: 0,
  },
  selectedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid #1a1a2a',
  },
  selectedName: {
    color: '#c8c8f0',
    fontSize: '13px',
    fontWeight: '600',
    flex: 1,
  },
  selectedYears: {
    color: '#8080a0',
    fontSize: '12px',
  },
  selectedPC: {
    color: '#e0a85c',
    fontSize: '12px',
    fontWeight: '600',
  },
  removeBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #4a2a2a',
    borderRadius: '3px',
    color: '#c06060',
    cursor: 'pointer',
    fontSize: '11px',
  },
  noneSelected: {
    color: '#5a5a7a',
    fontSize: '13px',
    textAlign: 'center',
    margin: 0,
  },
  separator: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
  },
  separatorText: {
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  skillsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    padding: '4px 6px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'left',
    borderBottom: '1px solid #1e1e2e',
  },
  td: {
    padding: '3px 6px',
    color: '#a0a0c0',
    borderBottom: '1px solid #1a1a2e',
  },
  tdBase: {
    padding: '3px 6px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontStyle: 'italic',
    borderBottom: '1px solid #1a1a2e',
  },
  tdMasteryCell: {
    padding: '3px 6px',
    borderBottom: '1px solid #1a1a2e',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  minusBtn: {
    padding: '1px 6px',
    backgroundColor: 'transparent',
    border: '1px solid #3a2a2a',
    borderRadius: '3px',
    color: '#c06060',
    cursor: 'pointer',
    fontSize: '11px',
    lineHeight: 1,
  },
  plusBtn: {
    padding: '1px 6px',
    backgroundColor: 'transparent',
    border: '1px solid #2a3a2a',
    borderRadius: '3px',
    color: '#60c060',
    cursor: 'pointer',
    fontSize: '11px',
    lineHeight: 1,
  },
  masteryValue: {
    color: '#c8c8f0',
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '20px',
    textAlign: 'center',
  },
  nav: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '8px',
    paddingBottom: '20px',
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8080a0',
    cursor: 'pointer',
    fontSize: '13px',
  },
  nextBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  nextBtnDisabled: {
    padding: '8px 24px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    color: '#4a4a6a',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'not-allowed',
  },
}