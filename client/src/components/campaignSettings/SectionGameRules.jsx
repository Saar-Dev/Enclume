// client/src/components/campaignSettings/SectionGameRules.jsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sharedStyles as styles } from './sharedStyles'

export default function SectionGameRules({ initialData, onChange }) {
  const { t } = useTranslation()

  const [pnjUnlimitedAmmo, setPnjUnlimitedAmmo] = useState(initialData.pnj_unlimited_ammo ?? true)
  const [reloadMode, setReloadMode] = useState(initialData.reload_mode ?? 'magazine')
  const [actionTimerSec, setActionTimerSec] = useState(initialData.action_timer_sec ?? 0)
  const [shockAutoStun, setShockAutoStun] = useState(initialData.shock_auto_stun ?? true)
  const [encumbranceEnabled, setEncumbranceEnabled] = useState(initialData.encumbrance_enabled ?? true)
  const [encumbranceMultiplier, setEncumbranceMultiplier] = useState(initialData.encumbrance_multiplier ?? 3)

  const handlePnjUnlimitedAmmo = (val) => { setPnjUnlimitedAmmo(val); onChange({ pnj_unlimited_ammo: val }) }
  const handleReloadMode = (val) => { setReloadMode(val); onChange({ reload_mode: val }) }
  const handleActionTimerSec = (val) => { setActionTimerSec(val); onChange({ action_timer_sec: val }) }
  const handleShockAutoStun = (val) => { setShockAutoStun(val); onChange({ shock_auto_stun: val }) }
  const handleEncumbranceEnabled = (val) => { setEncumbranceEnabled(val); onChange({ encumbrance_enabled: val }) }
  const handleEncumbranceMultiplier = (val) => { setEncumbranceMultiplier(val); onChange({ encumbrance_multiplier: val }) }

  return (
    <section className="card">
      <h2 style={styles.sectionTitle}>{t('settings.sectionRules')}</h2>

      <label style={styles.toggleRow}>
        <input type="checkbox" checked={pnjUnlimitedAmmo}
          onChange={e => handlePnjUnlimitedAmmo(e.target.checked)}
          style={styles.checkbox} />
        <span style={styles.toggleLabel}>{t('settings.pnjAmmoLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.pnjAmmoHint')}</span>
      </label>

      <div style={{ marginTop: 12 }}>
        <span style={styles.toggleLabel}>{t('settings.reloadModeLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.reloadModeHint')}</span>
        <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
          <label style={styles.toggleRow}>
            <input type="radio" name="reloadMode" value="magazine" checked={reloadMode === 'magazine'}
              onChange={() => handleReloadMode('magazine')}
              style={styles.checkbox} />
            <span style={styles.toggleLabel}>{t('settings.reloadModeChargeur')}</span>
          </label>
          <label style={styles.toggleRow}>
            <input type="radio" name="reloadMode" value="topup" checked={reloadMode === 'topup'}
              onChange={() => handleReloadMode('topup')}
              style={styles.checkbox} />
            <span style={styles.toggleLabel}>{t('settings.reloadModeTopup')}</span>
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={styles.toggleLabel}>{t('settings.actionTimerLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.actionTimerHint')}</span>
        <div style={{ marginTop: 6 }}>
          <input type="number" min={0} value={actionTimerSec}
            onChange={e => {
              const val = parseInt(e.target.value, 10)
              handleActionTimerSec(isNaN(val) ? 0 : Math.max(0, val))
            }}
            style={{ ...styles.numInput, width: '80px' }} />
          <span style={{ ...styles.toggleHint, marginLeft: 8 }}>s</span>
        </div>
      </div>

      <label style={{ ...styles.toggleRow, marginTop: 12 }}>
        <input type="checkbox" checked={shockAutoStun}
          onChange={e => handleShockAutoStun(e.target.checked)}
          style={styles.checkbox} />
        <span style={styles.toggleLabel}>{t('settings.shockAutoStunLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.shockAutoStunHint')}</span>
      </label>

      <label style={{ ...styles.toggleRow, marginTop: 12 }}>
        <input type="checkbox" checked={encumbranceEnabled}
          onChange={e => handleEncumbranceEnabled(e.target.checked)}
          style={styles.checkbox} />
        <span style={styles.toggleLabel}>{t('settings.encumbranceEnabledLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.encumbranceEnabledHint')}</span>
      </label>

      <div style={{ marginTop: 12 }}>
        <span style={styles.toggleLabel}>{t('settings.encumbranceMultiplierLabel')}</span>
        <span style={styles.toggleHint}>{t('settings.encumbranceMultiplierHint')}</span>
        <div style={{ marginTop: 6 }}>
          <input type="number" min={0.5} step={0.5} value={encumbranceMultiplier}
            disabled={!encumbranceEnabled}
            onChange={e => {
              const val = parseFloat(e.target.value)
              handleEncumbranceMultiplier(isNaN(val) || val <= 0 ? 3 : val)
            }}
            style={{ ...styles.numInput, width: '80px' }} />
        </div>
      </div>
    </section>
  )
}
