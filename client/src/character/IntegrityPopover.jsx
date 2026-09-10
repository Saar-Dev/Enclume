import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getIntegrityTier, getIntegrityModifier, QUALITY_TABLE, DEFAULT_QUALITY, isRepairable,
} from '../../../shared/integrityRules.js'
import { fetchRepairPreview } from '../lib/inventoryMutations.js'

// PLAN_USURE&INTEGRITE.md §8 (L6c-B) — fenêtre d'Intégrité ancrée à l'icône (patron SkillInfoPopover :
// composant « dumb », l'état d'ouverture { itemId, x, y } et le listener clic-dehors vivent dans
// InventoryPanel). Deux visages :
//   - MJ : mise en service (presets = paliers RAW + champs bruts) + statut + Usage intensif.
//   - Joueur : lecture d'état + circuit de réparation selon repair_request_status.
// Monté seulement quand ouvert (état neuf à chaque ouverture). `item` est re-dérivé du store par le
// parent à chaque render → jamais de copie divergente. Le calcul de position { x, y } est fait par le
// parent (InventoryPanel), même découpage que SkillInfoPopover.
const PANEL_WIDTH = 300 // miroir : InventoryPanel utilise la même largeur pour placer la fenêtre

export default function IntegrityPopover({
  item, x, y, isGm, canEdit = true, hasCampaign = true, popoverRef, onClose,
  onSetIntegrity, onRollOccasion, onIntensiveUse, onRequestRepair, onCancelRepair,
}) {
  const { t } = useTranslation('charSheet')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [cur, setCur] = useState(() => (item?.integrity_current ?? ''))
  const [max, setMax] = useState(() => (item?.integrity_max ?? ''))
  const [preview, setPreview] = useState(null)

  const itemId = item?.id
  const repairStatus = item?.repair_request_status ?? null
  const canRepair = !isGm && canEdit && hasCampaign
  const repairable = item ? isRepairable(item) : false

  // Aperçu du Seuil de réparation — visage joueur, seulement si réparable et aucune demande en cours.
  useEffect(() => {
    if (!canRepair || !itemId || !repairable || repairStatus) { setPreview(null); return }
    let cancelled = false
    fetchRepairPreview(item.character_id, itemId)
      .then((p) => { if (!cancelled) setPreview(p) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [canRepair, itemId, item?.character_id, repairable, repairStatus])

  if (!item) return null

  const hasItg = item.integrity_current != null && item.integrity_max != null
  const tier = hasItg ? getIntegrityTier(item.integrity_current) : null
  const modifier = hasItg ? getIntegrityModifier(item.integrity_current) : null
  const broken = item.malfunction_severity != null
  const qMax = QUALITY_TABLE[item.ref_quality ?? DEFAULT_QUALITY]?.itgMax ?? QUALITY_TABLE[DEFAULT_QUALITY].itgMax

  const run = async (fn) => {
    setBusy(true); setErr(null)
    try { await fn() }
    catch (e) { setErr(e?.response?.data?.error?.message || t('inventoryPanel.integrity.popover.error')) }
    finally { setBusy(false) }
  }

  // Presets « État initial » — max préservé s'il existe, sinon plafond de la qualité ; courante bornée.
  const applyPreset = (targetCurrent, { horsUsage = false, neuf = false } = {}) => {
    const newMax = neuf ? qMax : (item.integrity_max ?? qMax)
    run(() => onSetIntegrity(itemId, {
      integrity_current: Math.min(targetCurrent, newMax),
      integrity_max: newMax,
      malfunction_severity: horsUsage ? 'critical' : null,
    }))
  }

  const saveRaw = () => run(() => onSetIntegrity(itemId, {
    integrity_current: cur === '' ? null : Number(cur),
    integrity_max: max === '' ? null : Number(max),
  }))

  const setStatus = (severity) => run(() => onSetIntegrity(itemId, { malfunction_severity: severity }))

  return (
    <div ref={popoverRef} className="itg-pop" style={{ top: y, left: x, width: PANEL_WIDTH }}>
      <div className="itg-pop-head">
        <span className="itg-pop-title">{item.custom_name || item.ref_name || t('inventoryPanel.unnamedItem')}</span>
        <button type="button" className="itg-pop-close" onClick={onClose}>×</button>
      </div>

      <div className="itg-pop-readout">
        {hasItg ? (
          <>
            <strong>{item.integrity_current}/{item.integrity_max}</strong>
            {' — '}
            {t(`inventoryPanel.integrity.tier.${tier.key}`)}
            {modifier != null && modifier !== 0 && <span className="itg-pop-mod"> ({modifier > 0 ? `+${modifier}` : modifier})</span>}
          </>
        ) : t('inventoryPanel.integrity.undefinedTooltip')}
        {broken && (
          <span className="itg-pop-broken">
            {item.malfunction_severity === 'critical'
              ? t('inventoryPanel.integrity.stateCritical')
              : t('inventoryPanel.integrity.stateSimple')}
          </span>
        )}
      </div>

      {isGm ? (
        <>
          <div className="itg-pop-section">
            <div className="itg-pop-label">{t('inventoryPanel.integrity.popover.initialState')}</div>
            <div className="itg-pop-btns">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => applyPreset(qMax, { neuf: true })}>{t('inventoryPanel.integrity.popover.presetNew')}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => onRollOccasion(itemId))}>{t('inventoryPanel.integrity.rollOccasion')}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => applyPreset(13)}>{t('inventoryPanel.integrity.popover.presetMoyen')}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => applyPreset(3)}>{t('inventoryPanel.integrity.popover.presetEndommage')}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => applyPreset(0, { horsUsage: true })}>{t('inventoryPanel.integrity.popover.presetHorsUsage')}</button>
            </div>
            <div className="itg-pop-raw">
              <input type="number" min="0" max="25" value={cur} disabled={busy}
                onChange={(e) => setCur(e.target.value)} aria-label={t('inventoryPanel.integrity.editCurrent')} />
              <span>/</span>
              <input type="number" min="1" max="25" value={max} disabled={busy}
                onChange={(e) => setMax(e.target.value)} aria-label={t('inventoryPanel.integrity.editMax')} />
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={saveRaw}>{t('inventoryPanel.integrity.save')}</button>
            </div>
          </div>

          <div className="itg-pop-section">
            <div className="itg-pop-label">{t('inventoryPanel.integrity.popover.statusSection')}</div>
            <div className="itg-pop-btns">
              <button type="button" className={`btn btn-ghost${!broken ? ' is-active' : ''}`} disabled={busy} onClick={() => setStatus(null)}>{t('inventoryPanel.integrity.stateOperational')}</button>
              <button type="button" className={`btn btn-ghost${item.malfunction_severity === 'simple' ? ' is-active' : ''}`} disabled={busy} onClick={() => setStatus('simple')}>{t('inventoryPanel.integrity.stateSimple')}</button>
              <button type="button" className={`btn btn-ghost${item.malfunction_severity === 'critical' ? ' is-active' : ''}`} disabled={busy} onClick={() => setStatus('critical')}>{t('inventoryPanel.integrity.stateCritical')}</button>
            </div>
          </div>

          <div className="itg-pop-section">
            <div className="itg-pop-label">{t('inventoryPanel.integrity.popover.actionsSection')}</div>
            <div className="itg-pop-btns">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => onIntensiveUse(itemId))}>{t('inventoryPanel.integrity.intensiveUse')}</button>
            </div>
          </div>
        </>
      ) : canRepair ? (
        <div className="itg-pop-section">
          <div className="itg-pop-label">{t('inventoryPanel.integrity.popover.repairSection')}</div>
          {repairStatus === 'pending_mj_review' && (
            <>
              <p className="itg-pop-note">{t('inventoryPanel.integrity.popover.repairPending')}</p>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => onCancelRepair(itemId))}>
                {t('inventoryPanel.integrity.popover.repairCancel')}
              </button>
            </>
          )}
          {repairStatus === 'awaiting_player_roll' && (
            <p className="itg-pop-note">{t('inventoryPanel.integrity.popover.repairApproved')}</p>
          )}
          {!repairStatus && repairable && (
            <>
              {preview && (
                <p className="itg-pop-note">
                  {preview.skillLabel} · {t('inventoryPanel.integrity.popover.threshold', { value: preview.threshold })}
                  {preview.ntMalus < 0 && ` · ${t('inventoryPanel.integrity.popover.ntMalus', { mod: preview.ntMalus })}`}
                </p>
              )}
              <div className="itg-pop-btns">
                <button type="button" className="btn btn-ghost" disabled title={t('inventoryPanel.integrity.popover.repairProDisabled')}>
                  {t('inventoryPanel.integrity.popover.repairPro')}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => onRequestRepair(itemId))}>
                  {t('inventoryPanel.integrity.popover.repairSelf')}
                </button>
              </div>
            </>
          )}
          {!repairStatus && !repairable && (
            <p className="itg-pop-note">{t('inventoryPanel.integrity.popover.notRepairable')}</p>
          )}
        </div>
      ) : null}

      {err && <div className="itg-pop-err">{err}</div>}
    </div>
  )
}
