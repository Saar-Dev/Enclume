import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../lib/api.js'

const WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']
const SLOT_LABELS  = { MG: 'Main G', MD: 'Main D', '2M': '2 mains', Tr: 'Trépied' }

function parseAmmoCount(ammoCount) {
  if (!ammoCount) return 0
  const match = ammoCount.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

function getSlotInfo(refLocation) {
  const locs = (refLocation || '').split('/')
  if (locs.includes('M'))                          return { type: '1H',    defaultSlot: 'MG' }
  if (locs.includes('2M') && locs.includes('Tr')) return { type: '2M_Tr', defaultSlot: '2M' }
  if (locs.includes('2M'))                         return { type: '2M',    defaultSlot: '2M' }
  if (locs.includes('Tr'))                         return { type: 'Tr',    defaultSlot: 'Tr' }
  return { type: 'unknown', defaultSlot: '' }
}

function WeaponCard({ weapon, canEdit, compatAmmos, ammoName, ammoSelected, onAmmoSelect,
                      onReload, onUnequip, error }) {
  const totalAmmoQty  = compatAmmos.reduce((acc, i) => acc + i.quantity, 0)
  const ammoCount     = parseAmmoCount(weapon.ref_ammo_count)
  const hasCompatAmmo = compatAmmos.length > 0

  return (
    <div style={s.weaponCard}>
      <div style={s.weaponHeader}>
        <span style={s.slotBadge}>{SLOT_LABELS[weapon.slot] || weapon.slot}</span>
        <span style={s.weaponName}>{weapon.custom_name || weapon.ref_name || '—'}</span>
        {weapon.ref_description && (
          <span className="has-tooltip" data-tooltip={weapon.ref_description} style={s.infoIcon}>ⓘ</span>
        )}
        {weapon.slot === 'Tr' && (
          <span
            style={s.trWarning}
            title="Arme lourde sur trépied. Si le personnage n'est pas en position stable, la compétence est divisée par 2."
          >⚠ Trépied</span>
        )}
        {canEdit && (
          <button style={s.unequipBtn} onClick={() => onUnequip(weapon)} title="Déséquiper">×</button>
        )}
      </div>

      <div style={s.statsRow}>
        {weapon.ref_damage_h  && <span style={s.stat}><span style={s.statKey}>DMG</span> {weapon.ref_damage_h}</span>}
        {weapon.ref_shock     && <span style={s.stat}><span style={s.statKey}>CHC</span> {weapon.ref_shock}</span>}
        {weapon.ref_range     && <span style={s.stat}><span style={s.statKey}>PTÉ</span> {weapon.ref_range}</span>}
        {weapon.ref_fire_mode && <span style={s.stat}><span style={s.statKey}>TIR</span> {weapon.ref_fire_mode}</span>}
        {weapon.ref_caliber   && <span style={s.stat}><span style={s.statKey}>CAL</span> {weapon.ref_caliber}</span>}
      </div>

      {weapon.ref_caliber && (
        <div style={s.ammoSection}>
          <div style={s.ammoRow}>
            <span style={s.ammoLabel}>
              {weapon.current_ammo
                ? <span style={s.ammoName}>{ammoName}</span>
                : <span style={s.ammoNone}>non chargée</span>
              }
              {weapon.current_ammo && ammoCount > 0 && (() => {
                const remaining = weapon.ammo_remaining ?? ammoCount
                const isEmpty   = weapon.ammo_remaining === 0
                return (
                  <span style={{ color: isEmpty ? '#c86030' : '#4a4a60' }}>
                    {' '}— <span style={isEmpty ? { color: '#c86030', fontWeight: 600 } : {}}>{remaining}/{ammoCount}</span> chargeur · {totalAmmoQty} en stock
                  </span>
                )
              })()}
            </span>
          </div>
          {canEdit && (
            <div style={s.ammoReloadRow}>
              {compatAmmos.length > 1 && (
                <select
                  style={s.ammoSelect}
                  value={ammoSelected || compatAmmos[0]?.id || ''}
                  onChange={e => onAmmoSelect(e.target.value)}
                >
                  {compatAmmos.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.custom_name || a.ref_name} ({a.quantity} dispo)
                    </option>
                  ))}
                </select>
              )}
              <button
                style={{ ...s.reloadBtn, opacity: hasCompatAmmo ? 1 : 0.4 }}
                onClick={() => onReload(weapon)}
                title={hasCompatAmmo ? 'Recharger' : 'Aucune munition compatible disponible'}
              >
                ↺ Recharger
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div style={s.errorMsg}>{error}</div>}
    </div>
  )
}

export default function WeaponPanel({ characterId, canEdit, reloadKey, onInventoryMutated = () => {} }) {
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [errors,      setErrors]      = useState({})
  const [handPref,    setHandPref]    = useState('R')
  const [equipDir,    setEquipDir]    = useState('')
  const [equipSec,    setEquipSec]    = useState('')
  const [equip2MId,   setEquip2MId]   = useState('')
  const [equip2MSlot, setEquip2MSlot] = useState('2M')
  const [equipping,   setEquipping]   = useState(false)
  const [ammoSelected, setAmmoSelected] = useState({})

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const showSpinner = !hasLoadedRef.current
    if (showSpinner) setLoading(true)
    api.get(`/char-sheet/${characterId}/inventory`)
      .then(res => {
        if (!cancelled) {
          setItems(res.data.items || [])
          setHandPref(res.data.hand_pref || 'R')
        }
      })
      .catch(err => console.error('Erreur chargement WeaponPanel :', err))
      .finally(() => {
        hasLoadedRef.current = true
        if (!cancelled && showSpinner) setLoading(false)
      })
    return () => { cancelled = true }
  }, [characterId, reloadKey])

  // ── Données dérivées ────────────────────────────────────────────────────────

  const equippedWeapons = useMemo(
    () => items.filter(i => i.slot && WEAPON_SLOTS.includes(i.slot)),
    [items],
  )

  const availableWeapons = useMemo(
    () => items.filter(i =>
      i.ref_family === 'Armes' &&
      i.ref_location &&
      ['M', '2M', 'Tr'].some(loc => i.ref_location.split('/').includes(loc)) &&
      i.container !== 'Coffre',
    ),
    [items],
  )

  const isAmbi  = handPref === 'A'
  const dirSlot = handPref === 'L' ? 'MG' : 'MD'
  const secSlot = handPref === 'L' ? 'MD' : 'MG'

  const weaponDir = equippedWeapons.find(w => w.slot === dirSlot)
  const weaponSec = equippedWeapons.find(w => w.slot === secSlot)
  const weapon2M  = equippedWeapons.find(w => w.slot === '2M' || w.slot === 'Tr')

  const hasTrepied = useMemo(() => items.some(i =>
    i.container !== 'Coffre' &&
    i.ref_family !== 'Armes' &&
    (i.ref_location || '').split('/').includes('Tr')
  ), [items])

  const available1H = useMemo(
    () => availableWeapons.filter(i => getSlotInfo(i.ref_location).type === '1H'),
    [availableWeapons],
  )

  const available2M = useMemo(
    () => availableWeapons.filter(i =>
      ['2M', '2M_Tr', 'Tr'].includes(getSlotInfo(i.ref_location).type)
    ),
    [availableWeapons],
  )

  // ── Helpers ammo ────────────────────────────────────────────────────────────

  const ammoNameForRef = useCallback((refId) => {
    if (!refId) return null
    const ammoItem = items.find(i => i.equipment_id === refId)
    return ammoItem ? (ammoItem.custom_name || ammoItem.ref_name) : '(épuisée)'
  }, [items])

  const availableAmmoFor = useCallback((weapon) => {
    if (!weapon.ref_caliber) return []
    return items
      .filter(i =>
        i.ref_family === 'Munitions' &&
        i.ref_caliber === weapon.ref_caliber &&
        i.container !== 'Coffre',
      )
      .sort((a, b) => {
        const aName = (a.custom_name || a.ref_name || '').toLowerCase()
        const bName = (b.custom_name || b.ref_name || '').toLowerCase()
        const aStd = aName.includes('standard')
        const bStd = bName.includes('standard')
        if (aStd !== bStd) return aStd ? -1 : 1
        return aName.localeCompare(bName, 'fr')
      })
  }, [items])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearError = (key) => setErrors(prev => { const n = { ...prev }; delete n[key]; return n })

  const handleUnequip = useCallback(async (weaponItem) => {
    clearError(weaponItem.id)
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${weaponItem.id}`, { slot: null })
      setItems(prev => prev.map(i => i.id === weaponItem.id ? res.data.item : i))
      onInventoryMutated()
    } catch (err) {
      setErrors(prev => ({ ...prev, [weaponItem.id]: err.response?.data?.error?.message || 'Erreur déséquipement' }))
    }
  }, [characterId, onInventoryMutated])

  const handleReload = useCallback(async (weaponItem) => {
    clearError(weaponItem.id)
    const compatAmmos = availableAmmoFor(weaponItem)
    if (compatAmmos.length === 0) return
    const selectedId = ammoSelected[weaponItem.id] || compatAmmos[0].id
    try {
      const res = await api.post(`/char-sheet/${characterId}/inventory/${weaponItem.id}/reload`, {
        ammo_item_id: selectedId,
      })
      setItems(prev => prev.map(i => i.id === weaponItem.id ? res.data.item : i))
    } catch (err) {
      setErrors(prev => ({ ...prev, [weaponItem.id]: err.response?.data?.error?.message || 'Erreur rechargement' }))
    }
  }, [characterId, availableAmmoFor, ammoSelected])

  const handleEquipItem = useCallback(async (itemId, slot) => {
    if (!itemId || !slot) return
    const isTwoHand     = slot === '2M' || slot === 'Tr'
    const conflictSlots = isTwoHand ? ['MG', 'MD', '2M', 'Tr'] : [slot, '2M', 'Tr']
    const conflicts     = equippedWeapons.filter(w => w.id !== itemId && conflictSlots.includes(w.slot))
    setEquipping(true)
    try {
      for (const c of conflicts) {
        const r = await api.put(`/char-sheet/${characterId}/inventory/${c.id}`, { slot: null })
        setItems(prev => prev.map(i => i.id === c.id ? r.data.item : i))
      }
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot })
      setItems(prev => prev.map(i => i.id === itemId ? res.data.item : i))
      setEquipDir(''); setEquipSec(''); setEquip2MId('')
      setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
      onInventoryMutated()
    } catch (err) {
      setErrors(prev => ({ ...prev, equip: err.response?.data?.error?.message || 'Erreur équipement' }))
    } finally {
      setEquipping(false)
    }
  }, [characterId, equippedWeapons, onInventoryMutated])

  const handleSelect2M = useCallback((itemId) => {
    setEquip2MId(itemId)
    if (!itemId) { setEquip2MSlot('2M'); return }
    const item = available2M.find(i => i.id === itemId)
    setEquip2MSlot(getSlotInfo(item?.ref_location).defaultSlot || '2M')
  }, [available2M])

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) return null

  const hasAnything = equippedWeapons.length > 0 ||
    (canEdit && (available1H.length > 0 || available2M.length > 0))

  if (!hasAnything) {
    return (
      <div style={s.root}>
        <div style={s.separator} />
        <div style={s.emptyMsg}>Aucune arme équipée</div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.separator} />
      <div style={s.sectionLabel}>Armes équipées</div>

      {weapon2M ? (
        /* ── Mode DEUX MAINS ──────────────────────────────────────────────── */
        <div style={s.sectionTwoHands}>
          <div style={s.colHeader}>DEUX MAINS / TRÉPIED</div>
          <WeaponCard
            weapon={weapon2M}
            canEdit={canEdit}
            compatAmmos={availableAmmoFor(weapon2M)}
            ammoName={ammoNameForRef(weapon2M.current_ammo)}
            ammoSelected={ammoSelected[weapon2M.id]}
            onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weapon2M.id]: v }))}
            onReload={handleReload}
            onUnequip={handleUnequip}
            error={errors[weapon2M.id]}
          />
          {weapon2M.slot === 'Tr' && !hasTrepied && (
            <div style={s.warning}>⚠ Trépied absent du sac — malus actif</div>
          )}
          {weapon2M.slot === '2M' && hasTrepied &&
           getSlotInfo(weapon2M.ref_location).type === '2M_Tr' && (
            <div style={s.info}>Trépied disponible dans le sac</div>
          )}
        </div>
      ) : (
        /* ── Mode DIR / SEC ───────────────────────────────────────────────── */
        <>
          <div style={s.twoColGrid}>

            {/* Colonne DIRECTRICE */}
            <div style={s.col}>
              <div style={s.colHeader}>
                {isAmbi ? 'MAIN GAUCHE' : 'MAIN DIRECTRICE'}
              </div>
              {weaponDir ? (
                <WeaponCard
                  weapon={weaponDir}
                  canEdit={canEdit}
                  compatAmmos={availableAmmoFor(weaponDir)}
                  ammoName={ammoNameForRef(weaponDir.current_ammo)}
                  ammoSelected={ammoSelected[weaponDir.id]}
                  onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weaponDir.id]: v }))}
                  onReload={handleReload}
                  onUnequip={handleUnequip}
                  error={errors[weaponDir.id]}
                />
              ) : canEdit && available1H.length > 0 && (
                <div style={s.equipCol}>
                  <select
                    style={s.select}
                    value={equipDir}
                    onChange={e => setEquipDir(e.target.value)}
                  >
                    <option value="">— Équiper —</option>
                    {available1H.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.custom_name || i.ref_name}
                      </option>
                    ))}
                  </select>
                  <button
                    style={s.equipBtn}
                    onClick={() => handleEquipItem(equipDir, dirSlot)}
                    disabled={!equipDir || equipping}
                  >
                    Équiper
                  </button>
                </div>
              )}
            </div>

            {/* Colonne SECONDAIRE */}
            <div style={s.col}>
              <div style={s.colHeader}>
                {isAmbi
                  ? 'MAIN DROITE'
                  : <>{weaponSec && <span style={s.malusNote}>−5 </span>}MAIN SECONDAIRE</>
                }
              </div>
              {weaponSec ? (
                <WeaponCard
                  weapon={weaponSec}
                  canEdit={canEdit}
                  compatAmmos={availableAmmoFor(weaponSec)}
                  ammoName={ammoNameForRef(weaponSec.current_ammo)}
                  ammoSelected={ammoSelected[weaponSec.id]}
                  onAmmoSelect={v => setAmmoSelected(prev => ({ ...prev, [weaponSec.id]: v }))}
                  onReload={handleReload}
                  onUnequip={handleUnequip}
                  error={errors[weaponSec.id]}
                />
              ) : canEdit && available1H.length > 0 && (
                <div style={s.equipCol}>
                  <select
                    style={s.select}
                    value={equipSec}
                    onChange={e => setEquipSec(e.target.value)}
                  >
                    <option value="">— Équiper —</option>
                    {available1H.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.custom_name || i.ref_name}
                      </option>
                    ))}
                  </select>
                  <button
                    style={s.equipBtn}
                    onClick={() => handleEquipItem(equipSec, secSlot)}
                    disabled={!equipSec || equipping}
                  >
                    Équiper
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Section DEUX MAINS (toujours visible si armes dispo) */}
          {canEdit && available2M.length > 0 && (
            <div style={s.sectionTwoHands}>
              <div style={s.colHeader}>DEUX MAINS / TRÉPIED</div>
              <div style={s.equipCol}>
                <select
                  style={s.select}
                  value={equip2MId}
                  onChange={e => handleSelect2M(e.target.value)}
                >
                  <option value="">— Équiper arme 2 mains / trépied —</option>
                  {available2M.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.custom_name || i.ref_name}
                    </option>
                  ))}
                </select>
                {equip2MId &&
                 getSlotInfo(available2M.find(i => i.id === equip2MId)?.ref_location).type === '2M_Tr' && (
                  <select
                    style={{ ...s.select, width: 'auto', flexShrink: 0 }}
                    value={equip2MSlot}
                    onChange={e => setEquip2MSlot(e.target.value)}
                  >
                    <option value="2M">2 mains (sans trépied)</option>
                    <option value="Tr">Trépied</option>
                  </select>
                )}
                <button
                  style={s.equipBtn}
                  onClick={() => handleEquipItem(equip2MId, equip2MSlot)}
                  disabled={!equip2MId || equipping}
                >
                  Équiper
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {errors.equip && <div style={s.errorMsg}>{errors.equip}</div>}
    </div>
  )
}

const s = {
  root:         { marginTop: 0 },
  separator:    { height: 1, backgroundColor: '#2a2a3e', margin: '12px 0' },
  sectionLabel: { fontSize: 10, color: '#4a4a60', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  emptyMsg:     { fontSize: 12, color: '#3a3a5a', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' },

  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 6,
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  colHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  malusNote: {
    fontSize: 9,
    color: '#e8a020',
  },
  sectionTwoHands: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 2,
  },
  equipCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  warning: {
    fontSize: 10,
    color: '#e8a020',
  },
  info: {
    fontSize: 10,
    color: '#4caf77',
  },

  weaponCard: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  weaponHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  slotBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: 'rgba(91,141,238,0.12)',
    border: '1px solid rgba(91,141,238,0.25)',
    borderRadius: 3,
    padding: '1px 5px',
    flexShrink: 0,
  },
  weaponName: {
    flex: 1,
    fontSize: 12,
    color: '#c0c0d0',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  unequipBtn: {
    background: 'none', border: 'none', color: '#5a5a7a',
    cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    fontSize: 11,
    color: '#9090a8',
  },
  statKey: {
    fontSize: 9,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginRight: 2,
  },
  ammoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  ammoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ammoReloadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  ammoSelect: {
    flex: 1,
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 11,
    padding: '3px 4px',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 0,
  },
  ammoLabel: {
    flex: 1,
    fontSize: 11,
    color: '#9090a8',
    minWidth: 0,
  },
  ammoName: {
    color: '#4caf77',
  },
  ammoNone: {
    color: '#5a5a7a',
    fontStyle: 'italic',
  },
  reloadBtn: {
    background: 'rgba(91,141,238,0.1)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: 4,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 8px',
    flexShrink: 0,
  },
  errorMsg: {
    fontSize: 10,
    color: '#e05c5c',
  },

  select: {
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 11,
    padding: '3px 4px',
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
  },
  equipBtn: {
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.4)',
    borderRadius: 4,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 10px',
    alignSelf: 'flex-start',
  },
  trWarning: {
    fontSize: 10,
    color: '#e8a020',
    cursor: 'default',
    flexShrink: 0,
  },
  infoIcon: {
    fontSize: 10,
    color: '#4a4a60',
    cursor: 'default',
    flexShrink: 0,
    lineHeight: 1,
  },
}
