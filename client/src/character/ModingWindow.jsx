import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useDraggable } from '../lib/useDraggable.js'
import { useModingRefreshSync } from '../lib/useModingRefreshSync.js'

// ModingWindow — docs/PLAN_MODING.md Phase A : installation d'un module d'arme (accessoire)
// depuis l'inventaire sur une arme. Rangement pur, aucun effet mécanique (Phase B, hors scope).
// Pattern TradeWindow.jsx (fenêtre flottante indépendante, useDraggable, suffixe "Window").

const PANEL_W = 460

export default function ModingWindow({ characterId, canEdit, onClose }) {
  const { t } = useTranslation('charSheet')
  const { pos, onHeaderMouseDown } = useDraggable(
    'moding-window-pos',
    { top: 100, left: window.innerWidth - PANEL_W - 60 },
    PANEL_W,
  )
  // PLAN_INVENTORY_UX.md §3.2 — signal local, ne dépend plus du reloadKey hérité de CharacterWindow.
  const reloadKey = useModingRefreshSync(characterId)

  const [weapons,         setWeapons]         = useState([])
  const [installableMods, setInstallableMods] = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedId,      setSelectedId]      = useState(null)
  const [installingId,    setInstallingId]    = useState(null)
  const [errorMsg,        setErrorMsg]        = useState(null)

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const showSpinner = !hasLoadedRef.current
    if (showSpinner) setLoading(true)
    api.get(`/char-sheet/${characterId}/moding/state`)
      .then(res => {
        if (cancelled) return
        setWeapons(res.data.weapons)
        setInstallableMods(res.data.installableMods)
      })
      .catch(err => console.error('Erreur chargement moding :', err))
      .finally(() => {
        hasLoadedRef.current = true
        if (!cancelled && showSpinner) setLoading(false)
      })
    return () => { cancelled = true }
  }, [characterId, reloadKey])

  // Sélection par défaut / purge si l'arme sélectionnée disparaît (retirée de l'inventaire)
  useEffect(() => {
    if (weapons.length === 0) { setSelectedId(null); return }
    if (!weapons.some(w => w.id === selectedId)) setSelectedId(weapons[0].id)
  }, [weapons, selectedId])

  const handleInstall = useCallback(async (modInvId) => {
    if (!selectedId || installingId) return
    setInstallingId(modInvId)
    setErrorMsg(null)
    try {
      const res = await api.post(`/char-sheet/${characterId}/moding/install`, {
        weaponInvId: selectedId,
        modInvId,
      })
      setWeapons(res.data.weapons)
      setInstallableMods(res.data.installableMods)
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || t('modingWindow.installError'))
    } finally {
      setInstallingId(null)
    }
  }, [characterId, selectedId, installingId, t])

  const selectedWeapon = weapons.find(w => w.id === selectedId) ?? null

  return (
    <div className="combat-win moding-window" style={{ width: PANEL_W, left: pos.left, top: pos.top }}>

      <div className="combat-win-header" onMouseDown={onHeaderMouseDown}>
        <span className="combat-win-title">
          {t('modingWindow.title', {
            weaponsLabel: t('modingWindow.weaponsCount', { count: weapons.length }),
            modsLabel: t('modingWindow.modsInstallableCount', { count: installableMods.length }),
          })}
        </span>
        <button className="btn btn-icon" onClick={onClose} title={t('common.closeButton')}>✕</button>
      </div>

      {loading ? (
        <div className="moding-empty">{t('common.loading')}</div>
      ) : (
        <div className="combat-win-body moding-body">

          <div className="moding-weapons">
            {weapons.length === 0 && <div className="moding-empty">{t('modingWindow.noWeaponInInventory')}</div>}
            {weapons.map(w => (
              <div
                key={w.id}
                className={`moding-weapon-row${w.id === selectedId ? ' moding-weapon-row-active' : ''}`}
                onClick={() => setSelectedId(w.id)}
              >
                {w.name}
                {w.installed_mods.length > 0 && ` (${w.installed_mods.length})`}
              </div>
            ))}
          </div>

          <div className="moding-detail">
            {!selectedWeapon && <div className="moding-empty">{t('modingWindow.selectWeapon')}</div>}
            {selectedWeapon && (
              <>
                <span className="combat-win-section-title">{t('modingWindow.installedModsTitle')}</span>
                {selectedWeapon.installed_mods.length === 0 && (
                  <div className="moding-empty">{t('modingWindow.noModInstalled')}</div>
                )}
                {selectedWeapon.installed_mods.map(m => (
                  <div key={m.id} className="moding-mod-row">
                    <span>{m.mod_name}</span>
                  </div>
                ))}

                <span className="combat-win-section-title" style={{ marginTop: '10px', display: 'block' }}>
                  {t('modingWindow.availableModsTitle')}
                </span>
                {installableMods.length === 0 && (
                  <div className="moding-empty">{t('modingWindow.noModInInventory')}</div>
                )}
                {installableMods.map(m => (
                  <div key={m.id} className="moding-mod-row">
                    <span>{m.name}</span>
                    {canEdit && (
                      <button
                        className="btn btn-gold"
                        disabled={installingId === m.id}
                        onClick={() => handleInstall(m.id)}
                      >
                        {installingId === m.id ? '…' : t('modingWindow.installButton')}
                      </button>
                    )}
                  </div>
                ))}
                {errorMsg && <div className="moding-error">{errorMsg}</div>}
              </>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
