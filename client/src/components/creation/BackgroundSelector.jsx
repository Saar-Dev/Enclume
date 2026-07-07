import { useTranslation } from 'react-i18next'
import { nationsList } from './mockStep4Data'

export default function BackgroundSelector({
  title,
  items,
  selected,
  selectedItem,
  onSelect,
  onRandom,
  onNext,
  onPrev,
  canNext,
  randomLabel,
  extraInfo,
  skipLabel,
  onSkip,
  customName,
  onNameChange,
  nation,
  onNationChange,
  defaultNation,
  conditionalChoices,
  onConditionalChoice,
}) {
  const { t } = useTranslation('creation')

  return (
    <div style={s.container}>
      <h2 style={s.title}>{title}</h2>

      {extraInfo && (
        <p style={s.extraInfo}>{extraInfo}</p>
      )}

      <div style={s.grid}>
        {items.map(item => (
          <div
            key={item.code + (item.parent_code || '')}
            style={{
              ...s.card,
              ...(selected === item.code ? s.cardSelected : {}),
            }}
            onClick={() => onSelect(item.code)}
          >
            <span style={s.cardName}>{item.name}</span>
            {item.diceRange && (
              <span style={s.cardDice}>{item.diceRange}</span>
            )}
          </div>
        ))}
      </div>

      {/* Détails de la sélection */}
      {selectedItem && (
        <div style={s.details}>
          {selectedItem.description && (
            <p style={s.desc}>{selectedItem.description}</p>
          )}

          {/* Champ nom (navire/station/cité) */}
          {selectedItem.asksName && (
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>{selectedItem.nameLabel || 'Nom'} :</label>
              <input
                type="text"
                style={s.textInput}
                value={customName || ''}
                onChange={(e) => onNameChange && onNameChange(e.target.value)}
                placeholder={selectedItem.nameLabel || 'Nom'}
              />
            </div>
          )}

          {/* Select nation */}
          {selectedItem.asksNation && (
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Nation :</label>
              <select
                style={s.nationSelect}
                value={nation || defaultNation || ''}
                onChange={(e) => onNationChange && onNationChange(e.target.value)}
              >
                <option value="">—</option>
                {nationsList.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Skills bonus (non conditionnelles) */}
{selectedItem.skills && selectedItem.skills.filter(sk => !sk.conditional).length > 0 && (
  <div style={s.skillsBox}>
    <h3 style={s.skillsTitle}>Bonus de compétences</h3>
    <ul style={s.skillsList}>
      {selectedItem.skills.filter(sk => !sk.conditional).map((sk, i) => (
        <li key={i} style={s.skillItem}>
          <span style={s.skillName}>{sk.skill_name || sk.skill_id}</span>
          <span style={s.skillBonus}>+{sk.bonus}</span>
        </li>
      ))}
    </ul>
  </div>
)}

{/* Choix conditionnels */}
{selectedItem.skills && selectedItem.skills.some(sk => sk.conditional) && (
  <div style={s.choicesBox}>
    <h3 style={s.choicesTitle}>À choisir</h3>
    {(() => {
      // Grouper par choice_group (ou skill_id seul pour les conditionnelles sans groupe)
      const groups = {}
      selectedItem.skills.filter(sk => sk.conditional).forEach(sk => {
        const key = sk.choice_group || `__solo_${sk.skill_id}`
        if (!groups[key]) groups[key] = { skills: [], isSolo: !sk.choice_group }
        groups[key].skills.push(sk)
        groups[key].isSolo = groups[key].isSolo || !sk.choice_group
      })
      return Object.entries(groups).map(([key, { skills, isSolo }]) => {
        const compositeKey = `${selectedItem.id}_${key}`
        const currentChoice = conditionalChoices?.[compositeKey]
        return (
          <div key={key} style={s.choiceGroup}>
            <span style={s.choiceLabel}>
              {isSolo ? 'Optionnel' : `Choisissez un(e) ${key.replace(/_/g, ' ')}`} :
            </span>
            <div style={s.choiceOptions}>
              {skills.map(sk => (
                <label key={sk.skill_id} style={s.choiceOption}>
                  <input
                    type={isSolo ? 'checkbox' : 'radio'}
                    name={`choice_${compositeKey}`}
                    checked={isSolo ? currentChoice === sk.skill_id : currentChoice === sk.skill_id}
                    onChange={() => {
                      if (isSolo) {
                        onConditionalChoice?.(
                          compositeKey,
                          currentChoice === sk.skill_id ? null : sk.skill_id
                        )
                      } else {
                        onConditionalChoice?.(compositeKey, sk.skill_id)
                      }
                    }}
                  />
                  <span style={s.choiceSkillName}>{sk.skill_name || sk.skill_id}</span>
                  <span style={s.skillBonus}>+{sk.bonus}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })
    })()}
  </div>
)}

          {selectedItem.isAutodidacte && (
            <p style={s.autodidacteInfo}>
              7 points libres à répartir (+2 max par compétence). Les compétences réservées doivent être validées par le MJ.
            </p>
          )}

          {selectedItem.hasSpecialties && (
            <p style={s.specialtyInfo}>
              Choisissez une spécialité : Aquaculture, Mines ou Usine/Atelier. Les bonus seront détaillés dans les professions.
            </p>
          )}
        </div>
      )}

      <div style={s.nav}>
        <button style={s.backBtn} onClick={onPrev}>
          {t('step4.prev')}
        </button>
        {onSkip && (
          <button style={s.skipBtn} onClick={onSkip}>
            {skipLabel || 'Passer'}
          </button>
        )}
        {onRandom && (
          <button style={s.randomBtn} onClick={onRandom}>
            {randomLabel || t('step4.geo_random')}
          </button>
        )}
        <button
          style={canNext ? s.nextBtn : s.nextBtnDisabled}
          onClick={onNext}
          disabled={!canNext}
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
    alignItems: 'center',
    padding: '30px 20px',
    gap: '18px',
  },
  title: {
    color: '#c8c8f0',
    fontSize: '22px',
    fontWeight: '700',
  },
  extraInfo: {
    color: '#c0a060',
    fontSize: '13px',
    margin: 0,
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    maxWidth: '600px',
  },
  card: {
    padding: '14px 20px',
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
    minWidth: '180px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardSelected: {
    borderColor: '#5b8dee',
    backgroundColor: '#14142e',
  },
  cardName: {
    color: '#c8c8f0',
    fontSize: '14px',
    fontWeight: '600',
  },
  cardDice: {
    color: '#5a5a7a',
    fontSize: '11px',
  },
  details: {
    maxWidth: '500px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  desc: {
    color: '#9090c8',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: 0,
    textAlign: 'center',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: '#8080a0',
    fontSize: '13px',
    minWidth: '60px',
    textAlign: 'right',
  },
  textInput: {
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#c8c8f0',
    fontSize: '13px',
    width: '200px',
  },
  nationSelect: {
    padding: '6px 10px',
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#c8c8f0',
    fontSize: '13px',
    width: '200px',
  },
  skillsBox: {
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '14px 18px',
  },
  skillsTitle: {
    color: '#9090c8',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '10px',
    textAlign: 'center',
  },
  skillsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  skillItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  skillName: {
    color: '#a0a0c0',
    flex: 1,
  },
  skillBonus: {
    color: '#5b8dee',
    fontWeight: '600',
  },
  skillCond: {
    color: '#6a6a4a',
    fontSize: '11px',
  },
  autodidacteInfo: {
    color: '#c0a060',
    fontSize: '13px',
    textAlign: 'center',
  },
  specialtyInfo: {
    color: '#c0a060',
    fontSize: '13px',
    textAlign: 'center',
  },
  choicesBox: {
  backgroundColor: '#0a0a18',
  border: '1px solid #2a2a3e',
  borderRadius: '6px',
  padding: '14px 18px',
  marginTop: '4px',
},
choicesTitle: {
  color: '#c0a060',
  fontSize: '12px',
  fontWeight: '600',
  marginBottom: '10px',
  textAlign: 'center',
},
choiceGroup: {
  marginBottom: '8px',
},
choiceLabel: {
  color: '#8080a0',
  fontSize: '11px',
  marginBottom: '4px',
  display: 'block',
},
choiceOptions: {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
},
choiceOption: {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  cursor: 'pointer',
},
choiceSkillName: {
  color: '#a0a0c0',
  flex: 1,
},
  nav: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  skipBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #3a3a5e',
    borderRadius: '4px',
    color: '#9090c8',
    cursor: 'pointer',
    fontSize: '13px',
  },
  randomBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #5a5a3e',
    borderRadius: '4px',
    color: '#c0a060',
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