import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WS } from '../../../shared/events.js'
import api from '../lib/api.js'
import AimedLocationPicker from './AimedLocationPicker.jsx'
import { BURNING_PRESETS, DECOMPRESSION_PRESETS } from '../../../shared/environmentalHazardPresets.js'
import { LOCATION_I18N_KEYS } from '../lib/locationI18nKeys.js'

// ─── Statuts — ordre et métadonnées ─────────────────────────────────────────
const STATUS_LIST = [
  { code: 'grappled',      category: 'entrave' },
  { code: 'restrained',    category: 'entrave' },
  { code: 'off_balance',   category: 'entrave' },
  { code: 'burning',       category: 'dot'     },
  { code: 'acid',          category: 'dot'     },
  { code: 'asphyxia',      category: 'dot'     },
  { code: 'decompression', category: 'dot'     },
  { code: 'electrocuted',  category: 'dot'     },
  { code: 'stunned',       category: 'sens'    },
  { code: 'unconscious',   category: 'sens'    },
  { code: 'blinded',       category: 'sens'    },
  { code: 'hypothermia',   category: 'chronique' },
  { code: 'infected',      category: 'chronique' },
  { code: 'poisoned',      category: 'chronique' },
  { code: 'irradiated',    category: 'chronique' },
]

const CATEGORY_COLOR = {
  entrave:  '#d8a838',
  dot:      '#d84838',
  sens:     '#9858c8',
  chronique:'#38a8c8',
}

// Dangers environnementaux Lot 3 (docs/PLAN_FATIGUE_DOMMAGES.md §9) — MJ uniquement, passent par
// exposeToHazard/clearHazard (formule/localisations), jamais le toggle nu WS.TOKEN_STATUS_TOGGLE
// (écraserait silencieusement la `data` posée — voir server/src/socket/socketToken.js).
const HAZARD_CODES = new Set(['burning', 'acid', 'decompression'])

// ─── TokenStatusPanel ────────────────────────────────────────────────────────
// Bulle-grille 3×5 pour ajouter/retirer les statuts d'un token. Les 3 codes danger environnemental
// ouvrent un sous-formulaire (Lot 3, increment G) au lieu d'un simple toggle.
// Props :
//   x, y        — coordonnées écran (même origine que le radial menu)
//   token       — objet token live (depuis tokenStore)
//   character   — objet character ou null (pour les entités sans personnage)
//   statuses    — string[] statuts actifs sur ce token
//   isGm        — boolean
//   userId      — id de l'utilisateur courant
//   socket      — instance socket.io client
//   campaignId  — id de la campagne (routes REST des dangers environnementaux)
//   onClose     — callback fermeture
export default function TokenStatusPanel({
  x, y,
  token,
  character,
  statuses = [],
  isGm,
  userId,
  socket,
  campaignId,
  onClose,
}) {
  const { t } = useTranslation()
  const { t: tCombat } = useTranslation('combat')
  const { t: tChar } = useTranslation('charSheet')
  const panelRef = useRef(null)

  const [hazardForm, setHazardForm] = useState(null) // { code, mode: 'expose'|'clear' } | null
  const [formula, setFormula] = useState('')
  const [locations, setLocations] = useState('1')
  const [forcedLocation, setForcedLocation] = useState(null)
  const [linger, setLinger] = useState(false)
  const [sending, setSending] = useState(false)

  // Chute (docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3, increment G) — flux séparé du sous-formulaire
  // danger ci-dessus : pas un statut token_statuses, un événement ponctuel (POST .../hazards/fall).
  const [fallForm, setFallForm] = useState(false)
  const [fallHeight, setFallHeight] = useState('1')
  const [fallGroundTrigger, setFallGroundTrigger] = useState(false)
  const [fallTerrainAccidente, setFallTerrainAccidente] = useState(false)
  const [fallAttemptTest, setFallAttemptTest] = useState(false)
  const [fallResult, setFallResult] = useState(null)

  const isOwner = character?.user_id === userId
  const canToggle = isGm || isOwner

  // Fermeture click-dehors / Échap
  useEffect(() => {
    const onMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const openHazardForm = (code, mode) => {
    setHazardForm({ code, mode })
    setFormula('')
    setLocations('1')
    setForcedLocation(null)
    setLinger(false)
  }

  const handleToggle = (statusCode) => {
    if (!canToggle) return
    if (HAZARD_CODES.has(statusCode)) {
      if (!isGm) return // dangers environnementaux : MJ uniquement (docs/PLAN_FATIGUE_DOMMAGES.md §9)
      openHazardForm(statusCode, statuses.includes(statusCode) ? 'clear' : 'expose')
      return
    }
    socket?.emit(WS.TOKEN_STATUS_TOGGLE, { tokenId: token.id, statusCode })
  }

  const applyPreset = (preset) => {
    setFormula(preset.formula)
    if (preset.locations !== undefined) setLocations(String(preset.locations))
  }

  const submitExpose = async () => {
    if (!formula || sending) return
    setSending(true)
    try {
      await api.post(`/campaigns/${campaignId}/tokens/${token.id}/hazards/${hazardForm.code}/expose`, {
        formula,
        locations: /^\d+$/.test(locations.trim()) ? Number(locations) : locations,
        forcedLocation,
      })
      setHazardForm(null)
    } catch (err) {
      console.error('[TokenStatusPanel] expose:', err.message)
    } finally {
      setSending(false)
    }
  }

  const submitClear = async () => {
    if (sending) return
    setSending(true)
    try {
      await api.post(`/campaigns/${campaignId}/tokens/${token.id}/hazards/${hazardForm.code}/clear`, {
        linger: hazardForm.code === 'acid' ? linger : false,
      })
      setHazardForm(null)
    } catch (err) {
      console.error('[TokenStatusPanel] clear:', err.message)
    } finally {
      setSending(false)
    }
  }

  const openFallForm = () => {
    setFallForm(true)
    setFallHeight('1')
    setFallGroundTrigger(false)
    setFallTerrainAccidente(false)
    setFallAttemptTest(false)
    setFallResult(null)
  }

  const submitFall = async () => {
    if (sending) return
    setSending(true)
    try {
      const { data } = await api.post(`/campaigns/${campaignId}/hazards/fall`, {
        tokenId: token.id,
        heightMeters: fallGroundTrigger ? null : Number(fallHeight),
        groundTrigger: fallGroundTrigger,
        terrainAccidente: fallTerrainAccidente,
        attemptTest: fallAttemptTest,
      })
      setFallResult(data)
      setFallForm(false)
    } catch (err) {
      console.error('[TokenStatusPanel] fall:', err.message)
    } finally {
      setSending(false)
    }
  }

  // Clamping écran — plus haut quand un sous-formulaire/résultat est ouvert. Fenêtre/icônes
  // agrandies (retour Saar, test navigateur 2026-07-30) — plafond viewport + scroll (ci-dessus)
  // absorbe le débordement si le contenu réel dépasse ces estimations.
  const W = 340, H = (hazardForm || fallForm) ? 450 : fallResult ? 400 : 300
  const left = Math.max(8, Math.min(window.innerWidth  - W - 8, x - W / 2))
  const top  = Math.max(8, Math.min(window.innerHeight - H - 8, y - H / 2))

  const presetsFor = hazardForm?.code === 'burning' ? BURNING_PRESETS
    : hazardForm?.code === 'decompression' ? DECOMPRESSION_PRESETS
    : null

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left, top,
        width: W,
        zIndex: 10000,
        background: 'rgba(8,13,20,0.96)',
        border: '1px solid rgba(70,198,230,0.25)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(70,198,230,0.08)',
        padding: '12px 14px 14px',
        pointerEvents: 'auto',
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
      }}
    >
      {/* En-tête */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '2px',
        color: 'rgba(70,198,230,0.7)',
        textTransform: 'uppercase',
        marginBottom: 10,
        userSelect: 'none',
      }}>
        {token?.label || '?'} — {(fallForm || fallResult)
          ? tCombat(fallResult ? 'fallPanel.resultTitle' : 'fallPanel.title')
          : hazardForm
            ? tCombat(hazardForm.mode === 'expose' ? 'hazardPanel.exposeTitle' : 'hazardPanel.clearTitle', { label: t(`status.${hazardForm.code}`) })
            : t('tokenRadial.statuts')}
      </div>

      {fallForm ? (
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            <input type="checkbox" checked={fallGroundTrigger} onChange={(e) => setFallGroundTrigger(e.target.checked)} />
            {tCombat('fallPanel.groundTrigger')}
          </label>

          {!fallGroundTrigger && (
            <>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                {tCombat('fallPanel.heightMeters')}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={fallHeight}
                onChange={(e) => setFallHeight(e.target.value)}
                style={{ width: '100%', marginBottom: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#eee', padding: '4px 6px', fontSize: 12 }}
              />
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
            <input type="checkbox" checked={fallTerrainAccidente} onChange={(e) => setFallTerrainAccidente(e.target.checked)} />
            {tCombat('fallPanel.terrainAccidente')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
            <input type="checkbox" checked={fallAttemptTest} onChange={(e) => setFallAttemptTest(e.target.checked)} />
            {tCombat('fallPanel.attemptTest')}
          </label>

          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-gold" disabled={sending || (!fallGroundTrigger && !fallHeight)} onClick={submitFall}>
              {tCombat('fallPanel.confirm')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setFallForm(false)}>
              {tCombat('fallPanel.cancel')}
            </button>
          </div>
        </div>
      ) : fallResult ? (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
            {tCombat('fallPanel.resultDegats', { total: fallResult.degatsBruts, formula: fallResult.formula })}
          </div>
          {fallResult.terrainRoll && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              {tCombat('fallPanel.resultTerrain', { total: fallResult.terrainRoll.total })}
            </div>
          )}
          {fallResult.testResult && (
            <div style={{ fontSize: 11, color: fallResult.testResult.isSuccess ? '#7ed67e' : '#e07a7a', marginBottom: 4 }}>
              {fallResult.testResult.isSuccess
                ? tCombat('fallPanel.resultTestSuccess', { mr: fallResult.testResult.mr, reduction: fallResult.testResult.reduction })
                : tCombat('fallPanel.resultTestFail', { seuil: fallResult.testResult.seuil })}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
            {tCombat('fallPanel.resultLocations', { count: fallResult.locationsCount })}
          </div>

          {fallResult.hits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {fallResult.hits.map((hit, i) => (
                <div key={i} style={{ fontSize: 10, color: '#eee', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '3px 6px' }}>
                  {tCombat('fallPanel.resultHit', {
                    location: tChar(LOCATION_I18N_KEYS[hit.localisation] ?? hit.localisation),
                    degats: hit.degatsNets,
                    severity: hit.finalSeverity ? tChar(`locationPanel.severityShort.${hit.finalSeverity}`) : '—',
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
              {tCombat('fallPanel.resultNone')}
            </div>
          )}

          <button type="button" className="btn btn-ghost" onClick={() => setFallResult(null)}>
            {tCombat('fallPanel.close')}
          </button>
        </div>
      ) : hazardForm ? (
        <div>
          {hazardForm.mode === 'expose' ? (
            <>
              {presetsFor && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {presetsFor.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 10, padding: '3px 7px' }}
                      onClick={() => applyPreset(preset)}
                    >
                      {tCombat(`hazardPanel.presets.${hazardForm.code}_${preset.key}`)}
                    </button>
                  ))}
                </div>
              )}

              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                {tCombat('hazardPanel.formula')}
              </label>
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder={tCombat('hazardPanel.formulaPlaceholder')}
                style={{ width: '100%', marginBottom: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#eee', padding: '4px 6px', fontSize: 12 }}
              />

              {hazardForm.code !== 'decompression' && (
                <>
                  <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                    {tCombat('hazardPanel.locations')}
                  </label>
                  <input
                    type="text"
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                    placeholder={tCombat('hazardPanel.locationsPlaceholder')}
                    style={{ width: '100%', marginBottom: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#eee', padding: '4px 6px', fontSize: 12 }}
                  />

                  <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                    {tCombat('hazardPanel.forcedLocation')} — <span style={{ opacity: 0.6 }}>{tCombat('hazardPanel.forcedLocationHint')}</span>
                  </label>
                  <AimedLocationPicker aimedLocation={forcedLocation} onChange={setForcedLocation} showMalus={false} />
                </>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button type="button" className="btn btn-gold" disabled={!formula || sending} onClick={submitExpose}>
                  {tCombat('hazardPanel.confirm')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setHazardForm(null)}>
                  {tCombat('hazardPanel.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              {hazardForm.code === 'acid' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
                  <input type="checkbox" checked={linger} onChange={(e) => setLinger(e.target.checked)} />
                  {tCombat('hazardPanel.linger')}
                </label>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-danger" disabled={sending} onClick={submitClear}>
                  {tCombat('hazardPanel.clearButton')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setHazardForm(null)}>
                  {tCombat('hazardPanel.cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Grille 5×3 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 6,
          }}>
            {STATUS_LIST.map(({ code, category }) => {
              const active  = statuses.includes(code)
              const color   = CATEGORY_COLOR[category]
              const clickable = canToggle && (!HAZARD_CODES.has(code) || isGm)

              return (
                <div
                  key={code}
                  title={t(`status.${code}`)}
                  onClick={() => clickable && handleToggle(code)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '7px 4px',
                    borderRadius: 5,
                    border: active
                      ? `1px solid ${color}`
                      : '1px solid rgba(255,255,255,0.06)',
                    background: active
                      ? `${color}22`
                      : 'rgba(255,255,255,0.03)',
                    cursor: clickable ? 'pointer' : 'default',
                    opacity: !clickable && !active ? 0.35 : 1,
                    boxShadow: active ? `0 0 6px ${color}55` : 'none',
                    transition: 'background .12s, border-color .12s, box-shadow .12s',
                  }}
                >
                  <img
                    src={`/assets/status/${code}.svg`}
                    alt={code}
                    width={32}
                    height={32}
                    style={{
                      filter: active
                        ? `drop-shadow(0 0 3px ${color})`
                        : 'grayscale(60%) opacity(0.55)',
                      transition: 'filter .12s',
                    }}
                  />
                  <span style={{
                    fontSize: 10,
                    color: active ? color : 'rgba(255,255,255,0.3)',
                    textAlign: 'center',
                    lineHeight: 1.1,
                    userSelect: 'none',
                    letterSpacing: '0.5px',
                  }}>
                    {t(`status.${code}`)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Chute (docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3) — MJ uniquement */}
          {isGm && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 10, width: '100%' }}
              onClick={openFallForm}
            >
              {tCombat('fallPanel.openButton')}
            </button>
          )}

          {/* Légende permission */}
          {!canToggle && (
            <div style={{
              marginTop: 10,
              fontSize: 9,
              color: 'rgba(255,255,255,0.25)',
              textAlign: 'center',
              letterSpacing: '1px',
              userSelect: 'none',
            }}>
              {t('tokenRadial.detailStatuts')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
