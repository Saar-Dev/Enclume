// client/src/components/campaignSettings/SectionDice.jsx
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }
const DICE_LABELS = { d4: 'D4', d6: 'D6', d8: 'D8', d10: 'D10', d12: 'D12', d20: 'D20', d100: 'D100' }

function buildSimpleConfig(successOn, failOn) {
  if (!successOn && !failOn) return null
  const config = {}
  for (const die of DICE_TYPES) {
    const faces = DICE_FACES[die]
    const entry = {}
    if (successOn === 'max') entry.success = { min: faces, max: faces }
    else if (successOn === 'min') entry.success = { min: 1, max: 1 }
    else entry.success = null
    if (failOn === 'min') entry.fail = { min: 1, max: 1 }
    else if (failOn === 'max') entry.fail = { min: faces, max: faces }
    else entry.fail = null
    config[die] = entry
  }
  return config
}

function buildExpertConfig(expertRows) {
  const config = {}
  let hasAny = false
  for (const die of DICE_TYPES) {
    const row = expertRows[die]
    if (!row.active) continue
    hasAny = true
    const entry = {}
    if (row.successActive && row.successMin !== '' && row.successMax !== '') {
      entry.success = { min: Number(row.successMin), max: Number(row.successMax) }
    } else { entry.success = null }
    if (row.failActive && row.failMin !== '' && row.failMax !== '') {
      entry.fail = { min: Number(row.failMin), max: Number(row.failMax) }
    } else { entry.fail = null }
    config[die] = entry
  }
  return hasAny ? config : null
}

function detectSimpleConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  if (!DICE_TYPES.every(d => cfg[d] !== undefined)) return null
  const d20 = cfg['d20']
  let successOn = 'max', successActive = false
  if (d20.success?.min === 20 && d20.success?.max === 20) { successOn = 'max'; successActive = true }
  else if (d20.success?.min === 1 && d20.success?.max === 1) { successOn = 'min'; successActive = true }
  else if (!d20.success) { successActive = false }
  else return null
  let failOn = 'min', failActive = false
  if (d20.fail?.min === 1 && d20.fail?.max === 1) { failOn = 'min'; failActive = true }
  else if (d20.fail?.min === 20 && d20.fail?.max === 20) { failOn = 'max'; failActive = true }
  else if (!d20.fail) { failActive = false }
  else return null
  return { successOn, failOn, successActive, failActive }
}

function initExpertRows(diceConfig) {
  const rows = {}
  for (const die of DICE_TYPES) {
    const faces = DICE_FACES[die]
    const entry = diceConfig?.[die]
    rows[die] = {
      active: !!entry,
      successActive: !!entry?.success,
      successMin: entry?.success?.min ?? 1,
      successMax: entry?.success?.max ?? faces,
      failActive: !!entry?.fail,
      failMin: entry?.fail?.min ?? 1,
      failMax: entry?.fail?.max ?? faces,
    }
  }
  return rows
}

function DiceD20Icon({ size = 48, color = 'var(--text-muted)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,3 45,14 45,34 24,45 3,34 3,14" stroke={color} strokeWidth="1.5" fill="none" />
      <polygon points="24,3 45,14 24,20" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,3 3,14 24,20" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,20 45,14 45,34" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,20 3,14 3,34" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,20 45,34 24,45" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <polygon points="24,20 3,34 24,45" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <text x="24" y="30" textAnchor="middle" fontSize="11" fontFamily="monospace" fill={color} fontWeight="bold">20</text>
    </svg>
  )
}

export default function SectionDice({ initialConfig, onChange }) {
  const { t } = useTranslation()

  const [diceEnabled, setDiceEnabled] = useState(() => {
    return initialConfig && typeof initialConfig === 'object' && Object.keys(initialConfig).length > 0
  })
  const [expertMode, setExpertMode] = useState(() => {
    if (!initialConfig || typeof initialConfig !== 'object' || Object.keys(initialConfig).length === 0) return false
    return !detectSimpleConfig(initialConfig)
  })
  const [successOn, setSuccessOn] = useState(() => {
    const simple = initialConfig ? detectSimpleConfig(initialConfig) : null
    return simple?.successOn ?? 'max'
  })
  const [successActive, setSuccessActive] = useState(() => {
    const simple = initialConfig ? detectSimpleConfig(initialConfig) : null
    return simple?.successActive ?? true
  })
  const [failOn, setFailOn] = useState(() => {
    const simple = initialConfig ? detectSimpleConfig(initialConfig) : null
    return simple?.failOn ?? 'min'
  })
  const [failActive, setFailActive] = useState(() => {
    const simple = initialConfig ? detectSimpleConfig(initialConfig) : null
    return simple?.failActive ?? true
  })
  const [expertRows, setExpertRows] = useState(() => initExpertRows(initialConfig))

  const buildConfig = useCallback(() => {
    if (!diceEnabled) return null
    if (expertMode) return buildExpertConfig(expertRows)
    return buildSimpleConfig(successActive ? successOn : null, failActive ? failOn : null)
  }, [diceEnabled, expertMode, expertRows, successActive, successOn, failActive, failOn])

  const updateExpertRow = useCallback((die, field, value) => {
    setExpertRows(prev => ({
      ...prev,
      [die]: { ...prev[die], [field]: value },
    }))
  }, [])

  // Notifie le parent à chaque changement d'état pertinent — buildConfig liste toutes les dépendances
  useEffect(() => {
    onChange({ dice_config: buildConfig() })
  }, [buildConfig, onChange])

  const toggleDice = (val) => setDiceEnabled(val)
  const toggleSuccess = (val) => setSuccessActive(val)
  const toggleFail = (val) => setFailActive(val)
  const setSuccessOnFn = (val) => setSuccessOn(val)
  const setFailOnFn = (val) => setFailOn(val)
  const switchToExpert = () => setExpertMode(true)
  const switchToSimple = () => { setExpertMode(false); setSuccessActive(true); setSuccessOn('max'); setFailActive(true); setFailOn('min') }

  const previewSuccessValue = successActive ? (successOn === 'max' ? 20 : 1) : null
  const previewFailValue = failActive ? (failOn === 'min' ? 1 : 20) : null

  return (
    <section className="card">
      <h2 className="cs-section-title">{t('settings.diceTitle')}</h2>

      <label className="cs-toggle-row">
        <input type="checkbox" checked={diceEnabled} onChange={e => toggleDice(e.target.checked)} className="cs-checkbox" />
        <span className="cs-toggle-label">{t('settings.diceEnable')}</span>
        <span className="cs-toggle-hint">{t('settings.diceEnableHint')}</span>
      </label>

      {diceEnabled && (
        <div style={{ marginTop: '20px' }}>
          {!expertMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="cs-dice-subtitle">{t('settings.diceSimpleTitle')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label className="cs-dice-option-label">
                    <input type="checkbox" checked={successActive} onChange={e => toggleSuccess(e.target.checked)} className="cs-checkbox" />
                    <span style={{ marginLeft: '8px' }}>{t('settings.diceSuccessLabel')}</span>
                  </label>
                  {successActive && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-toggle cs-dice-toggle-btn" data-active={successOn === 'min'} onClick={() => setSuccessOnFn('min')}>{t('settings.diceToggleMin')}</button>
                      <button className="btn-toggle cs-dice-toggle-btn" data-active={successOn === 'max'} onClick={() => setSuccessOnFn('max')}>{t('settings.diceToggleMax')}</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label className="cs-dice-option-label">
                    <input type="checkbox" checked={failActive} onChange={e => toggleFail(e.target.checked)} className="cs-checkbox" />
                    <span style={{ marginLeft: '8px' }}>{t('settings.diceFailLabel')}</span>
                  </label>
                  {failActive && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-toggle cs-dice-toggle-btn" data-active={failOn === 'min'} onClick={() => setFailOnFn('min')}>{t('settings.diceToggleMin')}</button>
                      <button className="btn-toggle cs-dice-toggle-btn" data-active={failOn === 'max'} onClick={() => setFailOnFn('max')}>{t('settings.diceToggleMax')}</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="cs-dice-preview-box">
                <DiceD20Icon size={52} color={previewSuccessValue !== null ? 'var(--color-success, #4caf77)' : previewFailValue !== null ? 'var(--color-danger)' : 'var(--text-muted)'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {previewSuccessValue !== null && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="cs-dice-preview-success-label">{t('settings.dicePreviewSuccess')}</span>
                      <span className="cs-dice-preview-value">{previewSuccessValue}</span>
                    </div>
                  )}
                  {previewFailValue !== null && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="cs-dice-preview-fail-label">{t('settings.dicePreviewFail')}</span>
                      <span className="cs-dice-preview-value">{previewFailValue}</span>
                    </div>
                  )}
                  {previewSuccessValue === null && previewFailValue === null && <span className="cs-dice-preview-empty">—</span>}
                </div>
              </div>
              <button className="cs-dice-link-btn" onClick={switchToExpert}>{t('settings.diceExpertLink')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="cs-dice-subtitle">{t('settings.diceExpertTitle')}</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="cs-dice-expert-table">
                  <thead>
                    <tr>
                      <th className="cs-dice-expert-th" style={{ width: '60px' }}>{t('settings.diceColDie')}</th>
                      <th className="cs-dice-expert-th" style={{ textAlign: 'center', width: '60px' }}>{t('settings.diceColActive')}</th>
                      <th className="cs-dice-expert-th">{t('settings.diceColSuccess')}</th>
                      <th className="cs-dice-expert-th">{t('settings.diceColFail')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DICE_TYPES.map(die => {
                      const row = expertRows[die]
                      const faces = DICE_FACES[die]
                      return (
                        <tr key={die} className="cs-dice-expert-tr" style={{ opacity: row.active ? 1 : 0.4 }}>
                          <td className="cs-dice-expert-td-die">{DICE_LABELS[die]}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={row.active} onChange={e => updateExpertRow(die, 'active', e.target.checked)} className="cs-checkbox" />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {row.active && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={row.successActive} onChange={e => updateExpertRow(die, 'successActive', e.target.checked)} className="cs-checkbox" />
                                {row.successActive && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input type="number" min={1} max={faces} value={row.successMin} onChange={e => updateExpertRow(die, 'successMin', e.target.value)} className="cs-num-input" />
                                    <span className="cs-dice-expert-dash">–</span>
                                    <input type="number" min={1} max={faces} value={row.successMax} onChange={e => updateExpertRow(die, 'successMax', e.target.value)} className="cs-num-input" />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {row.active && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={row.failActive} onChange={e => updateExpertRow(die, 'failActive', e.target.checked)} className="cs-checkbox" />
                                {row.failActive && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input type="number" min={1} max={faces} value={row.failMin} onChange={e => updateExpertRow(die, 'failMin', e.target.value)} className="cs-num-input" />
                                    <span className="cs-dice-expert-dash">–</span>
                                    <input type="number" min={1} max={faces} value={row.failMax} onChange={e => updateExpertRow(die, 'failMax', e.target.value)} className="cs-num-input" />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button className="cs-dice-link-btn" onClick={switchToSimple}>{t('settings.diceSimpleLink')}</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}