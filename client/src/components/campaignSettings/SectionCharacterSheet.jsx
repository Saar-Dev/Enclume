// client/src/components/campaignSettings/SectionCharacterSheet.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SectionCharacterSheet({ initialData, onChange }) {
  const { t } = useTranslation()
  const [ambiance, setAmbiance] = useState(initialData.ambiance ?? 'INTERMEDIAIRE')
  const [femininBonus, setFemininBonus] = useState(initialData.feminin_bonus ?? false)
  const [randomMutations, setRandomMutations] = useState(initialData.random_mutations ?? true)
  const [polarisLatent, setPolarisLatent] = useState(initialData.polaris_latent ?? false)
  const [randomProAdvantages, setRandomProAdvantages] = useState(initialData.random_pro_advantages ?? true)
  const [revers, setRevers] = useState(initialData.revers ?? false)
  const [skillPrerequisites, setSkillPrerequisites] = useState(initialData.skill_prerequisites ?? false)
  const [skillMaxLevel, setSkillMaxLevel] = useState(initialData.skill_max_level ?? false)
  const [skillNaturalProg, setSkillNaturalProg] = useState(initialData.skill_natural_prog ?? false)
  const [youngPenalty, setYoungPenalty] = useState(initialData.young_penalty ?? false)
  const [celebrity, setCelebrity] = useState(initialData.celebrity ?? false)

  const handleAmbiance = (amb) => {
    setAmbiance(amb)
    onChange({ ambiance: amb })
  }

  const handleFemininBonus = (val) => {
    setFemininBonus(val)
    onChange({ feminin_bonus: val })
  }

  const handleRandomMutations = (val) => {
    setRandomMutations(val)
    onChange({ random_mutations: val })
  }

  const handlePolarisLatent = (val) => {
    setPolarisLatent(val)
    onChange({ polaris_latent: val })
  }
  
  const handleRandomProAdvantages = (val) => {
  setRandomProAdvantages(val)
  onChange({ random_pro_advantages: val })
  }
  
  const handleRevers = (val) => {
  setRevers(val)
  onChange({ revers: val })
}
  
  const handleSkillPrerequisites = (val) => {
  setSkillPrerequisites(val)
  onChange({ skill_prerequisites: val })
}

  const handleSkillMaxLevel = (val) => {
  setSkillMaxLevel(val)
  onChange({ skill_max_level: val })
}

  const handleSkillNaturalProg = (val) => {
  setSkillNaturalProg(val)
  onChange({ skill_natural_prog: val })
	}

  const handleYoungPenalty = (val) => {
  setYoungPenalty(val)
  onChange({ young_penalty: val })
}

  const handleCelebrity = (val) => {
  setCelebrity(val)
  onChange({ celebrity: val })
}

  return (
    <section className="card">
      <h2 className="cs-section-title">{t('settings.sectionSheet')}</h2>

      {/* OPT-01 — Ambiance */}
      <div style={{ marginBottom: '24px' }}>
        <span className="cs-toggle-label">{t('settings.ambianceLabel')}</span>
        <p className="cs-toggle-hint" style={{ marginTop: '4px', marginBottom: '12px' }}>
          {t('settings.ambianceHint')}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['REALISTE', 'INTERMEDIAIRE', 'HEROIQUE'].map(amb => (
            <button
              key={amb}
              className="btn-toggle"
              data-active={ambiance === amb}
              style={{ flex: '0 0 auto', padding: '8px 18px' }}
              onClick={() => handleAmbiance(amb)}
            >
              {t(`settings.ambiance${amb}`)}
            </button>
          ))}
        </div>
        <table style={{ marginTop: '12px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="cs-mini-th">{t('settings.ambianceColAmbiance')}</th>
              <th className="cs-mini-th">{t('settings.ambianceColPoints')}</th>
              <th className="cs-mini-th">{t('settings.ambianceColChance')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className={ambiance === 'REALISTE' ? 'cs-mini-tr-active' : ''}>
              <td className="cs-mini-td">{t('settings.ambianceRealiste')}</td>
              <td className="cs-mini-td">30</td>
              <td className="cs-mini-td">11</td>
            </tr>
            <tr className={ambiance === 'INTERMEDIAIRE' ? 'cs-mini-tr-active' : ''}>
              <td className="cs-mini-td">{t('settings.ambianceIntermediaire')}</td>
              <td className="cs-mini-td">38</td>
              <td className="cs-mini-td">13</td>
            </tr>
            <tr className={ambiance === 'HEROIQUE' ? 'cs-mini-tr-active' : ''}>
              <td className="cs-mini-td">{t('settings.ambianceHeroique')}</td>
              <td className="cs-mini-td">46</td>
              <td className="cs-mini-td">15</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* OPT-02 — Bonus/Malus féminin */}
      <div style={{ marginBottom: '24px' }}>
        <label className="cs-toggle-row">
          <input type="checkbox" checked={femininBonus} onChange={e => handleFemininBonus(e.target.checked)} className="cs-checkbox" />
          <span className="cs-toggle-label">{t('settings.femininBonusLabel')}</span>
        </label>
        <p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.femininBonusHint')}</p>
      </div>

      {/* OPT-03 — Mutations aléatoires */}
      <div style={{ marginBottom: '24px' }}>
        <label className="cs-toggle-row">
          <input type="checkbox" checked={randomMutations} onChange={e => handleRandomMutations(e.target.checked)} className="cs-checkbox" />
          <span className="cs-toggle-label">{t('settings.randomMutationsLabel')}</span>
        </label>
        <p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.randomMutationsHint')}</p>
      </div>

      {/* OPT-04 — Polaris latent et non maîtrisé */}
      <div style={{ marginBottom: '24px' }}>
        <label className="cs-toggle-row">
          <input type="checkbox" checked={polarisLatent} onChange={e => handlePolarisLatent(e.target.checked)} className="cs-checkbox" />
          <span className="cs-toggle-label">{t('settings.polarisLatentLabel')}</span>
        </label>
        <p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.polarisLatentHint')}</p>
      </div>
	  
	  {/* OPT-05 — Avantages professionnels aléatoires */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={randomProAdvantages} onChange={e => handleRandomProAdvantages(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.randomProAdvantagesLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.randomProAdvantagesHint')}</p>
	</div>
	
	{/* OPT-06 — Personnages expérimentés (Revers) */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={revers} onChange={e => handleRevers(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.reversLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.reversHint')}</p>
	</div>
	
	{/* OPT-07 — Compétences avec conditions requises */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={skillPrerequisites} onChange={e => handleSkillPrerequisites(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.skillPrerequisitesLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.skillPrerequisitesHint')}</p>
	</div>

	{/* OPT-08 — Niveau maximum des Compétences */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={skillMaxLevel} onChange={e => handleSkillMaxLevel(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.skillMaxLevelLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.skillMaxLevelHint')}</p>
	</div>

	{/* OPT-09 — Compétences à progression naturelle */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={skillNaturalProg} onChange={e => handleSkillNaturalProg(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.skillNaturalProgLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.skillNaturalProgHint')}</p>
	</div>

	{/* OPT-10 — Personnages très jeunes */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={youngPenalty} onChange={e => handleYoungPenalty(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.youngPenaltyLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.youngPenaltyHint')}</p>
	</div>

	{/* OPT-11 — Célébrité */}
	<div style={{ marginBottom: '24px' }}>
	<label className="cs-toggle-row">
    <input type="checkbox" checked={celebrity} onChange={e => handleCelebrity(e.target.checked)} className="cs-checkbox" />
    <span className="cs-toggle-label">{t('settings.celebrityLabel')}</span>
	</label>
	<p className="cs-toggle-hint" style={{ marginTop: '4px', marginLeft: '25px' }}>{t('settings.celebrityHint')}</p>
	</div>

    </section>
  )
}