import { useState, useCallback } from 'react'
import {
  WOUND_SEVERITIES, WOUND_MAX_COUNTS, SEVERITY_COLORS,
} from '../../../shared/woundConstants.js'
import {
  ARMOR_CATEGORY_MALUS, LOCATION_TO_SLOT, LOCATION_LABELS, SLOT_TO_REF_LOCATION,
} from '../../../shared/armorConstants.js'
import api from '../lib/api.js'

const SEVERITY_LABELS = {
  legere: 'Lég', moyenne: 'Moy', grave: 'Gra', critique: 'Crit', mortelle: 'Mort',
}

function calcMillefeuille(items, field) {
  const vals = items.map(i => i[field] ?? 0).filter(v => v > 0)
  if (!vals.length) return null
  const max  = Math.max(...vals)
  const rest = vals.reduce((s, v) => s + v, 0) - max
  return max + rest / 2
}

function fmt(n) {
  return n % 1 === 0 ? n : n.toFixed(1)
}

export default function LocationPanel({
  location,
  items,
  wounds,
  characterId,
  canEdit,
  onInventoryChange,
  onWoundsReload,
}) {
  const slotCode = LOCATION_TO_SLOT[location]
  const label    = LOCATION_LABELS[location]
  const refCode  = SLOT_TO_REF_LOCATION[slotCode] ?? slotCode

  const [lastAddedWoundId, setLastAddedWoundId] = useState(null)
  const [equipError,       setEquipError]       = useState(null)

  // ── Armures équipées à ce slot ─────────────────────────────────────────────
  const equippedItems = items.filter(i => i.slot?.split('/')?.includes(slotCode))
  const hasNonS       = equippedItems.some(i => i.ref_malus_cat && i.ref_malus_cat !== 'S')

  const availableItems = items.filter(i =>
    i.ref_location?.split('/').includes(refCode) &&
    i.container === 'Sac' &&
    !(i.slot?.split('/')?.includes(slotCode)) &&
    (!hasNonS || i.ref_malus_cat === 'S' || i.ref_malus_cat == null),
  )

  // ── Mille-feuille ──────────────────────────────────────────────────────────
  const finalProt = calcMillefeuille(equippedItems, 'ref_protection')
  const finalChoc = calcMillefeuille(equippedItems, 'ref_protection_shock')
  const worstMalusEntry = equippedItems
    .filter(i => i.ref_malus_cat)
    .sort((a, b) => (ARMOR_CATEGORY_MALUS[a.ref_malus_cat] ?? 0) - (ARMOR_CATEGORY_MALUS[b.ref_malus_cat] ?? 0))[0]
  const worstMalusLabel = worstMalusEntry?.ref_malus_cat ?? null
  const worstMalusVal   = worstMalusLabel != null ? ARMOR_CATEGORY_MALUS[worstMalusLabel] : null

  // ── Handlers armure ────────────────────────────────────────────────────────
  const handleEquip = useCallback(async (itemId) => {
    setEquipError(null)
    const item = items.find(i => i.id === itemId)
    const existingParts = item?.slot ? item.slot.split('/') : []
    const newSlot = [...new Set([...existingParts, slotCode])].join('/')
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot: newSlot })
      onInventoryChange(res.data.item)
    } catch (err) {
      setEquipError(err.response?.data?.error || 'Impossible d\'équiper')
    }
  }, [characterId, slotCode, items, onInventoryChange])

  const handleUnequip = useCallback(async (itemId) => {
    setEquipError(null)
    const item = items.find(i => i.id === itemId)
    const remaining = (item?.slot || '').split('/').filter(s => s !== slotCode)
    const newSlot = remaining.length > 0 ? remaining.join('/') : null
    try {
      const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot: newSlot })
      onInventoryChange(res.data.item)
    } catch (err) {
      setEquipError(err.response?.data?.error || 'Impossible de déséquiper')
    }
  }, [characterId, slotCode, items, onInventoryChange])

  // ── Handlers blessures ─────────────────────────────────────────────────────
  const woundsHere = wounds.filter(w => w.location === location)

  const handleBoxClick = useCallback(async (severity, index) => {
    if (!canEdit) return
    const woundsOfSev = woundsHere.filter(w => w.severity === severity)
    const wound       = woundsOfSev[index]
    try {
      if (!wound) {
        const res = await api.post(`/char-sheet/${characterId}/wounds`, { location, severity })
        setLastAddedWoundId(res.data.shock_test_required ? res.data.wound.id : null)
        onWoundsReload()
      } else if (!wound.is_stabilized) {
        await api.put(`/char-sheet/${characterId}/wounds/${wound.id}/stabilize`)
        onWoundsReload()
      } else {
        await api.delete(`/char-sheet/${characterId}/wounds/${wound.id}`)
        onWoundsReload()
      }
    } catch (err) {
      console.error('Erreur blessure LocationPanel :', err)
    }
  }, [canEdit, woundsHere, characterId, location, onWoundsReload])

  // ── Pire blessure pour le header ───────────────────────────────────────────
  const worstSev = woundsHere.length > 0
    ? WOUND_SEVERITIES[Math.max(...woundsHere.map(w => WOUND_SEVERITIES.indexOf(w.severity)))]
    : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.panel}>

      {/* Header */}
      <div style={s.header}>
        {worstSev && <span style={{ ...s.headerDot, background: SEVERITY_COLORS[worstSev] }} />}
        <span style={s.headerLabel}>{label}</span>
      </div>

      {/* Armure */}
      <div style={s.armorSection}>

        {/* Ligne agrégée mille-feuille — visible si ≥1 couche */}
        {equippedItems.length > 0 && (
          <div style={s.aggregateRow}>
            {finalProt != null && <span>ETQ {fmt(finalProt)}</span>}
            {finalChoc != null && <span>PRT {fmt(finalChoc)}</span>}
            {worstMalusLabel && worstMalusVal !== 0 && <span>{worstMalusLabel}/{worstMalusVal}</span>}
          </div>
        )}

        {/* Couches individuelles */}
        {equippedItems.map(item => (
          <div key={item.id} style={s.equippedRow}>
            <div style={s.equippedName} title={item.custom_name || item.ref_name}>
              {item.custom_name || item.ref_name || '—'}
            </div>
            <div style={s.equippedStats}>
              {item.ref_protection       != null && <span>E{item.ref_protection}</span>}
              {item.ref_protection_shock != null && <span>P{item.ref_protection_shock}</span>}
              {item.ref_malus_cat && <span>{item.ref_malus_cat}</span>}
            </div>
            {canEdit && (
              <button style={s.unequipBtn} onClick={() => handleUnequip(item.id)} title="Déséquiper">×</button>
            )}
          </div>
        ))}

        {/* Dropdown ajout couche */}
        {canEdit && equippedItems.length < 3 && (
          availableItems.length > 0 ? (
            <select
              style={s.select}
              value=""
              onChange={e => { if (e.target.value) handleEquip(e.target.value) }}
            >
              <option value="">
                {equippedItems.length === 0 ? '— Équiper —' : (hasNonS ? '+ Couche S' : '+ Couche')}
              </option>
              {availableItems.map(i => (
                <option key={i.id} value={i.id}>{i.custom_name || i.ref_name}</option>
              ))}
            </select>
          ) : equippedItems.length === 0 ? (
            <span style={s.emptySlot}>Aucune armure</span>
          ) : null
        )}
        {!canEdit && equippedItems.length === 0 && (
          <span style={s.emptySlot}>Aucune armure</span>
        )}

        {equipError && <div style={s.equipError}>{equipError}</div>}
      </div>

      {/* Grille blessures */}
      <div style={s.woundGrid}>
        {WOUND_SEVERITIES.map(sev => {
          const maxCount    = WOUND_MAX_COUNTS[location]?.[sev] ?? 0
          const woundsOfSev = woundsHere.filter(w => w.severity === sev)
          return (
            <div key={sev} style={s.woundRow}>
              <span style={s.sevLabel}>{SEVERITY_LABELS[sev]}</span>
              <div style={s.boxes}>
                {Array.from({ length: maxCount }).map((_, i) => {
                  const w       = woundsOfSev[i]
                  const isShock = w && w.id === lastAddedWoundId
                  return (
                    <div
                      key={i}
                      onClick={() => handleBoxClick(sev, i)}
                      title={
                        w
                          ? (w.is_stabilized ? 'Stabilisée — cliquer pour guérir' : 'Blessure — cliquer pour stabiliser')
                          : (canEdit ? 'Vide — cliquer pour ajouter' : '')
                      }
                      style={{
                        width: 13, height: 13,
                        border: `1px solid ${w ? '#fff' : '#2a2a3e'}`,
                        background: w ? SEVERITY_COLORS[sev] : 'transparent',
                        cursor: canEdit ? 'pointer' : 'default',
                        borderRadius: 2,
                        position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8,
                        boxShadow: w?.is_stabilized ? '0 0 4px #00ff00' : 'none',
                        flexShrink: 0,
                      }}
                    >
                      {w?.is_stabilized && <span style={{ color: '#00ff00', lineHeight: 1 }}>✓</span>}
                      {isShock && !w?.is_stabilized && (
                        <span style={{
                          color: '#FFA500', position: 'absolute',
                          top: -6, right: -4, fontSize: 9, fontWeight: 'bold',
                        }}>!</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

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
    gap: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  headerDot: {
    width: 8, height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#9090a8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  armorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  aggregateRow: {
    display: 'flex',
    gap: 8,
    fontSize: 11,
    color: '#c0c0d8',
    padding: '2px 6px',
    background: '#12122a',
    borderRadius: 3,
    flexWrap: 'wrap',
  },
  equippedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#0e0e1a',
    borderRadius: 4,
    padding: '3px 6px',
    minHeight: 22,
  },
  equippedName: {
    flex: 1,
    fontSize: 10,
    color: '#c0c0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  equippedStats: {
    display: 'flex',
    gap: 4,
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
  emptySlot: {
    fontSize: 10,
    color: '#3a3a5a',
    fontStyle: 'italic',
  },
  equipError: {
    fontSize: 10,
    color: '#e05c5c',
  },
  woundGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingTop: 2,
    borderTop: '1px solid #1e1e2e',
  },
  woundRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  sevLabel: {
    fontSize: 9,
    color: '#5a5a7a',
    width: 26,
    flexShrink: 0,
    textAlign: 'right',
  },
  boxes: {
    display: 'flex',
    gap: 2,
    flexWrap: 'wrap',
  },
}
