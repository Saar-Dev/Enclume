import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// ─── Constantes ────────────────────────────────────────────────────────────────
const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DICE_FACES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }
const DICE_LABELS = { d4: 'D4', d6: 'D6', d8: 'D8', d10: 'D10', d12: 'D12', d20: 'D20', d100: 'D100' }

/**
 * Construit un dice_config uniforme (mode simple) depuis les toggles.
 * successOn : 'max' | 'min' | null
 * failOn    : 'min' | 'max' | null
 */
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

/**
 * Construit un dice_config expert depuis le state de la grille.
 * expertRows : { [die]: { active, successActive, successMin, successMax, failActive, failMin, failMax } }
 */
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
    } else {
      entry.success = null
    }
    if (row.failActive && row.failMin !== '' && row.failMax !== '') {
      entry.fail = { min: Number(row.failMin), max: Number(row.failMax) }
    } else {
      entry.fail = null
    }
    config[die] = entry
  }
  return hasAny ? config : null
}

/**
 * Détecte si un dice_config est issu du mode simple et retourne les états simples.
 * Retourne null si le config est expert (dés non uniformes ou partiels).
 */
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

/**
 * Initialise le state expert depuis un dice_config existant.
 */
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

// ─── Icône dé SVG placeholder ──────────────────────────────────────────────────
function DiceD20Icon({ size = 48, color = 'var(--text-muted)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="24,3 45,14 45,34 24,45 3,34 3,14"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <polygon
        points="24,3 45,14 24,20"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polygon
        points="24,3 3,14 24,20"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polygon
        points="24,20 45,14 45,34"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polygon
        points="24,20 3,14 3,34"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polygon
        points="24,20 45,34 24,45"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polygon
        points="24,20 3,34 24,45"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="11"
        fontFamily="monospace"
        fill={color}
        fontWeight="bold"
      >20</text>
    </svg>
  )
}

// ─── Composant principal ────────────────────────────────────────────────────────
export default function CampaignSettingsPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null) // 'saved' | 'error' | null

  // ─── État section dés ──────────────────────────────────────────────────────
  const [diceEnabled, setDiceEnabled] = useState(false)
  const [expertMode, setExpertMode] = useState(false)
  const [pnjUnlimitedAmmo, setPnjUnlimitedAmmo] = useState(true)
  const [reloadMode,       setReloadMode]       = useState('magazine')
  const [actionTimerSec,   setActionTimerSec]   = useState(0)
  const [shockAutoStun,    setShockAutoStun]    = useState(true)
  const [defaultTokenGlbUrl, setDefaultTokenGlbUrl] = useState(null)
  const [uploadingToken, setUploadingToken] = useState(false)
  const [uploadTokenStatus, setUploadTokenStatus] = useState(null) // 'saved' | 'error' | null
  const tokenFileInputRef = useRef(null)

  // Mode simple
  const [successOn, setSuccessOn] = useState('max')    // 'max' | 'min' | null
  const [successActive, setSuccessActive] = useState(true)
  const [failOn, setFailOn] = useState('min')          // 'min' | 'max' | null
  const [failActive, setFailActive] = useState(true)

  // Mode expert
  const [expertRows, setExpertRows] = useState(() => initExpertRows(null))

  useEffect(() => { document.title = 'Enclume — Paramètres campagne' }, [])

  // ─── Chargement campagne ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/campaigns/${campaignId}`)
        const { campaign } = res.data

        // Guard GM : la vérification stricte est faite côté serveur (requireRole('gm') sur PUT).
        // Le GET /:id retourne 403 si l'utilisateur n'est pas membre — suffisant pour bloquer l'accès.

        // Initialiser les états depuis dice_config existante
        const cfg = campaign.dice_config
        if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
          setDiceEnabled(true)
          const simple = detectSimpleConfig(cfg)
          if (simple) {
            setExpertMode(false)
            setSuccessOn(simple.successOn)
            setSuccessActive(simple.successActive)
            setFailOn(simple.failOn)
            setFailActive(simple.failActive)
          } else {
            setExpertMode(true)
          }
          setExpertRows(initExpertRows(cfg))
        }
        setPnjUnlimitedAmmo(campaign.pnj_unlimited_ammo ?? true)
        setReloadMode(campaign.reload_mode ?? 'magazine')
        setActionTimerSec(campaign.action_timer_sec ?? 0)
        setShockAutoStun(campaign.shock_auto_stun ?? true)
        setDefaultTokenGlbUrl(campaign.default_token_glb_url ?? null)

        setLoading(false)
      } catch (err) {
        if (err.response?.status === 403) {
          setError(t('settings.accessDenied'))
        } else {
          setError(t('settings.errorLoad'))
        }
        setLoading(false)
      }
    }
    load()
  }, [campaignId])

  // ─── Sauvegarde ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus(null)
    try {
      let dice_config = null
      if (diceEnabled) {
        if (expertMode) {
          dice_config = buildExpertConfig(expertRows)
        } else {
          const resolvedSuccessOn = successActive ? successOn : null
          const resolvedFailOn = failActive ? failOn : null
          dice_config = buildSimpleConfig(resolvedSuccessOn, resolvedFailOn)
        }
      }
      await api.put(`/campaigns/${campaignId}`, { dice_config, pnj_unlimited_ammo: pnjUnlimitedAmmo, reload_mode: reloadMode, action_timer_sec: actionTimerSec, shock_auto_stun: shockAutoStun })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [campaignId, diceEnabled, expertMode, expertRows, successActive, successOn, failActive, failOn, pnjUnlimitedAmmo, reloadMode, actionTimerSec, shockAutoStun])

  // ─── Bascule mode expert → simple ─────────────────────────────────────────
  const handleSwitchToSimple = useCallback(() => {
    // Les réglages par dé sont perdus — comportement documenté et confirmé
    setExpertMode(false)
    setSuccessActive(true)
    setSuccessOn('max')
    setFailActive(true)
    setFailOn('min')
  }, [])

  const handleSwitchToExpert = useCallback(() => {
    // Initialiser la grille depuis les toggles simples actuels
    const simpleConfig = diceEnabled
      ? buildSimpleConfig(successActive ? successOn : null, failActive ? failOn : null)
      : null
    setExpertRows(initExpertRows(simpleConfig))
    setExpertMode(true)
  }, [diceEnabled, successActive, successOn, failActive, failOn])

  // ─── Réinitialiser token par défaut ───────────────────────────────────────
  const handleClearDefaultToken = useCallback(async () => {
    setUploadingToken(true)
    setUploadTokenStatus(null)
    try {
      await api.put(`/campaigns/${campaignId}`, { default_token_glb_url: null })
      setDefaultTokenGlbUrl(null)
      setUploadTokenStatus('saved')
      setTimeout(() => setUploadTokenStatus(null), 3000)
    } catch (err) {
      console.error('Erreur réinitialisation token par défaut :', err)
      setUploadTokenStatus('error')
    } finally {
      setUploadingToken(false)
    }
  }, [campaignId])

  // ─── Upload token par défaut ───────────────────────────────────────────────
  const handleUploadDefaultToken = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingToken(true)
    setUploadTokenStatus(null)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(`/campaigns/${campaignId}/default-token`, formData)
      setDefaultTokenGlbUrl(res.data.campaign.default_token_glb_url)
      setUploadTokenStatus('saved')
      setTimeout(() => setUploadTokenStatus(null), 3000)
    } catch (err) {
      console.error('Erreur upload token par défaut :', err)
      setUploadTokenStatus('error')
    } finally {
      setUploadingToken(false)
      if (tokenFileInputRef.current) tokenFileInputRef.current.value = ''
    }
  }, [campaignId])

  // ─── Mise à jour ligne expert ──────────────────────────────────────────────
  const updateExpertRow = useCallback((die, field, value) => {
    setExpertRows(prev => ({
      ...prev,
      [die]: { ...prev[die], [field]: value },
    }))
  }, [])

  // ─── Aperçu mode simple ────────────────────────────────────────────────────
  const previewSuccessValue = successActive
    ? (successOn === 'max' ? 20 : 1)
    : null
  const previewFailValue = failActive
    ? (failOn === 'min' ? 1 : 20)
    : null

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={styles.loadingScreen}>
      <p style={styles.loadingText}>{t('common.loading')}</p>
    </div>
  )

  if (error) return (
    <div style={styles.loadingScreen}>
      <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>
      <button style={styles.btnGhost} onClick={() => navigate('/dashboard')}>
        {t('settings.back')}
      </button>
    </div>
  )

  return (
    <div style={styles.container}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          {t('settings.back')}
        </button>
        <h1 style={styles.pageTitle}>{t('settings.pageTitle')}</h1>
        <div style={styles.headerRight}>
          {saveStatus === 'saved' && (
            <span style={styles.saveSuccess}>{t('settings.saved')}</span>
          )}
          {saveStatus === 'error' && (
            <span style={styles.saveError}>{t('settings.errorSave')}</span>
          )}
          <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div style={styles.body}>
        {/* ─── Navigation sections ─────────────────────────────────────── */}
        <nav style={styles.nav}>
          <button style={{ ...styles.navItem, ...styles.navItemActive }}>
            {t('settings.sectionDice')}
          </button>
          <button style={{ ...styles.navItem, ...styles.navItemDisabled }} disabled>
            {t('settings.sectionPlayers')}
          </button>
          <button style={{ ...styles.navItem, ...styles.navItemDisabled }} disabled>
            {t('settings.sectionSheet')}
          </button>
        </nav>

        {/* ─── Contenu section active ───────────────────────────────────── */}
        <div style={styles.content}>

          {/* ── Section Dés ──────────────────────────────────────────────── */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('settings.diceTitle')}</h2>

            {/* Toggle global activer les critiques */}
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={diceEnabled}
                onChange={e => setDiceEnabled(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.toggleLabel}>{t('settings.diceEnable')}</span>
              <span style={styles.toggleHint}>{t('settings.diceEnableHint')}</span>
            </label>

            {/* Contenu conditionnel — visible uniquement si critiques activés */}
            {diceEnabled && (
              <div style={styles.diceBody}>

                {!expertMode ? (
                  /* ── Mode simple ─────────────────────────────────────── */
                  <div style={styles.simpleMode}>
                    <p style={styles.simpleModeTitle}>{t('settings.diceSimpleTitle')}</p>

                    <div style={styles.simpleRows}>
                      {/* Réussite critique */}
                      <div style={styles.simpleRow}>
                        <label style={styles.simpleRowLabel}>
                          <input
                            type="checkbox"
                            checked={successActive}
                            onChange={e => setSuccessActive(e.target.checked)}
                            style={styles.checkbox}
                          />
                          <span style={{ marginLeft: '8px' }}>{t('settings.diceSuccessLabel')}</span>
                        </label>
                        {successActive && (
                          <div style={styles.toggleGroup}>
                            <button
                              style={{
                                ...styles.toggleBtn,
                                ...(successOn === 'min' ? styles.toggleBtnActive : {}),
                              }}
                              onClick={() => setSuccessOn('min')}
                            >
                              {t('settings.diceToggleMin')}
                            </button>
                            <button
                              style={{
                                ...styles.toggleBtn,
                                ...(successOn === 'max' ? styles.toggleBtnActive : {}),
                              }}
                              onClick={() => setSuccessOn('max')}
                            >
                              {t('settings.diceToggleMax')}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Échec critique */}
                      <div style={styles.simpleRow}>
                        <label style={styles.simpleRowLabel}>
                          <input
                            type="checkbox"
                            checked={failActive}
                            onChange={e => setFailActive(e.target.checked)}
                            style={styles.checkbox}
                          />
                          <span style={{ marginLeft: '8px' }}>{t('settings.diceFailLabel')}</span>
                        </label>
                        {failActive && (
                          <div style={styles.toggleGroup}>
                            <button
                              style={{
                                ...styles.toggleBtn,
                                ...(failOn === 'min' ? styles.toggleBtnActive : {}),
                              }}
                              onClick={() => setFailOn('min')}
                            >
                              {t('settings.diceToggleMin')}
                            </button>
                            <button
                              style={{
                                ...styles.toggleBtn,
                                ...(failOn === 'max' ? styles.toggleBtnActive : {}),
                              }}
                              onClick={() => setFailOn('max')}
                            >
                              {t('settings.diceToggleMax')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aperçu D20 */}
                    <div style={styles.preview}>
                      <DiceD20Icon
                        size={52}
                        color={
                          previewSuccessValue !== null
                            ? 'var(--color-success, #4caf77)'
                            : previewFailValue !== null
                            ? 'var(--color-danger)'
                            : 'var(--text-muted)'
                        }
                      />
                      <div style={styles.previewValues}>
                        {previewSuccessValue !== null && (
                          <div style={styles.previewRow}>
                            <span style={styles.previewSuccess}>{t('settings.dicePreviewSuccess')}</span>
                            <span style={styles.previewNum}>{previewSuccessValue}</span>
                          </div>
                        )}
                        {previewFailValue !== null && (
                          <div style={styles.previewRow}>
                            <span style={styles.previewFail}>{t('settings.dicePreviewFail')}</span>
                            <span style={styles.previewNum}>{previewFailValue}</span>
                          </div>
                        )}
                        {previewSuccessValue === null && previewFailValue === null && (
                          <span style={styles.previewMuted}>—</span>
                        )}
                      </div>
                    </div>

                    <button style={styles.modeLink} onClick={handleSwitchToExpert}>
                      {t('settings.diceExpertLink')}
                    </button>
                  </div>
                ) : (
                  /* ── Mode expert ─────────────────────────────────────── */
                  <div style={styles.expertMode}>
                    <p style={styles.simpleModeTitle}>{t('settings.diceExpertTitle')}</p>

                    <div style={styles.expertTableWrapper}>
                      <table style={styles.expertTable}>
                        <thead>
                          <tr>
                            <th style={styles.thDie}>{t('settings.diceColDie')}</th>
                            <th style={styles.thActive}>{t('settings.diceColActive')}</th>
                            <th style={styles.thCrit}>{t('settings.diceColSuccess')}</th>
                            <th style={styles.thCrit}>{t('settings.diceColFail')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DICE_TYPES.map(die => {
                            const row = expertRows[die]
                            const faces = DICE_FACES[die]
                            return (
                              <tr key={die} style={row.active ? styles.trActive : styles.trInactive}>
                                <td style={styles.tdDie}>{DICE_LABELS[die]}</td>
                                <td style={styles.tdActive}>
                                  <input
                                    type="checkbox"
                                    checked={row.active}
                                    onChange={e => updateExpertRow(die, 'active', e.target.checked)}
                                    style={styles.checkbox}
                                  />
                                </td>
                                {/* Réussite critique */}
                                <td style={styles.tdCrit}>
                                  {row.active && (
                                    <div style={styles.critCell}>
                                      <input
                                        type="checkbox"
                                        checked={row.successActive}
                                        onChange={e => updateExpertRow(die, 'successActive', e.target.checked)}
                                        style={styles.checkbox}
                                        title={t('settings.diceColActive')}
                                      />
                                      {row.successActive && (
                                        <div style={styles.rangeInputs}>
                                          <input
                                            type="number"
                                            min={1}
                                            max={faces}
                                            value={row.successMin}
                                            onChange={e => updateExpertRow(die, 'successMin', e.target.value)}
                                            style={styles.numInput}
                                            title={t('settings.diceColMin')}
                                          />
                                          <span style={styles.rangeSep}>–</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={faces}
                                            value={row.successMax}
                                            onChange={e => updateExpertRow(die, 'successMax', e.target.value)}
                                            style={styles.numInput}
                                            title={t('settings.diceColMax')}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                {/* Échec critique */}
                                <td style={styles.tdCrit}>
                                  {row.active && (
                                    <div style={styles.critCell}>
                                      <input
                                        type="checkbox"
                                        checked={row.failActive}
                                        onChange={e => updateExpertRow(die, 'failActive', e.target.checked)}
                                        style={styles.checkbox}
                                        title={t('settings.diceColActive')}
                                      />
                                      {row.failActive && (
                                        <div style={styles.rangeInputs}>
                                          <input
                                            type="number"
                                            min={1}
                                            max={faces}
                                            value={row.failMin}
                                            onChange={e => updateExpertRow(die, 'failMin', e.target.value)}
                                            style={styles.numInput}
                                            title={t('settings.diceColMin')}
                                          />
                                          <span style={styles.rangeSep}>–</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={faces}
                                            value={row.failMax}
                                            onChange={e => updateExpertRow(die, 'failMax', e.target.value)}
                                            style={styles.numInput}
                                            title={t('settings.diceColMax')}
                                          />
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

                    <button style={styles.modeLink} onClick={handleSwitchToSimple}>
                      {t('settings.diceSimpleLink')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section Règles de jeu ────────────────────────────────────── */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('settings.sectionRules')}</h2>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={pnjUnlimitedAmmo}
                onChange={e => setPnjUnlimitedAmmo(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.toggleLabel}>{t('settings.pnjAmmoLabel')}</span>
              <span style={styles.toggleHint}>{t('settings.pnjAmmoHint')}</span>
            </label>

            <div style={{ marginTop: 12 }}>
              <span style={styles.toggleLabel}>{t('settings.reloadModeLabel')}</span>
              <span style={styles.toggleHint}>{t('settings.reloadModeHint')}</span>
              <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                <label style={styles.toggleRow}>
                  <input type="radio" name="reloadMode" value="magazine"
                    checked={reloadMode === 'magazine'}
                    onChange={() => setReloadMode('magazine')}
                    style={styles.checkbox} />
                  <span style={styles.toggleLabel}>{t('settings.reloadModeChargeur')}</span>
                </label>
                <label style={styles.toggleRow}>
                  <input type="radio" name="reloadMode" value="topup"
                    checked={reloadMode === 'topup'}
                    onChange={() => setReloadMode('topup')}
                    style={styles.checkbox} />
                  <span style={styles.toggleLabel}>{t('settings.reloadModeTopup')}</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <span style={styles.toggleLabel}>{t('settings.actionTimerLabel')}</span>
              <span style={styles.toggleHint}>{t('settings.actionTimerHint')}</span>
              <div style={{ marginTop: 6 }}>
                <input
                  type="number"
                  min={0}
                  value={actionTimerSec}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10)
                    setActionTimerSec(isNaN(val) ? 0 : Math.max(0, val))
                  }}
                  style={{ ...styles.numInput, width: '80px' }}
                />
                <span style={{ ...styles.toggleHint, marginLeft: 8 }}>s</span>
              </div>
            </div>

            <label style={{ ...styles.toggleRow, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={shockAutoStun}
                onChange={e => setShockAutoStun(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.toggleLabel}>{t('settings.shockAutoStunLabel')}</span>
              <span style={styles.toggleHint}>{t('settings.shockAutoStunHint')}</span>
            </label>
          </section>

          {/* ── Section Tokens 3D ────────────────────────────────────────── */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('settings.sectionTokens')}</h2>
            <p style={styles.toggleLabel}>{t('settings.defaultTokenLabel')}</p>
            <p style={{ ...styles.toggleHint, marginBottom: '12px' }}>{t('settings.defaultTokenHint')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={defaultTokenGlbUrl ? styles.tokenStatusSet : styles.tokenStatusNone}>
                {defaultTokenGlbUrl ? t('settings.defaultTokenSet') : t('settings.defaultTokenNone')}
              </span>
              <input
                ref={tokenFileInputRef}
                type="file"
                accept=".glb"
                style={{ display: 'none' }}
                onChange={handleUploadDefaultToken}
              />
              <button
                style={styles.btnSecondary}
                onClick={() => tokenFileInputRef.current?.click()}
                disabled={uploadingToken}
              >
                {uploadingToken ? t('settings.defaultTokenUploading') : t('settings.defaultTokenUpload')}
              </button>
              {defaultTokenGlbUrl && (
                <button
                  style={styles.btnDanger}
                  onClick={handleClearDefaultToken}
                  disabled={uploadingToken}
                >
                  {t('settings.defaultTokenClear')}
                </button>
              )}
              {uploadTokenStatus === 'saved' && (
                <span style={styles.saveSuccess}>{t('settings.saved')}</span>
              )}
              {uploadTokenStatus === 'error' && (
                <span style={styles.saveError}>{t('settings.errorSave')}</span>
              )}
            </div>
          </section>

          {/* ── Section Joueurs — placeholder ────────────────────────────── */}
          <section style={{ ...styles.section, ...styles.sectionPlaceholder }}>
            <h2 style={styles.sectionTitle}>{t('settings.sectionPlayers')}</h2>
            <p style={styles.placeholderText}>{t('settings.sectionPlayersPlaceholder')}</p>
          </section>

          {/* ── Section Fiche perso — placeholder ────────────────────────── */}
          <section style={{ ...styles.section, ...styles.sectionPlaceholder }}>
            <h2 style={styles.sectionTitle}>{t('settings.sectionSheet')}</h2>
            <p style={styles.placeholderText}>{t('settings.sectionSheetPlaceholder')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingScreen: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 32px',
    height: '56px',
    backgroundColor: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 0',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    flex: 1,
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  saveSuccess: {
    fontSize: '13px',
    color: '#4caf77',
  },
  saveError: {
    fontSize: '13px',
    color: 'var(--color-danger)',
  },
  body: {
    display: 'flex',
    flex: 1,
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
    padding: '32px',
    gap: '32px',
    boxSizing: 'border-box',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '160px',
    flexShrink: 0,
    paddingTop: '4px',
  },
  navItem: {
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  navItemActive: {
    backgroundColor: 'rgba(91,141,238,0.12)',
    color: '#5b8dee',
    fontWeight: '500',
  },
  navItemDisabled: {
    color: 'var(--text-muted)',
    cursor: 'default',
    opacity: 0.5,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  section: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-normal)',
    borderRadius: '10px',
    padding: '24px',
  },
  sectionPlaceholder: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    margin: '0 0 20px 0',
  },
  placeholderText: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    margin: 0,
  },

  // Toggle global
  toggleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '15px',
    height: '15px',
    cursor: 'pointer',
    accentColor: '#5b8dee',
    flexShrink: 0,
  },
  toggleLabel: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  toggleHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },

  // Corps section dés
  diceBody: {
    marginTop: '20px',
  },

  // Mode simple
  simpleMode: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  simpleModeTitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
  },
  simpleRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  simpleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  simpleRowLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    minWidth: '220px',
  },
  toggleGroup: {
    display: 'flex',
    gap: '4px',
  },
  toggleBtn: {
    background: 'none',
    border: '1px solid var(--border-normal)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 10px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
    color: '#5b8dee',
  },

  // Aperçu
  preview: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: 'var(--bg-app)',
    borderRadius: '8px',
    padding: '12px 16px',
    border: '1px solid var(--border-subtle)',
    alignSelf: 'flex-start',
  },
  previewValues: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  previewRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  previewSuccess: {
    fontSize: '12px',
    color: '#4caf77',
    fontWeight: '500',
    minWidth: '60px',
  },
  previewFail: {
    fontSize: '12px',
    color: 'var(--color-danger)',
    fontWeight: '500',
    minWidth: '60px',
  },
  previewNum: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
  },
  previewMuted: {
    fontSize: '18px',
    color: 'var(--text-muted)',
  },

  modeLink: {
    background: 'none',
    border: 'none',
    color: '#5b8dee',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '0',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    alignSelf: 'flex-start',
  },

  // Mode expert
  expertMode: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  expertTableWrapper: {
    overflowX: 'auto',
  },
  expertTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  thDie: {
    textAlign: 'left',
    padding: '8px 12px',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    width: '60px',
  },
  thActive: {
    textAlign: 'center',
    padding: '8px 12px',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    width: '60px',
  },
  thCrit: {
    textAlign: 'left',
    padding: '8px 12px',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
  },
  trActive: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  trInactive: {
    borderBottom: '1px solid var(--border-subtle)',
    opacity: 0.4,
  },
  tdDie: {
    padding: '10px 12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  tdActive: {
    padding: '10px 12px',
    textAlign: 'center',
  },
  tdCrit: {
    padding: '10px 12px',
  },
  critCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rangeInputs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  numInput: {
    width: '52px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-normal)',
    borderRadius: '4px',
    padding: '4px 6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    textAlign: 'center',
  },
  rangeSep: {
    color: 'var(--text-muted)',
    fontSize: '12px',
  },

  // Statut token
  tokenStatusNone: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  tokenStatusSet: {
    fontSize: '13px',
    color: '#4caf77',
    fontWeight: '500',
  },

  // Boutons
  btnSecondary: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-normal)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    padding: '7px 14px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnDanger: {
    backgroundColor: 'transparent',
    border: '1px solid var(--color-danger)',
    borderRadius: '6px',
    color: 'var(--color-danger)',
    padding: '7px 14px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnPrimary: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 18px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    padding: '8px',
    cursor: 'pointer',
  },
}
