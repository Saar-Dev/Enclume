import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../lib/api.js'

const WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']
const SLOT_LABELS  = { MG: 'Main G', MD: 'Main D', '2M': '2 mains', Tr: 'Trépied' }

function parseAmmoCount(ammoCount) {
  if (!ammoCount) return 0
  const match = ammoCount.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

export default function WeaponPanel({ characterId, canEdit, reloadKey, onInventoryMutated = () => {} }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [errors,  setErrors]  = useState({})  // { [itemId]: message }

  const [equipSlot,   setEquipSlot]   = useState('')
  const [equipItemId, setEquipItemId] = useState('')
  const [equipping,   setEquipping]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/char-sheet/${characterId}/inventory`)
      .then(res => { if (!cancelled) setItems(res.data.items || []) })
      .catch(err => console.error('Erreur chargement WeaponPanel :', err))
      .finally(() => { if (!cancelled) setLoading(false) })
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
      i.container !== 'Coffre' &&
      !i.slot,
    ),
    [items],
  )

  // ── Trouver le nom d'une munition chargée par son ref_equipment.id ──────────
  const ammoNameForRef = useCallback((refId) => {
    if (!refId) return null
    const ammoItem = items.find(i => i.equipment_id === refId)
    return ammoItem ? (ammoItem.custom_name || ammoItem.ref_name) : '(épuisée)'
  }, [items])

  // ── Quantité disponible d'ammo compatible avec une arme ────────────────────
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

  const clearError = (itemId) => setErrors(prev => { const n = { ...prev }; delete n[itemId]; return n })

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
    if (compatAmmos.length === 0) return  // échec silencieux
    const firstAmmo = compatAmmos[0]
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${weaponItem.id}`, {
        current_ammo: firstAmmo.equipment_id,
      })
      setItems(prev => prev.map(i => i.id === weaponItem.id ? res.data.item : i))
    } catch (err) {
      setErrors(prev => ({ ...prev, [weaponItem.id]: err.response?.data?.error?.message || 'Erreur rechargement' }))
    }
  }, [characterId, availableAmmoFor])

  const handleEquip = useCallback(async () => {
    if (!equipItemId || !equipSlot) return
    setEquipping(true)
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${equipItemId}`, { slot: equipSlot })
      setItems(prev => prev.map(i => i.id === equipItemId ? res.data.item : i))
      setEquipItemId('')
      setEquipSlot('')
      onInventoryMutated()
    } catch (err) {
      setErrors(prev => ({ ...prev, equip: err.response?.data?.error?.message || 'Erreur équipement' }))
    } finally {
      setEquipping(false)
    }
  }, [characterId, equipItemId, equipSlot, onInventoryMutated])

  // Quand l'item sélectionné change, pré-sélectionner le slot selon ref_location
  const handleSelectWeapon = useCallback((itemId) => {
    setEquipItemId(itemId)
    setErrors(prev => { const n = { ...prev }; delete n.equip; return n })
    if (!itemId) { setEquipSlot(''); return }
    const item = availableWeapons.find(i => i.id === itemId)
    if (!item) { setEquipSlot(''); return }
    const loc = item.ref_location || ''
    const isTwoHand = loc.split('/').some(l => l === '2M' || l === 'Tr')
    setEquipSlot(isTwoHand ? '2M' : 'MG')
  }, [availableWeapons])

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) return null

  if (equippedWeapons.length === 0 && (!canEdit || availableWeapons.length === 0)) {
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

      {/* ── Armes équipées ─────────────────────────────────────────────────── */}
      {equippedWeapons.map(weapon => {
        const compatAmmos    = availableAmmoFor(weapon)
        const totalAmmoQty   = compatAmmos.reduce((s, i) => s + i.quantity, 0)
        const ammoCount      = parseAmmoCount(weapon.ref_ammo_count)
        const ammoName       = ammoNameForRef(weapon.current_ammo)
        const hasCompatAmmo  = compatAmmos.length > 0

        return (
          <div key={weapon.id} style={s.weaponCard}>

            {/* Header arme */}
            <div style={s.weaponHeader}>
              <span style={s.slotBadge}>{SLOT_LABELS[weapon.slot] || weapon.slot}</span>
              <span style={s.weaponName}>{weapon.custom_name || weapon.ref_name || '—'}</span>
              {canEdit && (
                <button style={s.unequipBtn} onClick={() => handleUnequip(weapon)} title="Déséquiper">×</button>
              )}
            </div>

            {/* Stats arme */}
            <div style={s.statsRow}>
              {weapon.ref_damage_h && <span style={s.stat}><span style={s.statKey}>DMG</span> {weapon.ref_damage_h}</span>}
              {weapon.ref_shock    && <span style={s.stat}><span style={s.statKey}>CHC</span> {weapon.ref_shock}</span>}
              {weapon.ref_range    && <span style={s.stat}><span style={s.statKey}>PTÉ</span> {weapon.ref_range}</span>}
              {weapon.ref_fire_mode && <span style={s.stat}><span style={s.statKey}>TIR</span> {weapon.ref_fire_mode}</span>}
              {weapon.ref_caliber  && <span style={s.stat}><span style={s.statKey}>CAL</span> {weapon.ref_caliber}</span>}
            </div>

            {/* Munitions */}
            {weapon.ref_caliber && (
              <div style={s.ammoRow}>
                <span style={s.ammoLabel}>
                  {weapon.current_ammo
                    ? <span style={s.ammoName}>{ammoName}</span>
                    : <span style={s.ammoNone}>non chargée</span>
                  }
                  {ammoCount > 0 && (
                    <span style={{ color: '#4a4a60' }}>
                      {' '}— {Math.min(ammoCount, totalAmmoQty)}/{ammoCount} chargeur · {totalAmmoQty} en stock
                    </span>
                  )}
                </span>
                {canEdit && (
                  <button
                    style={{ ...s.reloadBtn, opacity: hasCompatAmmo ? 1 : 0.4 }}
                    onClick={() => handleReload(weapon)}
                    title={hasCompatAmmo ? 'Recharger' : 'Aucune munition compatible disponible'}
                  >
                    ↺ Recharger
                  </button>
                )}
              </div>
            )}

            {errors[weapon.id] && <div style={s.errorMsg}>{errors[weapon.id]}</div>}
          </div>
        )
      })}

      {/* ── Équiper une arme ───────────────────────────────────────────────── */}
      {canEdit && availableWeapons.length > 0 && (
        <div style={s.equipRow}>
          <select
            style={s.select}
            value={equipItemId}
            onChange={e => handleSelectWeapon(e.target.value)}
          >
            <option value="">— Équiper une arme —</option>
            {availableWeapons.map(i => (
              <option key={i.id} value={i.id}>{i.custom_name || i.ref_name}</option>
            ))}
          </select>

          {equipItemId && (
            <select
              style={{ ...s.select, width: 'auto', flexShrink: 0 }}
              value={equipSlot}
              onChange={e => setEquipSlot(e.target.value)}
            >
              {(() => {
                const item = availableWeapons.find(i => i.id === equipItemId)
                const loc  = item?.ref_location || ''
                const isTwoHand = loc.split('/').some(l => l === '2M' || l === 'Tr')
                if (isTwoHand) return [<option key="2M" value="2M">2 mains</option>]
                return [
                  <option key="MG" value="MG">Main G</option>,
                  <option key="MD" value="MD">Main D</option>,
                ]
              })()}
            </select>
          )}

          {equipItemId && (
            <button
              style={s.equipBtn}
              onClick={handleEquip}
              disabled={equipping || !equipSlot}
            >
              {equipping ? '…' : 'Équiper'}
            </button>
          )}
        </div>
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

  weaponCard: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 6,
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
  ammoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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

  equipRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  select: {
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
  equipBtn: {
    background: 'rgba(91,141,238,0.15)',
    border: '1px solid rgba(91,141,238,0.4)',
    borderRadius: 4,
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 10px',
    flexShrink: 0,
  },
}
