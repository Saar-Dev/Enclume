import { useState, useCallback } from 'react'
import { ARMOR_CATEGORY_MALUS } from '../../../shared/armorConstants.js'
import api from '../lib/api.js'

export default function ContainerPanel({ type, label, items, characterId, canEdit, onInventoryChange }) {
  const [equipError, setEquipError] = useState(null)

  const equippedItem   = items.find(i => i.slot === type)
  const availableItems = items.filter(i => i.ref_location === type && i.slot === null)

  const handleEquip = useCallback(async (itemId) => {
    setEquipError(null)
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot: type })
      onInventoryChange(res.data.item)
    } catch (err) {
      setEquipError(err.response?.data?.error || 'Impossible d\'équiper')
    }
  }, [characterId, type, onInventoryChange])

  const handleUnequip = useCallback(async () => {
    if (!equippedItem) return
    setEquipError(null)
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${equippedItem.id}`, { slot: null })
      onInventoryChange(res.data.item)
    } catch (err) {
      setEquipError(err.response?.data?.error || 'Impossible de déséquiper')
    }
  }, [characterId, equippedItem, onInventoryChange])

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.headerLabel}>{label}</span>
      </div>

      {equippedItem ? (
        <div style={s.equippedRow}>
          <div style={s.equippedName} title={equippedItem.custom_name || equippedItem.ref_name}>
            {equippedItem.custom_name || equippedItem.ref_name || '—'}
          </div>
          <div style={s.equippedStats}>
            {equippedItem.ref_capacity   != null && <span>{equippedItem.ref_capacity} kg</span>}
            {equippedItem.ref_waterproof != null && <span>{equippedItem.ref_waterproof ? 'Étanche' : 'Non étanche'}</span>}
            {equippedItem.ref_malus_cat  && <span>{equippedItem.ref_malus_cat}/{ARMOR_CATEGORY_MALUS[equippedItem.ref_malus_cat]}</span>}
          </div>
          {canEdit && (
            <button style={s.unequipBtn} onClick={handleUnequip} title="Déséquiper">×</button>
          )}
        </div>
      ) : canEdit ? (
        <select
          style={s.select}
          value=""
          onChange={e => { if (e.target.value) handleEquip(e.target.value) }}
        >
          <option value="">— Équiper —</option>
          {availableItems.map(i => (
            <option key={i.id} value={i.id}>{i.custom_name || i.ref_name}</option>
          ))}
        </select>
      ) : (
        <span style={s.empty}>Aucun {label.toLowerCase()}</span>
      )}

      {equipError && <div style={s.equipError}>{equipError}</div>}
    </div>
  )
}

const s = {
  panel: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#9090a8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  equippedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#0e0e1a',
    borderRadius: 4,
    padding: '3px 6px',
    minHeight: 24,
  },
  equippedName: {
    flex: 1,
    fontSize: 11,
    color: '#c0c0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  equippedStats: {
    display: 'flex',
    gap: 6,
    fontSize: 10,
    color: '#5b8dee',
    flexShrink: 0,
  },
  unequipBtn: {
    background: 'none',
    border: 'none',
    color: '#5a5a7a',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    padding: '0 2px',
    flexShrink: 0,
  },
  select: {
    width: '100%',
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#7070a0',
    fontSize: 11,
    padding: '3px 4px',
    cursor: 'pointer',
    outline: 'none',
  },
  empty: {
    fontSize: 10,
    color: '#3a3a5a',
    fontStyle: 'italic',
  },
  equipError: {
    fontSize: 10,
    color: '#e05c5c',
  },
}
